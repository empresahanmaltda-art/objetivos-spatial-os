const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { webcrypto } = require('crypto');

const context = { console, crypto: webcrypto, Date, Intl, Math, JSON, String, Number, Boolean, Array, Object, RegExp, Map, Set };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('fluency-engine.js', 'utf8'), context);

const engine = context.FluencyEngine;
assert(engine, 'Fluency engine missing');
assert.strictEqual(engine.ENGINE_VERSION, 3);

const exact = engine.gradeAnswer('Это моя книга.', 'это моя книга');
assert.strictEqual(exact.verdict, 'exact');
assert.strictEqual(exact.suggestedRating, 3);
const yo = engine.gradeAnswer('Всё хорошо.', 'Все хорошо');
assert.strictEqual(yo.verdict, 'minor');
assert(yo.note.includes('е/ё'));
assert.strictEqual(engine.gradeAnswer('Я живу в Бразилии.', 'Я жеву в Бразилии.').verdict, 'minor');
assert.strictEqual(engine.gradeAnswer('Я живу в Бразилии.', 'Меня зовут Кауан.').verdict, 'wrong');

const sourceId = 'lesson-fixture';
const parsed = engine.parseImportedText([
  'Это моя книга. — Este é meu livro.',
  'Я живу в Бразилии. | Eu moro no Brasil.',
  'Это моя книга. — Este é meu livro.',
  'linha ainda sem tradução'
].join('\n'), { sourceId, level: 'A1' });
assert.strictEqual(parsed.items.length, 2, 'imports must be deduplicated');
assert.strictEqual(parsed.unresolved.length, 1, 'unresolved material must be preserved for AI enrichment');

const curriculumLessons = Array.from({ length: 8 }, (_, index) => ({
  id: `unit-${index + 1}`,
  number: index + 1,
  title: `Unidade ${index + 1}`,
  date: `2026-08-${String(index + 1).padStart(2, '0')}`,
  summary: `Conteúdo de teste ${index + 1}`,
  pageCount: 2
}));
const privateItems = curriculumLessons.flatMap((lesson) => Array.from({ length: 6 }, (_, index) => engine.sanitizeItem({
  id: `${lesson.id}-card-${index + 1}`,
  sourceId: 'authenticated-curriculum',
  lessonId: lesson.id,
  unitTitle: lesson.title,
  order: lesson.number * 100 + index + 1,
  targetPhrase: `Это урок ${lesson.number}, пример ${index + 1}.`,
  nativeTranslation: `Esta é a unidade ${lesson.number}, exemplo ${index + 1}.`,
  focusWord: 'урок',
  scheduling: { state: 'new' }
})));
const state = engine.sanitizeState({
  settings: { newPerDay: 10, maxReviews: 30 },
  sources: [{ id: 'authenticated-curriculum', title: 'Currículo autenticado', kind: 'lesson', itemCount: privateItems.length }],
  items: privateItems,
  curriculumLessons,
  curriculumVersion: 1
});
assert.strictEqual(state.items.length, privateItems.length);
assert.strictEqual(engine.curriculumProgress(state).lessons.length, curriculumLessons.length);

const calibration = engine.buildSession(state, { date: engine.localISO(), minutes: 75 });
assert(calibration.queue.slice(0, 3).every((entry) => state.items.find((item) => item.id === entry.itemId)?.lessonId === 'unit-8'), 'full sessions must begin with the latest lesson');
const classWarmup = engine.buildSession(state, { date: engine.localISO(), minutes: 10 });
assert.strictEqual(classWarmup.targetMinutes, 10);
assert.strictEqual(classWarmup.queue.length, 10);
assert(classWarmup.queue.slice(0, 4).every((entry) => state.items.find((item) => item.id === entry.itemId)?.lessonId === 'unit-8'), 'warmup must anchor forty percent in the latest lesson');
assert(new Set(classWarmup.queue.map((entry) => state.items.find((item) => item.id === entry.itemId)?.lessonId)).size >= 6, 'warmup must retrieve across earlier lessons');

const forcedLatestState = engine.sanitizeState(state);
forcedLatestState.items.forEach((item) => {
  item.scheduling.state = 'review';
  item.scheduling.reps = 3;
  item.scheduling.lastReview = engine.localISO();
  item.scheduling.due = item.lessonId === 'unit-8' ? engine.addDays(engine.localISO(), 30) : engine.localISO();
});
const forcedLatest = engine.buildSession(forcedLatestState, { date: engine.localISO(), minutes: 30 });
assert(forcedLatest.queue.slice(0, 4).every((entry) => forcedLatestState.items.find((item) => item.id === entry.itemId)?.lessonId === 'unit-8'), 'latest lesson must remain present even when not due');

const today = engine.localISO();
state.items.forEach((item, index) => {
  item.scheduling.state = 'review';
  item.scheduling.due = index < 5 ? engine.addDays(today, -5 - index) : today;
  item.scheduling.reps = 3;
});
const plan = engine.buildSession(state, { date: today, minutes: 30 });
const backlogInPlan = plan.queue.filter((entry) => state.items.find((item) => item.id === entry.itemId).scheduling.due < today).length;
assert(backlogInPlan <= 3, 'backlog must be throttled');

const first = state.items[0];
const scheduled = engine.scheduleReview(first, 3, today);
assert.strictEqual(scheduled.scheduling.reps, first.scheduling.reps + 1);
assert(scheduled.scheduling.due > today);
assert(engine.retrievability(scheduled.scheduling, today) > engine.retrievability(scheduled.scheduling, engine.addDays(today, 30)), 'retrievability must decay');
assert(engine.intervalForRetention(12, .9) >= 11);
const latinFirst = engine.scheduleReview(engine.sanitizeItem({ targetPhrase: 'Hello world.', nativeTranslation: 'Olá mundo.' }), 4, today);
const cyrillicFirst = engine.scheduleReview(engine.sanitizeItem({ targetPhrase: 'Привет, мир!', nativeTranslation: 'Olá, mundo!' }), 4, today);
assert(cyrillicFirst.scheduling.scheduledDays < latinFirst.scheduling.scheduledDays, 'early Cyrillic intervals must be shorter');

const defaults = engine.defaultState();
assert.strictEqual(defaults.curriculumLessons.length, 0, 'public bundle must not embed a private curriculum');
assert.strictEqual(defaults.profile.teacher, '', 'public bundle must not embed the teacher identity');
const sanitized = engine.sanitizeState({
  profile: { overallLevel: 'INVALID', dailyMinutes: 999 },
  settings: { newPerDay: 999 },
  items: parsed.items,
  sources: [{ id: sourceId, title: 'Aula de teste' }]
});
assert.strictEqual(sanitized.profile.overallLevel, 'A1');
assert.strictEqual(sanitized.profile.dailyMinutes, 240);
assert.strictEqual(sanitized.settings.newPerDay, 30);
assert.strictEqual(sanitized.items.length, parsed.items.length, 'private cards must arrive only through authenticated state');

const derived = engine.sanitizeState({ items: privateItems, sources: [{ id: 'authenticated-curriculum', title: 'Currículo autenticado' }] });
assert.strictEqual(derived.curriculumLessons.length, curriculumLessons.length, 'legacy private state must derive lesson metadata');

const preserved = engine.sanitizeSource({ id: sourceId, title: 'Aula de teste', rawText: 'conteúdo integral', unresolvedText: 'linha sem tradução', storagePath: 'user/lesson/aula.pdf' });
assert.strictEqual(preserved.rawText, 'conteúdo integral');
assert.strictEqual(preserved.unresolvedText, 'linha sem tradução');
assert.strictEqual(preserved.storagePath, 'user/lesson/aula.pdf');

console.log(JSON.stringify({ ok: true, modes: engine.VALID_MODES, queue: plan.queue.length, backlogInPlan }));
