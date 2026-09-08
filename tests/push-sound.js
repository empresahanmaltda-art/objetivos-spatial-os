const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { MessageChannel } = require('worker_threads');
async function pushCase(windows, { failure = false } = {}) {
  const handlers = {}, delivered = [], messaged = [];
  const clients = windows.map(item => ({ ...item, postMessage(message, ports) {
    messaged.push(item.id);
    assert.strictEqual(message.type, 'objetivos:push-sound');
    if (item.closed) throw new Error('tab closed');
    if (item.reply !== undefined) ports[0].postMessage({ played: item.reply });
    ports[0].close();
  } }));
  const self = {
    addEventListener(name, callback) { handlers[name] = callback; },
    clients: { async matchAll() { if (failure) throw new Error('unavailable'); return clients; } },
    registration: { async getNotifications() { return []; }, async showNotification(title, options) { delivered.push({ title, options }); } }
  };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, MessageChannel, setTimeout, clearTimeout, URL });
  let finished;
  handlers.push({ data: { json: () => ({ title: 'Teste', tag: 'unique-tag' }) }, waitUntil(promise) { finished = promise; } });
  await finished;
  assert.strictEqual(delivered.length, 1, 'a sound failure must not swallow a notification');
  assert.strictEqual(delivered[0].options.tag, 'unique-tag');
  return { options: delivered[0].options, messaged };
}
(async () => {
  const successful = await pushCase([
    { id: 'background', visibilityState: 'hidden', reply: true },
    { id: 'unfocused', visibilityState: 'visible', reply: true },
    { id: 'focused', visibilityState: 'visible', focused: true, reply: true }
  ]);
  assert.deepStrictEqual(successful.messaged, ['focused'], 'only one foreground window should play');
  assert.strictEqual(successful.options.silent, true, 'confirmed custom playback must suppress duplicate OS sound');
  for (const windows of [[], [{ id: 'hidden', visibilityState: 'hidden' }],
    [{ id: 'blocked', visibilityState: 'visible', reply: false }],
    [{ id: 'unresponsive', visibilityState: 'visible' }],
    [{ id: 'closed', visibilityState: 'visible', closed: true }]]) {
    assert.strictEqual((await pushCase(windows)).options.silent, undefined, 'OS sound must remain available as fallback');
  }
  assert.strictEqual((await pushCase([], { failure: true })).options.silent, undefined);
  console.log(JSON.stringify({ ok: true, singleForegroundSound: true, noDuplicateOSSound: true, backgroundFallback: true, closedTabDelivery: true }));
})().catch(error => { console.error(error); process.exitCode = 1; });
