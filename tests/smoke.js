const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) {
    if (force === true) this.values.add(item);
    else if (force === false) this.values.delete(item);
    else if (this.values.has(item)) this.values.delete(item);
    else this.values.add(item);
    return this.values.has(item);
  }
}

class Style {
  constructor() { this.values = new Map(); }
  setProperty(key, value) { this.values.set(key, String(value)); }
  removeProperty(key) { this.values.delete(key); }
}

class Element {
  constructor(id = '') {
    this.id = id;
    this.innerHTML = '';
    this.className = '';
    this.classList = new ClassList();
    this.children = [];
    this.dataset = {};
    this.style = new Style();
  }
  querySelector(selector) {
    if (this.id === 'syncStatus' && selector === 'span') return elements.statusCopy;
    return null;
  }
  querySelectorAll() { return []; }
  append(child) { this.children.push(child); }
  remove() {}
  focus() {}
  addEventListener() {}
  setAttribute(key, value) { this[key] = String(value); }
  closest() { return null; }
}

const elements = {
  root: new Element('html'),
  themeMeta: new Element('themeMeta'),
  syncStatus: new Element('syncStatus'),
  statusCopy: new Element('statusCopy'),
  bottomDock: new Element('bottomDock'),
  viewRoot: new Element('viewRoot'),
  modalLayer: new Element('modalLayer'),
  toastLayer: new Element('toastLayer'),
  commandBtn: new Element('commandBtn'),
  settingsBtn: new Element('settingsBtn'),
  quickAdd: new Element('quickAdd'),
  repeatPreset: new Element('repeatPreset'),
  repeatUnit: new Element('repeatUnit'),
  taskForm: new Element('taskForm')
};

const selectors = {
  'meta[name="theme-color"]': elements.themeMeta,
  '#syncStatus': elements.syncStatus,
  '#bottomDock': elements.bottomDock,
  '#viewRoot': elements.viewRoot,
  '#modalLayer': elements.modalLayer,
  '#toastLayer': elements.toastLayer,
  '#commandBtn': elements.commandBtn,
  '#settingsBtn': elements.settingsBtn,
  '#quickAdd': elements.quickAdd,
  '#repeatPreset': elements.repeatPreset,
  '#repeatUnit': elements.repeatUnit,
  '#taskForm': elements.taskForm
};

const store = new Map();
store.set('objetivos-spatial-os-v1', JSON.stringify({
  tasks: [
    { id: 't1', title: 'Demo', date: '2026-08-28', start: '09:00', duration: 45 },
    { id: 't2', title: 'Demo 2', date: '2026-08-28', start: '11:00', duration: 70 }
  ],
  goals: [{ id: 'g1', title: 'Demo', target: 100000, manualCurrent: 67450, unit: 'R$' }],
  finance: [{ id: 'f1', amount: 67450, type: 'income' }]
}));
store.set('objetivos-spatial-os-v2', JSON.stringify({
  version: 2,
  view: 'today',
  selectedDate: '2026-08-28',
  tasks: [],
  goals: [
    { id: 'goal-brl-30k', title: 'R$ 30 mil por mês', target: 30000, current: 9876, unit: 'R$', deadline: '2026-11-30' },
    { id: 'goal-usd-10k', title: 'US$ 10 mil por mês', target: 10000, current: 4500, unit: 'US$', deadline: '2026-11-30' },
    { id: 'goal-usd-100k', title: 'US$ 100 mil por mês', target: 100000, current: 75000, unit: 'US$', deadline: '2027-02-28' },
    { id: 'goal-usd-1m', title: 'US$ 1 milhão por mês', target: 1000000, current: 120000, unit: 'US$', deadline: '2027-12-31' },
    { id: 'custom-goal', title: 'Meta pessoal', target: 20, current: 7, unit: 'unid.', deadline: '2026-12-31' }
  ],
  settings: {}
}));

const document = {
  documentElement: elements.root,
  querySelector: (selector) => selectors[selector] || null,
  querySelectorAll: () => [],
  createElement: () => new Element(),
  addEventListener() {},
  visibilityState: 'visible'
};

const window = { addEventListener() {}, removeEventListener() {} };
const context = {
  console,
  document,
  window,
  navigator: {},
  location: { protocol: 'file:' },
  localStorage: {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  },
  crypto: webcrypto,
  Blob,
  URL,
  Intl,
  Date,
  Math,
  JSON,
  String,
  Number,
  Boolean,
  Array,
  Object,
  RegExp,
  Map,
  Set,
  confirm: () => true,
  alert() {},
  requestAnimationFrame: (callback) => callback(),
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {}
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const api = window.__OBJETIVOS__;
assert(api, 'public test API missing');
let state = api.getState();

assert.strictEqual(state.version, 3);
assert.strictEqual(state.settings.theme, 'spatial');
assert.strictEqual(state.tasks.filter((task) => task.routine).length, 26);
assert(!state.tasks.some((task) => /^t[1-7]$/.test(task.id)), 'legacy demo tasks leaked');
assert.deepStrictEqual(state.goals.slice(0, 4).map((goal) => goal.target), [30000, 10000, 100000, 1000000]);
assert(state.goals.slice(0, 4).every((goal) => goal.current === 0));
assert.strictEqual(state.goals.find((goal) => goal.id === 'custom-goal').current, 7);

const today = state.selectedDate;
const tomorrow = (() => {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
})();

assert(api.tasksForDate(today).some((task) => task.title === 'Acordar'));
assert(api.tasksForDate(tomorrow).some((task) => task.title === 'Acordar'));

const wake = state.tasks.find((task) => task.title === 'Acordar');
api.toggleTask(wake.id, today);
assert(!api.tasksForDate(today, { includeCompleted: false }).some((task) => task.id === wake.id));
assert(api.tasksForDate(tomorrow, { includeCompleted: false }).some((task) => task.id === wake.id));

api.executeCommand('Adicione meditar todo dia às 06h por 15 min');
state = api.getState();
const meditation = state.tasks.find((task) => task.title === 'meditar');
assert(meditation, 'daily natural-language task was not created');
assert.strictEqual(meditation.time, '06:00');
assert.strictEqual(meditation.duration, 15);
assert.strictEqual(meditation.repeat.type, 'day');
assert(api.isTaskOnDate(meditation, tomorrow));

api.executeCommand('Adicione treino toda segunda, quarta e sexta às 18h por 90 min');
state = api.getState();
const workout = state.tasks.find((task) => task.title === 'treino');
assert(workout, 'weekly natural-language task was not created');
assert.deepStrictEqual(workout.repeat.days, [1, 3, 5]);

api.executeCommand('Adicione revisar a cada 2 dias depois de concluir às 14h por 20 min');
state = api.getState();
const review = state.tasks.find((task) => task.title === 'revisar');
assert(review, 'completion-based task was not created');
assert.strictEqual(review.repeat.interval, 2);
assert.strictEqual(review.repeat.mode, 'completed');
const previousReviewDate = review.date;
api.toggleTask(review.id, previousReviewDate);
state = api.getState();
const movedReview = state.tasks.find((task) => task.id === review.id);
assert.strictEqual(Math.round((new Date(`${movedReview.date}T12:00:00`) - new Date(`${previousReviewDate}T12:00:00`)) / 86400000), 2);

api.executeCommand('Coloque 5 mil na meta de 30 mil');
api.executeCommand('Zere os valores realizados das metas');
state = api.getState();
assert(state.goals.every((goal) => goal.current === 0));
assert(store.has('objetivos-spatial-os-v2'));

elements.quickAdd.onclick();
assert(elements.modalLayer.innerHTML.includes('modal glass task-modal'), 'compact task modal class missing');
assert(elements.modalLayer.innerHTML.includes('class="task-core-grid"'), 'compact task core grid missing');
assert(elements.modalLayer.innerHTML.includes('class="task-options-grid"'), 'compact task options grid missing');
assert(elements.modalLayer.innerHTML.includes('<details class="task-advanced"'), 'advanced task fields are not collapsible');
assert(elements.modalLayer.innerHTML.indexOf('<label>Duração</label>') > elements.modalLayer.innerHTML.indexOf('<details class="task-advanced"'), 'duration must stay inside compact advanced options');
assert(!elements.modalLayer.innerHTML.includes('<div class="input-grid">'), 'legacy oversized task form leaked');

console.log(JSON.stringify({
  ok: true,
  routineTasks: state.tasks.filter((task) => task.routine).length,
  todayTasks: api.tasksForDate(today).length,
  tomorrowTasks: api.tasksForDate(tomorrow).length,
  goals: state.goals.map((goal) => goal.target),
  recurringCompletion: true,
  saved: true
}));
