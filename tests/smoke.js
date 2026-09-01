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
    this.scrollTop = 0;
    this.clientHeight = 800;
    this.scrollHeight = 1600;
  }
  querySelector(selector) {
    if (this.id === 'syncStatus' && selector === 'span') return elements.statusCopy;
    return null;
  }
  querySelectorAll() { return []; }
  append(child) {
    this.children.push(child);
    if (child.id) selectors[`#${child.id}`] = child;
  }
  remove() { if (this.id) delete selectors[`#${this.id}`]; }
  focus() {}
  addEventListener() {}
  setAttribute(key, value) { this[key] = String(value); }
  closest() { return null; }
}

const elements = {
  root: new Element('html'),
  body: new Element('body'),
  themeMeta: new Element('themeMeta'),
  syncStatus: new Element('syncStatus'),
  statusCopy: new Element('statusCopy'),
  bottomDock: new Element('bottomDock'),
  appShell: new Element('appShell'),
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
  '#appShell': elements.appShell,
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
  settings: { haptics: false, motion: false }
}));

const documentListeners = new Map();
const document = {
  documentElement: elements.root,
  body: elements.body,
  querySelector: (selector) => selectors[selector] || null,
  querySelectorAll: () => [],
  createElement: () => new Element(),
  addEventListener(type, handler) {
    if (!documentListeners.has(type)) documentListeners.set(type, []);
    documentListeners.get(type).push(handler);
  },
  visibilityState: 'visible'
};

const window = { scrollY: 240, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
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
vm.runInContext(fs.readFileSync('fluency-engine.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const appSource = fs.readFileSync('app.js', 'utf8');
const fluencySource = fs.readFileSync('fluency-engine.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const stylesSource = fs.readFileSync('styles.css', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');
const cloudSyncSource = fs.readFileSync('cloud-sync.js', 'utf8');
const pushSource = fs.readFileSync('supabase/functions/push-due/index.ts', 'utf8');
const fluencyFunctionSource = fs.readFileSync('supabase/functions/fluency-generate/index.ts', 'utf8');
const fluencyMigrationSource = fs.readFileSync('supabase/migrations/202609010001_fluency_materials.sql', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const pngDimensions = (path) => {
  const file = fs.readFileSync(path);
  assert.strictEqual(file.subarray(1, 4).toString(), 'PNG', `${path} must be a PNG`);
  return [file.readUInt32BE(16), file.readUInt32BE(20)];
};
assert(indexSource.includes('Continuar com Google'), 'Google sign-in control missing');
assert(!appSource.includes('cloudMagicLink'), 'legacy magic-link form leaked');
assert(indexSource.includes('assets/os-icon-v18-180.png'), 'new iOS home-screen icon missing');
assert(indexSource.includes('<span class="brand-tile"><img src="assets/os-icon-v18-192.png"'), 'new in-app icon missing');
assert(indexSource.includes('apple-mobile-web-app-status-bar-style" content="black-translucent"'), 'iOS status bar must blend into the app');
assert(indexSource.includes('name="theme-color" content="#171614"'), 'status-bar fallback must match the dark spatial background');
assert(stylesSource.includes('body.auth-locked{height:100dvh;overflow:hidden'), 'login viewport must stay fixed');
assert(stylesSource.includes('position:fixed;inset:0;'), 'document viewport must stay fixed on iOS');
assert(stylesSource.includes('padding:calc(10px + env(safe-area-inset-top))'), 'mobile safe area padding missing');
assert(stylesSource.includes('.workspace[data-update="animated"] .task-card'), 'task motion must be opt-in per render');
assert(!stylesSource.includes('filter:blur(4px)'), 'task completion still uses the flickering blur effect');
assert(appSource.includes("document.addEventListener('touchmove'"), 'iOS edge overscroll guard missing');
assert(appSource.includes("root.dataset.update = quiet ? 'quiet' : 'animated'"), 'quiet task refresh missing');
assert(indexSource.includes('id="authGate"'), 'login gate missing');
assert(indexSource.includes('id="authGoogleBtn"'), 'Google login entry missing');
assert(indexSource.includes('id="appShell" aria-hidden="true" inert'), 'app must stay locked before authentication');
assert(indexSource.includes('fluency-engine.js?v=27'), 'Fluency engine must load before the app');
assert(swSource.includes("'./fluency-engine.js?v=27'"), 'Fluency engine must be available offline');
assert(fluencyFunctionSource.includes("text: { format: { type: 'json_schema'"), 'AI output must use strict Structured Outputs');
assert(fluencyFunctionSource.includes("supabase.auth.getUser()"), 'Fluency AI must authenticate the current user');
assert(fluencyFunctionSource.includes("store: false"), 'AI material processing must not retain model responses by default');
assert(fluencyMigrationSource.includes("fluency_materials_select_own"), 'private per-user material policy missing');
assert(manifest.icons.some((icon) => icon.src === 'assets/os-icon-v18-192.png' && icon.type === 'image/png'));
assert(manifest.icons.some((icon) => icon.src === 'assets/os-icon-v18-512.png' && icon.purpose.includes('maskable')));
assert.deepStrictEqual(pngDimensions('assets/os-icon-v18-180.png'), [180, 180]);
assert.deepStrictEqual(pngDimensions('assets/os-icon-v18-192.png'), [192, 192]);
assert.deepStrictEqual(pngDimensions('assets/os-icon-v18-512.png'), [512, 512]);
assert.strictEqual(manifest.theme_color, '#171614');

const api = window.__OBJETIVOS__;
assert(api, 'public test API missing');
let state = api.getState();

assert.strictEqual(state.version, 6);
assert.strictEqual(state.settings.theme, 'spatial');
assert.strictEqual(state.settings.customBackground, '#302c28');
assert.strictEqual(state.settings.customGlass, '#48423b');
assert.strictEqual(state.settings.customModule, '#1e1c19');
assert.strictEqual(state.settings.customGlow, '#958b7f');
assert.strictEqual(state.settings.glassOpacity, 82);
assert.strictEqual(state.settings.moduleOpacity, 84);
assert.strictEqual(state.settings.glassBlur, 28);
assert.deepStrictEqual(state.settings.savedThemes, []);
assert.strictEqual(state.settings.haptics, true, 'haptic feedback must stay enabled');
assert.strictEqual(state.settings.motion, true, 'Spatial motion must stay enabled');
assert.strictEqual(state.settings.defaultReminder, 30);
assert.deepStrictEqual(state.settings.defaultReminders, [30, 0]);
assert.strictEqual(state.settings.routineVersion, 3);
assert.strictEqual(state.fluency.profile.targetLanguage, 'ru');
assert.strictEqual(state.fluency.profile.overallLevel, 'A1');
assert.strictEqual(state.fluency.profile.dailyMinutes, 75);
assert.strictEqual(state.fluency.items.length, 8);
assert.strictEqual(state.fluency.sources[0].id, 'starter-russian-a1');
assert(fluencySource.includes("const VALID_MODES = ['recognition', 'recall', 'cloze', 'listening', 'shadowing']"), 'all five acquisition modes are required');
assert.strictEqual(state.selectedProject, 'routine');
assert(/^\d{4}-\d{2}-01$/.test(state.plannerMonth), 'planner month must be normalized');
assert.strictEqual(state.plannerDate, '');
assert.deepStrictEqual(state.projects.map((project) => project.title), ['Rotina Milionária', 'Projeto GYM — Greko Romano']);
assert.strictEqual(state.tasks.filter((task) => task.routine).length, 26);
assert.strictEqual(state.tasks.filter((task) => task.projectId === 'gym').length, 11);
assert.strictEqual(state.tasks.filter((task) => task.projectId === 'routine').length, 15);
assert(state.tasks.every((task) => ['routine', 'gym'].includes(task.projectId)), 'every task must belong to a project');
assert(state.tasks.filter((task) => task.title === 'Marketing').every((task) => task.time === '15:00'), 'every Marketing routine must start at 15:00');
assert(state.tasks.filter((task) => task.time).every((task) => JSON.stringify(task.reminders) === '[30,0]'), 'every timed task needs 30-minute and exact-time alerts');
assert(!state.tasks.some((task) => /^t[1-7]$/.test(task.id)), 'legacy demo tasks leaked');
assert.deepStrictEqual(state.goals.slice(0, 4).map((goal) => goal.target), [30000, 10000, 100000, 1000000]);
assert(state.goals.slice(0, 4).every((goal) => goal.current === 0));
assert.strictEqual(state.goals.find((goal) => goal.id === 'custom-goal').current, 7);

const originalAppearanceState = api.getState();
api.applyCloudState({
  ...originalAppearanceState,
  settings: {
    ...originalAppearanceState.settings,
    theme: 'custom',
    customAccent: '#ff00aa',
    customBackground: '#123456',
    customGlass: '#334455',
    customModule: '#111827',
    customGlow: '#22ccff',
    glassOpacity: 50,
    moduleOpacity: 60,
    glassBlur: 12
  }
});
assert.strictEqual(elements.root.dataset.theme, 'custom');
assert.strictEqual(elements.root.style.values.get('--accent-rgb'), '255 0 170');
assert.strictEqual(elements.root.style.values.get('--bg-b'), 'rgb(18 52 86)');
assert(elements.root.style.values.get('--glass-a').includes('/ 0.5'));
assert(elements.root.style.values.get('--module-a').includes('/ 0.6'));
assert.strictEqual(elements.root.style.values.get('--glass-blur'), '12px');
api.applyCloudState(originalAppearanceState);
state = api.getState();

const savedAppearanceState = api.getState();
api.applyCloudState({
  ...savedAppearanceState,
  settings: {
    ...savedAppearanceState.settings,
    theme: 'saved:night-orbit',
    savedThemes: [{
      id: 'night-orbit',
      label: 'Órbita noturna',
      accent: '#d9e7ff',
      background: '#10131a',
      glass: '#202631',
      module: '#090b10',
      glow: '#f0b788',
      intensity: 74,
      glassOpacity: 71,
      moduleOpacity: 91,
      glassBlur: 33
    }]
  }
});
assert.strictEqual(elements.root.dataset.theme, 'saved');
assert.strictEqual(elements.root.style.values.get('--accent-rgb'), '217 231 255');
assert.strictEqual(elements.root.style.values.get('--glass-blur'), '33px');
assert.strictEqual(api.getState().settings.savedThemes[0].label, 'Órbita noturna');
api.applyCloudState(savedAppearanceState);
state = api.getState();

const today = state.selectedDate;
const tomorrow = (() => {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
})();

assert(api.tasksForDate(today).some((task) => task.title === 'Acordar'));
assert(api.tasksForDate(tomorrow).some((task) => task.title === 'Acordar'));

const wake = state.tasks.find((task) => task.title === 'Acordar');
const navBeforeCompletion = elements.bottomDock.innerHTML;
api.toggleTask(wake.id, today);
assert(!api.tasksForDate(today, { includeCompleted: false }).some((task) => task.id === wake.id));
assert(api.tasksForDate(tomorrow, { includeCompleted: false }).some((task) => task.id === wake.id));
assert.strictEqual(elements.viewRoot.dataset.update, 'quiet', 'completion must not replay the full view animation');
assert.strictEqual(elements.bottomDock.innerHTML, navBeforeCompletion, 'completion must not rebuild the bottom dock');

const newProject = api.upsertProject({ title: 'Empresa OS', description: 'Construção da empresa.', icon: '◆' });
assert(newProject, 'dynamic project was not created');
state = api.getState();
assert(state.projects.some((project) => project.id === newProject.id && project.title === 'Empresa OS'));
const projectTask = api.upsertTask({ title: 'Planejar lançamento', date: today, time: '16:00', duration: 45, projectId: newProject.id });
assert.strictEqual(projectTask.projectId, newProject.id, 'task was not created inside the selected project');
assert(api.deleteProject(newProject.id), 'dynamic project was not deleted');
state = api.getState();
assert(!state.projects.some((project) => project.id === newProject.id));
assert.notStrictEqual(state.tasks.find((task) => task.id === projectTask.id).projectId, newProject.id, 'tasks from a deleted project were not reassigned');

api.setView('upcoming');
assert.strictEqual(api.getState().view, 'upcoming');
assert(elements.viewRoot.innerHTML.includes('Meus projetos'), 'projects browser was not rendered');
assert(elements.viewRoot.innerHTML.includes('data-action="addTask" data-project-id="routine"'), 'tasks cannot be created inside the selected project');
api.selectPlannerDate(today);
assert.strictEqual(api.getState().view, 'upcoming', 'calendar selection must stay inside Projects');
assert.strictEqual(api.getState().plannerDate, today);
assert(elements.viewRoot.innerHTML.includes('planner-day-panel'), 'selected-day tasks were not rendered below the calendar');
assert(!elements.viewRoot.innerHTML.includes('class="project-browser"'), 'project list should yield to the selected-day agenda');
api.setView('today');

api.setView('fluency');
assert.strictEqual(api.getState().view, 'fluency');
assert(elements.viewRoot.innerHTML.includes('Mapa de fluência'), 'Fluency dashboard was not rendered');
assert(elements.viewRoot.innerHTML.includes('Sessão de hoje'), 'daily Fluency plan missing');
assert(elements.bottomDock.innerHTML.includes('Fluency'), 'Fluency navigation item missing');
assert(elements.quickAdd.classList.contains('fluency-add'), 'quick add must switch to study material in Fluency');
api.startFluencySession();
state = api.getState();
assert(state.fluency.activeSession?.queue?.length > 0, 'adaptive Fluency session was not created');
assert(elements.viewRoot.innerHTML.includes('fluency-study-card'), 'active study card was not rendered');
api.revealFluencyAnswer();
state = api.getState();
assert(state.fluency.activeSession.revealed, 'recognition card should reveal without typed input');
const firstFluencyItem = state.fluency.items.find((item) => item.id === state.fluency.activeSession.queue[0].itemId);
const previousFluencyReps = firstFluencyItem.scheduling.reps;
api.rateFluencyCard(3);
state = api.getState();
assert.strictEqual(state.fluency.items.find((item) => item.id === firstFluencyItem.id).scheduling.reps, previousFluencyReps + 1, 'rating must update spaced repetition state');
assert.strictEqual(state.fluency.events.length, 1, 'review event history missing');
api.finishFluencySession();
api.setView('today');

let edgePullPrevented = false;
const touchTarget = { closest: () => null };
documentListeners.get('touchstart')[0]({ touches: [{ clientX: 100, clientY: 100 }] });
documentListeners.get('touchmove')[0]({
  touches: [{ clientX: 101, clientY: 132 }],
  target: touchTarget,
  preventDefault() { edgePullPrevented = true; }
});
assert(edgePullPrevented, 'pulling down at the top edge must be blocked');

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
assert(elements.root.classList.contains('modal-open'), 'modal must lock the app viewport');
assert(elements.body.classList.contains('modal-open'), 'modal must lock background scrolling');
assert.strictEqual(elements.themeMeta.content, '#111315', 'an open modal must darken the iOS status bar with the app');
assert(elements.modalLayer.innerHTML.includes('class="task-core-grid"'), 'compact task core grid missing');
assert(elements.modalLayer.innerHTML.includes('class="task-options-grid"'), 'compact task options grid missing');
assert(elements.modalLayer.innerHTML.includes('<details class="task-advanced"'), 'advanced task fields are not collapsible');
assert(elements.modalLayer.innerHTML.includes('<label>Projeto</label>'), 'task project selector missing');
assert(elements.modalLayer.innerHTML.indexOf('<label>Duração</label>') > elements.modalLayer.innerHTML.indexOf('<details class="task-advanced"'), 'duration must stay inside compact advanced options');
assert(!elements.modalLayer.innerHTML.includes('<div class="input-grid">'), 'legacy oversized task form leaked');

assert(!stylesSource.includes('position:sticky'), 'top bar must scroll with the page');
assert(stylesSource.includes('.workspace:focus{outline:none}'), 'workspace must not show a native focus ring');
assert(stylesSource.includes('.task-core-grid{grid-template-columns:minmax(0,1fr)'), 'mobile date and time fields must stack without overlapping');
assert(stylesSource.includes('.task-options-grid{grid-template-columns:repeat(2,minmax(0,1fr))'), 'mobile options must stay compact');
assert(stylesSource.includes('.task-modal .modal-head .modal-close{width:32px'), 'only the header close control may use icon dimensions');
assert(!stylesSource.includes('.task-modal .modal-close{width:'), 'cancel action inherited the close icon width');
assert(stylesSource.includes('.task-modal .modal-actions{justify-content:center'), 'task actions must be centered');
assert(stylesSource.includes('.task-modal .task-title-field input{height:35px;min-height:35px;max-height:35px}'), 'task title field must keep the approved compact height');
assert(stylesSource.includes('.modal select,.modal textarea,.command-input{font-size:16px!important;touch-action:manipulation}'), 'mobile form controls must stay at 16px to prevent iOS focus zoom');
assert(stylesSource.includes('.modal.task-modal{width:min(310px,100%);height:min(380px,68dvh)'), 'task modal must keep its approved fixed mobile size');
assert(stylesSource.includes('.task-core-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:8px;width:100%;min-width:0;max-width:100%;overflow:hidden'), 'date and time grid must never overflow the task field width');
assert(stylesSource.includes('.task-modal .native-picker-control{height:32px!important;min-height:32px!important;max-height:32px!important'), 'visible date and time shells must use the corrected iOS height');
assert(elements.bottomDock.innerHTML.includes('Projetos'), 'project navigation label missing');
assert(appSource.includes("'Rotina Milionária'"), 'routine project missing');
assert(appSource.includes("'Projeto GYM — Greko Romano'"), 'gym project missing');
assert(appSource.includes('function projectModal('), 'project creation and editing modal missing');
assert(appSource.includes('function upsertProject('), 'dynamic project storage missing');
assert(appSource.includes('data-action="addProject"'), 'new-project controls missing');
assert(appSource.includes('data-project-id="${selectedProject.id}"'), 'selected-project task creation control missing');
assert(appSource.includes('function plannerCalendar()'), 'compact project calendar missing');
assert(appSource.includes('function selectPlannerDate('), 'planner date must be selected inside the projects view');
assert(appSource.includes('state.plannerDate ? renderPlannerDay() : renderProjectBrowser()'), 'selected calendar day must render below the calendar');
assert(!appSource.includes('Os próximos 14 dias'), 'legacy repeated upcoming-day view leaked');
assert(stylesSource.includes('bottom:max(6px,env(safe-area-inset-bottom));'), 'approved floating mobile dock position changed');
assert(stylesSource.includes('width:calc(100vw - 20px);'), 'approved floating mobile dock width changed');
assert(!stylesSource.includes('height:calc(62px + env(safe-area-inset-bottom))'), 'safe area was incorrectly added inside the dock again');
assert(stylesSource.includes('position:fixed;inset:0;\n  height:auto;min-height:0;'), 'the iOS viewport must extend behind the bottom safe area');
assert(stylesSource.includes('padding:calc(10px + env(safe-area-inset-top)) 10px calc(82px + env(safe-area-inset-bottom))'), 'mobile content clearance for the floating dock is missing');
assert(indexSource.includes('styles.css?v=27') && indexSource.includes('app.js?v=27') && indexSource.includes('cloud-sync.js?v=27'), 'v27 asset cache keys missing');
assert(swSource.includes("objetivos-spatial-v27"), 'v27 service-worker cache missing');
assert(stylesSource.includes('opacity:.001;cursor:pointer'), 'native iOS pickers must remain tappable above their fixed visual shells');
assert(appSource.includes('id="taskDateDisplay"') && appSource.includes('id="taskTimeDisplay"'), 'fixed date and time display shells missing');
assert(appSource.includes("location.replace(freshUrl.href)"), 'PWA updates must force the newly installed build to become visible');
assert(swSource.includes("fetch(event.request, { cache: 'no-store' })"), 'PWA navigation must bypass stale iOS caches');
assert(appSource.includes("window.matchMedia?.('(max-width:760px)')"), 'mobile modal must not auto-open the keyboard');
['backgroundColor', 'glassColor', 'moduleColor', 'glowColor', 'glassOpacity', 'moduleOpacity', 'glassBlur'].forEach((id) => {
  assert(appSource.includes(`id="${id}"`), `appearance control ${id} missing`);
});
assert(appSource.includes("root.style.setProperty('--glass-a'"), 'custom glass color is not applied');
assert(appSource.includes("root.style.setProperty('--module-a'"), 'custom card color is not applied');
assert(appSource.includes("root.style.setProperty('--bg-b'"), 'custom background color is not applied');
assert(appSource.includes('id="saveThemePresetBtn"'), 'custom appearance preset save control missing');
assert(appSource.includes('data-saved-theme-choice'), 'saved appearance presets cannot be selected');
assert(appSource.includes('data-delete-saved-theme'), 'saved appearance presets cannot be removed');
assert(stylesSource.includes('.modal::-webkit-scrollbar{display:none'), 'native modal scrollbar must stay hidden');
assert(stylesSource.includes('.modal-scroll-indicator.active{opacity:'), 'transient modal scroll indicator missing');
assert(appSource.includes("setTimeout(() => indicator.classList.remove('active'), 620)"), 'modal scroll indicator must disappear after scrolling');
assert(appSource.includes('globalThis.OBJETIVOS_PUSH_ACTIVE !== false'), 'local notifications must pause when server push is active or unresolved');
assert(cloudSyncSource.includes('window.OBJETIVOS_PUSH_ACTIVE = runtime.pushActive'), 'push subscription state must be shared with the local notification fallback');
assert(pushSource.includes('const reminderMinutes = [30, 0]'), 'server push must send 30-minute and exact-time reminders');
assert(pushSource.includes('task-${task.id}-${date}-${minutesBefore}'), 'server push delivery tags must be unique per reminder stage');
assert(swSource.includes('self.registration.getNotifications({ tag })'), 'service worker must close duplicate notifications before displaying one');
assert(elements.modalLayer.innerHTML.includes('task-cancel-button'), 'cancel button needs independent sizing');
assert(elements.modalLayer.innerHTML.includes('task-save-button'), 'save button needs independent sizing');
assert(elements.modalLayer.innerHTML.includes('30 min antes + na hora'), 'task form must show the fixed dual reminder schedule');
assert(!appSource.includes("$('#viewRoot')?.focus()"), 'view changes must not leave a native focus ring');
assert(stylesSource.includes('background-image:var(--app-background);'), 'the iOS root canvas must share the app background');
assert(stylesSource.includes('body{\n  position:fixed;inset:0;') && stylesSource.includes('background:transparent;'), 'the body must not paint a separate bottom strip');
assert(!stylesSource.includes('body{background:linear-gradient'), 'the mobile breakpoint must not repaint the body above the iOS safe area');
assert(appSource.includes('class="project-icon-picker" role="radiogroup"'), 'project icon list missing');
assert(appSource.includes('name="icon" type="hidden"'), 'project icon must be selected instead of typed');
assert(!appSource.includes('name="icon" maxlength="4"'), 'legacy typed project icon field leaked');
assert(stylesSource.includes('.project-icon-option.selected{'), 'selected project icon state missing');
assert(!stylesSource.includes('@media (display-mode:standalone) and (max-width:760px)'), 'standalone PWA must not paint a separate lower band');
assert(!stylesSource.includes('.app-shell::after{') && !stylesSource.includes('body::after{'), 'no bottom overlay may cover or dim the approved navigation');
assert(appSource.includes("root.style.setProperty('--system-edge', systemEdgeColor)"), 'custom themes must update the PWA system edge color');
[
  'canvasDiagnosticBtn', 'Rotina Operação Moscou', 'motionToggle', 'hapticToggle',
  'id="swipeLeft"', 'id="swipeRight"', 'Salvamento automático', 'cloudSettingRow', 'cloudAccountBtn'
].forEach((hiddenSetting) => assert(!appSource.includes(hiddenSetting), `${hiddenSetting} must stay hidden from settings`));
assert(!stylesSource.includes('canvas-diagnostic'), 'temporary canvas diagnostic styles leaked');
assert(appSource.includes('<strong>Backup</strong>') && appSource.includes('id="exportBtn"') && appSource.includes('id="importBtn"'), 'backup controls must remain available');
assert(appSource.includes('id="notificationToggle"') && appSource.includes('id="pushServerBtn"'), 'notification controls must remain available');
assert(appSource.includes('settings.haptics = true') && appSource.includes('settings.motion = true'), 'hidden automatic behaviors must be enforced');
assert(cloudSyncSource.includes('if (pushButton) {') && !cloudSyncSource.includes('if (!accountButton || !pushButton) return;'), 'push settings must bind without the hidden account row');

console.log(JSON.stringify({
  ok: true,
  routineTasks: state.tasks.filter((task) => task.routine).length,
  todayTasks: api.tasksForDate(today).length,
  tomorrowTasks: api.tasksForDate(tomorrow).length,
  goals: state.goals.map((goal) => goal.target),
  recurringCompletion: true,
  saved: true
}));
