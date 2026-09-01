const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

const context = {
  console,
  crypto: webcrypto,
  Date,
  Intl,
  Math,
  JSON,
  String,
  Number,
  Boolean,
  Array,
  Object,
  RegExp,
  Map,
  Set
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('fluency-curriculum.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('fluency-engine.js', 'utf8'), context);

const engine = context.FluencyEngine;
const curriculum = context.FluencyCurriculumRU;
assert(engine, 'Fluency engine missing');
assert(curriculum, 'Russian curriculum missing');
assert.strictEqual(curriculum.lessons.length, 16);
assert.strictEqual(curriculum.cards.length, 140);
assert.strictEqual(curriculum.pageCount, 130);
assert.strictEqual(new Set(curriculum.cards.map((card) => card.id)).size, curriculum.cards.length, 'curriculum card ids must be unique');

const exact = engine.gradeAnswer('Это моя книга.', 'это моя книга');
assert.strictEqual(exact.verdict, 'exact');
assert.strictEqual(exact.suggestedRating, 3);

const yo = engine.gradeAnswer('Всё хорошо.', 'Все хорошо');
assert.strictEqual(yo.verdict, 'minor');
assert(yo.note.includes('е/ё'));

const typo = engine.gradeAnswer('Я живу в Бразилии.', 'Я жеву в Бразилии.');
assert.strictEqual(typo.verdict, 'minor');

const wrong = engine.gradeAnswer('Я живу в Бразилии.', 'Меня зовут Кауан.');
assert.strictEqual(wrong.verdict, 'wrong');
assert.strictEqual(wrong.suggestedRating, 1);

const sourceId = 'lesson-01';
const parsed = engine.parseImportedText([
  'Это моя книга. — Este é meu livro.',
  'Я живу в Бразилии. | Eu moro no Brasil.',
  'Это моя книга. — Este é meu livro.',
  'linha ainda sem tradução'
].join('\n'), { sourceId, level: 'A1' });
assert.strictEqual(parsed.items.length, 2, 'imports must be deduplicated');
assert.strictEqual(parsed.unresolved.length, 1, 'unresolved material must be preserved for AI enrichment');
assert(parsed.items.every((item) => item.sourceId === sourceId));

const state = engine.defaultState();
assert.strictEqual(state.items.length, 148, 'starter and full private-course curriculum must be available');
assert.strictEqual(state.curriculumVersion, curriculum.VERSION);
assert.strictEqual(engine.curriculumProgress(state).lessons.length, 16);
const today = engine.localISO();
state.items.forEach((item, index) => {
  item.scheduling.state = 'review';
  item.scheduling.due = index < 5 ? engine.addDays(today, -5 - index) : today;
  item.scheduling.reps = 3;
});
const plan = engine.buildSession(state, { date: today, minutes: 30 });
const backlogInPlan = plan.queue.filter((entry) => {
  const item = state.items.find((candidate) => candidate.id === entry.itemId);
  return item.scheduling.due < today;
}).length;
assert(backlogInPlan <= 3, 'backlog must be throttled instead of dumped into one session');

const first = state.items[0];
const scheduled = engine.scheduleReview(first, 3, today);
assert.strictEqual(scheduled.scheduling.reps, first.scheduling.reps + 1);
assert(scheduled.scheduling.due > today);
assert(scheduled.scheduling.stability > first.scheduling.stability);
const recallNow = engine.retrievability(scheduled.scheduling, today);
const recallLater = engine.retrievability(scheduled.scheduling, engine.addDays(today, 30));
assert(recallNow > recallLater, 'retrievability must decay as time passes');
assert(engine.intervalForRetention(12, .9) >= 11, 'target retention should translate stability into an interval');
const latinFirst = engine.scheduleReview(engine.sanitizeItem({ targetPhrase: 'Hello world.', nativeTranslation: 'Olá mundo.' }), 4, today);
const cyrillicFirst = engine.scheduleReview(engine.sanitizeItem({ targetPhrase: 'Привет, мир!', nativeTranslation: 'Olá, mundo!' }), 4, today);
assert(cyrillicFirst.scheduling.scheduledDays < latinFirst.scheduling.scheduledDays, 'early Cyrillic intervals must be shorter than Latin ones');

const lapse = engine.scheduleReview(scheduled, 1, today);
assert.strictEqual(lapse.scheduling.lapses, scheduled.scheduling.lapses + 1);
assert.strictEqual(lapse.scheduling.state, 'relearning');

let streak = engine.updateStreak({}, today);
streak = engine.updateStreak(streak, engine.addDays(today, 1));
assert.strictEqual(streak.current, 2);
assert.strictEqual(streak.best, 2);

const sanitized = engine.sanitizeState({
  profile: { overallLevel: 'INVALID', dailyMinutes: 999 },
  settings: { newPerDay: 999 },
  items: parsed.items,
  sources: [{ id: sourceId, title: 'Aula 01' }]
});
assert.strictEqual(sanitized.profile.overallLevel, 'A1');
assert.strictEqual(sanitized.profile.dailyMinutes, 240);
assert.strictEqual(sanitized.settings.newPerDay, 30);
assert.strictEqual(sanitized.items.length, parsed.items.length + curriculum.cards.length, 'existing accounts must receive the curriculum exactly once');
const sanitizedTwice = engine.sanitizeState(sanitized);
assert.strictEqual(sanitizedTwice.items.length, sanitized.items.length, 'curriculum migration must be idempotent');
const preserved = engine.sanitizeSource({
  id: sourceId,
  title: 'Aula 01',
  rawText: 'conteúdo integral',
  unresolvedText: 'linha sem tradução',
  storagePath: 'user/lesson/aula.pdf'
});
assert.strictEqual(preserved.rawText, 'conteúdo integral');
assert.strictEqual(preserved.unresolvedText, 'linha sem tradução');
assert.strictEqual(preserved.storagePath, 'user/lesson/aula.pdf');
const richCard = engine.sanitizeItem({
  sourceId,
  targetPhrase: 'Это моя книга.',
  nativeTranslation: 'Este é meu livro.',
  lemma: 'книга',
  wordBreakdown: 'это = isto; моя = meu/minha; книга = livro',
  pronunciationTip: 'Tônica em кни́га.'
});
assert.strictEqual(richCard.lemma, 'книга');
assert(richCard.wordBreakdown.includes('книга'));

console.log(JSON.stringify({
  ok: true,
  modes: engine.VALID_MODES,
  imported: parsed.items.length,
  unresolved: parsed.unresolved.length,
  queue: plan.queue.length,
  backlogInPlan
}));
