/*
  GZS Manager - script.js
  Compatível com seu sistema original (usa chave localStorage 'gzs_manager_v3')
  Mantém design/IDs, corrige login, adiciona desconto extra + motivo e totais reorganizados.
*/
(function(){
  const LS_KEY = 'gzs_manager_v3';

  // ---- util ----
  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){ console.warn('loadStore error', e); }
    // estrutura padrão mínima (não sobrescreve salvo ao carregar)
    return {
      config: {
        empresa: "GZS Manager - Sistema de Controle e Gestão",
        email: "",
        admin: { user: "gelozonasul", pass: "1234", name: "Suzy" },
        settings: { lateLimit: "08:21", latePenalty: 10, weeklySalary: 350, foodPerDay: 20, sellDayValue: 60 }
      },
      employees: [
        { id:"e1", name:"Suzy", role:"Gestão", active:true, payType:"Quinzenal", foodMode:"Acumulada", sellMode:"Acumulada" },
        { id:"e2", name:"Wander", role:"Entregador", active:true, payType:"Semanal", foodMode:"Diaria", sellMode:"NaHora" }
      ],
      records: {},
      periods: {},
      reports: [],
      extras: {},      // desconto extra por empId
      lateDetails: {}  // histórico de atrasos (opcional)
    };
  }
  function saveStore(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }
  function el(id){ return document.getElementById(id); }
  function monthKey(d=new Date()){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
  function parseMin(t){ if(!t) return null; const m = String(t).match(/^(\d{1,2}):(\d{2})$/); if(!m) return null; const h=parseInt(m[1],10), mm=parseInt(m[2],10); if(isNaN(h)||isNaN(mm)) return null; return h*60+mm; }
  function money(v){ return 'R$ ' + Number(v||0).toFixed(2).replace('.',','); }
  function brToISO(d){ if(!d) return null; const sep = d.indexOf('/') !== -1 ? '/' : '-'; const parts = d.split(sep); if(parts.length < 3) return null; const dia = parts[0].padStart(2,'0'), mes = parts[1].padStart(2,'0'), ano = parts[2].length===2 ? ('20'+parts[2]) : parts[2]; return `${ano}-${mes}-${dia}`; }

  // ---- store (carrega sem sobrescrever se já existe) ----
  const store = loadStore();
  store.extras = store.extras || {};
  store.lateDetails = store.lateDetails || {};
  store.config = store.config || { empresa: "GZS Manager - Sistema de Controle e Gestão", admin:{user:'gelozonasul',pass:'1234',name:'Suzy'}, settings:{ lateLimit:'08:21', latePenalty:10, weeklySalary:350, foodPerDay:20, sellDayValue:60 } };

  // ---- Helpers extras ----
  function addExtraDiscount(empId, dateBR, value, reason){
    store.extras[empId] = store.extras[empId] || [];
    store.extras[empId].push({ date: String(dateBR), value: Number(value||0), reason: reason||'' });
    saveStore(store);
  }
  function addLateDetail(empId, dateBR, value){
    store.lateDetails[empId] = store.lateDetails[empId] || [];
    store.lateDetails[empId].push({ date: String(dateBR), value: Number(value||0) });
    saveStore(store);
  }

  // ---- Calcular totais dado intervalo em BR (DD-MM-YYYY ou DD/MM/YYYY) ----
  function calcTotalsForGivenRange(empId, startBR, endBR){
    const sISO = brToISO(startBR);
    const eISO = brToISO(endBR);
    if(!sISO || !eISO) return { base:0, totalVales:0, totalSold:0, totalDescAtrasos:0, foodAccum:0, totalExtra:0, net:0 };

    const start = new Date(sISO + 'T00:00:00');
    const end = new Date(eISO + 'T00:00:00');

    const emp = store.employees.find(e => e.id === empId);
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
        if(mm !== null && mm >= parseMin(store.config.settings.lateLimit)){
          totalDescAtrasos += Number(store.config.settings.latePenalty || 0);
          // registra histórico (opcional)
          addLateDetail(empId, `${String(daynum).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`, store.config.settings.latePenalty || 0);
        }
        if(emp.foodMode === 'Acumulada') foodAccum += Number(store.config.settings.foodPerDay || 0);
      }
    }

    // soma extras que caem no período
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

  // ---- Compatibilidade antiga: calcTotalsForPeriod(empId, mk, null) ----
  function calcTotalsForPeriod(empId, mk, _unused){
    const parts = String(mk).split('-');
    let year, month;
    if(parts.length === 2){
      year = Number(parts[0]); month = Number(parts[1]);
    } else {
      const d = new Date(); year = d.getFullYear(); month = d.getMonth()+1;
    }
    const start = new Date(year, month-1, 1);
    const end = new Date(year, month, 0);
    const startBR = String(start.getDate()).padStart(2,'0') + '-' + String(start.getMonth()+1).padStart(2,'0') + '-' + start.getFullYear();
    const endBR = String(end.getDate()).padStart(2,'0') + '-' + String(end.getMonth()+1).padStart(2,'0') + '-' + end.getFullYear();
    return calcTotalsForGivenRange(empId, startBR, endBR);
  }

  // ---- Atualiza totais na UI (mantém IDs antigos para não quebrar designer) ----
  function updateTotalsUI(empId, startBR, endBR){
    const t = calcTotalsForGivenRange(empId, startBR, endBR);
    if(el('baseVal')) el('baseVal').innerText = money(t.base);
    if(el('descVal')) el('descVal').innerText = money(t.totalDescAtrasos + t.totalExtra);
    if(el('valesVal')) el('valesVal').innerText = money(t.totalVales);
    if(el('sellVal')) el('sellVal').innerText = money(t.totalSold);
    if(el('foodVal')) el('foodVal').innerText = money(t.foodAccum);
    if(el('netVal')) el('netVal').innerText = money(t.net);

    // novos campos opcionais (se você adicionar no HTML)
    if(el('totBase')) el('totBase').textContent = money(t.base);
    if(el('totExtra')) el('totExtra').textContent = money(t.totalExtra);
    if(el('totVales')) el('totVales').textContent = money(t.totalVales);
    if(el('totAtrasos')) el('totAtrasos').textContent = money(t.totalDescAtrasos);
    if(el('totSold')) el('totSold').textContent = money(t.totalSold);
    if(el('totFood')) el('totFood').textContent = money(t.foodAccum);
    if(el('totFinal')) el('totFinal').textContent = money(t.net);
  }

  // ---- Páginas: index / painel / funcionario / configuracoes ----
  const path = window.location.pathname.split('/').pop() || 'index.html';

  // LOGIN: aceita credenciais do store.config.admin OR senha de fallback (21082024) OR legacy '1234'
  function setupLogin(){
    const btn = el('btnLogin');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      const u = (el('user') && el('user').value.trim()) || '';
      const p = (el('pass') && el('pass').value.trim()) || '';
      const adminUser = (store.config && store.config.admin && store.config.admin.user) ? store.config.admin.user : 'gelozonasul';
      const adminPass = (store.config && store.config.admin && store.config.admin.pass) ? store.config.admin.pass : '1234';
      const ok = (u === adminUser && (p === adminPass || p === '21082024' || p === '1234'));
      if(ok){
        localStorage.setItem('gzs_logged','1');
        // garante persistência das credenciais no store (não altera senão existir)
        store.config = store.config || {};
        store.config.admin = store.config.admin || { user: adminUser, pass: adminPass, name: (store.config.admin && store.config.admin.name) ? store.config.admin.name : 'Suzy' };
        saveStore(store);
        window.location.href = 'painel.html';
      } else {
        alert('Usuário ou senha incorretos!');
      }
    });
  }

  // proteção simples de páginas privadas
  function protectPages(){
    const protectedPages = ['painel.html','funcionario.html','configuracoes.html'];
    if(protectedPages.includes(path)){
      if(localStorage.getItem('gzs_logged') !== '1'){
        location.href = 'index.html';
      }
    }
  }

  // ---- RENDER PAINEL ----
  function renderEmployeeList(){
    const list = el('empList');
    if(!list) return;
    list.innerHTML = '';
    store.employees.forEach(emp=>{
      const d = document.createElement('div'); d.style.padding='8px'; d.style.border='1px solid #f1f7ff'; d.style.borderRadius='6px'; d.style.marginTop='8px';
      d.innerHTML = `<strong>${emp.name}</strong><div class="small">${emp.role||''} ${emp.active? '':'(Inativo)'}</div><div class="small-ghost">${emp.payType}</div><div style="margin-top:8px"><button class="btn openEmp" data-id="${emp.id}">Abrir</button></div>`;
      list.appendChild(d);
    });
    list.querySelectorAll('.openEmp').forEach(b=> b.addEventListener('click', (e)=> { const id=e.target.dataset.id; window.location.href = 'funcionario.html?id=' + id; }));
  }

  function addEmployeePrompt(){
    const name = prompt('Nome do funcionário:'); if(!name) return;
    const id = 'e' + (store.employees.length+1);
    store.employees.push({ id, name, role:'', active:true, payType:'Quinzenal', foodMode:'Acumulada', sellMode:'Acumulada' });
    saveStore(store); renderEmployeeList();
  }

  function renderOverview(){
    const mk = monthKey();
    const div = el('overview'); if(!div) return;
    div.innerHTML = '';
    store.employees.forEach(emp=>{
      const totals = calcTotalsForPeriod(emp.id, mk, null);
      const box = document.createElement('div'); box.style.padding='10px'; box.style.border='1px solid #eef6ff'; box.style.borderRadius='8px'; box.style.marginTop='8px';
      box.innerHTML = `<strong>${emp.name}</strong><div class="small-ghost">${emp.payType}</div><div class="total-box">Total a receber (exemplo atual): ${money(totals.net)}</div>`;
      div.appendChild(box);
    });
  }

  // ---- RENDER FUNCIONÁRIO (ponto + descontos extras) ----
  function renderPointsPage(){
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const emp = store.employees.find(e=>e.id===id);
    if(!emp){ alert('Funcionário não encontrado'); window.location.href='painel.html'; return; }
    if(el('empTitle')) el('empTitle').textContent = emp.name;
    if(el('empSub')) el('empSub').textContent = emp.role + ' — ' + emp.payType;

    const mk = monthKey();
    store.records[mk] = store.records[mk] || {};
    store.records[mk][emp.id] = store.records[mk][emp.id] || {};
    const rec = store.records[mk][emp.id];

    let html = `<h3>${emp.name} — ${emp.payType}</h3><div class="small-note">Mês: ${mk}</div>`;
    html += `<div class="controls">`;
    if(emp.payType === 'Semanal') html += `<button id="btnChoosePeriod" class="btn">Escolher Período Semanal</button>`;
    if(emp.payType === 'Quinzenal') html += `<button id="btnChoosePeriod" class="btn">Escolher Período Quinzenal</button>`;
    html += `<button id="btnGenReport" class="btn secondary">Gerar Relatório (abrir/print)</button>`;
    html += `<button id="btnDiscounts" class="btn">Detalhes Descontos</button>`;
    html += `</div>`;

    // tabela com coluna Desc. Extra e Motivo
    html += `<table class="table"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída Almoço</th><th>Volta Almoço</th><th>Folga</th><th>Vendeu</th><th>Vales (R$)</th><th>Desc. Extra (R$)</th><th>Motivo</th><th>Desconto</th></tr></thead><tbody>`;
    for(let d=1; d<=31; d++){
      const r = rec[String(d)] || {entry:'', lunchOut:'', lunchIn:'', folga:false, sold:false, vale:0};
      // se houver desconto extra salvo globalmente (store.extras), preenche automaticamente buscando por data do mês atual
      let extraValue = 0, extraReason = '';
      const extraList = store.extras[emp.id] || [];
      for(let ex of extraList){
        try{
          const iso = brToISO(ex.date);
          const dt = new Date(iso + 'T00:00:00');
          if(dt.getMonth() === (new Date()).getMonth() && Number(ex.date.slice(0,2))===d){
            extraValue = ex.value; extraReason = ex.reason||'';
            break;
          }
        }catch(e){}
      }

      html += `<tr>
        <td>${d}</td>
        <td><input class="inp-time entry" data-day="${d}" value="${r.entry||''}"></td>
        <td><input class="inp-time lunchOut" data-day="${d}" value="${r.lunchOut||''}"></td>
        <td><input class="inp-time lunchIn" data-day="${d}" value="${r.lunchIn||''}"></td>
        <td style="text-align:center"><input type="checkbox" class="chk-folga" data-day="${d}" ${r.folga? 'checked':''}></td>
        <td style="text-align:center"><input type="checkbox" class="chk-sold" data-day="${d}" ${r.sold? 'checked':''}></td>
        <td><input class="inp-time vale" data-day="${d}" value="${r.vale||0}" type="number" min="0" step="0.01"></td>
        <td><input class="inp-time descExtra" data-day="${d}" value="${extraValue||0}" type="number" min="0" step="0.01"></td>
        <td><input class="inp-text descReason" data-day="${d}" value="${extraReason||''}" type="text" placeholder="motivo (opcional)"></td>
        <td class="td-desc" data-day="${d}">R$ 0,00</td>
      </tr>`;
    }
    html += `</tbody></table>`;

    html += `<div class="card" style="margin-top:12px"><h4>Configuração do funcionário</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label>Forma de pagamento</label>
          <select id="payType" class="input"><option ${emp.payType==='Semanal'?'selected':''}>Semanal</option><option ${emp.payType==='Quinzenal'?'selected':''}>Quinzenal</option></select></div>
        <div><label>Alimentação</label>
          <select id="foodMode" class="input"><option ${emp.foodMode==='Acumulada'?'selected':''}>Acumulada</option><option ${emp.foodMode==='Diaria'?'selected':''}>Diária</option></select></div>
        <div><label>Venda folga</label>
          <select id="sellMode" class="input"><option ${emp.sellMode==='Acumulada'?'selected':''}>Acumulada</option><option ${emp.sellMode==='NaHora'?'selected':''}>NaHora</option></select></div>
        <div><label>Ativo?</label><select id="activeMode" class="input"><option ${emp.active?'selected':''}>Sim</option><option ${!emp.active?'selected':''}>Não</option></select></div>
      </div>
      <div style="margin-top:8px"><table class="table"><thead><tr><th>Base</th><th>Descontos</th><th>Vales</th><th>Vendas Folga</th><th>Alimentação</th><th>Total Líquido</th></tr></thead><tbody><tr><td id="baseVal">R$ 0,00</td><td id="descVal">R$ 0,00</td><td id="valesVal">R$ 0,00</td><td id="sellVal">R$ 0,00</td><td id="foodVal">R$ 0,00</td><td id="netVal">R$ 0,00</td></tr></tbody></table></div>
    </div>`;

    el('pointsCard').innerHTML = html;

    // eventos
    document.querySelectorAll('.inp-time').forEach(i=> i.addEventListener('blur', (e)=> { saveField(emp.id, e.target.dataset.day); }));
    document.querySelectorAll('.chk-folga, .chk-sold').forEach(cb=> cb.addEventListener('change', (e)=> { saveField(emp.id, e.target.dataset.day); }));
    document.querySelectorAll('.vale').forEach(v=> v.addEventListener('change', (e)=> { saveField(emp.id, e.target.dataset.day); }));
    document.querySelectorAll('.descExtra').forEach(v=> v.addEventListener('change', (e)=> { // registra desconto extra globalmente
      const day = e.target.dataset.day;
      const val = Number(e.target.value) || 0;
      const reasonEl = document.querySelector('.descReason[data-day="'+day+'"]');
      const reason = reasonEl ? (reasonEl.value||'') : '';
      // monta dataBR (mês atual)
      const today = new Date();
      const dateBR = String(day).padStart(2,'0') + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + today.getFullYear();
      // salva em store.extras (substitui existente no mesmo dia)
      store.extras[emp.id] = store.extras[emp.id] || [];
      // remove existente para mesma data
      store.extras[emp.id] = store.extras[emp.id].filter(x=> x.date !== dateBR);
      if(val > 0) store.extras[emp.id].push({ date: dateBR, value: val, reason: reason });
      saveStore(store);
      saveField(emp.id, day); // recalcula row
    }));
    document.querySelectorAll('.descReason').forEach(v=> v.addEventListener('blur', (e)=> {
      const day = e.target.dataset.day;
      const valEl = document.querySelector('.descExtra[data-day="'+day+'"]');
      const val = valEl ? Number(valEl.value) || 0 : 0;
      const today = new Date();
      const dateBR = String(day).padStart(2,'0') + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + today.getFullYear();
      store.extras[emp.id] = store.extras[emp.id] || [];
      store.extras[emp.id] = store.extras[emp.id].filter(x=> x.date !== dateBR);
      if(val > 0) store.extras[emp.id].push({ date: dateBR, value: val, reason: e.target.value||'' });
      saveStore(store);
    }));

    if(el('payType')) el('payType').addEventListener('change', ()=> { emp.payType = el('payType').value; saveStore(store); renderPointsPage(); });
    if(el('foodMode')) el('foodMode').addEventListener('change', ()=> { emp.foodMode = el('foodMode').value; saveStore(store); });
    if(el('sellMode')) el('sellMode').addEventListener('change', ()=> { emp.sellMode = el('sellMode').value; saveStore(store); });
    if(el('activeMode')) el('activeMode').addEventListener('change', ()=> { emp.active = (el('activeMode').value === 'Sim'); saveStore(store); });

    if(el('btnChoosePeriod')) el('btnChoosePeriod').addEventListener('click', ()=> openPeriodSelector(emp));
    if(el('btnGenReport')) el('btnGenReport').addEventListener('click', ()=> { const p = store.periods[monthKey()]; const period = p && p[emp.id] ? p[emp.id] : null; if(!period) return alert('Escolha primeiro o período (semana/quinzena) para gerar relatório.'); const totals = calcTotalsForGivenRange(emp.id, period.start, period.end); openReport(emp, period.start, period.end, totals); });
    if(el('btnDiscounts')) el('btnDiscounts').addEventListener('click', ()=> { const p = store.periods[monthKey()]; const period = p && p[emp.id] ? p[emp.id] : null; if(!period) return alert('Escolha primeiro o período (semana/quinzena) para ver detalhes dos descontos.'); openDiscountDetails(emp, period.start, period.end); });

    for(let d=1; d<=31; d++) calcRow(emp.id, d);
    const p = store.periods[monthKey()] || {};
    const per = p[emp.id] || null;
    if(per) updateTotalsUI(emp.id, per.start, per.end);
  }

  // salvar campo por dia
  function saveField(empId, day){
    const mk = monthKey();
    store.records[mk] = store.records[mk] || {};
    store.records[mk][empId] = store.records[mk][empId] || {};
    const elEntry = document.querySelector('.entry[data-day="'+day+'"]');
    const entry = elEntry ? elEntry.value.trim() : '';
    const lunchOutEl = document.querySelector('.lunchOut[data-day="'+day+'"]');
    const lunchOut = lunchOutEl ? lunchOutEl.value.trim() : '';
    const lunchInEl = document.querySelector('.lunchIn[data-day="'+day+'"]');
    const lunchIn = lunchInEl ? lunchInEl.value.trim() : '';
    const folgaEl = document.querySelector('.chk-folga[data-day="'+day+'"]');
    const folga = folgaEl ? folgaEl.checked : false;
    const soldEl = document.querySelector('.chk-sold[data-day="'+day+'"]');
    const sold = soldEl ? soldEl.checked : false;
    const valeEl = document.querySelector('.vale[data-day="'+day+'"]');
    const vale = valeEl ? Number(valeEl.value) || 0 : 0;

    // descExtra & reason handled globally in store.extras; but keep local field as well for compatibility
    const descExtraEl = document.querySelector('.descExtra[data-day="'+day+'"]');
    const descExtra = descExtraEl ? Number(descExtraEl.value) || 0 : 0;
    const descReasonEl = document.querySelector('.descReason[data-day="'+day+'"]');
    const descReason = descReasonEl ? (descReasonEl.value || '') : '';

    store.records[mk][empId][String(day)] = { entry, lunchOut, lunchIn, folga, sold, vale, descExtra, descReason };
    saveStore(store);
    calcRow(empId, day);
    const p = store.periods[mk] && store.periods[mk][empId] ? store.periods[mk][empId] : null;
    if(p) updateTotalsUI(empId, p.start, p.end);
  }

  function calcRow(empId, day){
    const mk = monthKey();
    const row = (store.records[mk] && store.records[mk][empId] && store.records[mk][empId][String(day)]) || null;
    const td = document.querySelector('.td-desc[data-day="'+day+'"]'); if(!td) return;
    if(!row || (!row.entry && !row.sold && !row.folga)){ td.innerText = 'R$ 0,00'; td.style.color = '#0b1724'; return; }
    if(row.folga){ td.innerText = 'R$ 0,00'; td.style.color = '#0b1724'; return; }
    const m = parseMin(row.entry);
    const limit = parseMin(store.config.settings.lateLimit);
    const late = (m !== null && m >= limit);
    td.innerText = late ? money(store.config.settings.latePenalty) : money(0);
    td.style.color = late ? '#b91c1c' : '#0b1724';
  }

  // escolher período (salva em store.periods com chave monthKey(start))
  function openPeriodSelector(emp){
    const start = prompt('Digite data de início (DD-MM-YYYY ou YYYY-MM-DD):');
    if(!start) return;
    const end = prompt('Digite data de fim (DD-MM-YYYY ou YYYY-MM-DD) — para semanal o final deve ser domingo:');
    if(!end) return;
    // aceitamos DD-MM-YYYY ou YYYY-MM-DD; normalizar para DD-MM-YYYY
    const sISO = brToISO(start) || start;
    const eISO = brToISO(end) || end;
    const s = new Date((sISO.indexOf('-')===4 ? sISO : brToISO(start)) + 'T00:00:00');
    const e = new Date((eISO.indexOf('-')===4 ? eISO : brToISO(end)) + 'T00:00:00');
    if(isNaN(s.getTime()) || isNaN(e.getTime())) return alert('Formato de data inválido.');
    if(emp.payType === 'Semanal'){
      if(e.getDay() !== 0) return alert('Para pagamento semanal o dia final precisa ser domingo.');
    }
    const mk = monthKey(s);
    store.periods[mk] = store.periods[mk] || {};
    // salvar no formato BR DD-MM-YYYY para compatibilidade interna
    function toBR(dt){ return String(dt.getDate()).padStart(2,'0') + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + dt.getFullYear(); }
    store.periods[mk][emp.id] = { start: toBR(s), end: toBR(e) };
    saveStore(store);
    alert('Período salvo: ' + toBR(s) + ' até ' + toBR(e));
    updateTotalsUI(emp.id, toBR(s), toBR(e));
  }

  // Relatórios (detalhado e descontos)
  function openReport(emp, startStr, endStr, totals){
    let html = `<html><head><meta charset="utf-8"><title>Relatório ${emp.name}</title><link rel="stylesheet" href="style.css"></head><body><div style="padding:20px">`;
    html += `<h2>${store.config.empresa}</h2><h3>Relatório: ${emp.name}</h3>`;
    html += `<div>Período: ${startStr} até ${endStr}</div>`;
    html += `<table border="1" cellpadding="6" style="border-collapse:collapse;margin-top:10px"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída Almoço</th><th>Volta</th><th>Folga</th><th>Vendeu</th><th>Vales</th><th>Desc. Extra</th><th>Motivo</th><th>Desconto (Atraso)</th></tr></thead><tbody>`;
    const start = new Date(brToISO(startStr) + 'T00:00:00'), end = new Date(brToISO(endStr) + 'T00:00:00');
    const rec = (store.records[monthKey(start)] && store.records[monthKey(start)][emp.id]) || {};
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      const daynum = d.getDate();
      const r = rec[String(daynum)] || {};
      const descAtraso = (r.entry && parseMin(r.entry) >= parseMin(store.config.settings.lateLimit)) ? store.config.settings.latePenalty : 0;
      // busca extra para o dia
      const dateBR = String(daynum).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
      const extra = (store.extras[emp.id] || []).find(x=> x.date === dateBR) || {};
      html += `<tr><td>${daynum}</td><td>${r.entry||''}</td><td>${r.lunchOut||''}</td><td>${r.lunchIn||''}</td><td>${r.folga? 'Sim':''}</td><td>${r.sold? 'Sim':''}</td><td>R$ ${(Number(r.vale||0)).toFixed(2)}</td><td>R$ ${(Number(extra.value||r.descExtra||0)).toFixed(2)}</td><td>${(extra.reason||r.descReason||'')}</td><td>R$ ${Number(descAtraso).toFixed(2)}</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<h4>Resumo</h4><div>Base: ${money(totals.base)}</div><div>Descontos por atrasos: ${money(totals.totalDescAtrasos)}</div><div>Descontos extras: ${money(totals.totalExtra)}</div><div>Vales: ${money(totals.totalVales)}</div><div>Vendas de folga (acumuladas): ${money(totals.totalSold)}</div><div>Alimentação (acumulada): ${money(totals.foodAccum)}</div><div style="margin-top:8px" class="total-box">Total líquido: ${money(totals.net)}</div>`;
    html += `<div style="margin-top:20px" class="creditos">Desenvolvido por Suzydxx - GZS Manager</div>`;
    html += `</div></body></html>`;
    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
    try{ w.print(); }catch(e){}
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    const fname = `relatorio_${emp.name.replace(/\s+/g,'_')}_${startStr}_to_${endStr}.html`;
    a.download = fname; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    store.reports.push({ empId: emp.id, name: emp.name, start: startStr, end: endStr, date: new Date().toISOString().slice(0,10), filename: fname });
    saveStore(store);
    alert('Relatório gerado. Use Imprimir -> Salvar como PDF se desejar PDF.');
  }

  function openDiscountDetails(emp, startStr, endStr){
    const start = new Date(brToISO(startStr) + 'T00:00:00'), end = new Date(brToISO(endStr) + 'T00:00:00');
    const rec = (store.records[monthKey(start)] && store.records[monthKey(start)][emp.id]) || {};
    let rows = '';
    let totalAtrasos = 0, totalExtras = 0;
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      const daynum = d.getDate();
      const r = rec[String(daynum)] || {};
      const atras = (r.entry && parseMin(r.entry) >= parseMin(store.config.settings.lateLimit)) ? Number(store.config.settings.latePenalty || 0) : 0;
      const dateBR = String(daynum).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
      const extraObj = (store.extras[emp.id] || []).find(x=> x.date === dateBR) || {};
      const extra = Number(extraObj.value || r.descExtra || 0);
      if(atras > 0){
        rows += `<tr><td>${daynum}</td><td>Atraso</td><td>R$ ${Number(atras).toFixed(2)}</td><td>-</td></tr>`;
        totalAtrasos += atras;
      }
      if(extra > 0){
        rows += `<tr><td>${daynum}</td><td>Desconto Extra</td><td>R$ ${Number(extra).toFixed(2)}</td><td>${extraObj.reason||r.descReason||''}</td></tr>`;
        totalExtras += extra;
      }
    }
    if(!rows) rows = `<tr><td colspan="4">Nenhum desconto registrado neste período.</td></tr>`;

    const html = `<html><head><meta charset="utf-8"><title>Detalhes Descontos ${emp.name}</title><link rel="stylesheet" href="style.css"></head><body><div style="padding:20px">
      <h2>${store.config.empresa}</h2><h3>Detalhes de Descontos: ${emp.name}</h3><div>Período: ${startStr} até ${endStr}</div>
      <table border="1" cellpadding="6" style="border-collapse:collapse;margin-top:10px;width:100%"><thead><tr><th>Dia</th><th>Tipo</th><th>Valor</th><th>Motivo</th></tr></thead><tbody>
      ${rows}
      </tbody></table>
      <div style="margin-top:12px"><strong>Total atrasos:</strong> ${money(totalAtrasos)}<br><strong>Total descontos extras:</strong> ${money(totalExtras)}<br><strong>Total desconto geral:</strong> ${money(totalAtrasos + totalExtras)}</div>
      <div style="margin-top:20px" class="creditos">Relatório de descontos gerado por GZS Manager</div>
      </div></body></html>`;

    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
  }

  // ---- Configurações page handlers ----
  function setupConfigPage(){
    if(!el('cEmpresa')) return;
    el('cEmpresa').value = store.config.empresa || '';
    el('cEmail').value = store.config.email || '';
    el('cUser').value = (store.config.admin && store.config.admin.user) || 'gelozonasul';
    el('cPass').value = (store.config.admin && store.config.admin.pass) || '1234';
    el('cSell').value = store.config.settings.sellDayValue || 60;
    el('cFood').value = store.config.settings.foodPerDay || 20;
    el('cLate').value = store.config.settings.latePenalty || 10;
    el('cLateLimit').value = store.config.settings.lateLimit || '08:21';

    el('saveCfg').addEventListener('click', ()=>{
      store.config.empresa = el('cEmpresa').value || store.config.empresa;
      store.config.email = el('cEmail').value || store.config.email;
      store.config.admin = store.config.admin || {};
      store.config.admin.user = el('cUser').value || store.config.admin.user;
      store.config.admin.pass = el('cPass').value || store.config.admin.pass;
      store.config.settings.sellDayValue = Number(el('cSell').value) || store.config.settings.sellDayValue;
      store.config.settings.foodPerDay = Number(el('cFood').value) || store.config.settings.foodPerDay;
      store.config.settings.latePenalty = Number(el('cLate').value) || store.config.settings.latePenalty;
      store.config.settings.lateLimit = el('cLateLimit').value || store.config.settings.lateLimit;
      saveStore(store);
      alert('Configurações salvas.');
    });

    el('exportCfg').addEventListener('click', ()=>{
      const data = JSON.stringify(store, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'gzs-manager-backup-' + new Date().toISOString().slice(0,10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      alert('Backup exportado.');
    });

    el('restoreDefault').addEventListener('click', ()=>{
      if(!confirm('Restaurar padrões? Isso limpará os dados locais.')) return;
      localStorage.removeItem(LS_KEY);
      location.reload();
    });
  }

  // ---- Inicialização por página ----
  function init(){
    setupLogin();
    protectPages();

    if(path === '' || path === 'index.html'){
      // nada além do login é necessário aqui
    } else if(path === 'painel.html'){
      if(el('empresaTitle')) el('empresaTitle').textContent = store.config.empresa || 'GZS Manager - Sistema de Controle e Gestão';
      renderEmployeeList();
      if(el('btnAddEmp')) el('btnAddEmp').addEventListener('click', addEmployeePrompt);
      if(el('btnSettings')) el('btnSettings').addEventListener('click', ()=> location.href='configuracoes.html');
      renderOverview();
    } else if(path === 'funcionario.html'){
      renderPointsPage();
    } else if(path === 'configuracoes.html'){
      setupConfigPage();
    }

    // export para debug/integração se quiser usar via console
    window.gzs = window.gzs || {};
    window.gzs.store = store;
    window.gzs.calcTotalsForGivenRange = calcTotalsForGivenRange;
    window.gzs.calcTotalsForPeriod = calcTotalsForPeriod;
    window.gzs.updateTotalsUI = updateTotalsUI;
    window.gzs.addExtraDiscount = addExtraDiscount;
    window.gzs.addLateDetail = addLateDetail;
    window.gzs.saveStore = saveStore;

    // salva estado (não sobrescreve dados importantes, apenas garante estrutura)
    saveStore(store);
  }

  // aguarda DOM
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
