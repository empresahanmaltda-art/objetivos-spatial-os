(() => {
  'use strict';

  const DIRTY_KEY = 'objetivos-cloud-dirty-v1';
  const CONFIG = window.OBJETIVOS_CLOUD_CONFIG || {};
  window.OBJETIVOS_PUSH_ACTIVE = null;
  const runtime = {
    client: null,
    session: null,
    channel: null,
    uploadTimer: null,
    applying: false,
    lastHash: '',
    syncing: false,
    initialSyncPromise: null,
    error: '',
    pushActive: null
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

  function setAuthGate({ unlocked = false, busy = false, message = '' } = {}) {
    const body = document.body;
    const gate = document.querySelector('#authGate');
    const shell = document.querySelector('#appShell');
    const button = document.querySelector('#authGoogleBtn');
    const label = button?.querySelector?.('.google-button-label');
    const status = document.querySelector('#authGateStatus');
    body?.classList?.toggle('auth-locked', !unlocked);
    body?.classList?.toggle('auth-ready', unlocked);
    gate?.setAttribute?.('aria-hidden', unlocked ? 'true' : 'false');
    if (shell) {
      shell.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
      if (unlocked) shell.removeAttribute('inert');
      else shell.setAttribute('inert', '');
    }
    if (button) {
      button.disabled = busy || !configured();
      button.classList.toggle('is-loading', busy);
    }
    if (label) label.textContent = busy ? 'Conectando…' : 'Continuar com Google';
    if (status) status.textContent = message || (unlocked ? 'Tudo sincronizado.' : 'Entre para abrir seu espaço.');
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

  async function signInWithGoogle() {
    if (!runtime.client) throw new Error('Servidor ainda não configurado.');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await runtime.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } }
    });
    if (error) throw error;
    return data;
  }

  async function beginGoogleLogin(sourceButton) {
    setAuthGate({ busy: true, message: 'Abrindo o acesso seguro do Google…' });
    if (sourceButton) sourceButton.disabled = true;
    try {
      const data = await signInWithGoogle();
      setAuthGate({ message: 'Conclua o acesso na tela do Google.' });
      return data;
    } catch (error) {
      const message = error.message || 'Não foi possível entrar com o Google.';
      setRuntimeStatus({ error: message });
      setAuthGate({ message });
      if (sourceButton) sourceButton.disabled = false;
      throw error;
    }
  }

  function bindAuthGate() {
    const button = document.querySelector('#authGoogleBtn');
    if (!button) return;
    button.onclick = () => beginGoogleLogin(button).catch(() => {});
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
    setPushState(true);
    return true;
  }

  function setPushState(active) {
    runtime.pushActive = Boolean(active);
    window.OBJETIVOS_PUSH_ACTIVE = runtime.pushActive;
    if (typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('objetivos:push-status', { detail: { active: runtime.pushActive } }));
    }
    return runtime.pushActive;
  }

  async function pushIsActive() {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager?.getSubscription?.());
  }

  async function refreshPushState() {
    try { return setPushState(await pushIsActive()); }
    catch { return setPushState(false); }
  }

  async function refreshSettings() {
    const copy = document.querySelector('#cloudStatusCopy');
    const button = document.querySelector('#cloudAccountBtn');
    const pushCopy = document.querySelector('#pushStatusCopy');
    const pushButton = document.querySelector('#pushServerBtn');
    if (!configured()) {
      if (copy) copy.textContent = 'A estrutura segura está pronta; falta finalizar o projeto do servidor.';
      if (button) {
        button.textContent = 'Pendente';
        button.disabled = true;
      }
      if (pushCopy) pushCopy.textContent = 'Aguardando a ativação do servidor.';
      if (pushButton) pushButton.disabled = true;
      return;
    }
    if (copy && button) {
      button.disabled = false;
      if (runtime.error) copy.textContent = runtime.error;
      else if (runtime.session) copy.textContent = `Sincronizado como ${runtime.session.user.email || 'conta Google conectada'}.`;
      else copy.textContent = 'Entre com a mesma conta Google no celular e no computador.';
      if (runtime.session) {
        button.className = 'soft-button';
        button.textContent = runtime.syncing ? 'Sincronizando…' : 'Sincronizar';
        button.setAttribute('aria-label', button.textContent);
      } else {
        button.className = 'google-signin-button';
        button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-4V7.4H3.2a10 10 0 0 0 0 9.2L6.5 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.4L6.5 10A5.8 5.8 0 0 1 12 6Z"/></svg><span>Continuar com Google</span>';
        button.setAttribute('aria-label', 'Continuar com Google');
      }
    }
    if (pushCopy && pushButton) {
      const active = await refreshPushState();
      pushCopy.textContent = active ? 'Alertas únicos: 30 minutos antes e exatamente no horário.' : 'Ative para receber os dois alertas mesmo com o PWA fechado.';
      pushButton.textContent = active ? 'Ativo' : 'Ativar';
      pushButton.disabled = active;
    }
  }

  function bindSettings() {
    const accountButton = document.querySelector('#cloudAccountBtn');
    const pushButton = document.querySelector('#pushServerBtn');
    if (accountButton) {
      accountButton.onclick = async () => {
        if (runtime.session) {
          await uploadState(api()?.getState?.(), { force: true });
        } else {
          accountButton.disabled = true;
          try {
            await beginGoogleLogin(accountButton);
          } catch (error) {
            accountButton.disabled = false;
            setRuntimeStatus({ error: error.message || 'Não foi possível entrar com o Google.' });
          }
        }
      };
    }
    if (pushButton) {
      pushButton.onclick = async () => {
        pushButton.disabled = true;
        const pushCopy = document.querySelector('#pushStatusCopy');
        try {
          await enablePush();
          pushButton.textContent = 'Ativo';
          if (pushCopy) pushCopy.textContent = 'Alertas únicos: 30 minutos antes e exatamente no horário.';
        } catch (error) {
          pushButton.disabled = false;
          if (pushCopy) pushCopy.textContent = error.message || 'Não foi possível ativar o push.';
        }
      };
    }
    refreshSettings();
  }

  async function boot() {
    bindAuthGate();
    setAuthGate({ busy: true, message: 'Verificando sua sessão segura…' });
    runtime.lastHash = hashState(api()?.getState?.());
    window.addEventListener('objetivos:state-saved', (event) => scheduleUpload(event.detail?.state));
    window.addEventListener('online', () => runtime.session && uploadState(api()?.getState?.()));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && runtime.session) initialSync();
    });
    if (!configured()) {
      setPushState(false);
      setRuntimeStatus({ error: '' });
      setAuthGate({ message: 'Servidor de acesso indisponível. Tente novamente em instantes.' });
      return;
    }
    runtime.client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    await refreshPushState();
    runtime.client.auth.onAuthStateChange((_event, session) => {
      const wasSignedIn = Boolean(runtime.session);
      runtime.session = session;
      if (session) {
        if (!wasSignedIn) setAuthGate({ busy: true, message: 'Preparando seu espaço…' });
        setTimeout(async () => {
          await initialSync();
          setAuthGate({ unlocked: true, message: 'Tudo sincronizado.' });
        }, 0);
      }
      else {
        runtime.channel = null;
        setTopStatus('salvo neste aparelho');
        refreshSettings();
        setAuthGate({ message: 'Entre com sua conta Google para continuar.' });
      }
    });
    const { data } = await runtime.client.auth.getSession();
    runtime.session = data.session;
    if (runtime.session) {
      setAuthGate({ busy: true, message: 'Sincronizando suas tarefas e metas…' });
      await initialSync();
      setAuthGate({ unlocked: true, message: 'Tudo sincronizado.' });
    } else {
      refreshSettings();
      setAuthGate({ message: 'Entre com sua conta Google para continuar.' });
    }
  }

  window.OBJETIVOS_CLOUD = {
    bindSettings,
    signInWithGoogle,
    uploadNow: () => uploadState(api()?.getState?.(), { force: true })
  };
  boot().catch((error) => {
    const message = error.message || 'Falha ao iniciar sincronização.';
    setRuntimeStatus({ error: message });
    setAuthGate({ message });
  });
})();
