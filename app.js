(() => {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const apiBase = isLocal
    ? 'http://localhost:3000/v1'
    : 'https://ia-ti-corp-fzsbackend.vercel.app/v1';
  const sessionKey = 'emprestai-session';
  const loginPanel = document.getElementById('login-panel');
  const appPanel = document.getElementById('app-panel');
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');
  const appMessage = document.getElementById('app-message');
  const equipmentList = document.getElementById('equipment-list');
  const loanList = document.getElementById('loan-list');
  const refreshButton = document.getElementById('reload-button');
  const logoutButton = document.getElementById('logout-button');
  const moreEquipmentButton = document.getElementById('more-equipment');
  const moreLoansButton = document.getElementById('more-loans');
  let session = readSession();
  let refreshPromise;
  let equipmentCursor = null;
  let loanCursor = null;

  function readSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey));
      return saved && typeof saved.access_token === 'string' &&
        typeof saved.refresh_token === 'string' ? saved : null;
    } catch {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
  }

  function saveSession(nextSession) {
    session = nextSession;
    sessionStorage.setItem(sessionKey, JSON.stringify(nextSession));
  }

  function clearSession() {
    session = null;
    sessionStorage.removeItem(sessionKey);
    appPanel.hidden = true;
    loginPanel.hidden = false;
  }

  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('Sua sessão expirou. Entre novamente.');
    if (!refreshPromise) {
      refreshPromise = fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }).then(async (response) => {
        const body = await readBody(response);
        if (!response.ok) throw new Error(body.detail || 'Não foi possível renovar a sessão.');
        saveSession(body);
      }).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function readBody(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function api(path, options = {}, canRefresh = true) {
    const headers = new Headers(options.headers || {});
    if (session?.access_token) headers.set('authorization', `Bearer ${session.access_token}`);
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    if (response.status === 401 && canRefresh && session?.refresh_token) {
      try {
        await refreshSession();
        return api(path, options, false);
      } catch {
        clearSession();
        throw new Error('Sua sessão expirou. Entre novamente.');
      }
    }
    const body = await readBody(response);
    if (!response.ok) throw new Error(body.detail || `Falha na API (${response.status}).`);
    return body;
  }

  function setMessage(element, message = '') {
    element.textContent = message;
  }

  function createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderEquipment(equipment) {
    const card = document.createElement('article');
    card.className = 'equipment-card';
    const image = document.createElement('img');
    image.className = 'equipment-image';
    image.alt = `Imagem de ${equipment.name}`;
    image.referrerPolicy = 'no-referrer';
    image.hidden = !equipment.imageUrl;
    if (equipment.imageUrl) image.src = equipment.imageUrl;
    card.append(image);

    const content = document.createElement('div');
    content.className = 'card-content';
    content.append(createText('h3', '', equipment.name));
    const details = [equipment.category, equipment.patrimony, equipment.status]
      .filter(Boolean).join(' · ');
    content.append(createText('p', '', details));
    const borrowButton = createText('button', 'button primary', 'Solicitar empréstimo');
    borrowButton.type = 'button';
    borrowButton.disabled = equipment.status !== 'disponivel';
    borrowButton.addEventListener('click', async () => {
      borrowButton.disabled = true;
      setMessage(appMessage);
      try {
        await api(`/emprestimos/solicitar/${encodeURIComponent(equipment.id)}`, { method: 'POST' });
        await loadData(true);
        setMessage(appMessage, 'Empréstimo solicitado.');
      } catch (error) {
        setMessage(appMessage, error.message);
        borrowButton.disabled = equipment.status !== 'disponivel';
      }
    });
    content.append(borrowButton);
    card.append(content);
    equipmentList.append(card);
  }

  function renderLoan(loan) {
    const card = document.createElement('article');
    card.className = 'loan-card';
    const info = document.createElement('div');
    info.append(createText('h3', '', loan.equipmentName));
    const dueDate = new Date(loan.dueAt);
    const returned = Boolean(loan.returnedAt);
    const overdue = !returned && dueDate.getTime() < Date.now();
    const status = returned ? 'Devolvido' : overdue ? 'Atrasado' : 'Em aberto';
    const dueText = `Devolução prevista: ${dueDate.toLocaleDateString('pt-BR')} · ${status}`;
    info.append(createText('p', overdue ? 'loan-overdue' : '', dueText));
    card.append(info);
    if (!returned) {
      const returnButton = createText('button', 'button secondary', 'Registrar devolução');
      returnButton.type = 'button';
      returnButton.addEventListener('click', async () => {
        returnButton.disabled = true;
        try {
          await api(`/emprestimos/${encodeURIComponent(loan.id)}/devolver`, { method: 'POST' });
          await loadData(true);
          setMessage(appMessage, 'Devolução registrada.');
        } catch (error) {
          setMessage(appMessage, error.message);
          returnButton.disabled = false;
        }
      });
      card.append(returnButton);
    }
    loanList.append(card);
  }

  async function loadEquipment(reset) {
    if (reset) {
      equipmentCursor = null;
      equipmentList.replaceChildren();
    }
    const query = equipmentCursor ? `?cursor=${encodeURIComponent(equipmentCursor)}` : '';
    const result = await api(`/equipamentos${query}`);
    result.equipments.forEach(renderEquipment);
    equipmentCursor = result.nextCursor;
    moreEquipmentButton.hidden = !result.hasMore;
  }

  async function loadLoans(reset) {
    if (reset) {
      loanCursor = null;
      loanList.replaceChildren();
    }
    const query = loanCursor ? `?cursor=${encodeURIComponent(loanCursor)}` : '';
    const result = await api(`/emprestimos/meus${query}`);
    result.emprestimos.forEach(renderLoan);
    loanCursor = result.nextCursor;
    moreLoansButton.hidden = !result.hasMore;
    document.getElementById('open-count').textContent = `(${result.totalAbertos} em aberto)`;
  }

  async function loadData(reset = false) {
    setMessage(appMessage);
    try {
      await Promise.all([loadEquipment(reset), loadLoans(reset)]);
    } catch (error) {
      setMessage(appMessage, error.message);
    }
  }

  function showApp() {
    loginPanel.hidden = true;
    appPanel.hidden = false;
    loadData(true);
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(loginMessage);
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const form = new FormData(loginForm);
    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const body = await readBody(response);
      if (!response.ok) throw new Error(body.detail || 'Não foi possível entrar.');
      if (typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string') {
        throw new Error('A API retornou uma sessão inválida.');
      }
      saveSession(body);
      showApp();
    } catch (error) {
      setMessage(loginMessage, error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      await api('/auth/logout', { method: 'POST' }, false);
    } catch {
      setMessage(loginMessage, 'Sessão encerrada neste dispositivo.');
    } finally {
      clearSession();
      logoutButton.disabled = false;
    }
  });

  refreshButton.addEventListener('click', () => loadData(true));
  moreEquipmentButton.addEventListener('click', () => loadEquipment(false));
  moreLoansButton.addEventListener('click', () => loadLoans(false));

  if (session) showApp();
})();
