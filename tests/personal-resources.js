const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const makeDOM = () => new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://synthetic.example/', runScripts: 'outside-only', pretendToBeVisual: true });
const evaluate = (w, files) => files.forEach(file => w.eval(fs.readFileSync(file, 'utf8')));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function clientFor(result, log = []) {
  return { from(table) { assert.strictEqual(table, 'user_resources'); return { select(columns) {
    assert.strictEqual(columns, 'kind,payload,updated_at'); return { eq(column, userId) {
      assert.strictEqual(column, 'user_id'); log.push(userId); return typeof result === 'function' ? result() : Promise.resolve(result);
    } };
  } }; } };
}
const nutrition = {
  title: 'Plano fictício de teste', prescribedAt: '2026-01-01', timingNote: 'Horários da rotina.',
  meals: [{ key: 'breakfast', title: 'Café da manhã', sourcePage: 1, items: [
    { food: 'Alimento fictício <script>test</script>', quantity: '17 g', alternatives: ['Alternativa fictícia: 23 g'] }
  ] }], guidance: ['Orientação fictícia.'], reportedTotals: { protein: '1 g', fat: '2 g', carbs: '3 g', kcal: '4 kcal' }, nutrients: []
};
const sounds = ['complete','undo','create','navigate','notification','error','milestone','session','open'].map(event => ({
  kind: 'sound:' + event, payload: { id: event, event, label: 'Som ' + event, mime: 'audio/mpeg', base64: 'AAAA' }
}));
const rows = [{ kind: 'nutrition', payload: nutrition }, ...sounds];
(async () => {
  const dom = makeDOM(), w = dom.window, d = w.document;
  w.scrollTo = () => {};
  evaluate(w, ['personal-resources.js','sound-engine.js','dom-patch.js','fluency-engine.js','app.js']);
  const api = w.__OBJETIVOS__, resources = w.ObjetivosResources;
  assert(!d.querySelector('.meal-card'), 'private data must not exist before an account loads it');
  const before = JSON.stringify(api.getState());
  const nonmeal = d.querySelector('[data-task-id="routine-v3-russian"]');
  const queries = [];
  await resources.load(clientFor({ data: rows }, queries), 'owner-a');
  assert.deepStrictEqual(queries, ['owner-a']);
  assert.strictEqual(JSON.stringify(api.getState()), before, 'resource import must not change tasks/history/progress');
  assert(d.contains(nonmeal), 'resource hydration replaced an unrelated task node');
  const breakfast = d.querySelector('[data-task-id="routine-v3-breakfast"]');
  const card = breakfast.querySelector('.meal-card');
  assert(card && card.open, 'the meal must show its foods on the scheduled task');
  assert(card.textContent.includes('17 g') && card.textContent.includes('23 g'));
  assert(!card.querySelector('script'), 'food text must be escaped');
  card.open = false;
  api.toggleTask(nonmeal.dataset.taskId, nonmeal.dataset.taskDate);
  assert.strictEqual(breakfast.querySelector('.meal-card'), card);
  assert(!card.open, 'quiet updates must preserve manually collapsed food details');
  const edited = api.getState().tasks.find(task => task.id === 'routine-v3-breakfast');
  api.upsertTask({ ...edited, time: '09:40', title: 'Minha refeição renomeada' }, edited.id);
  const updated = d.querySelector('[data-task-id="routine-v3-breakfast"]');
  assert(updated.textContent.includes('09:40') && updated.querySelector('.meal-card'), 'meal mapping must survive a time/title edit');
  updated.querySelector('[data-action="nutritionPlan"]').click();
  assert(d.querySelector('.nutrition-modal').textContent.includes('09:40'));
  assert(d.querySelector('.nutrition-modal').textContent.includes('Orientação fictícia.'));
  d.querySelector('.modal-close').click();
  d.querySelector('#settingsBtn').click();
  assert.strictEqual(d.querySelectorAll('[data-sound-event]').length, 9);
  const choose = d.querySelector('#sound-notification');
  choose.value = 'open'; choose.dispatchEvent(new w.Event('change'));
  assert.strictEqual(api.getState().settings.soundAssignments.notification, 'open');
  const toggle = d.querySelector('#soundToggle'); toggle.checked = false; toggle.dispatchEvent(new w.Event('change'));
  assert.strictEqual(api.getState().settings.soundEffects, false);
  await resources.load(clientFor({ error: { message: 'offline' } }), 'owner-a', { force: true });
  assert.strictEqual(resources.status(), 'cached'); assert(resources.get('nutrition'));
  const stale = deferred();
  const loading = resources.load(clientFor(() => stale.promise), 'owner-a', { force: true });
  resources.clear(); stale.resolve({ data: rows }); await loading;
  assert.strictEqual(resources.get('nutrition'), null, 'signout must reject in-flight data');
  assert.strictEqual(w.localStorage.getItem('objetivos-private-resources-v1:owner-a'), null);
  assert(!d.querySelector('.meal-card'));
  await resources.load(clientFor({ data: [] }), 'owner-b');
  assert.strictEqual(resources.get('nutrition'), null, 'another account must not inherit meals');
  dom.window.close();

  // A fresh tab can read an owner-scoped cache after authentication, even offline.
  const offline = makeDOM();
  offline.window.localStorage.setItem('objetivos-private-resources-v1:owner-a', JSON.stringify({ userId: 'owner-a', rows }));
  evaluate(offline.window, ['personal-resources.js']);
  assert.strictEqual(offline.window.ObjetivosResources.get('nutrition'), null);
  await offline.window.ObjetivosResources.load(clientFor({ error: { message: 'offline' } }), 'owner-a');
  assert(offline.window.ObjetivosResources.get('nutrition'));
  offline.window.close();

  // Web Audio behavior: mute/zero, gesture resume, non-overlap, speech priority,
  // account lock, unavailable codec and background notification fallback.
  const audioDOM = makeDOM(), aw = audioDOM.window;
  aw.document.body.classList.remove('auth-locked');
  let started = 0, stopped = 0, decoded = 0, resumed = 0, ctx;
  aw.AudioContext = class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; ctx = this; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    async decodeAudioData() { decoded++; return { duration: 1 }; }
    async resume() { resumed++; this.state = 'running'; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { started++; }, stop() { stopped++; } }; }
  };
  evaluate(aw, ['sound-engine.js']);
  const engine = aw.ObjetivosSound;
  engine.setAssets(sounds.map(row => row.payload));
  assert.strictEqual(await engine.play('notification'), false, 'a push must not unlock audio itself');
  assert.strictEqual(resumed, 0);
  assert.strictEqual(await engine.play('notification', { previewId: 'notification' }), true, 'explicit notification preview must unlock');
  assert.strictEqual(started, 1);
  assert.strictEqual(await engine.play('complete', { previewId: 'complete' }), true);
  assert(stopped >= 1, 'new audio must replace current audio');
  const beforeMute = started;
  engine.configure({ soundEffects: false });
  assert.strictEqual(await engine.play('complete', { previewId: 'complete' }), false);
  engine.configure({ soundVolume: 0 });
  assert.strictEqual(await engine.play('complete', { previewId: 'complete' }), false);
  assert.strictEqual(started, beforeMute);
  engine.configure({ soundEffects: true, soundVolume: .35 });
  aw.speechSynthesis = { speaking: true };
  assert.strictEqual(await engine.play('complete'), false);
  aw.speechSynthesis.speaking = false;
  aw.document.body.classList.add('auth-locked');
  assert.strictEqual(await engine.play('complete', { previewId: 'complete' }), false);
  aw.document.body.classList.remove('auth-locked');
  engine.setAssets([{ id:'broken', event:'error', mime:'audio/mpeg', base64:'!' }]);
  assert.strictEqual(await engine.play('error', { previewId:'broken' }), false);
  assert(decoded === 9, 'short sound assets should only decode once per collection');
  assert(ctx);
  audioDOM.window.close();
  console.log(JSON.stringify({ ok: true, mealMapping: true, taskHistoryPreserved: true, privateCache: true, accountIsolation: true, soundControls: true, nonOverlap: true, notificationFallback: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
