import { createClient } from 'npm:@supabase/supabase-js@2.91.0'
import { DateTime } from 'npm:luxon@3.7.2'
import webpush from 'npm:web-push@3.6.7'

type Repeat = {
  type: 'day' | 'week' | 'month' | 'year'
  interval: number
  days?: number[]
  mode?: 'scheduled' | 'completed'
  endDate?: string
}

type Task = {
  id: string
  title: string
  date: string
  time?: string
  duration?: number
  reminder?: number | null
  repeat?: Repeat | null
  recurrence?: string
  completedAt?: number | null
  completions?: Record<string, number>
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

function adminKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  return keys.default || ''
}

function parseDate(value: string) {
  return DateTime.fromISO(value, { zone: 'utc' }).startOf('day')
}

function dayDiff(from: string, to: string) {
  return Math.round(parseDate(to).diff(parseDate(from), 'days').days)
}

function weekStart(value: string) {
  return parseDate(value).startOf('week')
}

function normalizeRepeat(task: Task): Repeat | null {
  if (task.repeat) return {
    type: task.repeat.type || 'day',
    interval: Math.max(1, Number(task.repeat.interval) || 1),
    days: Array.isArray(task.repeat.days) ? task.repeat.days.map(Number) : [],
    mode: task.repeat.mode === 'completed' ? 'completed' : 'scheduled',
    endDate: task.repeat.endDate || ''
  }
  if (task.recurrence === 'daily') return { type: 'day', interval: 1, days: [], mode: 'scheduled' }
  if (task.recurrence === 'weekdays') return { type: 'week', interval: 1, days: [1, 2, 3, 4, 5], mode: 'scheduled' }
  if (task.recurrence === 'weekly') return { type: 'week', interval: 1, days: [parseDate(task.date).weekday % 7], mode: 'scheduled' }
  return null
}

function taskOccursOn(task: Task, date: string) {
  if (!task?.date || date < task.date) return false
  const repeat = normalizeRepeat(task)
  if (!repeat) return task.date === date && !task.completedAt
  if (repeat.endDate && date > repeat.endDate) return false
  if (repeat.mode === 'completed') return task.date === date
  if (task.completions?.[date]) return false
  const elapsed = dayDiff(task.date, date)
  if (repeat.type === 'day') return elapsed % repeat.interval === 0
  if (repeat.type === 'week') {
    const weeks = Math.floor(weekStart(date).diff(weekStart(task.date), 'weeks').weeks)
    const sundayIndex = parseDate(date).weekday % 7
    return weeks >= 0 && weeks % repeat.interval === 0 && (repeat.days || []).includes(sundayIndex)
  }
  if (repeat.type === 'month') {
    const start = parseDate(task.date)
    const current = parseDate(date)
    const months = (current.year - start.year) * 12 + current.month - start.month
    const expectedDay = Math.min(start.day, current.daysInMonth || start.day)
    return months >= 0 && months % repeat.interval === 0 && current.day === expectedDay
  }
  const start = parseDate(task.date)
  const current = parseDate(date)
  const expectedDay = Math.min(start.day, current.set({ month: start.month }).daysInMonth || start.day)
  return (current.year - start.year) % repeat.interval === 0 && current.month === start.month && current.day === expectedDay
}

async function deliveryKey(endpoint: string, taskId: string, date: string, reminder: number) {
  const bytes = new TextEncoder().encode(`${endpoint}|${taskId}|${date}|${reminder}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function dueNow(task: Task, zone: string, now: DateTime) {
  if (!task.time || task.reminder == null) return null
  const localNow = now.setZone(zone)
  const date = localNow.toISODate()
  if (!date || !taskOccursOn(task, date)) return null
  const due = DateTime.fromISO(`${date}T${task.time}`, { zone }).minus({ minutes: Number(task.reminder) || 0 }).toUTC()
  const seconds = now.diff(due, 'seconds').seconds
  return seconds >= 0 && seconds < 90 ? date : null
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    if (!Deno.env.get('CRON_SECRET') || request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const url = Deno.env.get('SUPABASE_URL') || ''
    const key = adminKey()
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || ''
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'
    if (!url || !key || !vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'Missing server configuration' }), { status: 500, headers: jsonHeaders })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: states, error: stateError } = await supabase.from('user_state').select('user_id,payload,timezone')
    if (stateError) return new Response(JSON.stringify({ error: stateError.message }), { status: 500, headers: jsonHeaders })

    const now = DateTime.utc()
    let sent = 0
    let failed = 0
    for (const row of states || []) {
      const tasks = Array.isArray(row.payload?.tasks) ? row.payload.tasks as Task[] : []
      const zone = row.timezone || 'UTC'
      const dueTasks = tasks.map((task) => ({ task, date: dueNow(task, zone, now) })).filter((item) => item.date)
      if (!dueTasks.length) continue

      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .eq('user_id', row.user_id)
        .eq('active', true)

      for (const { task, date } of dueTasks) {
        for (const subscription of subscriptions || []) {
          const keyValue = await deliveryKey(subscription.endpoint, task.id, date!, Number(task.reminder) || 0)
          const { data: delivered } = await supabase.from('push_deliveries').select('delivery_key').eq('delivery_key', keyValue).maybeSingle()
          if (delivered) continue
          try {
            await webpush.sendNotification({
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth }
            }, JSON.stringify({
              title: task.title,
              body: `${task.time} · ${Number(task.duration) || 0} min`,
              tag: `task-${task.id}-${date}`,
              url: `./?date=${date}`
            }))
            await supabase.from('push_deliveries').insert({
              delivery_key: keyValue, user_id: row.user_id, task_id: task.id, occurrence_date: date
            })
            sent += 1
          } catch (error) {
            failed += 1
            const status = Number((error as { statusCode?: number }).statusCode || 0)
            if (status === 404 || status === 410) {
              await supabase.from('push_subscriptions').update({ active: false }).eq('endpoint', subscription.endpoint)
            }
          }
        }
      }
    }

    await supabase.from('push_deliveries').delete().lt('sent_at', now.minus({ days: 45 }).toISO())
    return new Response(JSON.stringify({ ok: true, sent, failed }), { headers: jsonHeaders })
  }
}
