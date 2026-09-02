const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

async function main() {
  const savedListeners = new Map();
  const store = new Map();
  const upserts = [];
  let realtimeHandler = null;
  let remoteApplied = null;
  let status = '';
  let oauthRequest = null;
  const session = { user: { id: 'user-1', email: 'owner@example.com' } };
  const localState = {
    version: 3,
    view: 'today',
    selectedDate: '2026-08-28',
    tasks: [{ id: 'task-1', title: 'Acordar', date: '2026-08-28', time: '07:00' }],
    goals: [],
    settings: { theme: 'spatial', notificationsEnabled: true },
    revision: 8,
    updatedAt: 'local-only'
  };

  const userStateQuery = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
    async upsert(row) {
      upserts.push(row);
      if (realtimeHandler) realtimeHandler({ new: { payload: row.payload } });
      return { error: null };
    }
  };
  const client = {
    auth: {
      onAuthStateChange() {},
      async getSession() { return { data: { session } }; },
      async signInWithOAuth(params) { oauthRequest = params; return { data: { url: 'https://accounts.google.com/' }, error: null }; }
    },
    from(table) {
      assert.strictEqual(table, 'user_state');
      return userStateQuery;
    },
    channel() {
      return {
        on(_event, _filter, handler) { realtimeHandler = handler; return this; },
        subscribe() { return this; }
      };
    },
    removeChannel() {}
  };

  const api = {
    getState: () => JSON.parse(JSON.stringify(localState)),
    applyCloudState(payload) { remoteApplied = payload; },
    setSyncLabel(label) { status = label; }
  };
  class FakeClassList {
    constructor() { this.values = new Set(); }
    toggle(name, force) {
      if (force) this.values.add(name);
      else this.values.delete(name);
    }
    contains(name) { return this.values.has(name); }
  }
  const makeElement = () => ({
    attrs: new Map(),
    classList: new FakeClassList(),
    disabled: false,
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    removeAttribute(name) { this.attrs.delete(name); },
    querySelector() { return null; }
  });
  const body = makeElement();
  body.classList.values.add('auth-locked');
  const authGate = makeElement();
  const appShell = makeElement();
  appShell.attrs.set('inert', '');
  const authButton = makeElement();
  const authLabel = { textContent: '' };
  authButton.querySelector = (selector) => selector === '.google-button-label' ? authLabel : null;
  const authStatus = { textContent: '' };
  const dom = new Map([
    ['#authGate', authGate],
    ['#appShell', appShell],
    ['#authGoogleBtn', authButton],
    ['#authGateStatus', authStatus]
  ]);
  const document = {
    body,
    visibilityState: 'visible',
    querySelector(selector) { return dom.get(selector) || null; },
    addEventListener() {}
  };
  const window = {
    __OBJETIVOS__: api,
    OBJETIVOS_CLOUD_CONFIG: { supabaseUrl: 'https://project.supabase.co', publishableKey: 'public-key', vapidPublicKey: '' },
    supabase: { createClient: () => client },
    location: {
      origin: 'https://empresahanmaltda-art.github.io',
      pathname: '/objetivos-spatial-os/',
      assign() {}
    },
    addEventListener(type, handler) { savedListeners.set(type, handler); }
  };
  const context = {
    window,
    document,
    navigator: {},
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value))
    },
    Intl,
    Date,
    JSON,
    String,
    Number,
    Boolean,
    Array,
    Object,
    URL,
    console,
    setTimeout,
    clearTimeout,
    atob
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('cloud-sync.js', 'utf8'), context);
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.strictEqual(upserts.length, 1, 'first connected device should upload its local state');
  assert.strictEqual(upserts[0].user_id, session.user.id);
  assert.strictEqual(upserts[0].payload.view, undefined, 'view must stay device-local');
  assert.strictEqual(upserts[0].payload.selectedDate, undefined, 'selected day must stay device-local');
  assert.strictEqual(upserts[0].payload.settings.notificationsEnabled, undefined, 'notification permission must stay device-local');
  assert.strictEqual(status, 'sincronizado');
  assert(realtimeHandler, 'realtime subscription missing');
  assert(body.classList.contains('auth-ready'), 'authenticated app was not revealed');
  assert(!body.classList.contains('auth-locked'), 'login gate stayed locked after session confirmation');
  assert.strictEqual(appShell.attrs.get('aria-hidden'), 'false');
  assert(!appShell.attrs.has('inert'), 'authenticated app remained inert');

  const changed = JSON.parse(JSON.stringify(localState));
  changed.tasks.push({ id: 'task-2', title: 'Treino', date: '2026-08-28', time: '19:30' });
  savedListeners.get('objetivos:state-saved')({ detail: { state: changed } });
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.strictEqual(upserts.length, 2, 'saved app change was not uploaded');
  assert.strictEqual(remoteApplied, null, 'the device applied its own realtime echo and caused a second render');

  realtimeHandler({ new: { payload: { version: 3, tasks: [{ id: 'remote', title: 'Remoto' }], goals: [], settings: {} } } });
  assert(remoteApplied?.tasks?.some((task) => task.id === 'remote'), 'remote state was not applied');

  await window.OBJETIVOS_CLOUD.signInWithGoogle();
  assert.strictEqual(oauthRequest.provider, 'google');
  assert.strictEqual(oauthRequest.options.redirectTo, 'https://empresahanmaltda-art.github.io/objetivos-spatial-os/');
  assert.strictEqual(oauthRequest.options.queryParams.prompt, 'select_account');

  assert.strictEqual(window.OBJETIVOS_CLOUD.generateFluencyCards, undefined, 'private lessons must not be sent to an external AI function');

  console.log(JSON.stringify({ ok: true, initialUpload: true, autosaveUpload: true, realtimeApply: true, googleOAuth: true, privateLessonApiDisabled: true }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
