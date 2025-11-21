// ======================================================================
// GZS MANAGER — SCRIPT FINAL COMPLETO
// Login corrigido • Totais reorganizados • Desconto Extra + Motivo
// Total de Descontos de Atrasos separado • Mantendo TODO o designer
// ======================================================================

// ---------------------------
// 1. Funções Utilitárias
// ---------------------------
function saveStore(data) {
  localStorage.setItem("gzs_manager", JSON.stringify(data));
}

function parseMin(h) {
  if (!h) return null;
  const [h2, m] = h.split(":");
  return Number(h2) * 60 + Number(m);
}

function money(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------
// 2. Carregar Base de Dados
// ---------------------------
let store = JSON.parse(localStorage.getItem("gzs_manager") || "{}");

store.employees = store.employees || [];
store.records = store.records || {};
store.periods = store.periods || {};
store.reports = store.reports || [];
store.extras = store.extras || {};         // ← Desconto Extra (NOVO)
store.lateDetails = store.lateDetails || {}; // ← Relatório de atrasos (NOVO)

store.config = store.config || { empresa: "", settings: {} };
store.config.settings = store.config.settings || {};


// ---------------------------
// 3. Nova função: Registrar Desconto Extra
// ---------------------------
function addExtraDiscount(empId, dateBR, value, reason) {
  const iso = brToISO(dateBR);
  store.extras[empId] = store.extras[empId] || [];

  store.extras[empId].push({
    date: dateBR,
    iso,
    value: Number(value),
    reason
  });

  saveStore(store);
  alert("Desconto extra registrado!");
}


// ---------------------------
// 4. Registrar detalhe de atraso
// ---------------------------
function addLateDetail(empId, dateBR, value) {
  store.lateDetails[empId] = store.lateDetails[empId] || [];

  store.lateDetails[empId].push({
    date: dateBR,
    value: Number(value)
  });

  saveStore(store);
}


// ---------------------------
// 5. Convert BR date → ISO
// ---------------------------
function brToISO(d) {
  const [dia, mes, ano] = d.split("-");
  return `${ano}-${mes}-${dia}`;
}


// ---------------------------
// 6. Cálculos de Totais
// ---------------------------
function calcTotalsForGivenRange(empId, startBR, endBR) {

  const start = new Date(brToISO(startBR) + "T00:00:00");
  const end = new Date(brToISO(endBR) + "T00:00:00");

  const emp = store.employees.find(e => e.id === empId);
  const mk = monthKey(start);
  const rec = (store.records[mk] && store.records[mk][empId]) || {};

  const weekly = Number(store.config.settings.weeklySalary) || 350;
  const base = (emp.payType === "Quinzenal") ? weekly * 2 : weekly;

  let totalVales = 0;
  let totalSold = 0;
  let totalDescAtrasos = 0;
  let foodAccum = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

    const daynum = d.getDate();
    const r = rec[String(daynum)] || null;
    if (!r) continue;

    if (r.vale) totalVales += Number(r.vale);

    if (r.sold && emp.sellMode === "Acumulada") {
      totalSold += Number(store.config.settings.sellDayValue || 0);
    }

    if (r.entry) {
      const mm = parseMin(r.entry);

      if (mm >= parseMin(store.config.settings.lateLimit)) {
        totalDescAtrasos += Number(store.config.settings.latePenalty || 0);

        addLateDetail(empId, `${String(daynum).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`, store.config.settings.latePenalty);
      }

      if (emp.foodMode === "Acumulada") {
        foodAccum += Number(store.config.settings.foodPerDay || 0);
      }
    }
  }

  const extraList = store.extras[empId] || [];
  const totalExtra = extraList
    .filter(x => {
      const dt = new Date(brToISO(x.date) + "T00:00:00");
      return dt >= start && dt <= end;
    })
    .reduce((s, x) => s + x.value, 0);

  const net = Math.max(0, base - (totalDescAtrasos + totalVales + totalExtra) + totalSold + foodAccum);

  return {
    base,
    totalVales,
    totalSold,
    totalDescAtrasos,
    foodAccum,
    totalExtra,
    net
  };
}


// ---------------------------
// 7. Reorganizar Totais no Painel
// ---------------------------
function updateTotalsUI(empId, startBR, endBR) {

  const t = calcTotalsForGivenRange(empId, startBR, endBR);

  document.getElementById("totBase").textContent = money(t.base);
  document.getElementById("totExtra").textContent = money(t.totalExtra);
  document.getElementById("totVales").textContent = money(t.totalVales);
  document.getElementById("totAtrasos").textContent = money(t.totalDescAtrasos);
  document.getElementById("totSold").textContent = money(t.totalSold);
  document.getElementById("totFood").textContent = money(t.foodAccum);
  document.getElementById("totFinal").textContent = money(t.net);
}


// ---------------------------
// 8. LOGIN — 100% corrigido
// ---------------------------
document.getElementById("btnLogin")?.addEventListener("click", () => {
  const u = document.getElementById("user")?.value.trim();
  const p = document.getElementById("pass")?.value.trim();

  if (u === "gelozonasul" && p === "21082024") {
    localStorage.setItem("gzs_logged", "1");
    window.location.href = "painel.html";
  } else {
    alert("Usuário ou senha incorretos!");
  }
});

(function () {
  const protectedPages = ["painel.html", "funcionario.html"];
  const here = location.pathname.split("/").pop();

  if (protectedPages.includes(here)) {
    if (localStorage.getItem("gzs_logged") !== "1") {
      location.href = "index.html";
    }
  }
})();


// ---------------------------
// 9. Fim do Script Final
// ---------------------------
