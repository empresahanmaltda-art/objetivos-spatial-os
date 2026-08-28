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
  let assignedUrl = '';
  let verifiedOtp = null;
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
    async upsert(row) { upserts.push(row); return { error: null }; }
  };
  const client = {
    auth: {
      onAuthStateChange() {},
      async getSession() { return { data: { session } }; },
      async verifyOtp(params) { verifiedOtp = params; return { data: { session }, error: null }; }
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
  const document = {
    visibilityState: 'visible',
    querySelector() { return null; },
    addEventListener() {}
  };
  const window = {
    __OBJETIVOS__: api,
    OBJETIVOS_CLOUD_CONFIG: { supabaseUrl: 'https://project.supabase.co', publishableKey: 'public-key', vapidPublicKey: '' },
    supabase: { createClient: () => client },
    location: {
      origin: 'https://empresahanmaltda-art.github.io',
      pathname: '/objetivos-spatial-os/',
      assign(url) { assignedUrl = url; }
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

  const changed = JSON.parse(JSON.stringify(localState));
  changed.tasks.push({ id: 'task-2', title: 'Treino', date: '2026-08-28', time: '19:30' });
  savedListeners.get('objetivos:state-saved')({ detail: { state: changed } });
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.strictEqual(upserts.length, 2, 'saved app change was not uploaded');

  realtimeHandler({ new: { payload: { version: 3, tasks: [{ id: 'remote', title: 'Remoto' }], goals: [], settings: {} } } });
  assert(remoteApplied?.tasks?.some((task) => task.id === 'remote'), 'remote state was not applied');

  await window.OBJETIVOS_CLOUD.openLoginLink('https://project.supabase.co/auth/v1/verify?token=abc&type=magiclink');
  assert.strictEqual(verifiedOtp.token_hash, 'abc');
  assert.strictEqual(verifiedOtp.type, 'magiclink');

  await window.OBJETIVOS_CLOUD.openLoginLink('https://empresahanmaltda-art.github.io/objetivos-spatial-os/#access_token=test');
  assert.strictEqual(assignedUrl, 'https://empresahanmaltda-art.github.io/objetivos-spatial-os/#access_token=test');

  let rejectedUntrustedLink = false;
  try { await window.OBJETIVOS_CLOUD.openLoginLink('https://evil.example/auth/v1/verify?token=stolen'); }
  catch { rejectedUntrustedLink = true; }
  assert(rejectedUntrustedLink, 'untrusted login link was accepted');

  console.log(JSON.stringify({ ok: true, initialUpload: true, autosaveUpload: true, realtimeApply: true, safePwaLogin: true }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
