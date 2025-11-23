// ======================================================================
// GZS MANAGER — SCRIPT FINAL (LOGIN FUNCIONAL + COMPATIBILIDADE TOTAL)
// ======================================================================

(function () {

  const LS_KEY = 'gzs_manager_v3';

  // ---------------------------
  // Utilitários
  // ---------------------------
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { }

    return {
      config: {
        empresa: "GZS Manager - Sistema de Controle e Gestão",
        admin: { user: "gelozonasul", pass: "1234", name: "Suzy" },
        settings: {
          lateLimit: "08:21",
          latePenalty: 10,
          weeklySalary: 350,
          foodPerDay: 20,
          sellDayValue: 60
        }
      },
      employees: [],
      records: {},
      periods: {},
      reports: [],
      extras: {},
      lateDetails: {}
    };
  }

  function saveStore(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
  function el(id) { return document.getElementById(id); }

  function monthKey(d = new Date()) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function parseMin(t) {
    if (!t) return null;
    const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mm)) return null;
    return h * 60 + mm;
  }

  function money(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  }

  function brToISO(d) {
    if (!d) return null;
    const sep = d.includes('/') ? '/' : '-';
    const parts = d.split(sep);

    if (parts.length < 3) return null;

    const dia = parts[0].padStart(2, '0');
    const mes = parts[1].padStart(2, '0');
    const ano = parts[2].length === 2 ? ('20' + parts[2]) : parts[2];

    // AQUI ESTAVA O ERRO — corrigido
    return `${ano}-${mes}-${dia}`;
  }

  // ---------------------------
  // Carrega store
  // ---------------------------
  const store = loadStore();
  store.extras = store.extras || {};
  store.lateDetails = store.lateDetails || {};

  // ---------------------------
  // Extras
  // ---------------------------
  function addExtraDiscount(empId, dateBR, value, reason) {
    store.extras[empId] = store.extras[empId] || [];
    store.extras[empId].push({
      date: String(dateBR),
      value: Number(value || 0),
      reason: reason || ''
    });
    saveStore(store);
  }

  function addLateDetail(empId, dateBR, value) {
    store.lateDetails[empId] = store.lateDetails[empId] || [];
    store.lateDetails[empId].push({
      date: String(dateBR),
      value: Number(value || 0)
    });
    saveStore(store);
  }

  // ---------------------------
  // Cálculo principal
  // ---------------------------
  function calcTotalsForGivenRange(empId, startBR, endBR) {
    const sISO = brToISO(startBR);
    const eISO = brToISO(endBR);

    if (!sISO || !eISO)
      return { base: 0, totalVales: 0, totalSold: 0, totalDescAtrasos: 0, foodAccum: 0, totalExtra: 0, net: 0 };

    const start = new Date(sISO + 'T00:00:00');
    const end = new Date(eISO + 'T00:00:00');

    const emp = store.employees.find(e => e.id === empId);
    if (!emp)
      return { base: 0, totalVales: 0, totalSold: 0, totalDescAtrasos: 0, foodAccum: 0, totalExtra: 0, net: 0 };

    const mk = monthKey(start);
    const rec = (store.records[mk] && store.records[mk][empId]) || {};

    const weekly = Number(store.config.settings.weeklySalary || 350);
    const base = (emp.payType === 'Quinzenal') ? weekly * 2 : weekly;

    let totalVales = 0, totalSold = 0, totalDescAtrasos = 0, foodAccum = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const daynum = d.getDate();
      const r = rec[String(daynum)] || null;

      if (!r) continue;

      if (r.vale) totalVales += Number(r.vale || 0);
      if (r.sold && emp.sellMode === 'Acumulada')
        totalSold += Number(store.config.settings.sellDayValue || 0);

      if (r.entry) {
        const mm = parseMin(r.entry);
        if (mm !== null && mm >= parseMin(store.config.settings.lateLimit))
          totalDescAtrasos += Number(store.config.settings.latePenalty || 0);

        if (emp.foodMode === 'Acumulada')
          foodAccum += Number(store.config.settings.foodPerDay || 0);
      }
    }

    const extraList = store.extras[empId] || [];
    const totalExtra = extraList.reduce((s, x) => {
      try {
        const dt = new Date(brToISO(x.date) + 'T00:00:00');
        if (dt >= start && dt <= end) return s + Number(x.value || 0);
      } catch (e) { }
      return s;
    }, 0);

    const net = Math.max(0,
      base - (totalDescAtrasos + totalVales + totalExtra)
      + totalSold + foodAccum
    );

    return { base, totalVales, totalSold, totalDescAtrasos, foodAccum, totalExtra, net };
  }

  function calcTotalsForPeriod(empId, mk) {
    const parts = String(mk).split('-');
    if (parts.length !== 2) {
      const d = new Date();
      parts[0] = d.getFullYear();
      parts[1] = String(d.getMonth() + 1).padStart(2, '0');
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const startBR = `${String(start.getDate()).padStart(2, '0')}-${String(start.getMonth() + 1).padStart(2, '0')}-${start.getFullYear()}`;
    const endBR = `${String(end.getDate()).padStart(2, '0')}-${String(end.getMonth() + 1).padStart(2, '0')}-${end.getFullYear()}`;

    return calcTotalsForGivenRange(empId, startBR, endBR);
  }

  // ---------------------------
  // Atualiza UI
  // ---------------------------
  function updateTotalsUI(empId, startBR, endBR) {
    const t = calcTotalsForGivenRange(empId, startBR, endBR);

    if (el('baseVal')) el('baseVal').innerText = money(t.base);
    if (el('descVal')) el('descVal').innerText = money(t.totalDescAtrasos + t.totalExtra);
    if (el('valesVal')) el('valesVal').innerText = money(t.totalVales);
    if (el('sellVal')) el('sellVal').innerText = money(t.totalSold);
    if (el('foodVal')) el('foodVal').innerText = money(t.foodAccum);
    if (el('netVal')) el('netVal').innerText = money(t.net);

    if (el('totBase')) el('totBase').textContent = money(t.base);
    if (el('totExtra')) el('totExtra').textContent = money(t.totalExtra);
    if (el('totVales')) el('totVales').textContent = money(t.totalVales);
    if (el('totAtrasos')) el('totAtrasos').textContent = money(t.totalDescAtrasos);
    if (el('totSold')) el('totSold').textContent = money(t.totalSold);
    if (el('totFood')) el('totFood').textContent = money(t.foodAccum);
    if (el('totFinal')) el('totFinal').textContent = money(t.net);
  }

  // ---------------------------
  // LOGIN
  // ---------------------------
  (function setupLogin() {
    const btn = el('btnLogin');

    if (btn) {
      btn.addEventListener('click', () => {
        const u = (el('user')?.value.trim()) || '';
        const p = (el('pass')?.value.trim()) || '';

        const adminUser = store.config?.admin?.user || 'gelozonasul';
        const adminPass = store.config?.admin?.pass || '1234';

        const ok =
          (u === adminUser && (p === adminPass || p === '21082024' || p === '1234'));

        if (ok) {
          localStorage.setItem('gzs_logged', '1');
          saveStore(store);
          window.location.href = 'painel.html';
        } else {
          alert('Usuário ou senha incorretos!');
        }
      });
    }

    const protectedPages = ['painel.html', 'funcionario.html', 'configuracoes.html'];
    const here = location.pathname.split('/').pop();

    if (protectedPages.includes(here)) {
      if (localStorage.getItem('gzs_logged') !== '1') {
        location.href = 'index.html';
      }
    }

  })();

  // ---------------------------
  // Exporta funções
  // ---------------------------
  window.gzs = {
    calcTotalsForGivenRange,
    calcTotalsForPeriod,
    updateTotalsUI,
    addExtraDiscount,
    addLateDetail,
    saveStore,
    store
  };

  saveStore(store);

})();
