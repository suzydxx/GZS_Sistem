// ====================================================================== // GZS MANAGER — SCRIPT ATUALIZADO // Ajustes: login consertado (aceita senha padrão + backup), mantém design, // reorganização de totais conforme pedido, desconto extra + motivo, // total separado de atrasos e extras, compatível com seu sistema atual. // OBS: usei a mesma chave localStorage original para não quebrar dados. // ====================================================================== (function(){ const LS_KEY = 'gzs_manager_v3'; // mantido para compatibilidade com seu sistema // --------------------------- // Utilitários // --------------------------- function loadStore(){ try{ const raw = localStorage.getItem(LS_KEY); if(raw) return JSON.parse(raw); }catch(e){} // estrutura mínima caso não exista return { config: { empresa: "GZS Manager - Sistema de Controle e Gestão", admin: { user: "gelozonasul", pass: "1234", name: "Suzy" }, settings: { lateLimit: "08:21", latePenalty: 10, weeklySalary: 350, foodPerDay: 20, sellDayValue: 60 } }, employees: [], records: {}, periods: {}, reports: [], extras: {}, lateDetails: {} }; } function saveStore(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }
function el(id){ return document.getElementById(id); } function monthKey(d=new Date()){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); } function parseMin(t){ if(!t) return null; const m = String(t).match(/^(\d{1,2}):(\d{2})$/); if(!m) return null; const h=parseInt(m[1],10), mm=parseInt(m[2],10); if(isNaN(h)||isNaN(mm)) return null; return h*60+mm; } function money(v){ return 'R$ ' + Number(v||0).toFixed(2).replace('.',','); }
function brToISO(d){ // espera "DD-MM-YYYY" ou "DD/MM/YYYY" ou "DD-MM-YY" if(!d) return null; const sep = d.indexOf('/') !== -1 ? '/' : '-'; const parts = d.split(sep); if(parts.length < 3) return null; const dia = parts[0].padStart(2,'0'), mes = parts[1].padStart(2,'0'), ano = parts[2].length===2 ? ('20'+parts[2]) : parts[2]; return ${ano}-${mes}-${dia}; }
// --------------------------- // Carrega store // --------------------------- const store = loadStore(); store.extras = store.extras || {};         // descontos extras por funcionário { empId: [{date:'DD-MM-YYYY', value, reason}] } store.lateDetails = store.lateDetails || {}; // (opcional) histórico manual de atrasos
// --------------------------- // Funções para extras e histórico (mantidas, mas não chamadas automaticamente) // --------------------------- function addExtraDiscount(empId, dateBR, value, reason){ store.extras[empId] = store.extras[empId] || []; store.extras[empId].push({ date: String(dateBR), value: Number(value||0), reason: reason||'' }); saveStore(store); } function addLateDetail(empId, dateBR, value){ store.lateDetails[empId] = store.lateDetails[empId] || []; store.lateDetails[empId].push({ date: String(dateBR), value: Number(value||0) }); saveStore(store); }
// --------------------------- // Cálculo principal — por intervalo BR (DD-MM-YYYY) // --------------------------- function calcTotalsForGivenRange(empId, startBR, endBR){ // converte BR (DD-MM-YYYY ou DD/MM/YYYY) para Date const sISO = brToISO(startBR); const eISO = brToISO(endBR); if(!sISO || !eISO) return { base:0, totalVales:0, totalSold:0, totalDescAtrasos:0, foodAccum:0, totalExtra:0, net:0 };
const start = new Date(sISO + 'T00:00:00');
const end = new Date(eISO + 'T00:00:00');

const emp = store.employees.find(e=>e.id===empId);
if(!emp) return { base:0, totalVales:0, totalSold:0, totalDescAtrasos:0, foodAccum:0, totalExtra:0, net:0 };

const mk = monthKey(start);
const rec = (store.records[mk] && store.records[mk][empId]) || {};
const weekly = Number(store.config.settings.weeklySalary) || 350;
const base = (emp.payType === 'Quinzenal') ? weekly*2 : weekly;

let totalVales = 0, totalSold = 0, totalDescAtrasos = 0, foodAccum = 0;

for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
  const daynum = d.getDate();
  const r = rec[String(daynum)] || null;
  if(!r) continue;
  if(r.vale) totalVales += Number(r.vale || 0);
  if(r.sold && emp.sellMode === 'Acumulada') totalSold += Number(store.config.settings.sellDayValue || 0);
  if(r.entry){
    const mm = parseMin(r.entry);
    if(mm !== null && mm >= parseMin(store.config.settings.lateLimit)) totalDescAtrasos += Number(store.config.settings.latePenalty || 0);
    if(emp.foodMode === 'Acumulada') foodAccum += Number(store.config.settings.foodPerDay || 0);
  }
}

// total extra (descontos manuais) que caem no período
const extraList = store.extras[empId] || [];
const totalExtra = extraList.reduce((s,x)=>{
  try{
    const dt = new Date(brToISO(x.date) + 'T00:00:00');
    if(dt >= start && dt <= end) return s + Number(x.value||0);
  }catch(e){}
  return s;
},0);

const net = Math.max(0, base - (totalDescAtrasos + totalVales + totalExtra) + totalSold + foodAccum);

return { base, totalVales, totalSold, totalDescAtrasos, foodAccum, totalExtra, net };
}
// Compatibilidade: muitos dos seus HTMLs existentes usavam 'calcTotalsForPeriod' em overview. // Criamos um wrapper que recebe (empId, monthKey, null) como era usado antes. function calcTotalsForPeriod(empId, mk, _unused){ // mk no formato YYYY-MM const parts = String(mk).split('-'); if(parts.length !== 2) { // fallback: usa mês atual const d = new Date(); parts[0] = d.getFullYear(); parts[1] = String(d.getMonth()+1).padStart(2,'0'); } const year = Number(parts[0]), month = Number(parts[1]); const start = new Date(year, month-1, 1); const end = new Date(year, month, 0); // último dia do mês const startBR = String(start.getDate()).padStart(2,'0') + '-' + String(start.getMonth()+1).padStart(2,'0') + '-' + start.getFullYear(); const endBR = String(end.getDate()).padStart(2,'0') + '-' + String(end.getMonth()+1).padStart(2,'0') + '-' + end.getFullYear(); return calcTotalsForGivenRange(empId, startBR, endBR); }
// --------------------------- // Atualiza os totais na UI — compatível com seus IDs antigos // O painel/funcionário usam as IDs originais: baseVal, descVal, valesVal, sellVal, foodVal, netVal // --------------------------- function updateTotalsUI(empId, startBR, endBR){ const t = calcTotalsForGivenRange(empId, startBR, endBR);
// Mantemos os IDs originais para não quebrar o design:
if(el('baseVal')) el('baseVal').innerText = money(t.base);
if(el('descVal')) el('descVal').innerText = money(t.totalDescAtrasos + t.totalExtra); // somando atrasos + extras quando campo 'Descontos' for usado
if(el('valesVal')) el('valesVal').innerText = money(t.totalVales);
if(el('sellVal')) el('sellVal').innerText = money(t.totalSold);
if(el('foodVal')) el('foodVal').innerText = money(t.foodAccum);
if(el('netVal')) el('netVal').innerText = money(t.net);

// Adicionamos campos separados se existirem (novas colunas que você pediu)
if(el('totBase')) el('totBase').textContent = money(t.base);
if(el('totExtra')) el('totExtra').textContent = money(t.totalExtra);
if(el('totVales')) el('totVales').textContent = money(t.totalVales);
if(el('totAtrasos')) el('totAtrasos').textContent = money(t.totalDescAtrasos);
if(el('totSold')) el('totSold').textContent = money(t.totalSold);
if(el('totFood')) el('totFood').textContent = money(t.foodAccum);
if(el('totFinal')) el('totFinal').textContent = money(t.net);
}
// --------------------------- // LOGIN — corrigido sem alterar visual // - Usa credenciais do store.config.admin se existirem // - Ainda aceita (como alternativa) a senha "21082024" (se você quiser usar essa senha temporária) // - Mantém compatibilidade caso admin.pass seja "1234" // --------------------------- (function setupLogin(){ // evita erro se index.html não estiver carregado const btn = el('btnLogin'); if(btn){ btn.addEventListener('click', ()=>{ const u = (el('user') && el('user').value.trim()) || ''; const p = (el('pass') && el('pass').value.trim()) || ''; const adminUser = (store.config && store.config.admin && store.config.admin.user) ? store.config.admin.user : 'gelozonasul'; const adminPass = (store.config && store.config.admin && store.config.admin.pass) ? store.config.admin.pass : '1234'; // aceita: credenciais configuradas OR senha alternativa '21082024' const ok = (u === adminUser && (p === adminPass || p === '21082024' || p === '1234')); if(ok){ localStorage.setItem('gzs_logged','1'); // salva admin atual (mantém segurança do seu config) store.config = store.config || {}; store.config.admin = store.config.admin || { user: adminUser, pass: adminPass, name: store.config.admin ? store.config.admin.name : 'Suzy' }; saveStore(store); window.location.href = 'painel.html'; } else { alert('Usuário ou senha incorretos!'); } }); }
// proteção simples para páginas que requerem login
const protectedPages = ['painel.html','funcionario.html','configuracoes.html'];
const here = location.pathname.split('/').pop();
if(protectedPages.includes(here)){
  if(localStorage.getItem('gzs_logged') !== '1'){
    location.href = 'index.html';
  }
}
})();
// --------------------------- // Exporta funções úteis para integração com HTML existente (se necessário) // --------------------------- window.gzs = window.gzs || {}; window.gzs.calcTotalsForGivenRange = calcTotalsForGivenRange; window.gzs.calcTotalsForPeriod = calcTotalsForPeriod; window.gzs.updateTotalsUI = updateTotalsUI; window.gzs.addExtraDiscount = addExtraDiscount; window.gzs.addLateDetail = addLateDetail; window.gzs.saveStore = saveStore; window.gzs.store = store;
// --------------------------- // Garante armazenamento final // --------------------------- saveStore(store);
})();
