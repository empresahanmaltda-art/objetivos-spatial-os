(() => {
  'use strict';

  const ENGINE_VERSION = 4;
  const DAY_MS = 86400000;
  const FORGETTING_DECAY = -.5;
  const FORGETTING_FACTOR = 19 / 81;
  const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const VALID_MODES = ['recognition', 'recall', 'cloze', 'listening', 'shadowing'];
  const MODE_SKILLS = {
    recognition: 'reading',
    recall: 'writing',
    cloze: 'interaction',
    listening: 'listening',
    shadowing: 'speaking'
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  function localISO(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseISO(value) {
    const [year, month, day] = String(value || '').split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function addDays(value, amount) {
    const date = parseISO(value);
    date.setDate(date.getDate() + Number(amount || 0));
    return localISO(date);
  }

  function dayDiff(from, to) {
    return Math.round((parseISO(to) - parseISO(from)) / DAY_MS);
  }

  function normalizeAnswer(value = '', { foldYo = true } = {}) {
    let clean = String(value)
      .normalize('NFKC')
      .toLocaleLowerCase('ru-RU')
      .replace(/[“”«»„‟]/g, '"')
      .replace(/[’‘]/g, "'")
      .replace(/[.,!?;:()\[\]{}—–-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (foldYo) clean = clean.replace(/ё/g, 'е');
    return clean;
  }

  function levenshtein(left = '', right = '') {
    const a = [...String(left)];
    const b = [...String(right)];
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[b.length];
  }

  function gradeAnswer(expected = '', actual = '') {
    const rawExpected = normalizeAnswer(expected, { foldYo: false });
    const rawActual = normalizeAnswer(actual, { foldYo: false });
    const normalizedExpected = normalizeAnswer(expected);
    const normalizedActual = normalizeAnswer(actual);
    if (!normalizedActual) {
      return { verdict: 'empty', distance: normalizedExpected.length, score: 0, suggestedRating: 1, note: 'Digite uma resposta antes de conferir.' };
    }
    if (normalizedExpected === normalizedActual) {
      const yoDifference = rawExpected !== rawActual && rawExpected.replace(/ё/g, 'е') === rawActual.replace(/ё/g, 'е');
      return {
        verdict: yoDifference ? 'minor' : 'exact',
        distance: 0,
        score: yoDifference ? .96 : 1,
        suggestedRating: yoDifference ? 1 : 2,
        note: yoDifference ? 'Resposta certa; atenção apenas ao uso de е/ё.' : 'Resposta exata.'
      };
    }
    const distance = levenshtein(normalizedExpected, normalizedActual);
    const maxLength = Math.max([...normalizedExpected].length, [...normalizedActual].length, 1);
    const score = clamp(1 - distance / maxLength, 0, 1);
    const expectedTokens = normalizedExpected.split(' ');
    const actualTokens = normalizedActual.split(' ');
    const tokenGap = Math.abs(expectedTokens.length - actualTokens.length);
    const tolerance = Math.max(1, Math.floor(maxLength * .08));
    const minor = distance <= tolerance && tokenGap <= 1;
    return {
      verdict: minor ? 'minor' : 'wrong',
      distance,
      score,
      suggestedRating: 1,
      note: minor ? 'Quase certo: há um pequeno erro de escrita.' : 'A estrutura ainda precisa ser recuperada novamente.'
    };
  }

  function defaultScheduling() {
    return {
      state: 'new',
      due: localISO(),
      stability: .4,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      scheduledDays: 0,
      lastReview: ''
    };
  }

  function starterItems() {
    const sourceId = 'starter-russian-a1';
    const rows = [
      ['привет', 'Привет!', 'Oi!', 'Cumprimento informal mais comum.', 'Imagine alguém chegando e dizendo “pri-VIET” com energia.'],
      ['зовут', 'Меня зовут Кауан.', 'Meu nome é Kauan.', 'Меня зовут é a construção natural para dizer como você se chama.', 'Зовут parece “sou o...”: use a cena de se apresentar.'],
      ['изучаю', 'Я изучаю русский язык.', 'Eu estudo a língua russa.', 'Depois de изучаю, o objeto aparece no acusativo: русский язык.', 'Imagine “eu estudo” escrito em um livro russo gigante.'],
      ['книга', 'Это моя книга.', 'Este é o meu livro.', 'Книга é feminino; por isso o possessivo é моя.', 'Uma “KNEE-ga”: um livro apoiado no joelho.'],
      ['урок', 'У меня сегодня урок.', 'Hoje eu tenho aula.', 'У меня есть/У меня expressa posse; no presente есть pode ser omitido.', 'Uma aula marcada no relógio de hoje.'],
      ['живу', 'Я живу в Бразилии.', 'Eu moro no Brasil.', 'Com localização, в pede o caso prepositivo: в Бразилии.', '“Já vivo” lembra живу: visualize sua casa no Brasil.'],
      ['немного', 'Я немного говорю по-русски.', 'Eu falo um pouco de russo.', 'По-русски descreve a maneira/idioma em que se fala.', 'Um copinho pequeno representa немного.'],
      ['понимаю', 'Я понимаю эту фразу.', 'Eu entendo esta frase.', 'Эту фразу está no acusativo feminino como objeto direto.', 'Uma lâmpada acende quando você entende: понимаю.']
    ];
    return rows.map(([focusWord, targetPhrase, nativeTranslation, grammarNote, mnemonicAssociation], index) => ({
      id: `starter-a1-${index + 1}`,
      sourceId,
      order: index,
      level: 'A1',
      focusWord,
      targetPhrase,
      nativeTranslation,
      grammarNote,
      mnemonicAssociation,
      tags: ['diagnóstico', 'a1'],
      createdAt: Date.now() + index,
      suspended: false,
      scheduling: defaultScheduling()
    }));
  }

  function defaultState() {
    const starter = starterItems();
    return {
      version: ENGINE_VERSION,
      profile: {
        targetLanguage: 'ru',
        targetLanguageName: 'Russo',
        nativeLanguage: 'pt-BR',
        overallLevel: 'A1',
        skillLevels: { reading: 'A1', listening: 'A1', speaking: 'A1', writing: 'A1', interaction: 'A1' },
        weeklyGoal: 7,
        dailyMinutes: 75,
        startedAt: localISO(),
        teacher: ''
      },
      settings: {
        newPerDay: 10,
        maxReviews: 30,
        backlogShare: .2,
        requestRetention: .9,
        autoplayAudio: true,
        acceptYoAsE: true
      },
      sources: [{
        id: 'starter-russian-a1',
        title: 'Diagnóstico inicial A1',
        kind: 'starter',
        status: 'ready',
        itemCount: starter.length,
        unresolvedCount: 0,
        createdAt: Date.now(),
        note: 'Calibração curta antes de avançar pelo conteúdo das suas aulas.'
      }],
      items: starter,
      events: [],
      sessions: [],
      activeSession: null,
      streak: { current: 0, best: 0, lastStudyDate: '' },
      curriculumLessons: [],
      importedLessonIds: [],
      curriculumVersion: 0
    };
  }

  function sanitizeScheduling(input = {}) {
    const base = defaultScheduling();
    const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due || '') ? input.due : localISO();
    return {
      state: ['new', 'learning', 'review', 'relearning'].includes(input.state) ? input.state : base.state,
      due,
      stability: clamp(Number(input.stability) || base.stability, .1, 3650),
      difficulty: clamp(Number(input.difficulty) || base.difficulty, 1, 10),
      reps: Math.max(0, Number(input.reps) || 0),
      lapses: Math.max(0, Number(input.lapses) || 0),
      scheduledDays: Math.max(0, Number(input.scheduledDays) || 0),
      lastReview: /^\d{4}-\d{2}-\d{2}$/.test(input.lastReview || '') ? input.lastReview : ''
    };
  }

  function sanitizeItem(input = {}, index = 0) {
    return {
      id: String(input.id || uid('fluency-card')).slice(0, 100),
      sourceId: String(input.sourceId || 'manual').slice(0, 100),
      lessonId: String(input.lessonId || '').slice(0, 100),
      unitTitle: String(input.unitTitle || '').trim().slice(0, 160),
      order: Number(input.order) || index,
      level: VALID_LEVELS.includes(input.level) ? input.level : 'A1',
      focusWord: String(input.focusWord || '').trim().slice(0, 160),
      lemma: String(input.lemma || '').trim().slice(0, 160),
      targetPhrase: String(input.targetPhrase || '').trim().slice(0, 500),
      nativeTranslation: String(input.nativeTranslation || '').trim().slice(0, 500),
      transliteration: String(input.transliteration || '').trim().slice(0, 500),
      literalGloss: String(input.literalGloss || '').trim().slice(0, 700),
      wordBreakdown: String(input.wordBreakdown || '').trim().slice(0, 1200),
      grammarNote: String(input.grammarNote || '').trim().slice(0, 900),
      mnemonicAssociation: String(input.mnemonicAssociation || '').trim().slice(0, 900),
      pronunciationTip: String(input.pronunciationTip || '').trim().slice(0, 700),
      sourceQuote: String(input.sourceQuote || '').trim().slice(0, 700),
      modePriority: VALID_MODES.includes(input.modePriority) ? input.modePriority : '',
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).slice(0, 40)).slice(0, 12) : [],
      createdAt: Number(input.createdAt) || Date.now(),
      suspended: Boolean(input.suspended),
      scheduling: sanitizeScheduling(input.scheduling)
    };
  }

  function sanitizeSource(input = {}, index = 0) {
    return {
      id: String(input.id || uid('fluency-source')).slice(0, 100),
      title: String(input.title || `Material ${index + 1}`).trim().slice(0, 120) || `Material ${index + 1}`,
      kind: ['starter', 'notion', 'pdf', 'text', 'manual', 'lesson'].includes(input.kind) ? input.kind : 'text',
      status: ['ready', 'processing', 'needs-ai', 'error'].includes(input.status) ? input.status : 'ready',
      itemCount: Math.max(0, Number(input.itemCount) || 0),
      unresolvedCount: Math.max(0, Number(input.unresolvedCount) || 0),
      createdAt: Number(input.createdAt) || Date.now(),
      note: String(input.note || '').slice(0, 500),
      externalUrl: String(input.externalUrl || '').slice(0, 1200),
      fileName: String(input.fileName || '').slice(0, 240),
      storagePath: String(input.storagePath || '').slice(0, 1200),
      rawText: String(input.rawText || '').slice(0, 120000),
      unresolvedText: String(input.unresolvedText || '').slice(0, 60000),
      processedAt: String(input.processedAt || '').slice(0, 40)
    };
  }

  function sanitizeLesson(input = {}, index = 0) {
    const explicitNumber = Number(input.number) || Number(String(input.id || '').match(/\d+/)?.[0]) || index + 1;
    return {
      id: String(input.id || `l${String(explicitNumber).padStart(2, '0')}`).slice(0, 100),
      number: Math.max(1, explicitNumber),
      title: String(input.title || `Aula ${explicitNumber}`).trim().slice(0, 160),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : '',
      summary: String(input.summary || '').trim().slice(0, 700),
      externalUrl: String(input.externalUrl || '').trim().slice(0, 1200),
      pageCount: Math.max(0, Number(input.pageCount) || 0)
    };
  }

  function curriculumLessonsFrom(input = {}, items = []) {
    const stored = Array.isArray(input.curriculumLessons)
      ? input.curriculumLessons.slice(0, 1000).map(sanitizeLesson)
      : [];
    const byId = new Map(stored.map((lesson) => [lesson.id, lesson]));
    items.filter((item) => item.lessonId).forEach((item) => {
      if (byId.has(item.lessonId)) return;
      const number = Number(String(item.lessonId).match(/\d+/)?.[0]) || Math.floor(Math.max(0, Number(item.order) || 0) / 100) || byId.size + 1;
      byId.set(item.lessonId, sanitizeLesson({
        id: item.lessonId,
        number,
        title: item.unitTitle || `Aula ${number}`
      }, byId.size));
    });
    return [...byId.values()].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
  }

  function sanitizeState(input) {
    const base = defaultState();
    if (!input || typeof input !== 'object') return base;
    const profile = { ...base.profile, ...(input.profile || {}) };
    profile.overallLevel = VALID_LEVELS.includes(profile.overallLevel) ? profile.overallLevel : 'A1';
    profile.dailyMinutes = clamp(Number(profile.dailyMinutes) || 75, 15, 240);
    profile.weeklyGoal = clamp(Number(profile.weeklyGoal) || 7, 1, 7);
    profile.skillLevels = { ...base.profile.skillLevels, ...(profile.skillLevels || {}) };
    Object.keys(profile.skillLevels).forEach((key) => {
      if (!VALID_LEVELS.includes(profile.skillLevels[key])) profile.skillLevels[key] = 'A1';
    });
    const settings = { ...base.settings, ...(input.settings || {}) };
    settings.newPerDay = clamp(Number(settings.newPerDay) || 6, 0, 30);
    settings.maxReviews = clamp(Number(settings.maxReviews) || 30, 5, 120);
    settings.backlogShare = clamp(Number(settings.backlogShare) || .2, .05, .5);
    settings.requestRetention = clamp(Number(settings.requestRetention) || .9, .8, .97);
    let items = Array.isArray(input.items) ? input.items.slice(0, 5000).map(sanitizeItem).filter((item) => item.targetPhrase && item.nativeTranslation) : base.items;
    let sources = Array.isArray(input.sources) && input.sources.length ? input.sources.slice(0, 500).map(sanitizeSource) : base.sources;
    const curriculumLessons = curriculumLessonsFrom(input, items);
    const storedCurriculumVersion = Math.max(0, Number(input.curriculumVersion) || 0);
    return {
      ...base,
      ...input,
      version: ENGINE_VERSION,
      profile,
      settings,
      sources,
      items,
      curriculumLessons,
      events: Array.isArray(input.events) ? input.events.slice(-3000) : [],
      sessions: Array.isArray(input.sessions) ? input.sessions.slice(-365) : [],
      activeSession: input.activeSession && typeof input.activeSession === 'object' ? input.activeSession : null,
      streak: { ...base.streak, ...(input.streak || {}) },
      importedLessonIds: [...new Set([
        ...(Array.isArray(input.importedLessonIds) ? input.importedLessonIds.map(String) : []),
        ...curriculumLessons.map((lesson) => lesson.id)
      ])].slice(0, 1000),
      curriculumVersion: storedCurriculumVersion
    };
  }

  function modeForItem(item) {
    const reps = Number(item.scheduling?.reps) || 0;
    if (reps === 0) return 'recognition';
    if (reps === 1) return 'recall';
    if (reps === 2 && VALID_MODES.includes(item.modePriority)) return item.modePriority;
    return VALID_MODES[(reps - 2) % VALID_MODES.length];
  }

  function retrievability(schedulingInput = {}, date = localISO()) {
    const scheduling = sanitizeScheduling(schedulingInput);
    if (!scheduling.lastReview) return scheduling.state === 'new' ? 0 : .9;
    const elapsed = Math.max(0, dayDiff(scheduling.lastReview, date));
    return clamp(Math.pow(1 + FORGETTING_FACTOR * elapsed / Math.max(.1, scheduling.stability), FORGETTING_DECAY), 0, 1);
  }

  function intervalForRetention(stability, retention = .9) {
    const desired = clamp(Number(retention) || .9, .8, .97);
    return clamp(Math.round(Math.max(.1, stability) / FORGETTING_FACTOR * (Math.pow(desired, 1 / FORGETTING_DECAY) - 1)), 1, 3650);
  }

  function buildSession(input, { date = localISO(), minutes = 75 } = {}) {
    const state = sanitizeState(input);
    const available = state.items.filter((item) => !item.suspended);
    const privateLessonIds = [...new Set(available.map((item) => item.lessonId).filter(Boolean))];
    const lessonNumber = (lessonId) => state.curriculumLessons.find((lesson) => lesson.id === lessonId)?.number
      || Number(String(lessonId).match(/\d+/)?.[0]) || 0;
    const newestLessonIds = privateLessonIds.slice().sort((a, b) => lessonNumber(b) - lessonNumber(a) || b.localeCompare(a));
    const curriculumRank = new Map(newestLessonIds.map((lessonId, index) => [lessonId, index]));
    const courseOrder = (item) => {
      const lessonRank = curriculumRank.get(item.lessonId) ?? newestLessonIds.length;
      const positionInLesson = Math.max(0, Number(item.order) % 100 - 1);
      return positionInLesson * Math.max(1, newestLessonIds.length) + lessonRank;
    };
    const newItems = available.filter((item) => item.scheduling.state === 'new').sort((a, b) => {
      const aCourse = Boolean(a.lessonId);
      const bCourse = Boolean(b.lessonId);
      if (aCourse && bCourse) return courseOrder(a) - courseOrder(b);
      if (aCourse !== bCourse) return aCourse ? 1 : -1;
      return b.createdAt - a.createdAt || a.order - b.order;
    });
    const reviewItems = available.filter((item) => item.scheduling.state !== 'new' && item.scheduling.due <= date);
    const backlog = reviewItems.filter((item) => item.scheduling.due < date).sort((a, b) => a.scheduling.due.localeCompare(b.scheduling.due));
    const dueToday = reviewItems.filter((item) => item.scheduling.due === date).sort((a, b) => a.scheduling.difficulty - b.scheduling.difficulty);
    const capacity = clamp(Math.round(Number(minutes || 75) * .45), 10, state.settings.maxReviews);
    const backlogLimit = Math.max(1, Math.round(capacity * state.settings.backlogShare));
    const plannedCount = Math.min(capacity, reviewItems.length + Math.min(state.settings.newPerDay, newItems.length));
    const latestLessonId = newestLessonIds[0] || '';
    const latestLessonItems = latestLessonId ? available.filter((item) => item.lessonId === latestLessonId) : [];
    const shortWarmup = Number(minutes) <= 15;
    const latestLessonMastery = latestLessonItems.length
      ? Math.round(latestLessonItems.reduce((sum, item) => sum + itemMastery(item), 0) / latestLessonItems.length)
      : 0;
    const latestLessonShare = shortWarmup
      ? (latestLessonMastery < 75 ? .6 : .5)
      : latestLessonMastery < 40 ? .6 : latestLessonMastery < 75 ? .5 : .35;
    const latestLessonQuota = Math.min(
      latestLessonItems.length,
      Math.max(shortWarmup ? 5 : 4, Math.round(Math.max(1, plannedCount) * latestLessonShare))
    );
    const chosen = [];
    const selectedIds = new Set();
    const addUnique = (candidates, limit) => {
      let added = 0;
      for (const item of candidates) {
        if (added >= limit || chosen.length >= capacity) break;
        if (selectedIds.has(item.id)) continue;
        selectedIds.add(item.id);
        chosen.push(item);
        added += 1;
      }
      return added;
    };
    const latestNonBacklog = latestLessonItems
      .filter((item) => item.scheduling.state === 'new' || item.scheduling.due >= date)
      .sort((a, b) => {
        const rank = (item) => item.scheduling.state !== 'new' && item.scheduling.due === date ? 0 : item.scheduling.state === 'new' ? 1 : 2;
        return rank(a) - rank(b)
          || retrievability(a.scheduling, date) - retrievability(b.scheduling, date)
          || a.order - b.order;
      });
    const latestBacklog = latestLessonItems
      .filter((item) => item.scheduling.state !== 'new' && item.scheduling.due < date)
      .sort((a, b) => a.scheduling.due.localeCompare(b.scheduling.due));
    const anchoredFresh = addUnique(latestNonBacklog, latestLessonQuota);
    const anchorGap = Math.max(0, latestLessonQuota - anchoredFresh);
    addUnique(latestBacklog, Math.min(anchorGap, backlogLimit));
    const anchoredBacklog = chosen.filter((item) => item.scheduling.state !== 'new' && item.scheduling.due < date).length;
    addUnique(backlog, Math.max(0, backlogLimit - anchoredBacklog));
    addUnique(dueToday, Math.max(0, capacity - chosen.length));
    const selectedNew = chosen.filter((item) => item.scheduling.state === 'new').length;
    const newLimit = Math.min(Math.max(0, state.settings.newPerDay - selectedNew), Math.max(0, capacity - chosen.length));
    addUnique(newItems, newLimit);
    if (!chosen.length) {
      addUnique(available.slice().sort((a, b) => a.scheduling.due.localeCompare(b.scheduling.due)), Math.min(6, capacity));
    }
    const queue = chosen.map((item) => ({ itemId: item.id, mode: modeForItem(item), retry: false }));
    return {
      id: uid('fluency-session'),
      date,
      targetMinutes: clamp(Number(minutes) || state.profile.dailyMinutes, 10, 240),
      startedAt: new Date().toISOString(),
      index: 0,
      queue,
      revealed: false,
      comparison: null,
      answer: '',
      ratings: [],
      correct: 0,
      minor: 0,
      missed: 0,
      paused: false,
      completedAt: ''
    };
  }

  function scheduleReview(itemInput, rating, date = localISO(), requestRetention = .9) {
    const item = sanitizeItem(itemInput);
    const previous = item.scheduling;
    const value = clamp(Number(rating) || 1, 1, 3);
    const firstReview = previous.reps === 0;
    let interval;
    let stability = previous.stability;
    let difficulty = previous.difficulty;
    if (firstReview) {
      interval = [1, 2, 4][value - 1];
      stability = [.35, 2.2, 4.5][value - 1];
    } else if (value === 1) {
      interval = 1;
      const recall = retrievability(previous, date);
      stability = Math.max(.35, previous.stability * (.42 + recall * .14));
      difficulty = clamp(previous.difficulty + .8, 1, 10);
    } else {
      const recall = retrievability(previous, date);
      const gradeGain = { 2: .95, 3: 1.55 }[value];
      const difficultyFactor = clamp(1.35 - difficulty * .065, .55, 1.25);
      const stabilizationDecay = clamp(Math.pow(Math.max(previous.stability, .2), -.18), .36, 1.34);
      const desirableDifficulty = 1 + (1 - recall) * 1.7;
      const gain = gradeGain * difficultyFactor * stabilizationDecay * desirableDifficulty;
      stability = clamp(previous.stability * (1 + gain), .5, 3650);
      interval = intervalForRetention(stability, requestRetention);
      difficulty = clamp(difficulty + ({ 2: -.15, 3: -.45 }[value] || 0), 1, 10);
    }
    const nonLatinFirstHours = /[\u0400-\u04ff]/u.test(item.targetPhrase) && previous.reps < 2 && interval > 0 && interval <= 4;
    if (nonLatinFirstHours) interval = Math.max(1, Math.round(interval * .8));
    item.scheduling = {
      state: value === 1 ? 'relearning' : interval <= 2 ? 'learning' : 'review',
      due: addDays(date, interval),
      stability,
      difficulty,
      reps: previous.reps + 1,
      lapses: previous.lapses + (value === 1 ? 1 : 0),
      scheduledDays: interval,
      lastReview: date
    };
    return item;
  }

  function updateStreak(streakInput = {}, date = localISO()) {
    const streak = { current: 0, best: 0, lastStudyDate: '', ...streakInput };
    if (streak.lastStudyDate === date) return streak;
    const yesterday = addDays(date, -1);
    streak.current = streak.lastStudyDate === yesterday ? streak.current + 1 : 1;
    streak.best = Math.max(streak.best, streak.current);
    streak.lastStudyDate = date;
    return streak;
  }

  function skillMetrics(input) {
    const state = sanitizeState(input);
    const recent = state.events.slice(-240);
    const skills = ['reading', 'listening', 'speaking', 'writing', 'interaction'];
    return Object.fromEntries(skills.map((skill) => {
      const events = recent.filter((event) => (event.skill || MODE_SKILLS[event.mode]) === skill);
      if (!events.length) return [skill, { score: 0, reviews: 0, level: state.profile.skillLevels[skill] || 'A1' }];
      const weighted = events.reduce((sum, event, index) => {
        const rating = Number(event.rating) || 1;
        const quality = Number(event.ratingScale) === 3
          ? ({ 1: .25, 2: .8, 3: 1 }[clamp(rating, 1, 3)] || .25)
          : clamp(rating, 1, 4) / 4;
        return sum + quality * (1 + index / Math.max(events.length, 1));
      }, 0);
      const weights = events.reduce((sum, _event, index) => sum + (1 + index / Math.max(events.length, 1)), 0);
      return [skill, { score: Math.round(weighted / weights * 100), reviews: events.length, level: state.profile.skillLevels[skill] || 'A1' }];
    }));
  }

  function clozePhrase(item) {
    const phrase = String(item?.targetPhrase || '');
    const focus = String(item?.focusWord || '').trim();
    if (!focus) return phrase.replace(/\p{L}+/u, '_____');
    const escaped = focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = phrase.replace(new RegExp(escaped, 'iu'), '_____');
    return replaced === phrase ? phrase.replace(/\p{L}+/u, '_____') : replaced;
  }

  function promptFor(item, mode) {
    if (mode === 'recognition') return { eyebrow: 'Reconhecimento', prompt: item.targetPhrase, instruction: 'Recupere o sentido antes de revelar.', expectsInput: false };
    if (mode === 'listening') return { eyebrow: 'Ditado', prompt: 'Ouça e escreva a frase em russo.', instruction: 'Use o áudio; não olhe a resposta.', expectsInput: true };
    if (mode === 'shadowing') return { eyebrow: 'Pronúncia', prompt: item.targetPhrase, instruction: 'Ouça, repita em voz alta e compare seu ritmo.', expectsInput: false };
    if (mode === 'cloze') return { eyebrow: 'Lacuna', prompt: clozePhrase(item), instruction: `Complete usando “${item.nativeTranslation}” como pista.`, expectsInput: true };
    return { eyebrow: 'Produção ativa', prompt: item.nativeTranslation, instruction: 'Escreva a frase natural em russo.', expectsInput: true };
  }

  function parseImportedText(text = '', { sourceId = uid('fluency-source'), level = 'A1' } = {}) {
    const unresolved = [];
    const items = [];
    const seen = new Set();
    String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const parts = line.split(/\t|\s+\|\s+|\s+::\s+|\s+=\s+|\s+[—–]\s+/).map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2 || !/[А-Яа-яЁё]/.test(parts[0])) {
        unresolved.push(line);
        return;
      }
      const targetPhrase = parts[0];
      const nativeTranslation = parts.slice(1).join(' — ');
      const key = `${normalizeAnswer(targetPhrase)}|${normalizeAnswer(nativeTranslation, { foldYo: false })}`;
      if (seen.has(key)) return;
      seen.add(key);
      const words = targetPhrase.match(/[А-Яа-яЁё-]+/g) || [];
      const focusWord = words.sort((a, b) => b.length - a.length)[0] || targetPhrase;
      items.push(sanitizeItem({
        id: uid('fluency-card'),
        sourceId,
        order: index,
        level,
        focusWord,
        targetPhrase,
        nativeTranslation,
        grammarNote: 'Importado do seu material. A análise gramatical será enriquecida pela IA.',
        mnemonicAssociation: '',
        tags: ['importado'],
        scheduling: defaultScheduling()
      }, index));
    });
    return { items, unresolved };
  }

  function dueSummary(input, date = localISO()) {
    const state = sanitizeState(input);
    const active = state.items.filter((item) => !item.suspended);
    const newCount = active.filter((item) => item.scheduling.state === 'new').length;
    const due = active.filter((item) => item.scheduling.state !== 'new' && item.scheduling.due <= date);
    const backlog = due.filter((item) => item.scheduling.due < date).length;
    return { newCount, dueCount: due.length, backlog, total: active.length, mature: active.filter((item) => item.scheduling.state === 'review').length };
  }

  function itemMastery(item) {
    const scheduling = sanitizeScheduling(item?.scheduling);
    if (scheduling.state === 'new' || !scheduling.reps) return 0;
    if (scheduling.state === 'relearning') return clamp(18 + scheduling.reps * 3 - scheduling.lapses * 4, 10, 48);
    if (scheduling.state === 'learning') return clamp(28 + scheduling.reps * 10, 28, 58);
    return clamp(Math.round(50 + scheduling.reps * 6 + Math.log2(1 + scheduling.stability) * 8 - scheduling.lapses * 5), 45, 100);
  }

  function curriculumProgress(input) {
    const state = sanitizeState(input);
    if (!state.curriculumLessons.length) return { lessons: [], current: null, overall: 0, mastered: 0, focusLessons: [] };
    const lessons = state.curriculumLessons.map((lesson) => {
      const items = state.items.filter((item) => item.lessonId === lesson.id && !item.suspended);
      const mastery = items.length ? Math.round(items.reduce((sum, item) => sum + itemMastery(item), 0) / items.length) : 0;
      const reviewed = items.filter((item) => item.scheduling.reps > 0).length;
      return { ...lesson, itemCount: items.length, reviewed, mastery, status: 'mapped' };
    });
    const current = lessons[lessons.length - 1];
    const earlierGaps = lessons
      .filter((lesson) => lesson.id !== current.id && lesson.mastery < 75)
      .sort((a, b) => a.mastery - b.mastery || b.number - a.number);
    const focusLessons = [current, ...earlierGaps];
    const next = earlierGaps[0] || null;
    const currentIndex = lessons.findIndex((lesson) => lesson.id === current.id);
    lessons.forEach((lesson) => {
      lesson.status = lesson.id === current.id ? 'current' : lesson.mastery >= 75 ? 'mastered' : lesson.id === next?.id ? 'next' : 'mapped';
    });
    const mastered = lessons.filter((lesson) => lesson.mastery >= 75).length;
    const overall = Math.round(lessons.reduce((sum, lesson) => sum + lesson.mastery, 0) / lessons.length);
    return { lessons, current, currentIndex, focusLessons, overall, mastered };
  }

  globalThis.FluencyEngine = Object.freeze({
    ENGINE_VERSION,
    VALID_LEVELS,
    VALID_MODES,
    MODE_SKILLS,
    localISO,
    addDays,
    dayDiff,
    normalizeAnswer,
    levenshtein,
    gradeAnswer,
    defaultState,
    sanitizeState,
    sanitizeItem,
    sanitizeSource,
    sanitizeLesson,
    buildSession,
    scheduleReview,
    retrievability,
    intervalForRetention,
    updateStreak,
    skillMetrics,
    promptFor,
    parseImportedText,
    dueSummary,
    curriculumProgress,
    clone,
    uid
  });
})();
