(() => {
  'use strict';
  // Kept outside task snapshots: an older/offline client cannot overwrite an import.
  const PREFIX = 'objetivos-private-resources-v1:';
  let owner = null, rows = [], generation = 0, pending = null, fetchedAt = 0;
  let status = 'idle';
  const notify = () => window.dispatchEvent(new CustomEvent('objetivos:resources', { detail: { status } }));
  function readCache(userId) {
    try {
      const value = JSON.parse(localStorage.getItem(PREFIX + userId));
      return value?.userId === userId && Array.isArray(value.rows) ? value.rows : [];
    } catch { return []; }
  }
  function clear() {
    const previous = owner;
    generation++; owner = null; rows = []; pending = null; fetchedAt = 0; status = 'idle';
    if (previous) { try { localStorage.removeItem(PREFIX + previous); } catch {} }
    notify();
  }
  async function load(client, userId, { force = false } = {}) {
    if (!userId || !client) return false;
    if (owner !== userId) {
      clear(); owner = userId; rows = readCache(userId);
      status = rows.length ? 'cached' : 'loading'; notify();
    }
    if (pending) return pending;
    if (!force && fetchedAt && Date.now() - fetchedAt < 60000) return true;
    const token = generation;
    pending = (async () => {
      try {
        const { data, error } = await client.from('user_resources').select('kind,payload,updated_at').eq('user_id', userId);
        if (owner !== userId || generation !== token) return false;
        if (error || !Array.isArray(data)) throw error || new Error('Invalid resources');
        rows = data; fetchedAt = Date.now(); status = 'ready';
        try { localStorage.setItem(PREFIX + userId, JSON.stringify({ userId, rows })); } catch { /* Memory-only if storage is full. */ }
        notify(); return true;
      } catch {
        if (owner === userId && generation === token) { status = rows.length ? 'cached' : 'error'; notify(); }
        return false;
      } finally { if (generation === token) pending = null; }
    })();
    return pending;
  }
  window.ObjetivosResources = {
    load, clear,
    get: (kind) => rows.find(row => row.kind === kind)?.payload || null,
    sounds: () => rows.filter(row => row.kind.startsWith('sound:')).map(row => row.payload),
    status: () => status
  };
})();
