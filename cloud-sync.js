(() => {
  'use strict';

  const EMAIL_KEY = 'objetivos-cloud-email-v1';
  const DIRTY_KEY = 'objetivos-cloud-dirty-v1';
  const CONFIG = window.OBJETIVOS_CLOUD_CONFIG || {};
  const runtime = {
    client: null,
    session: null,
    channel: null,
    uploadTimer: null,
    applying: false,
    lastHash: '',
    syncing: false,
    initialSyncPromise: null,
    error: ''
  };

  const api = () => window.__OBJETIVOS__;
  const configured = () => Boolean(CONFIG.supabaseUrl && CONFIG.publishableKey && window.supabase?.createClient);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function cloudPayload(input) {
    const source = clone(input || api()?.getState?.() || {});
    delete source.view;
    delete source.selectedDate;
    delete source.lastSystemDate;
    delete source.revision;
    delete source.updatedAt;
    if (source.settings) delete source.settings.notificationsEnabled;
    return source;
  }

  function hashState(input) {
    return JSON.stringify(cloudPayload(input));
  }

  function setTopStatus(label, saving = false) {
    api()?.setSyncLabel?.(label, saving);
  }

  function setRuntimeStatus({ syncing = runtime.syncing, error = runtime.error } = {}) {
    runtime.syncing = syncing;
    runtime.error = error;
    refreshSettings();
  }

  async function uploadState(input, { force = false } = {}) {
    if (!runtime.session || !runtime.client || runtime.applying || runtime.syncing) return false;
    const payload = cloudPayload(input);
    const nextHash = JSON.stringify(payload);
    if (!force && nextHash === runtime.lastHash && localStorage.getItem(DIRTY_KEY) !== '1') return true;
    runtime.syncing = true;
    setTopStatus('sincronizando…', true);
    setRuntimeStatus({ syncing: true, error: '' });
    const clientUpdatedAt = new Date().toISOString();
    const { error } = await runtime.client.from('user_state').upsert({
      user_id: runtime.session.user.id,
      payload: { ...payload, cloudUpdatedAt: clientUpdatedAt },
      client_updated_at: clientUpdatedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }, { onConflict: 'user_id' });
    runtime.syncing = false;
    if (error) {
      setRuntimeStatus({ syncing: false, error: error.message || 'Falha ao sincronizar.' });
      setTopStatus('salvo neste aparelho');
      return false;
    }
    runtime.lastHash = nextHash;
    localStorage.setItem(DIRTY_KEY, '0');
    setRuntimeStatus({ syncing: false, error: '' });
    setTopStatus('sincronizado');
    return true;
  }

  function scheduleUpload(input) {
    const nextHash = hashState(input);
    if (runtime.applying || nextHash === runtime.lastHash) return;
    localStorage.setItem(DIRTY_KEY, '1');
    clearTimeout(runtime.uploadTimer);
    runtime.uploadTimer = setTimeout(() => uploadState(input), 650);
  }

  function applyRemote(payload) {
    if (!payload || typeof payload !== 'object') return;
    runtime.applying = true;
    const clean = clone(payload);
    delete clean.cloudUpdatedAt;
    api()?.applyCloudState?.(clean);
    runtime.lastHash = JSON.stringify(clean);
    localStorage.setItem(DIRTY_KEY, '0');
    runtime.applying = false;
    setTopStatus('sincronizado');
  }

  async function performInitialSync() {
    if (!runtime.session || !runtime.client) return;
    setTopStatus('sincronizando…', true);
    const { data, error } = await runtime.client
      .from('user_state')
      .select('payload,client_updated_at')
      .eq('user_id', runtime.session.user.id)
      .maybeSingle();
    if (error) {
      setRuntimeStatus({ error: error.message || 'Falha ao carregar dados.' });
      setTopStatus('salvo neste aparelho');
      return;
    }
    const localState = api()?.getState?.();
    if (data?.payload && localStorage.getItem(DIRTY_KEY) !== '1') applyRemote(data.payload);
    else await uploadState(localState, { force: true });
    subscribeRealtime();
    setRuntimeStatus({ error: '' });
  }

  async function initialSync() {
    if (!runtime.session || !runtime.client) return;
    if (runtime.initialSyncPromise) return runtime.initialSyncPromise;
    runtime.initialSyncPromise = performInitialSync();
    try {
      return await runtime.initialSyncPromise;
    } finally {
      runtime.initialSyncPromise = null;
    }
  }

  function subscribeRealtime() {
    if (!runtime.client || !runtime.session) return;
    if (runtime.channel) runtime.client.removeChannel(runtime.channel);
    runtime.channel = runtime.client
      .channel(`objetivos-${runtime.session.user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_state', filter: `user_id=eq.${runtime.session.user.id}`
      }, (event) => {
        const payload = event.new?.payload;
        if (!payload || runtime.applying) return;
        const remoteHash = hashState(payload);
        if (remoteHash !== runtime.lastHash) applyRemote(payload);
      })
      .subscribe();
  }

  async function sendLink(email) {
    if (!runtime.client) throw new Error('Servidor ainda não configurado.');
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@')) throw new Error('Digite um email válido.');
    localStorage.setItem(EMAIL_KEY, cleanEmail);
    const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await runtime.client.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: true, emailRedirectTo }
    });
    if (error) throw error;
    return cleanEmail;
  }

  function urlBase64ToBytes(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  }

  async function enablePush() {
    if (!runtime.session) throw new Error('Conecte sua conta primeiro.');
    if (!CONFIG.vapidPublicKey) throw new Error('A chave de notificações ainda não foi configurada.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Este aparelho não oferece Web Push.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(CONFIG.vapidPublicKey)
      });
    }
    const json = subscription.toJSON();
    const { error } = await runtime.client.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      user_id: runtime.session.user.id,
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || '',
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return true;
  }

  async function pushIsActive() {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager?.getSubscription?.());
  }

  async function refreshSettings() {
    const copy = document.querySelector('#cloudStatusCopy');
    const button = document.querySelector('#cloudAccountBtn');
    const panel = document.querySelector('#cloudAuthPanel');
    const pushCopy = document.querySelector('#pushStatusCopy');
    const pushButton = document.querySelector('#pushServerBtn');
    if (!copy || !button || !panel) return;
    if (!configured()) {
      copy.textContent = 'A estrutura segura está pronta; falta finalizar o projeto do servidor.';
      button.textContent = 'Pendente';
      button.disabled = true;
      if (pushCopy) pushCopy.textContent = 'Aguardando a ativação do servidor.';
      if (pushButton) pushButton.disabled = true;
      return;
    }
    button.disabled = false;
    if (runtime.error) copy.textContent = runtime.error;
    else if (runtime.session) copy.textContent = `Sincronizado como ${runtime.session.user.email || 'conta conectada'}.`;
    else copy.textContent = 'Entre por email para usar os mesmos dados em todos os aparelhos.';
    button.textContent = runtime.session ? (runtime.syncing ? 'Sincronizando…' : 'Sincronizar') : 'Conectar';
    if (runtime.session) panel.hidden = true;
    if (pushCopy && pushButton) {
      const active = await pushIsActive();
      pushCopy.textContent = active ? 'Alertas do servidor ativos neste aparelho.' : 'Ative para receber alertas mesmo com o PWA fechado.';
      pushButton.textContent = active ? 'Ativo' : 'Ativar';
      pushButton.disabled = active;
    }
  }

  function bindSettings() {
    const accountButton = document.querySelector('#cloudAccountBtn');
    const panel = document.querySelector('#cloudAuthPanel');
    const email = document.querySelector('#cloudEmail');
    const send = document.querySelector('#cloudSendLinkBtn');
    const note = document.querySelector('#cloudAuthNote');
    const pushButton = document.querySelector('#pushServerBtn');
    if (!accountButton || !panel || !email || !send || !note || !pushButton) return;
    email.value = localStorage.getItem(EMAIL_KEY) || '';
    accountButton.onclick = async () => {
      if (runtime.session) {
        await uploadState(api()?.getState?.(), { force: true });
        note.textContent = 'Tudo sincronizado agora.';
      } else {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) email.focus();
      }
    };
    send.onclick = async () => {
      send.disabled = true;
      note.textContent = 'Enviando…';
      try {
        await sendLink(email.value);
        note.textContent = 'Link enviado. Abra o email neste aparelho e toque em “Sign in”.';
      } catch (error) {
        note.textContent = error.message || 'Não foi possível enviar o link.';
      } finally { send.disabled = false; }
    };
    pushButton.onclick = async () => {
      pushButton.disabled = true;
      try {
        await enablePush();
        pushButton.textContent = 'Ativo';
        document.querySelector('#pushStatusCopy').textContent = 'Alertas do servidor ativos neste aparelho.';
      } catch (error) {
        pushButton.disabled = false;
        document.querySelector('#pushStatusCopy').textContent = error.message || 'Não foi possível ativar o push.';
      }
    };
    refreshSettings();
  }

  async function boot() {
    runtime.lastHash = hashState(api()?.getState?.());
    window.addEventListener('objetivos:state-saved', (event) => scheduleUpload(event.detail?.state));
    window.addEventListener('online', () => runtime.session && uploadState(api()?.getState?.()));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && runtime.session) initialSync();
    });
    if (!configured()) {
      setRuntimeStatus({ error: '' });
      return;
    }
    runtime.client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    runtime.client.auth.onAuthStateChange((_event, session) => {
      runtime.session = session;
      if (session) setTimeout(initialSync, 0);
      else {
        runtime.channel = null;
        setTopStatus('salvo neste aparelho');
        refreshSettings();
      }
    });
    const { data } = await runtime.client.auth.getSession();
    runtime.session = data.session;
    if (runtime.session) await initialSync();
    else refreshSettings();
  }

  window.OBJETIVOS_CLOUD = {
    bindSettings,
    uploadNow: () => uploadState(api()?.getState?.(), { force: true })
  };
  boot().catch((error) => setRuntimeStatus({ error: error.message || 'Falha ao iniciar sincronização.' }));
})();
