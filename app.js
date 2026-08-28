(() => {
  'use strict';

  const STORAGE_KEY = 'objetivos-spatial-os-v2';
  const LEGACY_KEY = 'objetivos-spatial-os-v1';
  const CHANNEL_NAME = 'objetivos-spatial-os-sync';
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
    return {
      version: 2,
      view: 'today',
      selectedDate: localISO(),
      tasks: [],
      goals: seedGoals(),
      settings: {
        hideCompleted: true,
        defaultDuration: 60
      },
      updatedAt: new Date().toISOString(),
      revision: 0
    };
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
      next.tasks = userTasks;
      next.goals.push(...userGoals);
    } catch {
      return next;
    }
    return next;
  }

  function sanitizeState(input) {
    const base = freshState();
    if (!input || typeof input !== 'object') return base;
    return {
      ...base,
      ...input,
      version: 2,
      view: ['today', 'upcoming', 'goals'].includes(input.view) ? input.view : 'today',
      selectedDate: /^\d{4}-\d{2}-\d{2}$/.test(input.selectedDate || '') ? input.selectedDate : localISO(),
      tasks: Array.isArray(input.tasks) ? input.tasks : [],
      goals: Array.isArray(input.goals) && input.goals.length ? input.goals : seedGoals(),
      settings: { ...base.settings, ...(input.settings || {}) }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitizeState(JSON.parse(raw));
    } catch {
      // A clean state is safer than a broken boot.
    }
    const migrated = migrateLegacy();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  let state = loadState();
  let channel = null;
  let suppressBroadcast = false;

  try {
    channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (!event.data?.state || event.data.source === INSTANCE_ID) return;
        const incoming = sanitizeState(event.data.state);
        if ((incoming.revision || 0) <= (state.revision || 0)) return;
        suppressBroadcast = true;
        state = incoming;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        suppressBroadcast = false;
        render();
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
    requestAnimationFrame(() => setSaveStatus('salvo neste aparelho'));
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    $('#toastLayer').append(node);
    setTimeout(() => node.remove(), 2600);
  }

  function isTaskOnDate(task, date) {
    if (!task || date < task.date) return false;
    const recurrence = task.recurrence || 'none';
    if (recurrence === 'none') return task.date === date;
    const weekday = parseISO(date).getDay();
    if (recurrence === 'daily') return true;
    if (recurrence === 'weekdays') return weekday >= 1 && weekday <= 5;
    if (recurrence === 'weekly') return weekday === parseISO(task.date).getDay();
    return task.date === date;
  }

  function isTaskDone(task, date) {
    if ((task.recurrence || 'none') === 'none') return Boolean(task.completedAt);
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
      .filter((task) => (task.recurrence || 'none') === 'none' && task.date < localISO() && !task.completedAt)
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

  function recurrenceLabel(value) {
    return ({ none: '', daily: 'todo dia', weekdays: 'seg–sex', weekly: 'semanal' })[value || 'none'] || '';
  }

  function toggleTask(taskId, date = state.selectedDate) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const recurring = (task.recurrence || 'none') !== 'none';
    const done = isTaskDone(task, date);
    if (recurring) {
      task.completions ||= {};
      if (done) delete task.completions[date];
      else task.completions[date] = Date.now();
    } else {
      task.completedAt = done ? null : Date.now();
    }
    save();
    render();
    toast(done ? 'Tarefa devolvida para a lista.' : 'Concluída e arquivada.');
  }

  function deleteTask(taskId) {
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    save();
    render();
    toast('Tarefa removida.');
  }

  function upsertTask(data, existingId = null) {
    const existing = state.tasks.find((task) => task.id === existingId);
    const task = {
      id: existing?.id || uid('task'),
      title: String(data.title || '').trim(),
      date: data.date || state.selectedDate || localISO(),
      time: data.time || '',
      duration: Math.max(5, Number(data.duration) || Number(state.settings.defaultDuration) || 60),
      recurrence: data.recurrence || 'none',
      goalId: data.goalId || '',
      notes: String(data.notes || '').trim(),
      createdAt: existing?.createdAt || Date.now(),
      completedAt: existing?.completedAt || null,
      completions: existing?.completions || {}
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
    state.view = view;
    if (view === 'today' && !state.selectedDate) state.selectedDate = localISO();
    save();
    render();
    requestAnimationFrame(() => $('#viewRoot')?.focus());
  }

  function renderNav() {
    $('#bottomDock').innerHTML = navItems.map((item) => `
      <button class="dock-button ${state.view === item.id ? 'active' : ''}" data-view="${item.id}" type="button">
        <span class="dock-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');
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

  function taskCard(task, date, { overdue = false, completed = false } = {}) {
    const goal = goalById(task.goalId);
    const recurrence = recurrenceLabel(task.recurrence);
    const taskDate = overdue ? formatShortDate(task.date) : '';
    const time = task.time || 'sem horário';
    return `
      <article class="task-card ${overdue ? 'overdue' : ''} ${completed ? 'completed' : ''}" data-task-id="${task.id}">
        <button class="task-check" data-action="toggleTask" data-id="${task.id}" data-date="${date}" type="button" aria-label="${completed ? 'Desfazer conclusão' : 'Concluir tarefa'}">${completed ? '✓' : '✓'}</button>
        <div class="task-copy">
          <div class="task-title">${esc(task.title)}</div>
          <div class="task-meta">
            <span class="time-accent">${taskDate ? `${esc(taskDate)} · ` : ''}${esc(time)}</span>
            <span>· ${esc(formatDuration(task.duration))}</span>
            ${recurrence ? `<span>↻ ${esc(recurrence)}</span>` : ''}
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
        <button class="completed-toggle" data-action="toggleCompletedDrawer" type="button">▸ ${completed.length} concluída${completed.length === 1 ? '' : 's'} — toque para ver</button>
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

  function render() {
    renderNav();
    const views = { today: renderToday, upcoming: renderUpcoming, goals: renderGoals };
    $('#viewRoot').innerHTML = (views[state.view] || renderToday)();
  }

  function openModal(content, className = '') {
    const layer = $('#modalLayer');
    layer.classList.add('open');
    layer.innerHTML = `<section class="modal glass ${className}" role="dialog" aria-modal="true">${content}</section>`;
    requestAnimationFrame(() => {
      const firstField = $('input:not([type="hidden"]),textarea,select', layer);
      (firstField || $('button', layer))?.focus();
    });
  }

  function closeModal() {
    const layer = $('#modalLayer');
    layer.classList.remove('open');
    layer.innerHTML = '';
  }

  function taskModal(taskId = null, presetDate = null) {
    const task = state.tasks.find((item) => item.id === taskId);
    const date = presetDate || task?.date || state.selectedDate || localISO();
    openModal(`
      <div class="modal-head">
        <div><h2>${task ? 'Editar tarefa' : 'Nova tarefa'}</h2><p>Tudo é salvo automaticamente quando você confirma.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <form id="taskForm">
        <div class="input-grid">
          <div class="field full"><label>Tarefa</label><input name="title" required maxlength="120" value="${esc(task?.title || '')}" placeholder="O que precisa ser feito?" /></div>
          <div class="field"><label>Data</label><input name="date" type="date" required value="${esc(date)}" /></div>
          <div class="field"><label>Horário</label><input name="time" type="time" value="${esc(task?.time || '')}" /></div>
          <div class="field"><label>Duração</label><input name="duration" type="number" min="5" step="5" value="${esc(task?.duration || state.settings.defaultDuration)}" /></div>
          <div class="field"><label>Repetição</label><select name="recurrence">
            <option value="none" ${(task?.recurrence || 'none') === 'none' ? 'selected' : ''}>Não repetir</option>
            <option value="daily" ${task?.recurrence === 'daily' ? 'selected' : ''}>Todo dia</option>
            <option value="weekdays" ${task?.recurrence === 'weekdays' ? 'selected' : ''}>Segunda a sexta</option>
            <option value="weekly" ${task?.recurrence === 'weekly' ? 'selected' : ''}>Toda semana</option>
          </select></div>
          <div class="field full"><label>Meta vinculada</label><select name="goalId"><option value="">Nenhuma</option>${state.goals.map((goal) => `<option value="${goal.id}" ${task?.goalId === goal.id ? 'selected' : ''}>${esc(goal.title)}</option>`).join('')}</select></div>
          <div class="field full"><label>Observação</label><textarea name="notes" placeholder="Opcional">${esc(task?.notes || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          ${task ? '<button class="danger-button" id="deleteTaskBtn" type="button">Excluir</button>' : ''}
          <button class="soft-button modal-close" type="button">Cancelar</button>
          <button class="primary-button" type="submit">Salvar tarefa</button>
        </div>
      </form>
    `);
    $('#taskForm').onsubmit = (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
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
    return fallback;
  }

  function parseCommandTime(text) {
    const lower = normalize(text);
    const match = lower.match(/(?:as|às|para)\s*(\d{1,2})(?::|h)?(\d{2})?\s*(?:h|horas?)?/);
    if (!match) return '';
    const hour = clamp(Number(match[1]), 0, 23);
    const minute = clamp(Number(match[2] || 0), 0, 59);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function parseCommandDuration(text) {
    const lower = normalize(text);
    const hourMatch = lower.match(/(?:por|duracao de)\s*(\d+(?:[.,]\d+)?)\s*h/);
    if (hourMatch) return Math.max(5, Math.round(Number(hourMatch[1].replace(',', '.')) * 60));
    const minuteMatch = lower.match(/(?:por|duracao de)\s*(\d+)\s*min/);
    return minuteMatch ? Math.max(5, Number(minuteMatch[1])) : Number(state.settings.defaultDuration) || 60;
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
      .replace(/\s+(depois de amanhã|depois de amanha|amanhã|amanha|hoje)(?=\s|$).*$/i, '')
      .replace(/\s+(às|as|para)\s+\d{1,2}(?::|h)?\d{0,2}\s*(?:h|horas?)?.*$/i, '')
      .replace(/\s+por\s+\d+(?:[.,]\d+)?\s*(?:h|horas?|min|minutos?).*$/i, '')
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

    if (/(conclu|finaliz|feito|terminei)/.test(lower)) {
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
      const recurrence = /todo dia|diariamente/.test(lower) ? 'daily' : /segunda a sexta|seg a sex/.test(lower) ? 'weekdays' : /toda semana|semanal/.test(lower) ? 'weekly' : 'none';
      const mentionedGoal = findGoalInText(text);
      const task = upsertTask({ title, date, time, duration, recurrence, goalId: mentionedGoal?.id || '', notes: '' });
      return task ? `<strong>Tarefa criada:</strong> ${esc(task.title)} em ${esc(formatLongDate(task.date))}${task.time ? ` às ${esc(task.time)}` : ''}.` : 'Não consegui identificar o nome da tarefa.';
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
        <button type="button">Adicione estudar russo amanhã às 10h</button>
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
    openModal(`
      <div class="modal-head">
        <div><h2>Configurações</h2><p>O app está limpo: somente tarefas e metas.</p></div>
        <button class="icon-button modal-close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="settings-list">
        <div class="setting-row">
          <div class="setting-copy"><strong>Salvamento automático</strong><span>Cada tarefa, conclusão e alteração de meta é salva neste navegador imediatamente.</span></div>
          <span class="deadline-chip">ativo</span>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><strong>Celular ↔ computador</strong><span>O armazenamento online ainda precisa ser conectado para sincronizar aparelhos diferentes.</span></div>
          <button class="soft-button" id="cloudInfoBtn" type="button">Entender</button>
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
    $('#exportBtn').onclick = exportBackup;
    $('#importBtn').onclick = () => $('#importFile').click();
    $('#importFile').onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = sanitizeState(JSON.parse(await file.text()));
        state = parsed;
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
    $('#cloudInfoBtn').onclick = () => {
      alert('Hoje o app salva automaticamente no aparelho. Para celular e PC compartilharem os mesmos dados, é necessário conectar um banco online com login. Nenhuma senha será colocada no código público.');
    };
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

  document.addEventListener('click', (event) => {
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
      toggleTask: () => toggleTask(id, date || state.selectedDate),
      previousDay: () => { state.selectedDate = addDays(state.selectedDate, -1); save(); render(); },
      nextDay: () => { state.selectedDate = addDays(state.selectedDate, 1); save(); render(); },
      todayNow: () => { state.selectedDate = localISO(); save(); render(); },
      selectDate: () => { state.selectedDate = date; save(); render(); },
      selectUpcomingDate: () => { state.selectedDate = date; state.view = 'today'; save(); render(); },
      toggleCompletedDrawer: () => $('#completedDrawer')?.classList.toggle('open'),
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
      render();
      setSaveStatus('atualizado');
    } catch {
      // Ignore malformed external storage updates.
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  });
  window.addEventListener('beforeunload', () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
    reset() {
      state = freshState();
      save();
      render();
    }
  };

  render();
})();
