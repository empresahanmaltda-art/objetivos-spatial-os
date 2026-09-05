const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
const reorder = value => Array.isArray(value) ? value.map(reorder)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value;

async function harness({ owner = '', privateData = false } = {}) {
  let state = { version: 3, tasks: [{ id: 'a', title: 'Synthetic task' }], settings: {}, goals: [] };
  let handler, fail = false, release, slow = false, applied = 0, label;
  const uploads = [], listeners = new Map(), store = new Map(), timers = new Map();
  if (owner) store.set('objetivos-cloud-owner-v1', owner);
  if (privateData) state.fluency = { curriculumLessons: [{ id: 'synthetic-private-lesson' }] };
  let timerId = 0;
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
    async upsert(row) {
      uploads.push(clone(row));
      if (slow) { slow = false; await new Promise(resolve => { release = resolve; }); }
      if (fail) { fail = false; throw new Error('Synthetic offline failure'); }
      if (handler) handler({ new: { payload: reorder(row.payload) } });
      return { error: null };
    }
  };
  const session = { user: { id: 'test-owner' } };
  const client = {
    auth: { onAuthStateChange() {}, async getSession() { return { data: { session } }; } },
    from() { return query; }, removeChannel() {},
    channel() { return { on(_name, _filter, callback) { handler = callback; return this; }, subscribe() { return this; } }; }
  };
  const api = { getState: () => clone(state), applyCloudState(payload) { applied++; state = clone(payload); }, setSyncLabel(value) { label = value; } };
  const document = { querySelector() { return null; }, addEventListener() {}, visibilityState: 'visible' };
  const window = { __OBJETIVOS__: api, OBJETIVOS_CLOUD_CONFIG: { supabaseUrl: 'https://example.supabase.co', publishableKey: 'synthetic' },
    supabase: { createClient: () => client }, addEventListener(name, callback) { listeners.set(name, callback); } };
  const context = { window, document, navigator: {}, localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, String(value)) },
    console, Date, Intl, JSON, String, Number, Boolean, Array, Object, Set, URL,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  vm.runInNewContext(fs.readFileSync('cloud-sync.js', 'utf8'), context);
  await tick();
  assert.strictEqual(uploads.length, (owner && owner !== 'test-owner') || (!owner && privateData) ? 0 : 1);
  return {
    uploads, store, get label() { return label; }, get applied() { return applied; }, get state() { return state; },
    change(title) { state.tasks[0].title = title; listeners.get('objetivos:state-saved')({ detail: { state: clone(state) } }); },
    async flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); await tick(); },
    slow() { slow = true; }, release() { release(); }, fail() { fail = true; },
    remote(payload) { handler({ new: { payload } }); }, online() { listeners.get('online')(); },
    uploadNow: () => window.OBJETIVOS_CLOUD.uploadNow()
  };
}

async function main() {
  const h = await harness();
  h.change('first change');
  await h.flush();
  assert.strictEqual(h.applied, 0, 'JSONB key reordering must not reapply an own echo');
  h.slow();
  h.change('slow change');
  await h.flush();
  h.change('newest change');
  await h.flush();
  assert.strictEqual(h.store.get('objetivos-cloud-dirty-v1'), '1');
  assert.notStrictEqual(h.label, 'sincronizado');
  h.release();
  await tick();
  assert.strictEqual(h.uploads.at(-1).payload.tasks[0].title, 'newest change', 'latest queued edit was dropped');
  assert.strictEqual(h.label, 'sincronizado');
  assert.strictEqual(h.store.get('objetivos-cloud-dirty-v1'), '0');
  h.remote(reorder(h.uploads[1].payload));
  assert.strictEqual(h.applied, 0, 'a delayed own echo must not roll state back');

  h.slow(); h.change('temporary edit'); await h.flush();
  h.change('newest change'); await h.flush(); // Undo to the last confirmed snapshot.
  h.release(); await tick();
  assert.strictEqual(h.uploads.at(-1).payload.tasks[0].title, 'newest change', 'undo during upload was dropped');

  h.fail(); h.change('offline change'); await h.flush();
  assert.strictEqual(h.store.get('objetivos-cloud-dirty-v1'), '1');
  assert.strictEqual(h.label, 'salvo neste aparelho');
  h.remote({ tasks: [{ id: 'a', title: 'older remote' }], goals: [], settings: {} });
  assert.strictEqual(h.state.tasks[0].title, 'offline change', 'remote data erased a dirty local edit');
  h.online(); await tick();
  assert.strictEqual(h.uploads.at(-1).payload.tasks[0].title, 'offline change');
  assert.strictEqual(h.store.get('objetivos-cloud-dirty-v1'), '0');

  const foreign = { tasks: [{ id: 'remote', title: 'Other device' }], goals: [], settings: {} };
  h.remote(foreign);
  assert.strictEqual(h.applied, 1, 'clean devices must still accept remote changes');
  h.remote({ ...h.uploads[1].payload, cloudUpdatedAt: 'other-device-write' });
  assert.strictEqual(h.applied, 2, 'a genuine other-device undo must not be mistaken for our own delayed echo');
  const wrongAccount = await harness({ owner: 'different-owner', privateData: true });
  wrongAccount.change('must stay local'); await wrongAccount.flush(); await wrongAccount.uploadNow();
  assert.strictEqual(wrongAccount.uploads.length, 0, 'another account received private local data');
  const unknownOwner = await harness({ privateData: true });
  await unknownOwner.uploadNow();
  assert.strictEqual(unknownOwner.uploads.length, 0, 'legacy private data was uploaded without confirming its owner');
  console.log(JSON.stringify({ ok: true, jsonbEcho: true, overlappingSaves: true, delayedEcho: true, undoInFlight: true, offlineRetry: true, dirtyLocalProtection: true, accountIsolation: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
