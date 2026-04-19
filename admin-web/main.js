const els = {
  apiBase: document.getElementById('apiBase'),
  token: document.getElementById('token'),
  loadBtn: document.getElementById('loadBtn'),
  searchQuery: document.getElementById('searchQuery'),
  providerQuery: document.getElementById('providerQuery'),
  ticketStatus: document.getElementById('ticketStatus'),
  refreshSearches: document.getElementById('refreshSearches'),
  refreshSelections: document.getElementById('refreshSelections'),
  refreshTickets: document.getElementById('refreshTickets'),
  searchesTable: document.getElementById('searchesTable'),
  selectionsTable: document.getElementById('selectionsTable'),
  ticketsTable: document.getElementById('ticketsTable'),
};

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${els.token.value.trim()}`,
  };
}

function renderTable(target, columns, rows) {
  const head = columns.map((c) => `<th>${c}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`)
    .join('');
  target.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function getJson(path) {
  const url = `${els.apiBase.value.trim()}${path}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function loadSearches() {
  const q = encodeURIComponent(els.searchQuery.value.trim());
  const json = await getJson(`/admin/searches${q ? `?q=${q}` : ''}`);
  const rows = (json.data || []).map((x) => ({
    createdAt: new Date(x.createdAt).toLocaleString(),
    pickup: x.pickup,
    destination: x.destination,
    rideType: x.rideType,
    distanceKm: x.distanceKm,
    baseFare: x.baseFare,
  }));
  renderTable(els.searchesTable, ['createdAt', 'pickup', 'destination', 'rideType', 'distanceKm', 'baseFare'], rows);
}

async function loadSelections() {
  const provider = encodeURIComponent(els.providerQuery.value.trim());
  const json = await getJson(`/admin/provider-selections${provider ? `?provider=${provider}` : ''}`);
  const rows = (json.data || []).map((x) => ({
    createdAt: new Date(x.createdAt).toLocaleString(),
    provider: x.provider,
    estimatedFare: x.estimatedFare,
    redirectMode: x.redirectMode,
    redirectSucceeded: x.redirectSucceeded,
    failureReason: x.failureReason,
  }));
  renderTable(els.selectionsTable, ['createdAt', 'provider', 'estimatedFare', 'redirectMode', 'redirectSucceeded', 'failureReason'], rows);
}

async function loadTickets() {
  const status = encodeURIComponent(els.ticketStatus.value.trim());
  const json = await getJson(`/admin/support-tickets${status ? `?status=${status}` : ''}`);
  const rows = (json.data || []).map((x) => ({
    createdAt: new Date(x.createdAt).toLocaleString(),
    subject: x.subject,
    category: x.category,
    status: x.status,
    priority: x.priority,
    notes: x.notes,
  }));
  renderTable(els.ticketsTable, ['createdAt', 'subject', 'category', 'status', 'priority', 'notes'], rows);
}

async function loadAll() {
  try {
    await Promise.all([loadSearches(), loadSelections(), loadTickets()]);
  } catch (err) {
    alert(err.message);
  }
}

els.loadBtn.addEventListener('click', loadAll);
els.refreshSearches.addEventListener('click', () => loadSearches().catch((e) => alert(e.message)));
els.refreshSelections.addEventListener('click', () => loadSelections().catch((e) => alert(e.message)));
els.refreshTickets.addEventListener('click', () => loadTickets().catch((e) => alert(e.message)));
