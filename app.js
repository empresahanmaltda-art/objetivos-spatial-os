(() => {
  'use strict';

  const STORAGE_KEY = 'objetivos-spatial-os-v2';
  const LEGACY_KEY = 'objetivos-spatial-os-v1';
  const CHANNEL_NAME = 'objetivos-spatial-os-sync';
  const ROUTINE_VERSION = 1;
  const NOTIFICATION_LOG_KEY = 'objetivos-spatial-os-notifications-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const INSTANCE_ID = uid('tab');
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function localISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseISO(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function addDays(value, amount) {
    const date = parseISO(value);
    date.setDate(date.getDate() + amount);
    return localISO(date);
  }

  function dayDiff(from, to) {
    return Math.round((parseISO(to) - parseISO(from)) / 86400000);
  }

  function formatLongDate(value) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseISO(value));
  }

  function formatShortDate(value) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(parseISO(value)).replace('.', '');
  }

  function formatPickerDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseISO(value));
  }

  function formatDayLabel(value) {
    const today = localISO();
    if (value === today) return 'Hoje';
    if (value === addDays(today, 1)) return 'Amanhã';
    if (value === addDays(today, -1)) return 'Ontem';
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(parseISO(value));
  }

  function minutesFromTime(value) {
    if (!value) return Number.POSITIVE_INFINITY;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  function formatDuration(value) {
    const minutes = Number(value) || 0;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }

  const themePresets = {
    spatial: { label: 'Spatial', accent: '#79aef0', background: '#302c28', glass: '#48423b', module: '#1e1c19', glow: '#958b7f', intensity: 62, glassOpacity: 82, moduleOpacity: 84, glassBlur: 28, themeColor: '#171614' },
    warm: { label: 'Quente', accent: '#ff9b61', background: '#27231f', glass: '#413a34', module: '#1f1c1a', glow: '#9b7259', intensity: 68, glassOpacity: 80, moduleOpacity: 86, glassBlur: 27, themeColor: '#191715' },
    cold: { label: 'Frio', accent: '#72d7f2', background: '#17232c', glass: '#212f39', module: '#0f171d', glow: '#456a86', intensity: 65, glassOpacity: 80, moduleOpacity: 86, glassBlur: 30, themeColor: '#0c1217' },
    sexy: { label: 'Sexy', accent: '#ff5d91', background: '#23151e', glass: '#351f2d', module: '#181015', glow: '#6d294f', intensity: 72, glassOpacity: 82, moduleOpacity: 88, glassBlur: 30, themeColor: '#100b0f' }
  };

  const weekdayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  function weeklyRepeat(days, mode = 'scheduled') {
    return { type: 'week', interval: 1, days: [...days], mode, endDate: '' };
  }

  function dailyRepeat(mode = 'scheduled') {
    return { type: 'day', interval: 1, days: [], mode, endDate: '' };
  }

  function routineTask(id, title, time, duration, repeat, notes = '') {
    return {
      id: `routine-v${ROUTINE_VERSION}-${id}`,
      title,
      date: localISO(),
      time,
      duration,
      recurrence: repeat.type === 'day' ? 'daily' : 'custom',
      repeat: { ...repeat, days: [...(repeat.days || [])] },
      goalId: '',
      notes,
      reminder: 0,
      createdAt: Date.now(),
      completedAt: null,
      completions: {},
      completionHistory: {},
      routine: true
    };
  }

  function seedRoutine() {
    const allDays = dailyRepeat();
    const monWedThu = weeklyRepeat([1, 3, 4]);
    return [
      routineTask('wake', 'Acordar', '07:00', 10, allDays),
      routineTask('breakfast', 'Café da manhã', '07:20', 25, allDays, 'Refeição 1 de 7.'),
      routineTask('lunch', 'Almoço', '12:00', 30, allDays, 'Refeição 2 de 7.'),
      routineTask('snack', 'Lanche', '15:00', 20, allDays, 'Refeição 3 de 7.'),
      routineTask('meal-four', 'Refeição 4 / pré-treino', '16:30', 20, allDays, 'Na terça e sexta, ajustar conforme o horário do treino.'),
      routineTask('meal-five', 'Refeição 5 / pós-treino', '19:00', 30, allDays, 'Na terça e sexta, ajustar conforme o horário do treino.'),
      routineTask('dinner', 'Jantar', '21:15', 30, allDays, 'Refeição 6 de 7.'),
      routineTask('supper', 'Ceia', '23:00', 20, allDays, 'Refeição 7 de 7.'),
      routineTask('study-main', 'Estudo', '07:45', 75, weeklyRepeat([1, 3, 4, 6, 0])),
      routineTask('class-tue', 'Aula', '08:30', 90, weeklyRepeat([2])),
      routineTask('class-fri', 'Aula', '10:00', 75, weeklyRepeat([5])),
      routineTask('tiktok-main', 'TikTok — bloco principal', '09:00', 480, weeklyRepeat([1, 3, 4, 6, 0])),
      routineTask('tiktok-tue', 'TikTok — bloco principal', '10:00', 480, weeklyRepeat([2])),
      routineTask('tiktok-fri', 'TikTok — bloco principal', '11:15', 480, weeklyRepeat([5])),
      routineTask('body-main', 'Corpo / treino', '17:15', 90, monWedThu),
      routineTask('body-tue', 'Corpo / treino', '18:15', 90, weeklyRepeat([2])),
      routineTask('body-fri', 'Corpo / treino', '19:30', 90, weeklyRepeat([5])),
      routineTask('marketing-main', 'Marketing', '19:30', 105, monWedThu),
      routineTask('marketing-tue', 'Marketing', '20:30', 45, weeklyRepeat([2])),
      routineTask('marketing-fri', 'Marketing', '08:00', 60, weeklyRepeat([5])),
      routineTask('marketing-sat', 'Marketing', '17:30', 225, weeklyRepeat([6])),
      routineTask('marketing-sun', 'Marketing', '19:45', 90, weeklyRepeat([0])),
      routineTask('russian', 'Russo PM', '21:45', 75, allDays),
      routineTask('meal-prep', 'Preparar refeições da semana', '17:15', 120, weeklyRepeat([0])),
      routineTask('weekly-score', 'Placar semanal + primeira ação de segunda', '19:30', 15, weeklyRepeat([0])),
      routineTask('sleep-sun', 'Dormir', '23:30', 10, weeklyRepeat([0]))
    ];
  }

  function defaultSettings() {
    return {
      hideCompleted: true,
      defaultDuration: 60,
      defaultReminder: 0,
      theme: 'spatial',
      customAccent: themePresets.spatial.accent,
      customBackground: themePresets.spatial.background,
      customGlass: themePresets.spatial.glass,
      customModule: themePresets.spatial.module,
      customGlow: themePresets.spatial.glow,
      customAmbient: themePresets.spatial.glow,
      colorIntensity: 62,
      glassOpacity: 82,
      moduleOpacity: 84,
      glassBlur: 28,
      haptics: true,
      motion: true,
      notificationsEnabled: false,
      swipeLeft: 'complete',
      swipeRight: 'schedule',
      routineVersion: 0
    };
  }

  const seedGoals = () => [
    {
      id: 'goal-brl-30k',
      title: 'R$ 30 mil por mês',
      target: 30000,
      current: 0,
      unit: 'R$',
      deadline: '2026-11-30',
      note: 'Portão de segurança: manter a renda líquida por 3 meses.'
    },
    {
      id: 'goal-usd-10k',
      title: 'US$ 10 mil por mês',
      target: 10000,
      current: 0,
      unit: 'US$',
      deadline: '2026-11-30',
      note: 'Meta aspiracional de novembro.'
    },
    {
      id: 'goal-usd-100k',
      title: 'US$ 100 mil por mês',
      target: 100000,
      current: 0,
      unit: 'US$',
      deadline: '2027-02-28',
      note: 'Próximo degrau de escala.'
    },
    {
      id: 'goal-usd-1m',
      title: 'US$ 1 milhão por mês',
      target: 1000000,
      current: 0,
      unit: 'US$',
      deadline: '2027-12-31',
      note: 'Marco de longo prazo.'
    }
  ];

  function freshState() {
    const settings = defaultSettings();
    settings.routineVersion = ROUTINE_VERSION;
    return {
      version: 3,
      view: 'today',
      selectedDate: localISO(),
      lastSystemDate: localISO(),
      tasks: seedRoutine(),
      goals: seedGoals(),
      settings,
      updatedAt: new Date().toISOString(),
      revision: 0
    };
  }

  function normalizeRepeat(task = {}) {
    if (task.repeat && typeof task.repeat === 'object') {
      const type = ['day', 'week', 'month', 'year'].includes(task.repeat.type) ? task.repeat.type : 'day';
      const days = Array.isArray(task.repeat.days)
        ? [...new Set(task.repeat.days.map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
        : [];
      return {
        type,
        interval: clamp(Number(task.repeat.interval) || 1, 1, 365),
        days: type === 'week' ? (days.length ? days : [parseISO(task.date || localISO()).getDay()]) : [],
        mode: task.repeat.mode === 'completed' ? 'completed' : 'scheduled',
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(task.repeat.endDate || '') ? task.repeat.endDate : ''
      };
    }
    if (task.recurrence === 'daily') return dailyRepeat();
    if (task.recurrence === 'weekdays') return weeklyRepeat([1, 2, 3, 4, 5]);
    if (task.recurrence === 'weekly') return weeklyRepeat([parseISO(task.date || localISO()).getDay()]);
    return null;
  }

  function sanitizeTask(task = {}) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(task.date || '') ? task.date : localISO();
    const repeat = normalizeRepeat({ ...task, date });
    return {
      id: task.id || uid('task'),
      title: String(task.title || 'Tarefa').trim(),
      date,
      time: /^\d{2}:\d{2}$/.test(task.time || '') ? task.time : '',
      duration: Math.max(5, Number(task.duration) || 60),
      recurrence: repeat ? (repeat.type === 'day' && repeat.interval === 1 ? 'daily' : 'custom') : 'none',
      repeat,
      goalId: task.goalId || '',
      notes: String(task.notes || ''),
      reminder: task.reminder === '' || task.reminder == null ? null : clamp(Number(task.reminder), 0, 10080),
      createdAt: Number(task.createdAt) || Date.now(),
      completedAt: task.completedAt || null,
      completions: task.completions && typeof task.completions === 'object' ? task.completions : {},
      completionHistory: task.completionHistory && typeof task.completionHistory === 'object' ? task.completionHistory : {},
      routine: Boolean(task.routine || String(task.id || '').startsWith('routine-v'))
    };
  }

  function ensureRoutine(next) {
    if ((Number(next.settings?.routineVersion) || 0) >= ROUTINE_VERSION) return next;
    const existingIds = new Set(next.tasks.map((task) => task.id));
    const signatures = new Set(next.tasks.map((task) => `${normalize(task.title)}|${task.time || ''}`));
    seedRoutine().forEach((task) => {
      const signature = `${normalize(task.title)}|${task.time}`;
      if (!existingIds.has(task.id) && !signatures.has(signature)) next.tasks.push(task);
    });
    next.settings.routineVersion = ROUTINE_VERSION;
    return next;
  }

  function migrateLegacy() {
    const next = freshState();
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return next;
      const legacy = JSON.parse(raw);
      const demoIds = new Set(['t1', 't2', 't3', 't4', 't5', 't6', 't7']);
      const userTasks = Array.isArray(legacy.tasks)
        ? legacy.tasks.filter((task) => !demoIds.has(task.id)).map((task) => ({
            id: task.id || uid('task'),
            title: task.title || 'Tarefa',
            date: task.date || localISO(),
            time: task.start || '',
            duration: Number(task.duration) || 60,
            recurrence: task.recurrence?.days?.length === 7 ? 'daily' : 'none',
            goalId: task.goalId || '',
            notes: task.notes || '',
            createdAt: Date.now(),
            completedAt: null,
            completions: {}
          }))
        : [];
      const userGoals = Array.isArray(legacy.goals)
        ? legacy.goals.filter((goal) => !/^g[1-5]$/.test(goal.id || '')).map((goal) => ({
            id: goal.id || uid('goal'),
            title: goal.title || 'Meta',
            target: Number(goal.target) || 1,
            current: 0,
            unit: goal.unit || 'unid.',
            deadline: goal.deadline || addDays(localISO(), 90),
            note: ''
          }))
        : [];
      next.tasks.push(...userTasks);
      next.goals.push(...userGoals);
    } catch {
      return next;
    }
    return next;
  }

  function sanitizeState(input) {
    const base = freshState();
    if (!input || typeof input !== 'object') return base;
    const previousVersion = Number(input.version) || 0;
    const settings = { ...defaultSettings(), ...(input.settings || {}) };
    if (!input.settings?.customGlow && input.settings?.customAmbient) settings.customGlow = input.settings.customAmbient;
    const storedSystemDate = /^\d{4}-\d{2}-\d{2}$/.test(input.lastSystemDate || '') ? input.lastSystemDate : '';
    const seededGoalIds = new Set(seedGoals().map((goal) => goal.id));
    const goals = Array.isArray(input.goals) && input.goals.length
      ? input.goals.map((goal) => ({
          ...goal,
          current: previousVersion < 3 && seededGoalIds.has(goal.id) ? 0 : Math.max(0, Number(goal.current) || 0)
        }))
      : seedGoals();
    const next = {
      ...base,
      ...input,
      version: 3,
      view: ['today', 'upcoming', 'goals'].includes(input.view) ? input.view : 'today',
      selectedDate: /^\d{4}-\d{2}-\d{2}$/.test(input.selectedDate || '') ? input.selectedDate : localISO(),
      lastSystemDate: storedSystemDate || localISO(),
      tasks: Array.isArray(input.tasks) ? input.tasks.map(sanitizeTask) : [],
      goals,
      settings
    };
    if (next.view === 'today' && (!storedSystemDate || storedSystemDate !== localISO())) next.selectedDate = localISO();
    next.lastSystemDate = localISO();
    return ensureRoutine(next);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeState(JSON.parse(raw));
    } catch {
      // A clean state is safer than a broken boot.
    }
    const migrated = sanitizeState(migrateLegacy());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  let state = loadState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  let channel = null;
  let suppressBroadcast = false;
  let systemDate = localISO();
  let midnightTimer = null;
  let notificationTimer = null;
  let motionDirection = 'forward';
  let lastCompletionAction = null;
  let dayDrag = null;
  let taskDrag = null;
  let suppressDayClick = false;
  let suppressTaskClick = false;
  let modalScrollY = 0;
  let viewportTouch = null;

  function hexToRgb(value, fallback = '127 169 230') {
    const match = String(value || '').trim().match(/^#([\da-f]{6})$/i);
    if (!match) return fallback;
    const hex = match[1];
    return `${parseInt(hex.slice(0, 2), 16)} ${parseInt(hex.slice(2, 4), 16)} ${parseInt(hex.slice(4, 6), 16)}`;
  }

  function blendRgb(value, target, amount, fallback = '48 44 40') {
    const source = hexToRgb(value, fallback).split(' ').map(Number);
    const destination = hexToRgb(target, fallback).split(' ').map(Number);
    const ratio = clamp(Number(amount) || 0, 0, 1);
    return source.map((channel, index) => Math.round(channel + (destination[index] - channel) * ratio)).join(' ');
  }

  function applyAppearance() {
    const preset = themePresets[state.settings.theme] || themePresets.spatial;
    const custom = state.settings.theme === 'custom';
    const accent = custom ? state.settings.customAccent : preset.accent;
    const background = custom ? state.settings.customBackground : preset.background;
    const glass = custom ? state.settings.customGlass : preset.glass;
    const module = custom ? state.settings.customModule : preset.module;
    const glow = custom ? (state.settings.customGlow || state.settings.customAmbient) : preset.glow;
    const rawIntensity = Number(custom ? state.settings.colorIntensity : preset.intensity);
    const intensity = Number.isFinite(rawIntensity) ? clamp(rawIntensity, 0, 100) : 62;
    const glassOpacity = clamp(Number(custom ? state.settings.glassOpacity : preset.glassOpacity) || 82, 20, 100);
    const moduleOpacity = clamp(Number(custom ? state.settings.moduleOpacity : preset.moduleOpacity) || 84, 20, 100);
    const glassBlur = clamp(Number(custom ? state.settings.glassBlur : preset.glassBlur) || 28, 0, 50);
    const glassAlpha = glassOpacity / 100;
    const moduleAlpha = moduleOpacity / 100;
    const root = document.documentElement;
    root.dataset.theme = custom ? 'custom' : state.settings.theme;
    root.dataset.motion = state.settings.motion === false ? 'off' : 'on';
    root.style.setProperty('--accent-rgb', hexToRgb(accent));
    root.style.setProperty('--ambient-rgb', hexToRgb(glow, '149 139 127'));
    root.style.setProperty('--ambient-alpha', String(.04 + intensity / 100 * .3));
    root.style.setProperty('--bg-a', `rgb(${blendRgb(background, '#ffffff', .18)})`);
    root.style.setProperty('--bg-b', `rgb(${hexToRgb(background, '48 44 40')})`);
    root.style.setProperty('--bg-c', `rgb(${blendRgb(background, '#060708', .56)})`);
    root.style.setProperty('--glass-a', `rgb(${hexToRgb(glass, '72 66 59')} / ${glassAlpha})`);
    root.style.setProperty('--glass-b', `rgb(${blendRgb(glass, '#111315', .44, '72 66 59')} / ${Math.min(1, glassAlpha + .04)})`);
    root.style.setProperty('--module-a', `rgb(${hexToRgb(module, '30 28 25')} / ${moduleAlpha})`);
    root.style.setProperty('--module-b', `rgb(${blendRgb(module, '#090a0b', .38, '30 28 25')} / ${Math.min(1, moduleAlpha + .04)})`);
    root.style.setProperty('--shell', `rgb(${hexToRgb(glass, '72 66 59')} / ${Math.min(1, glassAlpha + .02)})`);
    root.style.setProperty('--surface', `rgb(${hexToRgb(module, '30 28 25')} / ${Math.min(1, moduleAlpha + .02)})`);
    root.style.setProperty('--line', `color-mix(in srgb,rgb(${hexToRgb(glow, '149 139 127')} / .17) 68%,rgba(245,248,255,.11))`);
    root.style.setProperty('--line-soft', `color-mix(in srgb,rgb(${hexToRgb(glow, '149 139 127')} / .1) 65%,rgba(245,248,255,.06))`);
    root.style.setProperty('--glass-blur', `${glassBlur}px`);
    root.style.setProperty('--shadow', `0 30px 80px rgba(4,6,8,.4),0 0 ${Math.round(12 + intensity * .34)}px rgb(${hexToRgb(glow, '149 139 127')} / ${(.025 + intensity * .0012).toFixed(3)}),inset 0 1px 0 rgba(255,255,255,.06)`);
    const themeMeta = $('meta[name="theme-color"]');
    const backgroundThemeColor = custom ? `rgb(${blendRgb(background, '#060708', .56)})` : preset.themeColor;
    if (themeMeta) themeMeta.setAttribute('content', document.body?.classList.contains('modal-open') ? '#111315' : backgroundThemeColor);
  }

  function haptic(kind = 'tap') {
    if (state.settings.haptics === false || !navigator.vibrate) return;
    const patterns = { tap: 8, select: 12, success: [10, 34, 16], warning: [20, 40, 20] };
    try { navigator.vibrate(patterns[kind] || patterns.tap); } catch { /* Unsupported device. */ }
  }

  function updateAppBadge() {
    if (!('setAppBadge' in navigator)) return;
    const count = tasksForDate(localISO(), { includeCompleted: false }).length + overdueTasks().length;
    const update = count ? navigator.setAppBadge(count) : navigator.clearAppBadge?.();
    Promise.resolve(update).catch(() => {});
  }

  applyAppearance();

  try {
    channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (!event.data?.state || event.data.source === INSTANCE_ID) return;
        const incoming = sanitizeState(event.data.state);
        if ((incoming.revision || 0) <= (state.revision || 0)) return;
        suppressBroadcast = true;
        state = incoming;
        applyAppearance();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        suppressBroadcast = false;
        render({ quiet: true });
        setSaveStatus('atualizado');
      };
    }
  } catch {
    channel = null;
  }

  function setSaveStatus(label = 'salvo neste aparelho', saving = false) {
    const status = $('#syncStatus');
    if (!status) return;
    status.classList.toggle('saving', saving);
    const copy = $('span', status);
    if (copy) copy.textContent = label;
  }

  function save({ broadcast = true } = {}) {
    state.updatedAt = new Date().toISOString();
    state.revision = (Number(state.revision) || 0) + 1;
    setSaveStatus('salvando…', true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (broadcast && channel && !suppressBroadcast) {
      channel.postMessage({ source: INSTANCE_ID, state });
    }
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('objetivos:state-saved', { detail: { state: JSON.parse(JSON.stringify(state)) } }));
    }
    requestAnimationFrame(() => setSaveStatus('salvo neste aparelho'));
  }

  function toast(message, options = {}) {
    const node = document.createElement('div');
    node.className = 'toast';
    const copy = document.createElement('span');
    copy.textContent = message;
    node.append(copy);
    if (options.actionLabel && typeof options.onAction === 'function') {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = options.actionLabel;
      action.onclick = () => {
        options.onAction();
        node.remove();
      };
      node.append(action);
    }
    $('#toastLayer').append(node);
    setTimeout(() => node.remove(), options.duration || 3200);
  }

  function monthDiff(from, to) {
    const start = parseISO(from);
    const end = parseISO(to);
    return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  }

  function weekStart(value) {
    const date = parseISO(value);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return localISO(date);
  }

  function addMonths(value, amount) {
    const date = parseISO(value);
    const originalDay = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(originalDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    return localISO(date);
  }

  function addYears(value, amount) {
    const date = parseISO(value);
    const month = date.getMonth();
    const day = date.getDate();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + amount);
    date.setMonth(month);
    date.setDate(Math.min(day, new Date(date.getFullYear(), month + 1, 0).getDate()));
    return localISO(date);
  }

  function nextRepeatDate(task, completedDate) {
    const repeat = task.repeat || normalizeRepeat(task) || dailyRepeat('completed');
    if (repeat.type === 'week') return addDays(completedDate, repeat.interval * 7);
    if (repeat.type === 'month') return addMonths(completedDate, repeat.interval);
    if (repeat.type === 'year') return addYears(completedDate, repeat.interval);
    return addDays(completedDate, repeat.interval);
  }

  function isTaskOnDate(task, date) {
    if (!task || date < task.date) return false;
    const repeat = task.repeat || normalizeRepeat(task);
    if (!repeat) return task.date === date;
    if (repeat.endDate && date > repeat.endDate) return false;
    if (repeat.mode === 'completed') return task.date === date;
    const elapsed = dayDiff(task.date, date);
    if (repeat.type === 'day') return elapsed % repeat.interval === 0;
    if (repeat.type === 'week') {
      const weeks = Math.floor(dayDiff(weekStart(task.date), weekStart(date)) / 7);
      return weeks >= 0 && weeks % repeat.interval === 0 && repeat.days.includes(parseISO(date).getDay());
    }
    if (repeat.type === 'month') {
      const months = monthDiff(task.date, date);
      const current = parseISO(date);
      const start = parseISO(task.date);
      const expectedDay = Math.min(start.getDate(), new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate());
      return months >= 0 && months % repeat.interval === 0 && current.getDate() === expectedDay;
    }
    if (repeat.type === 'year') {
      const start = parseISO(task.date);
      const current = parseISO(date);
      const expectedDay = Math.min(start.getDate(), new Date(current.getFullYear(), start.getMonth() + 1, 0).getDate());
      return (current.getFullYear() - start.getFullYear()) % repeat.interval === 0
        && current.getMonth() === start.getMonth()
        && current.getDate() === expectedDay;
    }
    return task.date === date;
  }

  function isTaskDone(task, date) {
    const repeat = task.repeat || normalizeRepeat(task);
    if (!repeat) return Boolean(task.completedAt);
    if (repeat.mode === 'completed') return false;
    return Boolean(task.completions?.[date]);
  }

  function tasksForDate(date, { includeCompleted = true } = {}) {
    return state.tasks
      .filter((task) => isTaskOnDate(task, date))
      .filter((task) => includeCompleted || !isTaskDone(task, date))
      .sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time) || (a.createdAt || 0) - (b.createdAt || 0));
  }

  function overdueTasks() {
    return state.tasks
      .filter((task) => {
        const repeat = task.repeat || normalizeRepeat(task);
        if (!repeat) return task.date < localISO() && !task.completedAt;
        return repeat.mode === 'completed' && task.date < localISO();
      })
      .sort((a, b) => a.date.localeCompare(b.date) || minutesFromTime(a.time) - minutesFromTime(b.time));
  }

  function goalById(id) {
    return state.goals.find((goal) => goal.id === id);
  }

  function goalProgress(goal) {
    if (!goal || !Number(goal.target)) return 0;
    return clamp((Number(goal.current) || 0) / Number(goal.target), 0, 1);
  }

  function formatGoalValue(goal, value) {
    const number = Number(value) || 0;
    const digits = Number.isInteger(number) ? 0 : 1;
    const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(number);
    if (goal.unit === 'R$' || goal.unit === 'US$') return `${goal.unit} ${formatted}`;
    return `${formatted} ${goal.unit || ''}`.trim();
  }

  function recurrenceLabel(task) {
    const repeat = task?.repeat || normalizeRepeat(task || {});
    if (!repeat) return '';
    const interval = repeat.interval > 1 ? ` ${repeat.interval}` : '';
    let label = '';
    if (repeat.type === 'day') label = repeat.interval === 1 ? 'todo dia' : `a cada${interval} dias`;
    if (repeat.type === 'week') {
      if (repeat.interval === 1 && repeat.days.join(',') === '1,2,3,4,5') label = 'seg–sex';
      else if (repeat.interval === 1 && repeat.days.length === 7) label = 'todo dia';
      else label = `${repeat.interval > 1 ? `a cada ${repeat.interval} sem. · ` : ''}${repeat.days.map((day) => weekdayNames[day]).join(', ')}`;
    }
    if (repeat.type === 'month') label = repeat.interval === 1 ? 'todo mês' : `a cada${interval} meses`;
    if (repeat.type === 'year') label = repeat.interval === 1 ? 'todo ano' : `a cada${interval} anos`;
    if (repeat.mode === 'completed') label += ' após concluir';
    return label;
  }

  function toggleTask(taskId, date = state.selectedDate) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const repeat = task.repeat || normalizeRepeat(task);
    const done = isTaskDone(task, date);
    if (repeat?.mode === 'completed') {
      if (task.date !== date) return;
      const previousDate = task.date;
      const nextDate = nextRepeatDate(task, date);
      task.completionHistory ||= {};
      task.completionHistory[date] = Date.now();
      task.date = nextDate;
      lastCompletionAction = { taskId, previousDate, nextDate };
      save();
      render({ quiet: true });
      haptic('success');
      toast(`Concluída. Próxima: ${formatShortDate(nextDate)}.`, {
        actionLabel: 'Desfazer',
        onAction: () => {
          const current = state.tasks.find((item) => item.id === taskId);
          if (!current || current.date !== nextDate) return;
          current.date = previousDate;
          delete current.completionHistory?.[previousDate];
          save();
          render({ quiet: true });
          haptic('select');
        },
        duration: 5000
      });
      return;
    }
    if (repeat) {
      task.completions ||= {};
      if (done) delete task.completions[date];
      else task.completions[date] = Date.now();
    } else {
      task.completedAt = done ? null : Date.now();
    }
    save();
    render({ quiet: true });
    haptic(done ? 'select' : 'success');
    toast(done ? 'Tarefa devolvida para a lista.' : 'Concluída e arquivada.');
  }

  function deleteTask(taskId) {
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    save();
    render({ quiet: true });
    toast('Tarefa removida.');
  }

  function upsertTask(data, existingId = null) {
    const existing = state.tasks.find((task) => task.id === existingId);
    const date = data.date || state.selectedDate || localISO();
    const repeat = data.repeat === null ? null : normalizeRepeat({
      date,
      repeat: data.repeat,
      recurrence: data.recurrence || 'none'
    });
    const task = {
      id: existing?.id || uid('task'),
      title: String(data.title || '').trim(),
      date,
      time: data.time || '',
      duration: Math.max(5, Number(data.duration) || Number(state.settings.defaultDuration) || 60),
      recurrence: repeat ? (repeat.type === 'day' && repeat.interval === 1 ? 'daily' : 'custom') : 'none',
      repeat,
      goalId: data.goalId || '',
      notes: String(data.notes || '').trim(),
      reminder: data.reminder === '' || data.reminder == null ? null : clamp(Number(data.reminder), 0, 10080),
      createdAt: existing?.createdAt || Date.now(),
      completedAt: existing?.completedAt || null,
      completions: existing?.completions || {},
      completionHistory: existing?.completionHistory || {},
      routine: existing?.routine || false
    };
    if (!task.title) return null;
    if (existing) Object.assign(existing, task);
    else state.tasks.push(task);
    save();
    render();
    return task;
  }

  function upsertGoal(data, existingId = null) {
    const existing = state.goals.find((goal) => goal.id === existingId);
    const goal = {
      id: existing?.id || uid('goal'),
      title: String(data.title || '').trim(),
      target: Math.max(0, Number(data.target) || 0),
      current: Math.max(0, Number(data.current) || 0),
      unit: String(data.unit || 'unid.').trim(),
      deadline: data.deadline || addDays(localISO(), 90),
      note: String(data.note || '').trim()
    };
    if (!goal.title || !goal.target) return null;
    if (existing) Object.assign(existing, goal);
    else state.goals.push(goal);
    save();
    render();
    return goal;
  }

  const navItems = [
    { id: 'today', icon: '◷', label: 'Hoje' },
    { id: 'upcoming', icon: '▤', label: 'Em breve' },
    { id: 'goals', icon: '◎', label: 'Metas' }
  ];

  function setView(view) {
    if (!navItems.some((item) => item.id === view)) return;
    const previousIndex = navItems.findIndex((item) => item.id === state.view);
    const nextIndex = navItems.findIndex((item) => item.id === view);
    motionDirection = nextIndex >= previousIndex ? 'forward' : 'backward';
    state.view = view;
    if (view === 'today') state.selectedDate = localISO();
    save();
    render();
    haptic('select');
  }

  let renderedNavView = null;

  function renderNav() {
    if (renderedNavView === state.view) return;
    $('#bottomDock').innerHTML = navItems.map((item) => `
      <button class="dock-button ${state.view === item.id ? 'active' : ''}" data-view="${item.id}" type="button">
        <span class="dock-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');
    renderedNavView = state.view;
  }

  function viewHead(eyebrow, title, subtitle, actions = '') {
    return `
      <header class="view-head">
        <div>
          <div class="eyebrow">${esc(eyebrow)}</div>
          <h1 class="view-title">${esc(title)}</h1>
          <p class="view-subtitle">${esc(subtitle)}</p>
        </div>
        <div class="head-actions">${actions}</div>
      </header>
    `;
  }

  function renderDayStrip() {
    const start = addDays(state.selectedDate, -3);
    const formatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return `
      <div class="day-toolbar">
        <button class="date-button" data-action="previousDay" type="button" aria-label="Dia anterior">‹</button>
        <div class="day-strip">
          ${days.map((date) => {
            const hasTask = tasksForDate(date, { includeCompleted: false }).length > 0;
            return `
              <button class="day-pill ${date === state.selectedDate ? 'active' : ''} ${hasTask ? 'has-task' : ''}" data-action="selectDate" data-date="${date}" type="button">
                <span>${esc(formatter.format(parseISO(date)).replace('.', ''))}</span>
                <strong>${parseISO(date).getDate()}</strong>
              </button>
            `;
          }).join('')}
        </div>
        <button class="date-button" data-action="nextDay" type="button" aria-label="Próximo dia">›</button>
      </div>
    `;
  }

  function selectCalendarDate(date, direction = 'forward') {
    motionDirection = direction;
    state.selectedDate = date;
    state.view = 'today';
    save();
    render();
    haptic('select');
  }

  function animatedToggleTask(button, taskId, date) {
    const card = button?.closest?.('.task-card');
    if (!card || state.settings.motion === false) {
      toggleTask(taskId, date);
      return;
    }
    card.classList.add(card.classList.contains('completed') ? 'is-restoring' : 'is-completing');
    setTimeout(() => toggleTask(taskId, date), 260);
  }

  function taskCard(task, date, { overdue = false, completed = false } = {}) {
    const goal = goalById(task.goalId);
    const recurrence = recurrenceLabel(task);
    const taskDate = overdue ? formatShortDate(task.date) : '';
    const time = task.time || 'sem horário';
    return `
      <article class="task-card ${overdue ? 'overdue' : ''} ${completed ? 'completed' : ''}" data-task-id="${task.id}" data-task-date="${date}" data-swipe-left="${esc(state.settings.swipeLeft)}" data-swipe-right="${esc(state.settings.swipeRight)}">
        <button class="task-check" data-action="toggleTask" data-id="${task.id}" data-date="${date}" type="button" aria-label="${completed ? 'Desfazer conclusão' : 'Concluir tarefa'}">
          ${completed ? '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 10.2 8.4 13.4 15 6.8"/></svg>' : ''}
        </button>
        <div class="task-copy">
          <div class="task-title">${esc(task.title)}</div>
          <div class="task-meta">
            <span class="time-accent">${taskDate ? `${esc(taskDate)} · ` : ''}${esc(time)}</span>
            <span>· ${esc(formatDuration(task.duration))}</span>
            ${recurrence ? `<span>↻ ${esc(recurrence)}</span>` : ''}
            ${task.reminder != null && task.time ? '<span aria-label="Lembrete ativo">◴</span>' : ''}
            ${goal ? `<span class="goal-link"># ${esc(goal.title)}</span>` : ''}
          </div>
        </div>
        <button class="task-menu" data-action="editTask" data-id="${task.id}" type="button" aria-label="Editar tarefa">•••</button>
      </article>
    `;
  }

  function completedDrawer(completed, date) {
    if (!completed.length) return '';
    return `
      <section class="completed-drawer" id="completedDrawer">
        <button class="completed-toggle" data-action="toggleCompletedDrawer" type="button" aria-expanded="false">
          <span class="drawer-chevron" aria-hidden="true">›</span>
          <span>${completed.length} concluída${completed.length === 1 ? '' : 's'} — toque para ver</span>
        </button>
        <div class="completed-list">
          ${completed.map((task) => taskCard(task, date, { completed: true })).join('')}
        </div>
      </section>
    `;
  }

  function emptyTasks(date) {
    return `
      <div class="empty-state">
        <div>
          <div class="empty-orb">✦</div>
          <strong>Nenhuma tarefa em ${esc(formatDayLabel(date).toLowerCase())}</strong>
          <p>Adicione pelo botão abaixo ou peça ao assistente: “crie uma tarefa amanhã às 15h”.</p>
          <button class="primary-button" data-action="addTask" type="button">+ Adicionar tarefa</button>
        </div>
      </div>
    `;
  }

  function renderToday() {
    const all = tasksForDate(state.selectedDate);
    const pending = all.filter((task) => !isTaskDone(task, state.selectedDate));
    const completed = all.filter((task) => isTaskDone(task, state.selectedDate));
    const overdue = state.selectedDate === localISO() ? overdueTasks() : [];
    const totalMinutes = pending.reduce((sum, task) => sum + (Number(task.duration) || 0), 0);
    const subtitle = state.selectedDate === localISO()
      ? formatLongDate(state.selectedDate)
      : `${formatDayLabel(state.selectedDate)} · ${formatLongDate(state.selectedDate)}`;

    return `
      <div class="view-enter">
        ${viewHead('Tarefas', formatDayLabel(state.selectedDate), subtitle, `
          ${state.selectedDate !== localISO() ? '<button class="soft-button" data-action="todayNow" type="button">Hoje</button>' : ''}
          <button class="primary-button" data-action="addTask" type="button">+ <span>Tarefa</span></button>
        `)}
        ${renderDayStrip()}

        ${overdue.length ? `
          <div class="summary-row">
            <div class="summary-copy"><strong>Atrasadas</strong><span>${overdue.length}</span></div>
            <div class="summary-actions"><button class="chip-button" data-action="moveOverdueToday" type="button">Reagendar para hoje</button></div>
          </div>
          <div class="task-list">${overdue.map((task) => taskCard(task, task.date, { overdue: true })).join('')}</div>
        ` : ''}

        <div class="summary-row">
          <div class="summary-copy">
            <strong>${pending.length ? `${pending.length} tarefa${pending.length === 1 ? '' : 's'}` : 'Dia livre'}</strong>
            <span>${pending.length ? esc(formatDuration(totalMinutes)) : 'sem pendências'}</span>
          </div>
          <div class="summary-actions">
            <button class="chip-button" data-view="upcoming" type="button">Ver próximos dias</button>
          </div>
        </div>

        ${pending.length ? `<div class="task-list">${pending.map((task) => taskCard(task, state.selectedDate)).join('')}</div>` : emptyTasks(state.selectedDate)}
        ${completedDrawer(completed, state.selectedDate)}
      </div>
    `;
  }

  function renderUpcoming() {
    const days = Array.from({ length: 14 }, (_, index) => addDays(localISO(), index));
    return `
      <div class="view-enter">
        ${viewHead('Agenda', 'Em breve', 'Os próximos 14 dias em uma visão compacta.', '<button class="primary-button" data-action="addTask" type="button">+ <span>Tarefa</span></button>')}
        <div class="upcoming-stack">
          ${days.map((date) => {
            const tasks = tasksForDate(date, { includeCompleted: false });
            return `
              <section class="upcoming-day">
                <button class="upcoming-head" data-action="selectUpcomingDate" data-date="${date}" type="button" style="width:100%;border:0;background:transparent;color:inherit;padding:0;cursor:pointer">
                  <strong>${esc(formatDayLabel(date))}</strong>
                  <span>${esc(formatLongDate(date))} · ${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}</span>
                </button>
                ${tasks.length ? `<div class="task-list">${tasks.map((task) => taskCard(task, date)).join('')}</div>` : '<div style="color:var(--faint);font-size:9px;padding:7px 1px 2px">Sem tarefas.</div>'}
              </section>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function deadlineInfo(goal) {
    const remaining = dayDiff(localISO(), goal.deadline);
    if (remaining < 0) return { label: `${Math.abs(remaining)} dias atrasada`, urgent: true };
    if (remaining === 0) return { label: 'vence hoje', urgent: true };
    if (remaining <= 14) return { label: `${remaining} dias restantes`, urgent: true };
    return { label: `${remaining} dias restantes`, urgent: false };
  }

  function goalCard(goal) {
    const progress = goalProgress(goal);
    const deadline = deadlineInfo(goal);
    return `
      <article class="goal-card">
        <div class="goal-head">
          <div class="goal-head-copy">
            <div class="goal-title">${esc(goal.title)}</div>
            <div class="goal-deadline">Prazo ${esc(formatShortDate(goal.deadline))}</div>
          </div>
          <div class="goal-percent">${Math.round(progress * 100)}%</div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>
        <div class="goal-values"><span>${esc(formatGoalValue(goal, goal.current))}</span><span>${esc(formatGoalValue(goal, goal.target))}</span></div>
        <div class="goal-foot">
          <span class="deadline-chip ${deadline.urgent ? 'urgent' : ''}">◷ ${esc(deadline.label)}</span>
          <button class="chip-button" data-action="editGoal" data-id="${goal.id}" type="button">Atualizar</button>
        </div>
      </article>
    `;
  }

  function renderGoals() {
    return `
      <div class="view-enter">
        ${viewHead('Direção', 'Metas', 'Alvos preservados; todo valor realizado começa em zero.', `
          <button class="soft-button" data-action="resetGoalValues" type="button">Zerar realizados</button>
          <button class="primary-button" data-action="addGoal" type="button">+ <span>Meta</span></button>
        `)}
        <div class="goals-grid">
          ${state.goals.map(goalCard).join('')}
        </div>
      </div>
    `;
  }

  function render({ quiet = false, preserveScroll = quiet } = {}) {
    const scroller = $('#appShell');
    const previousScroll = preserveScroll ? Number(scroller?.scrollTop || 0) : 0;
    applyAppearance();
    renderNav();
    const views = { today: renderToday, upcoming: renderUpcoming, goals: renderGoals };
    const root = $('#viewRoot');
    root.dataset.direction = motionDirection;
    root.dataset.update = quiet ? 'quiet' : 'animated';
    root.innerHTML = (views[state.view] || renderToday)();
    if (preserveScroll && scroller) scroller.scrollTop = previousScroll;
    updateAppBadge();
  }

  function openModal(content, className = '') {
    const layer = $('#modalLayer');
    if (!document.body?.classList.contains('modal-open')) {
      modalScrollY = Number($('#appShell')?.scrollTop || 0);
      document.documentElement?.classList.add('modal-open');
      document.body?.classList.add('modal-open');
    }
    layer.classList.add('open');
    layer.innerHTML = `<section class="modal glass ${className}" role="dialog" aria-modal="true">${content}</section>`;
    applyAppearance();
    requestAnimationFrame(() => {
      const firstField = $('input:not([type="hidden"]),textarea,select', layer);
      const mobileClose = window.matchMedia?.('(max-width:760px)')?.matches ? $('.modal-head .modal-close', layer) : null;
      (mobileClose || firstField || $('button', layer))?.focus({ preventScroll: true });
    });
  }

  function closeModal() {
    const layer = $('#modalLayer');
    layer.classList.remove('open');
    layer.innerHTML = '';
    const wasLocked = document.body?.classList.contains('modal-open');
    document.documentElement?.classList.remove('modal-open');
    document.body?.classList.remove('modal-open');
    applyAppearance();
    const scroller = $('#appShell');
    if (wasLocked && scroller) scroller.scrollTop = modalScrollY;
  }

  function repeatPresetFor(task) {
    const repeat = task?.repeat || normalizeRepeat(task || {});
    if (!repeat) return 'none';
    if (repeat.type === 'day' && repeat.interval === 1) return 'daily';
    if (repeat.type === 'week' && repeat.interval === 1 && repeat.days.join(',') === '1,2,3,4,5') return 'weekdays';
    if (repeat.type === 'week' && repeat.interval === 1 && repeat.days.length === 1) return 'weekly';
    if (repeat.type === 'month' && repeat.interval === 1) return 'monthly';
    if (repeat.type === 'year' && repeat.interval === 1) return 'yearly';
    return 'custom';
  }

  function repeatFromForm(form) {
    const data = new FormData(form);
    const preset = data.get('repeatPreset');
    if (!preset || preset === 'none') return null;
    const mode = data.get('repeatMode') === 'completed' ? 'completed' : 'scheduled';
    const endDate = data.get('repeatEnd') || '';
    if (preset === 'daily') return { ...dailyRepeat(mode), endDate };
    if (preset === 'weekdays') return { ...weeklyRepeat([1, 2, 3, 4, 5], mode), endDate };
    if (preset === 'weekly') return { ...weeklyRepeat([parseISO(data.get('date') || localISO()).getDay()], mode), endDate };
    if (preset === 'monthly') return { type: 'month', interval: 1, days: [], mode, endDate };
    if (preset === 'yearly') return { type: 'year', interval: 1, days: [], mode, endDate };
    const type = ['day', 'week', 'month', 'year'].includes(data.get('repeatUnit')) ? data.get('repeatUnit') : 'day';
    const days = data.getAll('repeatDays').map(Number).filter((day) => day >= 0 && day <= 6);
    return {
      type,
      interval: clamp(Number(data.get('repeatInterval')) || 1, 1, 365),
      days: type === 'week' ? (days.length ? days : [parseISO(data.get('date') || localISO()).getDay()]) : [],
      mode,
      endDate
    };
  }

  function updateRepeatEditor() {
    const preset = $('#repeatPreset')?.value || 'none';
    const advanced = $('#repeatAdvanced');
    const custom = $('#repeatCustom');
    if (advanced) advanced.hidden = preset === 'none';
    if (custom) custom.hidden = preset !== 'custom';
    const weekdayEditor = $('#repeatWeekdays');
    if (weekdayEditor) weekdayEditor.hidden = $('#repeatUnit')?.value !== 'week';
    const details = $('#taskAdvanced');
    if (details && preset === 'custom') details.open = true;
  }

  function applySmartTaskInput(data, form) {
    const title = String(data.title || '');
    const lower = normalize(title);
    const hasDate = /\b(hoje|amanha|depois de amanha|proxim[ao]\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo)|\d{1,2}[/-]\d{1,2})\b/.test(lower);
    const time = parseCommandTime(title);
    const repeat = parseCommandRepeat(title);
    if (hasDate) data.date = parseCommandDate(title, data.date);
    if (time) data.time = time;
    if (/(?:por|duracao de)\s*\d/.test(lower)) data.duration = parseCommandDuration(title);
    if (repeat) {
      data.repeat = repeat;
      data.recurrence = 'custom';
    } else {
      data.repeat = repeatFromForm(form);
      data.recurrence = data.repeat ? 'custom' : 'none';
    }
    if (hasDate || time || repeat || /(?:por|duracao de)\s*\d/.test(lower)) data.title = cleanTaskTitle(title);
    return data;
  }

  function taskModal(taskId = null, presetDate = null) {
    const task = state.tasks.find((item) => item.id === taskId);
    const date = presetDate || task?.date || state.selectedDate || localISO();
    const repeat = task?.repeat || normalizeRepeat(task || {});
    const repeatPreset = repeatPresetFor(task);
    const reminder = task?.reminder ?? state.settings.defaultReminder;
    const advancedOpen = Boolean(task?.goalId || task?.notes || repeatPreset === 'custom' || repeat?.mode === 'completed' || repeat?.endDate);
    openModal(`
      <div class="modal-head">
        <div><h2>${task ? 'Editar tarefa' : 'Nova tarefa'}</h2><p>Tudo é salvo automaticamente quando você confirma.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <form id="taskForm">
        <div class="task-form-compact">
          <div class="field task-title-field"><label>Tarefa</label><input name="title" required maxlength="150" value="${esc(task?.title || '')}" placeholder="O que precisa ser feito?" /><small class="form-note">Você também pode escrever: “russo todo dia às 21:45 por 75 min”.</small></div>
          <div class="task-core-grid">
            <div class="field task-date-field"><label>Data</label><div class="native-picker-control"><span class="native-picker-value" id="taskDateDisplay" aria-hidden="true">${esc(formatPickerDate(date))}</span><input id="taskDateInput" name="date" type="date" required value="${esc(date)}" aria-label="Data" /></div></div>
            <div class="field"><label>Horário</label><div class="native-picker-control"><span class="native-picker-value ${task?.time ? '' : 'empty'}" id="taskTimeDisplay" aria-hidden="true">${esc(task?.time || '')}</span><input id="taskTimeInput" name="time" type="time" value="${esc(task?.time || '')}" aria-label="Horário" /></div></div>
          </div>
          <div class="task-options-grid">
            <div class="field"><label>Repetição</label><select name="repeatPreset" id="repeatPreset">
            <option value="none" ${repeatPreset === 'none' ? 'selected' : ''}>Não repetir</option>
            <option value="daily" ${repeatPreset === 'daily' ? 'selected' : ''}>Todo dia</option>
            <option value="weekdays" ${repeatPreset === 'weekdays' ? 'selected' : ''}>Segunda a sexta</option>
            <option value="weekly" ${repeatPreset === 'weekly' ? 'selected' : ''}>Toda semana</option>
            <option value="monthly" ${repeatPreset === 'monthly' ? 'selected' : ''}>Todo mês</option>
            <option value="yearly" ${repeatPreset === 'yearly' ? 'selected' : ''}>Todo ano</option>
            <option value="custom" ${repeatPreset === 'custom' ? 'selected' : ''}>Personalizada…</option>
            </select></div>
            <div class="field"><label>Lembrete</label><select name="reminder">
            <option value="" ${reminder == null ? 'selected' : ''}>Sem lembrete</option>
            <option value="0" ${Number(reminder) === 0 ? 'selected' : ''}>No horário</option>
            <option value="5" ${Number(reminder) === 5 ? 'selected' : ''}>5 min antes</option>
            <option value="10" ${Number(reminder) === 10 ? 'selected' : ''}>10 min antes</option>
            <option value="15" ${Number(reminder) === 15 ? 'selected' : ''}>15 min antes</option>
            <option value="30" ${Number(reminder) === 30 ? 'selected' : ''}>30 min antes</option>
            <option value="60" ${Number(reminder) === 60 ? 'selected' : ''}>1 hora antes</option>
            </select></div>
          </div>
          <details class="task-advanced" id="taskAdvanced" ${advancedOpen ? 'open' : ''}>
            <summary><span>Mais opções</span><small>duração, repetição avançada, meta e nota</small></summary>
            <div class="task-advanced-content">
              <div class="field"><label>Duração</label><div class="duration-input"><input name="duration" type="number" min="5" step="5" inputmode="numeric" value="${esc(task?.duration || state.settings.defaultDuration)}" /><span>min</span></div></div>
              <div class="repeat-editor" id="repeatAdvanced" ${repeatPreset === 'none' ? 'hidden' : ''}>
                <div class="repeat-grid">
                  <div class="field"><label>Repetir pela</label><select name="repeatMode">
                    <option value="scheduled" ${repeat?.mode !== 'completed' ? 'selected' : ''}>Data programada</option>
                    <option value="completed" ${repeat?.mode === 'completed' ? 'selected' : ''}>Data da conclusão</option>
                  </select></div>
                  <div class="field"><label>Terminar em</label><input name="repeatEnd" type="date" value="${esc(repeat?.endDate || '')}" /></div>
                </div>
                <div class="repeat-custom" id="repeatCustom" ${repeatPreset !== 'custom' ? 'hidden' : ''}>
                  <div class="repeat-grid">
                    <div class="field"><label>A cada</label><input name="repeatInterval" type="number" min="1" max="365" value="${esc(repeat?.interval || 1)}" /></div>
                    <div class="field"><label>Unidade</label><select name="repeatUnit" id="repeatUnit">
                      <option value="day" ${repeat?.type === 'day' ? 'selected' : ''}>dia(s)</option>
                      <option value="week" ${repeat?.type === 'week' ? 'selected' : ''}>semana(s)</option>
                      <option value="month" ${repeat?.type === 'month' ? 'selected' : ''}>mês(es)</option>
                      <option value="year" ${repeat?.type === 'year' ? 'selected' : ''}>ano(s)</option>
                    </select></div>
                  </div>
                  <div class="weekday-picker" id="repeatWeekdays" ${repeat?.type !== 'week' ? 'hidden' : ''}>
                    ${weekdayNames.map((name, day) => `<label><input type="checkbox" name="repeatDays" value="${day}" ${repeat?.days?.includes(day) ? 'checked' : ''}/><span>${name}</span></label>`).join('')}
                  </div>
                </div>
              </div>
              <div class="field"><label>Meta vinculada</label><select name="goalId"><option value="">Nenhuma</option>${state.goals.map((goal) => `<option value="${goal.id}" ${task?.goalId === goal.id ? 'selected' : ''}>${esc(goal.title)}</option>`).join('')}</select></div>
              <div class="field"><label>Observação</label><textarea name="notes" placeholder="Opcional">${esc(task?.notes || '')}</textarea></div>
            </div>
          </details>
        </div>
        <div class="modal-actions">
          ${task ? '<button class="danger-button" id="deleteTaskBtn" type="button">Excluir</button>' : ''}
          <button class="soft-button modal-close task-cancel-button" type="button">Cancelar</button>
          <button class="primary-button task-save-button" type="submit">Salvar tarefa</button>
        </div>
      </form>
    `, 'task-modal');
    const bindNativePickerDisplay = (inputId, displayId, formatter = (value) => value) => {
      const input = $(`#${inputId}`);
      const display = $(`#${displayId}`);
      if (!input || !display) return;
      const sync = () => {
        const value = formatter(input.value);
        display.textContent = value;
        display.classList.toggle('empty', !value);
      };
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
      sync();
    };
    bindNativePickerDisplay('taskDateInput', 'taskDateDisplay', formatPickerDate);
    bindNativePickerDisplay('taskTimeInput', 'taskTimeDisplay');
    $('#repeatPreset').onchange = updateRepeatEditor;
    $('#repeatUnit').onchange = updateRepeatEditor;
    $('#taskForm').onsubmit = (event) => {
      event.preventDefault();
      const data = applySmartTaskInput(Object.fromEntries(new FormData(event.currentTarget).entries()), event.currentTarget);
      const result = upsertTask(data, task?.id || null);
      if (!result) return;
      closeModal();
      toast(task ? 'Tarefa atualizada.' : 'Tarefa adicionada.');
    };
    if (task) {
      $('#deleteTaskBtn').onclick = () => {
        if (!confirm(`Excluir “${task.title}”?`)) return;
        deleteTask(task.id);
        closeModal();
      };
    }
  }

  function goalModal(goalId = null) {
    const goal = state.goals.find((item) => item.id === goalId);
    openModal(`
      <div class="modal-head">
        <div><h2>${goal ? 'Atualizar meta' : 'Nova meta'}</h2><p>Alvo, realizado e prazo — sem números demonstrativos.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <form id="goalForm">
        <div class="input-grid">
          <div class="field full"><label>Meta</label><input name="title" required maxlength="120" value="${esc(goal?.title || '')}" placeholder="Ex.: US$ 10 mil por mês" /></div>
          <div class="field"><label>Alvo</label><input name="target" type="number" min="0" step="0.01" required value="${esc(goal?.target ?? '')}" /></div>
          <div class="field"><label>Realizado</label><input name="current" type="number" min="0" step="0.01" value="${esc(goal?.current ?? 0)}" /></div>
          <div class="field"><label>Unidade</label><input name="unit" maxlength="20" value="${esc(goal?.unit || 'R$')}" placeholder="R$, US$, kg…" /></div>
          <div class="field"><label>Prazo</label><input name="deadline" type="date" required value="${esc(goal?.deadline || addDays(localISO(), 90))}" /></div>
          <div class="field full"><label>Observação</label><textarea name="note" placeholder="Opcional">${esc(goal?.note || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          ${goal ? '<button class="danger-button" id="deleteGoalBtn" type="button">Excluir</button>' : ''}
          <button class="soft-button modal-close" type="button">Cancelar</button>
          <button class="primary-button" type="submit">Salvar meta</button>
        </div>
      </form>
    `);
    $('#goalForm').onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const result = upsertGoal(data, goal?.id || null);
      if (!result) return;
      closeModal();
      toast(goal ? 'Meta atualizada.' : 'Meta adicionada.');
    };
    if (goal) {
      $('#deleteGoalBtn').onclick = () => {
        if (!confirm(`Excluir a meta “${goal.title}”?`)) return;
        state.goals = state.goals.filter((item) => item.id !== goal.id);
        state.tasks.forEach((task) => { if (task.goalId === goal.id) task.goalId = ''; });
        save();
        render();
        closeModal();
        toast('Meta removida.');
      };
    }
  }

  function parseCommandDate(text, fallback = state.selectedDate || localISO()) {
    const lower = normalize(text);
    if (lower.includes('depois de amanha')) return addDays(localISO(), 2);
    if (lower.includes('amanha')) return addDays(localISO(), 1);
    if (lower.includes('hoje')) return localISO();
    const dateMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (dateMatch) {
      let year = Number(dateMatch[3] || new Date().getFullYear());
      if (year < 100) year += 2000;
      return `${year}-${String(Number(dateMatch[2])).padStart(2, '0')}-${String(Number(dateMatch[1])).padStart(2, '0')}`;
    }
    const weekdayPatterns = [
      [0, /\b(domingo|dom)\b/], [1, /\b(segunda(?:-feira)?|seg)\b/], [2, /\b(terca(?:-feira)?|ter)\b/],
      [3, /\b(quarta(?:-feira)?|qua)\b/], [4, /\b(quinta(?:-feira)?|qui)\b/], [5, /\b(sexta(?:-feira)?|sex)\b/],
      [6, /\b(sabado|sab)\b/]
    ];
    const weekday = weekdayPatterns.find(([, pattern]) => pattern.test(lower));
    if (weekday) {
      const current = parseISO(localISO()).getDay();
      let offset = (weekday[0] - current + 7) % 7;
      if (offset === 0 && /proxim[ao]/.test(lower)) offset = 7;
      return addDays(localISO(), offset);
    }
    return fallback;
  }

  function parseCommandRepeat(text) {
    const lower = normalize(text);
    const mode = /(apos|depois de)\s+conclu|cada!|every!/.test(lower) ? 'completed' : 'scheduled';
    const endMatch = lower.match(/\b(?:ate|terminando em)\s+(.+)$/);
    const endDate = endMatch ? parseCommandDate(endMatch[1], '') : '';
    if (/\b(todo dia|todos os dias|diariamente|diaria)\b/.test(lower)) return { ...dailyRepeat(mode), endDate };
    if (/\b(dias uteis|segunda a sexta|seg a sex)\b/.test(lower)) return { ...weeklyRepeat([1, 2, 3, 4, 5], mode), endDate };
    if (/\b(todo mes|mensalmente|mensal)\b/.test(lower)) return { type: 'month', interval: 1, days: [], mode, endDate };
    if (/\b(todo ano|anualmente|anual)\b/.test(lower)) return { type: 'year', interval: 1, days: [], mode, endDate };
    const intervalMatch = lower.match(/\b(?:a cada|cada)\s+(\d+)\s+(dia|dias|semana|semanas|mes|meses|ano|anos)\b/);
    if (intervalMatch) {
      const units = { dia: 'day', dias: 'day', semana: 'week', semanas: 'week', mes: 'month', meses: 'month', ano: 'year', anos: 'year' };
      const type = units[intervalMatch[2]] || 'day';
      return { type, interval: clamp(Number(intervalMatch[1]), 1, 365), days: type === 'week' ? [parseISO(parseCommandDate(text)).getDay()] : [], mode, endDate };
    }
    if (/\b(todo|toda|todas|semanalmente|semanal)\b/.test(lower)) {
      const patterns = [
        [0, /\b(domingo|dom)\b/], [1, /\b(segunda(?:-feira)?|seg)\b/], [2, /\b(terca(?:-feira)?|ter)\b/],
        [3, /\b(quarta(?:-feira)?|qua)\b/], [4, /\b(quinta(?:-feira)?|qui)\b/], [5, /\b(sexta(?:-feira)?|sex)\b/],
        [6, /\b(sabado|sab)\b/]
      ];
      const days = patterns.filter(([, pattern]) => pattern.test(lower)).map(([day]) => day);
      return { ...weeklyRepeat(days.length ? days : [parseISO(parseCommandDate(text)).getDay()], mode), endDate };
    }
    return null;
  }

  function parseCommandTime(text) {
    const lower = normalize(text);
    const match = lower.match(/\bas\s*(\d{1,2})(?:(?::|h)(\d{2})?)?\s*(?:h|horas?)?\b|\bpara\s*(\d{1,2})(?::|h)(\d{2})?\b/);
    if (!match) return '';
    const hour = clamp(Number(match[1] || match[3]), 0, 23);
    const minute = clamp(Number(match[2] || match[4] || 0), 0, 59);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function parseCommandDuration(text) {
    const lower = normalize(text);
    const hourMatch = lower.match(/(?:por|duracao de)\s*(\d+(?:[.,]\d+)?)\s*h/);
    if (hourMatch) return Math.max(5, Math.round(Number(hourMatch[1].replace(',', '.')) * 60));
    const minuteMatch = lower.match(/(?:por|duracao de)\s*(\d+)\s*min/);
    return minuteMatch ? Math.max(5, Number(minuteMatch[1])) : Number(state.settings.defaultDuration) || 60;
  }

  function parseCommandReminder(text, hasTime) {
    const lower = normalize(text);
    if (/sem lembrete|nao me lembre/.test(lower)) return null;
    const match = lower.match(/(?:lembre|avise)(?:-me| me)?\s+(\d+)\s*(min|minuto|minutos|h|hora|horas)\s+antes/);
    if (match) return match[2].startsWith('h') ? Number(match[1]) * 60 : Number(match[1]);
    return hasTime ? Number(state.settings.defaultReminder) || 0 : null;
  }

  function parseAmount(text) {
    const lower = normalize(text);
    const candidates = [...lower.matchAll(/(\d+(?:[.,]\d+)?)\s*(milhao|milhoes|mil|mi|k)?\b/g)];
    if (!candidates.length) return null;
    const match = candidates.find((item) => !/\b(?:dia|mes|ano|hora|min)/.test(lower.slice(item.index + item[0].length, item.index + item[0].length + 8))) || candidates[0];
    let value = Number(match[1].replace(',', '.'));
    if (['mil', 'k'].includes(match[2])) value *= 1000;
    if (['milhao', 'milhoes', 'mi'].includes(match[2])) value *= 1000000;
    return value;
  }

  function findTaskInText(text, date = null) {
    const lower = normalize(text);
    const pool = date ? tasksForDate(date) : state.tasks;
    return pool
      .filter((task) => lower.includes(normalize(task.title)) || normalize(task.title).split(/\s+/).some((word) => word.length > 3 && lower.includes(word)))
      .sort((a, b) => normalize(b.title).length - normalize(a.title).length)[0] || null;
  }

  function findGoalInText(text) {
    const lower = normalize(text);
    if (/1\s*(milhao|mi)/.test(lower)) return state.goals.find((goal) => goal.target === 1000000);
    if (/100\s*(mil|k)/.test(lower)) return state.goals.find((goal) => goal.target === 100000);
    if (/30\s*(mil|k)/.test(lower)) return state.goals.find((goal) => goal.target === 30000);
    if (/10\s*(mil|k)/.test(lower)) return state.goals.find((goal) => goal.target === 10000);
    return state.goals.find((goal) => lower.includes(normalize(goal.title))) || null;
  }

  function cleanTaskTitle(text) {
    return String(text)
      .replace(/^(adicione|adicionar|crie|criar|coloque|anote|nova tarefa|tarefa)\s+/i, '')
      .replace(/\s+tod[ao]s?\s+(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:\s*,?\s*(?:e\s+)?(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo))*.*$/i, '')
      .replace(/\s+(todo dia|todos os dias|diariamente|dias úteis|dias uteis|segunda a sexta|seg a sex|todo mês|todo mes|mensalmente|todo ano|anualmente|a cada\s+\d+\s+(?:dias?|semanas?|meses?|anos?)|toda?s?\s+(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:\s+e\s+(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo))*)(?=\s|$).*$/i, '')
      .replace(/\s+(depois de amanhã|depois de amanha|amanhã|amanha|hoje)(?=\s|$).*$/i, '')
      .replace(/\s+(?:próxima|proxima|próximo|proximo)?\s*(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?(?=\s|$).*$/i, '')
      .replace(/\s+(?:(?:às|as)\s+\d{1,2}(?::|h)?\d{0,2}\s*(?:h|horas?)?|para\s+\d{1,2}(?::|h)\d{0,2}).*$/i, '')
      .replace(/\s+por\s+\d+(?:[.,]\d+)?\s*(?:h|horas?|min|minutos?).*$/i, '')
      .replace(/\s+(?:me\s+)?(?:lembre|avise).*$/i, '')
      .trim()
      .replace(/[.!,;]+$/, '');
  }

  function executeCommand(raw) {
    const text = String(raw || '').trim();
    const lower = normalize(text);
    if (!lower) return 'Escreva um pedido para eu executar.';

    if (/(zer|reset|limp).*(valor|realiz|progresso).*(meta)|(?:meta).*(zer|reset|limp)/.test(lower)) {
      state.goals.forEach((goal) => { goal.current = 0; });
      save();
      render();
      return '<strong>Pronto.</strong> Zerei apenas os valores realizados. Alvos e prazos foram mantidos.';
    }

    if (/(mostrar|abrir|ver|ir para).*(amanha)|o que.*amanha/.test(lower)) {
      state.selectedDate = addDays(localISO(), 1);
      state.view = 'today';
      save();
      render();
      const count = tasksForDate(state.selectedDate, { includeCompleted: false }).length;
      return `<strong>Amanhã aberto.</strong> Há ${count} tarefa${count === 1 ? '' : 's'} pendente${count === 1 ? '' : 's'}.`;
    }

    if (/^(conclu\w*|finaliz\w*|feito|terminei|termine)\b/.test(lower) || /(marque|marcar).*(conclu|feito)/.test(lower)) {
      const date = parseCommandDate(text);
      const task = findTaskInText(text, date) || findTaskInText(text);
      if (!task) return 'Não encontrei qual tarefa você quer concluir. Diga o nome dela.';
      if (!isTaskDone(task, date)) toggleTask(task.id, date);
      return `<strong>Concluída:</strong> ${esc(task.title)}. Ela saiu da lista principal e foi arquivada.`;
    }

    if (/(mova|mover|reagend|remarc)/.test(lower)) {
      const task = findTaskInText(text);
      if (!task) return 'Não encontrei a tarefa que você quer reagendar.';
      task.date = parseCommandDate(text, task.date);
      const time = parseCommandTime(text);
      if (time) task.time = time;
      task.completedAt = null;
      save();
      render();
      return `<strong>Reagendada:</strong> ${esc(task.title)} para ${esc(formatLongDate(task.date))}${task.time ? ` às ${esc(task.time)}` : ''}.`;
    }

    if (/(atualiz|coloque|registre|fiz|bati).*(meta)|(?:meta).*(atualiz|coloque|registre)/.test(lower)) {
      const goal = findGoalInText(text);
      const value = parseAmount(text);
      if (!goal || value == null) return 'Diga qual meta e o valor realizado. Ex.: “coloque 5 mil na meta de 30 mil”.';
      goal.current = value;
      save();
      render();
      return `<strong>Meta atualizada.</strong> ${esc(goal.title)} agora está em ${esc(formatGoalValue(goal, goal.current))}.`;
    }

    if (/(crie|criar|adicione|nova).*(meta)/.test(lower)) {
      const target = parseAmount(text);
      if (!target) return 'Qual é o valor-alvo da nova meta?';
      const unit = /us\$|dolar|dolares/.test(lower) ? 'US$' : /r\$|reais|real/.test(lower) ? 'R$' : 'unid.';
      const deadline = parseCommandDate(text, addDays(localISO(), 90));
      const title = text.replace(/^(crie|criar|adicione|nova)\s+(uma\s+)?meta\s+(de\s+)?/i, '').replace(/\s+(até|ate)\s+.*$/i, '').trim() || `Meta de ${unit} ${target}`;
      const goal = upsertGoal({ title, target, current: 0, unit, deadline, note: '' });
      return goal ? `<strong>Meta criada:</strong> ${esc(goal.title)}, com prazo em ${esc(formatShortDate(goal.deadline))}.` : 'Não consegui criar a meta com esses dados.';
    }

    if (/(adicione|adicionar|crie|criar|coloque|anote|nova tarefa|tarefa)/.test(lower)) {
      const date = parseCommandDate(text);
      const time = parseCommandTime(text);
      const duration = parseCommandDuration(text);
      const title = cleanTaskTitle(text) || 'Nova tarefa';
      const repeat = parseCommandRepeat(text);
      const recurrence = repeat ? 'custom' : 'none';
      const reminder = parseCommandReminder(text, Boolean(time));
      const mentionedGoal = findGoalInText(text);
      const task = upsertTask({ title, date, time, duration, recurrence, repeat, reminder, goalId: mentionedGoal?.id || '', notes: '' });
      return task ? `<strong>Tarefa criada:</strong> ${esc(task.title)} em ${esc(formatLongDate(task.date))}${task.time ? ` às ${esc(task.time)}` : ''}${repeat ? ` · ${esc(recurrenceLabel(task))}` : ''}.` : 'Não consegui identificar o nome da tarefa.';
    }

    if (/(o que|quais|liste|mostre).*(tarefa|tenho|agenda)/.test(lower)) {
      const date = parseCommandDate(text);
      const tasks = tasksForDate(date, { includeCompleted: false });
      if (!tasks.length) return `Você não tem tarefas pendentes em ${esc(formatDayLabel(date).toLowerCase())}.`;
      return `<strong>${esc(formatDayLabel(date))}:</strong> ${tasks.map((task) => esc(task.title)).join(' · ')}.`;
    }

    return 'Ainda não reconheci esse pedido. Posso criar, concluir ou reagendar tarefas; abrir amanhã; criar/atualizar metas; e zerar os valores realizados.';
  }

  function commandModal() {
    openModal(`
      <div class="modal-head">
        <div><h2>Assistente</h2><p>Ele executa comandos sobre tarefas e metas — de verdade, sem botão decorativo.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <input id="commandInput" class="command-input" placeholder="Ex.: adicione estudar russo amanhã às 10h" autocomplete="off" />
      <div class="command-hints">
        <button type="button">Mostre minhas tarefas de amanhã</button>
        <button type="button">Adicione estudar russo todo dia às 10h por 45 min</button>
        <button type="button">Adicione treino toda segunda, quarta e sexta às 18h</button>
        <button type="button">Zere os valores realizados das metas</button>
        <button type="button">Coloque 5 mil na meta de 30 mil</button>
      </div>
      <div id="commandResult" class="command-result">Peça algo e eu confirmo exatamente o que foi alterado.</div>
    `, 'command-modal');
    const input = $('#commandInput');
    const run = () => {
      const result = executeCommand(input.value);
      $('#commandResult').innerHTML = result;
      input.select();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        run();
      }
    });
    $$('.command-hints button').forEach((button) => {
      button.onclick = () => {
        input.value = button.textContent;
        run();
      };
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `objetivos-backup-${localISO()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Backup exportado.');
  }

  function settingsModal() {
    const activeTheme = state.settings.theme === 'custom' || themePresets[state.settings.theme] ? state.settings.theme : 'spatial';
    const activePalette = activeTheme === 'custom' ? {
      accent: state.settings.customAccent,
      background: state.settings.customBackground,
      glass: state.settings.customGlass,
      module: state.settings.customModule,
      glow: state.settings.customGlow || state.settings.customAmbient,
      intensity: state.settings.colorIntensity,
      glassOpacity: state.settings.glassOpacity,
      moduleOpacity: state.settings.moduleOpacity,
      glassBlur: state.settings.glassBlur
    } : themePresets[activeTheme];
    const notificationPermission = 'Notification' in globalThis ? Notification.permission : 'unsupported';
    const routineCount = state.tasks.filter((task) => task.routine).length;
    openModal(`
      <div class="modal-head">
        <div><h2>Configurações</h2><p>Cores, movimento, recorrências e comportamento do seu Spatial OS.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <section class="appearance-panel">
        <div class="settings-section-head"><strong>Estúdio de aparência</strong><span>Cada camada do Spatial OS é ajustável.</span></div>
        <div class="theme-presets">
          ${Object.entries(themePresets).map(([id, preset]) => `
            <button class="theme-preset ${activeTheme === id ? 'active' : ''}" data-theme-choice="${id}" type="button" style="--swatch:${preset.accent};--swatch-bg:${preset.background}">
              <i></i><span>${preset.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="color-controls">
          <label><span>Destaque</span><input id="accentColor" type="color" value="${esc(activePalette.accent)}" /></label>
          <label><span>Fundo</span><input id="backgroundColor" type="color" value="${esc(activePalette.background)}" /></label>
          <label><span>Glass</span><input id="glassColor" type="color" value="${esc(activePalette.glass)}" /></label>
          <label><span>Cards</span><input id="moduleColor" type="color" value="${esc(activePalette.module)}" /></label>
          <label><span>Glow</span><input id="glowColor" type="color" value="${esc(activePalette.glow)}" /></label>
        </div>
        <div class="appearance-sliders">
          <label><span>Glow <output id="glowIntensityValue">${esc(activePalette.intensity)}%</output></span><input id="colorIntensity" type="range" min="0" max="100" value="${esc(activePalette.intensity)}" /></label>
          <label><span>Transparência glass <output id="glassOpacityValue">${esc(activePalette.glassOpacity)}%</output></span><input id="glassOpacity" type="range" min="20" max="100" value="${esc(activePalette.glassOpacity)}" /></label>
          <label><span>Transparência cards <output id="moduleOpacityValue">${esc(activePalette.moduleOpacity)}%</output></span><input id="moduleOpacity" type="range" min="20" max="100" value="${esc(activePalette.moduleOpacity)}" /></label>
          <label><span>Blur glass <output id="glassBlurValue">${esc(activePalette.glassBlur)}px</output></span><input id="glassBlur" type="range" min="0" max="50" value="${esc(activePalette.glassBlur)}" /></label>
        </div>
      </section>
      <div class="settings-list">
        <div class="setting-row">
          <div class="setting-copy"><strong>Rotina Operação Moscou</strong><span>${routineCount} recorrências configuradas: acordar 07:00, refeições, estudo, TikTok, corpo, marketing e russo.</span></div>
          <button class="soft-button" id="restoreRoutineBtn" type="button">Restaurar</button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Lembretes neste aparelho</strong><span>${notificationPermission === 'granted' ? 'Permissão concedida. Alertas funcionam enquanto o sistema mantém o app ativo.' : 'Ative a permissão para receber alertas das tarefas com horário.'}</span></div>
          <label class="native-switch"><input id="notificationToggle" type="checkbox" switch ${state.settings.notificationsEnabled ? 'checked' : ''}/><span></span></label>
        </div>
        <div class="setting-row" id="pushSettingRow">
          <div class="setting-copy"><strong>Notificar com o app fechado</strong><span id="pushStatusCopy">Conecte sua conta para ativar os alertas Web Push.</span></div>
          <button class="soft-button" id="pushServerBtn" type="button">Ativar</button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Movimento Spatial</strong><span>Transições elásticas, swipe nos dias e saída animada ao concluir.</span></div>
          <label class="native-switch"><input id="motionToggle" type="checkbox" switch ${state.settings.motion !== false ? 'checked' : ''}/><span></span></label>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Feedback tátil</strong><span>Vibra onde o navegador permite; os switches usam o toque nativo do iOS 18+.</span></div>
          <label class="native-switch"><input id="hapticToggle" type="checkbox" switch ${state.settings.haptics !== false ? 'checked' : ''}/><span></span></label>
        </div>
        <div class="setting-row swipe-setting">
          <div class="setting-copy"><strong>Ações ao arrastar</strong><span>Mesmo princípio do Todoist: escolha o que cada direção faz.</span></div>
          <div class="swipe-selects">
            <label>← <select id="swipeLeft"><option value="complete" ${state.settings.swipeLeft === 'complete' ? 'selected' : ''}>Concluir</option><option value="schedule" ${state.settings.swipeLeft === 'schedule' ? 'selected' : ''}>Reagendar</option><option value="none" ${state.settings.swipeLeft === 'none' ? 'selected' : ''}>Nada</option></select></label>
            <label>→ <select id="swipeRight"><option value="schedule" ${state.settings.swipeRight === 'schedule' ? 'selected' : ''}>Reagendar</option><option value="complete" ${state.settings.swipeRight === 'complete' ? 'selected' : ''}>Concluir</option><option value="none" ${state.settings.swipeRight === 'none' ? 'selected' : ''}>Nada</option></select></label>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Salvamento automático</strong><span>Cada tarefa, conclusão e alteração de meta é salva neste navegador imediatamente.</span></div>
          <span class="deadline-chip">ativo</span>
        </div>
        <div class="setting-row" id="cloudSettingRow">
          <div class="setting-copy"><strong>Celular ↔ computador</strong><span id="cloudStatusCopy">Verificando o servidor seguro…</span></div>
          <button class="google-signin-button" id="cloudAccountBtn" type="button" aria-label="Continuar com Google">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-4V7.4H3.2a10 10 0 0 0 0 9.2L6.5 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.4L6.5 10A5.8 5.8 0 0 1 12 6Z"/></svg>
            <span>Continuar com Google</span>
          </button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Backup</strong><span>Leve todas as tarefas e metas em um arquivo JSON.</span></div>
          <div><button class="soft-button" id="exportBtn" type="button">Exportar</button> <button class="soft-button" id="importBtn" type="button">Importar</button><input id="importFile" type="file" accept="application/json" hidden /></div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Progresso das metas</strong><span>Zera somente o realizado; mantém alvos e prazos.</span></div>
          <button class="danger-button" id="resetGoalsBtn" type="button">Zerar</button>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Todas as tarefas</strong><span>Apaga tarefas pendentes, recorrências e histórico de conclusão.</span></div>
          <button class="danger-button" id="clearTasksBtn" type="button">Apagar</button>
        </div>
      </div>
    `);
    const refreshThemeButtons = () => {
      $$('.theme-preset').forEach((button) => button.classList.toggle('active', button.dataset.themeChoice === state.settings.theme));
    };
    const refreshAppearanceOutputs = () => {
      $('#glowIntensityValue').textContent = `${$('#colorIntensity').value}%`;
      $('#glassOpacityValue').textContent = `${$('#glassOpacity').value}%`;
      $('#moduleOpacityValue').textContent = `${$('#moduleOpacity').value}%`;
      $('#glassBlurValue').textContent = `${$('#glassBlur').value}px`;
    };
    const syncAppearanceInputs = (palette) => {
      $('#accentColor').value = palette.accent;
      $('#backgroundColor').value = palette.background;
      $('#glassColor').value = palette.glass;
      $('#moduleColor').value = palette.module;
      $('#glowColor').value = palette.glow;
      $('#colorIntensity').value = palette.intensity;
      $('#glassOpacity').value = palette.glassOpacity;
      $('#moduleOpacity').value = palette.moduleOpacity;
      $('#glassBlur').value = palette.glassBlur;
      refreshAppearanceOutputs();
    };
    $$('.theme-preset').forEach((button) => {
      button.onclick = () => {
        state.settings.theme = button.dataset.themeChoice;
        const preset = themePresets[state.settings.theme];
        state.settings.customAccent = preset.accent;
        state.settings.customBackground = preset.background;
        state.settings.customGlass = preset.glass;
        state.settings.customModule = preset.module;
        state.settings.customGlow = preset.glow;
        state.settings.customAmbient = preset.glow;
        state.settings.colorIntensity = preset.intensity;
        state.settings.glassOpacity = preset.glassOpacity;
        state.settings.moduleOpacity = preset.moduleOpacity;
        state.settings.glassBlur = preset.glassBlur;
        syncAppearanceInputs(preset);
        applyAppearance();
        save();
        refreshThemeButtons();
        haptic('select');
      };
    });
    const applyCustomAppearance = () => {
      state.settings.theme = 'custom';
      state.settings.customAccent = $('#accentColor').value;
      state.settings.customBackground = $('#backgroundColor').value;
      state.settings.customGlass = $('#glassColor').value;
      state.settings.customModule = $('#moduleColor').value;
      state.settings.customGlow = $('#glowColor').value;
      state.settings.customAmbient = state.settings.customGlow;
      state.settings.colorIntensity = Number($('#colorIntensity').value);
      state.settings.glassOpacity = Number($('#glassOpacity').value);
      state.settings.moduleOpacity = Number($('#moduleOpacity').value);
      state.settings.glassBlur = Number($('#glassBlur').value);
      refreshAppearanceOutputs();
      applyAppearance();
      save();
      refreshThemeButtons();
    };
    ['accentColor', 'backgroundColor', 'glassColor', 'moduleColor', 'glowColor', 'colorIntensity', 'glassOpacity', 'moduleOpacity', 'glassBlur']
      .forEach((id) => { $(`#${id}`).oninput = applyCustomAppearance; });
    $('#motionToggle').onchange = (event) => { state.settings.motion = event.target.checked; applyAppearance(); save(); };
    $('#hapticToggle').onchange = (event) => { state.settings.haptics = event.target.checked; save(); haptic('select'); };
    $('#swipeLeft').onchange = (event) => { state.settings.swipeLeft = event.target.value; save(); };
    $('#swipeRight').onchange = (event) => { state.settings.swipeRight = event.target.value; save(); };
    $('#notificationToggle').onchange = async (event) => {
      if (!event.target.checked) {
        state.settings.notificationsEnabled = false;
        save();
        return;
      }
      if (!('Notification' in globalThis)) {
        event.target.checked = false;
        toast('Este navegador não oferece notificações web.');
        return;
      }
      const permission = await Notification.requestPermission();
      state.settings.notificationsEnabled = permission === 'granted';
      event.target.checked = state.settings.notificationsEnabled;
      save();
      startNotificationClock();
      toast(permission === 'granted' ? 'Lembretes ativados neste aparelho.' : 'Permissão de notificação não concedida.');
    };
    $('#restoreRoutineBtn').onclick = () => {
      if (!confirm('Restaurar a rotina planejada? Tarefas pessoais não serão apagadas.')) return;
      state.tasks = state.tasks.filter((task) => !task.routine);
      state.tasks.push(...seedRoutine());
      state.settings.routineVersion = ROUTINE_VERSION;
      save();
      render();
      closeModal();
      toast('Rotina recorrente restaurada.');
    };
    $('#exportBtn').onclick = exportBackup;
    $('#importBtn').onclick = () => $('#importFile').click();
    $('#importFile').onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = sanitizeState(JSON.parse(await file.text()));
        state = parsed;
        applyAppearance();
        save();
        render();
        closeModal();
        toast('Backup importado.');
      } catch {
        toast('Esse backup não é válido.');
      }
    };
    $('#resetGoalsBtn').onclick = () => {
      if (!confirm('Zerar todos os valores realizados sem alterar os alvos e prazos?')) return;
      state.goals.forEach((goal) => { goal.current = 0; });
      save();
      render();
      closeModal();
      toast('Valores realizados zerados.');
    };
    $('#clearTasksBtn').onclick = () => {
      if (!confirm('Apagar todas as tarefas e conclusões? Essa ação não altera as metas.')) return;
      state.tasks = [];
      save();
      render();
      closeModal();
      toast('Todas as tarefas foram apagadas.');
    };
    window.OBJETIVOS_CLOUD?.bindSettings?.();
  }

  function resetGoalValues() {
    if (!confirm('Zerar todos os valores realizados e manter alvos e prazos?')) return;
    state.goals.forEach((goal) => { goal.current = 0; });
    save();
    render();
    toast('Realizados zerados; metas preservadas.');
  }

  function moveOverdueToday() {
    const overdue = overdueTasks();
    overdue.forEach((task) => { task.date = localISO(); });
    save();
    render();
    toast(`${overdue.length} tarefa${overdue.length === 1 ? '' : 's'} reagendada${overdue.length === 1 ? '' : 's'} para hoje.`);
  }

  function syncSystemDay({ forceToday = false } = {}) {
    const current = localISO();
    const changed = current !== systemDate;
    systemDate = current;
    if (!changed && !forceToday) return false;
    if (forceToday || state.view === 'today') {
      state.selectedDate = current;
    }
    state.lastSystemDate = current;
    save();
    motionDirection = 'forward';
    render();
    if (changed) toast('Novo dia aberto automaticamente.');
    return true;
  }

  function scheduleMidnightRollover() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    midnightTimer = setTimeout(() => {
      syncSystemDay();
      scheduleMidnightRollover();
    }, Math.max(1000, midnight - now));
  }

  function readNotificationLog() {
    try { return JSON.parse(localStorage.getItem(NOTIFICATION_LOG_KEY) || '{}'); } catch { return {}; }
  }

  function writeNotificationLog(log) {
    const entries = Object.entries(log).sort((a, b) => b[1] - a[1]).slice(0, 300);
    localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  async function showTaskNotification(task, date) {
    const recurrence = recurrenceLabel(task);
    const options = {
      body: `${task.time} · ${formatDuration(task.duration)}${recurrence ? ` · ${recurrence}` : ''}`,
      icon: './assets/icon.svg',
      badge: './assets/icon.svg',
      tag: `task-${task.id}-${date}`,
      renotify: false,
      data: { taskId: task.id, date, url: `./?date=${date}` }
    };
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration?.showNotification) await registration.showNotification(task.title, options);
      else if ('Notification' in globalThis) new Notification(task.title, options);
    } catch {
      // Permission or platform support can change outside the app.
    }
  }

  function checkDueNotifications() {
    if (!state.settings.notificationsEnabled || !('Notification' in globalThis) || Notification.permission !== 'granted') return;
    const now = new Date();
    const log = readNotificationLog();
    [localISO(now), addDays(localISO(now), 1)].forEach((date) => {
      tasksForDate(date, { includeCompleted: false }).forEach((task) => {
        if (!task.time || task.reminder == null) return;
        const due = parseISO(date);
        const [hour, minute] = task.time.split(':').map(Number);
        due.setHours(hour, minute, 0, 0);
        const trigger = due.getTime() - Number(task.reminder) * 60000;
        const distance = now.getTime() - trigger;
        const key = `${task.id}|${date}|${task.time}|${task.reminder}`;
        if (distance >= 0 && distance <= 10 * 60000 && !log[key]) {
          log[key] = Date.now();
          showTaskNotification(task, date);
        }
      });
    });
    writeNotificationLog(log);
  }

  function startNotificationClock() {
    if (notificationTimer) clearInterval(notificationTimer);
    checkDueNotifications();
    notificationTimer = setInterval(checkDueNotifications, 30000);
  }

  function resetDraggedNode(node) {
    if (!node) return;
    node.classList.remove('is-dragging', 'drag-left', 'drag-right');
    node.style.removeProperty('transform');
    node.style.removeProperty('opacity');
  }

  document.addEventListener('touchstart', (event) => {
    if (event.touches?.length !== 1) {
      viewportTouch = null;
      return;
    }
    const touch = event.touches[0];
    viewportTouch = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!viewportTouch || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - viewportTouch.x;
    const dy = touch.clientY - viewportTouch.y;
    if (Math.abs(dy) < 7 || Math.abs(dy) <= Math.abs(dx)) return;

    const modal = event.target.closest?.('.modal');
    if (document.body?.classList.contains('modal-open') && !modal) {
      event.preventDefault();
      return;
    }

    const scroller = modal || $('#appShell');
    if (!scroller) {
      event.preventDefault();
      return;
    }
    const atTop = scroller.scrollTop <= 0;
    const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
    if ((dy > 0 && atTop) || (dy < 0 && atBottom)) event.preventDefault();
  }, { passive: false });

  const clearViewportTouch = () => { viewportTouch = null; };
  document.addEventListener('touchend', clearViewportTouch, { passive: true });
  document.addEventListener('touchcancel', clearViewportTouch, { passive: true });

  document.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    const strip = event.target.closest('.day-strip');
    if (strip) {
      dayDrag = { node: strip, startX: event.clientX, startY: event.clientY, dx: 0, horizontal: null };
      return;
    }
    const card = event.target.closest('.task-card:not(.completed)');
    if (!card || event.target.closest('button,input,select,a')) return;
    taskDrag = { node: card, startX: event.clientX, startY: event.clientY, dx: 0, horizontal: null };
  });

  document.addEventListener('pointermove', (event) => {
    const drag = dayDrag || taskDrag;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.horizontal == null && Math.max(Math.abs(dx), Math.abs(dy)) > 7) drag.horizontal = Math.abs(dx) > Math.abs(dy);
    if (drag.horizontal === false) return;
    if (drag.horizontal !== true) return;
    event.preventDefault();
    drag.dx = dx;
    drag.node.classList.add('is-dragging');
    drag.node.classList.toggle('drag-left', dx < 0);
    drag.node.classList.toggle('drag-right', dx > 0);
    const limit = drag === dayDrag ? 68 : 110;
    const translated = clamp(dx, -limit, limit);
    drag.node.style.transform = `translate3d(${translated}px,0,0)`;
    drag.node.style.opacity = String(1 - Math.min(Math.abs(translated) / 420, .18));
  }, { passive: false });

  document.addEventListener('pointerup', () => {
    if (dayDrag) {
      const { node, dx, horizontal } = dayDrag;
      dayDrag = null;
      resetDraggedNode(node);
      if (horizontal && Math.abs(dx) >= 42) {
        suppressDayClick = true;
        setTimeout(() => { suppressDayClick = false; }, 400);
        const forward = dx < 0;
        selectCalendarDate(addDays(state.selectedDate, forward ? 1 : -1), forward ? 'forward' : 'backward');
      }
      return;
    }
    if (!taskDrag) return;
    const { node, dx, horizontal } = taskDrag;
    taskDrag = null;
    const direction = dx < 0 ? 'left' : 'right';
    const action = direction === 'left' ? state.settings.swipeLeft : state.settings.swipeRight;
    if (!horizontal || Math.abs(dx) < 64 || action === 'none') {
      resetDraggedNode(node);
      return;
    }
    suppressTaskClick = true;
    setTimeout(() => { suppressTaskClick = false; }, 400);
    const taskId = node.dataset.taskId;
    const date = node.dataset.taskDate || state.selectedDate;
    if (action === 'complete') {
      node.classList.remove('is-dragging');
      node.classList.add('is-completing');
      setTimeout(() => toggleTask(taskId, date), 180);
      return;
    }
    resetDraggedNode(node);
    haptic('select');
    setTimeout(() => taskModal(taskId), 80);
  });

  document.addEventListener('pointercancel', () => {
    resetDraggedNode(dayDrag?.node);
    resetDraggedNode(taskDrag?.node);
    dayDrag = null;
    taskDrag = null;
  });

  document.addEventListener('click', (event) => {
    if (suppressDayClick && event.target.closest('.day-strip')) {
      suppressDayClick = false;
      event.preventDefault();
      return;
    }
    if (suppressTaskClick && event.target.closest('.task-card')) {
      suppressTaskClick = false;
      event.preventDefault();
      return;
    }
    const close = event.target.closest('.modal-close');
    if (close) {
      closeModal();
      return;
    }
    if (event.target === $('#modalLayer')) {
      closeModal();
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const { action, id, date } = actionButton.dataset;
    const actions = {
      addTask: () => taskModal(null, state.selectedDate),
      addGoal: () => goalModal(),
      editTask: () => taskModal(id),
      editGoal: () => goalModal(id),
      toggleTask: () => animatedToggleTask(actionButton, id, date || state.selectedDate),
      previousDay: () => selectCalendarDate(addDays(state.selectedDate, -1), 'backward'),
      nextDay: () => selectCalendarDate(addDays(state.selectedDate, 1), 'forward'),
      todayNow: () => selectCalendarDate(localISO(), state.selectedDate > localISO() ? 'backward' : 'forward'),
      selectDate: () => selectCalendarDate(date, date >= state.selectedDate ? 'forward' : 'backward'),
      selectUpcomingDate: () => selectCalendarDate(date, 'forward'),
      toggleCompletedDrawer: () => {
        const drawer = $('#completedDrawer');
        if (!drawer) return;
        const expanded = drawer.classList.toggle('open');
        $('.completed-toggle', drawer)?.setAttribute('aria-expanded', String(expanded));
      },
      resetGoalValues,
      moveOverdueToday
    };
    actions[action]?.();
  });

  $('#commandBtn').onclick = commandModal;
  $('#settingsBtn').onclick = settingsModal;
  $('#quickAdd').onclick = () => taskModal(null, state.view === 'today' ? state.selectedDate : localISO());

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = sanitizeState(JSON.parse(event.newValue));
      if ((incoming.revision || 0) <= (state.revision || 0)) return;
      state = incoming;
      render({ quiet: true });
      setSaveStatus('atualizado');
    } catch {
      // Ignore malformed external storage updates.
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    }
    syncSystemDay();
    checkDueNotifications();
  });
  window.addEventListener('focus', () => { syncSystemDay(); checkDueNotifications(); });
  window.addEventListener('pageshow', () => syncSystemDay());
  window.addEventListener('beforeunload', () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let pwaReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pwaReloading) return;
      pwaReloading = true;
      const freshUrl = new URL(location.href);
      freshUrl.searchParams.set('build', '17');
      location.replace(freshUrl.href);
    });
    navigator.serviceWorker.register('./sw.js?v=17').then((registration) => registration.update()).catch(() => {});
  }

  window.__OBJETIVOS__ = {
    getState: () => JSON.parse(JSON.stringify(state)),
    tasksForDate,
    overdueTasks,
    goalProgress,
    toggleTask,
    upsertTask,
    upsertGoal,
    executeCommand,
    isTaskOnDate,
    recurrenceLabel,
    syncSystemDay,
    applyCloudState(input) {
      const currentView = state.view;
      const currentDate = state.selectedDate;
      const notificationSetting = state.settings.notificationsEnabled;
      const incoming = sanitizeState(input);
      incoming.view = currentView;
      incoming.selectedDate = currentDate;
      incoming.lastSystemDate = localISO();
      incoming.settings.notificationsEnabled = notificationSetting;
      state = incoming;
      applyAppearance();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      channel?.postMessage?.({ source: INSTANCE_ID, state });
      render({ quiet: true });
      setSaveStatus('sincronizado');
      return JSON.parse(JSON.stringify(state));
    },
    setSyncLabel(label, saving = false) { setSaveStatus(label, saving); },
    reset() {
      state = freshState();
      save();
      render();
    }
  };

  scheduleMidnightRollover();
  startNotificationClock();
  render();
})();
