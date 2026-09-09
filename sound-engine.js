(() => {
  'use strict';
  let context, gain, active, assets = [], buffers = new Map(), decoding = new Map();
  let enabled = true, volume = .35, assignments = {}, generation = 0, ticket = 0, lastAt = 0;
  const events = {
    complete: 'Tarefa concluída', undo: 'Desfazer conclusão', create: 'Criar tarefa ou projeto',
    navigate: 'Mudar de aba', notification: 'Aviso com o app aberto', error: 'Algo deu errado',
    milestone: 'Meta alcançada', session: 'Revisão concluída', open: 'Abrir painel'
  };
  function stop() {
    ticket++;
    if (active) { try { active.stop(); } catch {} active = null; }
  }
  function configure(settings = {}) {
    enabled = settings.soundEffects !== false;
    const value = Number(settings.soundVolume ?? .35);
    volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .35;
    assignments = settings.soundAssignments || {};
    if (gain && context) gain.gain.setTargetAtTime(enabled ? volume : 0, context.currentTime, .02);
    if (!enabled || !volume) stop();
  }
  function prepare() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || !assets.length || !enabled) return false;
    if (!context) {
      try {
        context = new AudioContext(); gain = context.createGain();
        gain.gain.value = volume; gain.connect(context.destination);
      } catch { context = null; return false; }
    }
    for (const asset of assets) decode(asset);
    return true;
  }
  function decode(asset) {
    if (buffers.has(asset.id)) return Promise.resolve(buffers.get(asset.id));
    if (decoding.has(asset.id)) return decoding.get(asset.id);
    const token = generation;
    const job = (async () => {
      try {
        if (asset.mime !== 'audio/mpeg' || !/^[A-Za-z0-9+/=]+$/.test(asset.base64 || '') || asset.base64.length > 150000) return null;
        const raw = atob(asset.base64);
        const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
        const buffer = await context.decodeAudioData(bytes.buffer);
        if (token !== generation) return null;
        buffers.set(asset.id, buffer); return buffer;
      } catch { return null; }
      finally { if (token === generation) decoding.delete(asset.id); }
    })();
    decoding.set(asset.id, job); return job;
  }
  async function unlock() {
    if (!prepare()) return false;
    try {
      if (context.state !== 'running') await context.resume();
      return context.state === 'running';
    } catch { return false; }
  }
  async function play(event, { previewId = '' } = {}) {
    if (!enabled || !volume || document.visibilityState === 'hidden' || document.body.classList.contains('auth-locked')) return false;
    if (!previewId && (window.speechSynthesis?.speaking || window.speechSynthesis?.pending)) return false;
    const selected = previewId || assignments[event];
    const asset = assets.find(item => item.id === selected) || assets.find(item => item.event === event);
    if (!asset || !prepare()) return false;
    const now = Date.now();
    if (!previewId && now - lastAt < 180) return false;
    lastAt = now;
    stop(); const playTicket = ticket;
    try {
      // Called by a real UI action; background notifications never resume a context.
      if (context.state !== 'running' && (event !== 'notification' || previewId)) await context.resume();
      if (context.state !== 'running') return false;
      const buffer = await decode(asset);
      if (event === 'notification' && !previewId && Date.now() - now > 180) return false;
      if (!buffer || playTicket !== ticket || !enabled || document.visibilityState === 'hidden') return false;
      const source = context.createBufferSource(); source.buffer = buffer;
      const envelope = context.createGain(); const start = context.currentTime;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(1, start + .008);
      envelope.gain.setValueAtTime(1, start + Math.max(.009, buffer.duration - .025));
      envelope.gain.linearRampToValueAtTime(0, start + buffer.duration);
      source.connect(envelope); envelope.connect(gain); active = source;
      source.onended = () => { source.disconnect(); envelope.disconnect(); if (active === source) active = null; };
      source.start(); return true;
    } catch { return false; }
  }
  window.ObjetivosSound = {
    events, configure, play, stop, unlock,
    setAssets(value) {
      stop(); generation++; assets = Array.isArray(value) ? value : []; buffers.clear(); decoding.clear();
      if (context && enabled) prepare();
    },
    assets: () => assets.map(({ id, label, event }) => ({ id, label, event }))
  };
  document.addEventListener('pointerdown', event => { if (event.isTrusted) unlock(); }, { capture: true, passive: true });
  document.addEventListener('keydown', event => { if (event.isTrusted) unlock(); }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stop(); });
})();
