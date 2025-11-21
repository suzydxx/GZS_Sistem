/*
  GZS Manager - script.js
  Local system for desktop use. Login: gelozonasul / 1234
  Stores data in localStorage under key 'gzs_manager_v3'
  Atualização: adiciona "desconto extra" por dia (campo descExtra) com motivo (descReason) e inclui relatório detalhado de descontos.
*/
(function(){
  const LS_KEY = 'gzs_manager_v3';
  const DEFAULT = {
    config: {
      empresa: "GZS Manager - Sistema de Controle e Gestão",
      email: "vivianelagendick@hotmail.com",
      admin: { user: "gelozonasul", pass: "1234", name: "Suzy" },
      settings: { lateLimit: "08:21", latePenalty: 10, weeklySalary: 350, foodPerDay: 20, sellDayValue: 60 }
    },
    employees: [
      { id:"e1", name:"Suzy", role:"Gestão", active:true, payType:"Quinzenal", foodMode:"Acumulada", sellMode:"Acumulada" },
      { id:"e2", name:"Wander", role:"Entregador", active:true, payType:"Semanal", foodMode:"Diaria", sellMode:"NaHora" },
      { id:"e3", name:"Funcionario_3", role:"", active:false, payType:"Quinzenal", foodMode:"Acumulada", sellMode:"Acumulada" }
    ],
    records: {},
    periods: {},
    reports: []
  };

  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return DEFAULT;
  }
  function saveStore(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  const store = loadStore();

  function el(id){ return document.getElementById(id); }
  function monthKey(d=new Date()){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
  function parseMin(t){ if(!t) return null; const m = t.match(/^(\d{1,2}):(\d{2})$/); if(!m) return null; const h=parseInt(m[1],10), mm=parseInt(m[2],10); if(isNaN(h)||isNaN(mm)) return null; return h*60+mm; }
  function money(v){ return 'R$ ' + Number(v).toFixed(2).replace('.',','); }

  const path = window.location.pathname.split('/').pop();

  if(path === '' || path === 'index.html'){
    document.addEventListener('DOMContentLoaded', ()=>{
      const btn = el('btnLogin'), demo = el('btnDemo');
      if(btn){
        btn.addEventListener('click', ()=>{
          const u = el('user').value.trim(), p = el('pass').value.trim();
          if(u === store.config.admin.user && p === store.config.admin.pass){
            window.location.href = 'painel.html';
          } else {
            alert('Usuário ou senha incorretos');
          }
        });
      }
      if(demo){
        demo.addEventListener('click', ()=>{
          const mk = monthKey();
          store.records[mk] = store.records[mk] || {};
          store.records[mk]['e1'] = store.records[mk]['e1'] || {};
          // incluí descExtra e descReason nos defaults
          store.records[mk]['e1']['1'] = { entry:'08:00', lunchOut:'12:00', lunchIn:'13:00', folga:false, sold:false, vale:0, descExtra:0, descReason:'' };
          store.records[mk]['e1']['2'] = { entry:'08:25', lunchOut:'12:00', lunchIn:'13:00', folga:false, sold:false, vale:0, descExtra:0, descReason:'' };
          saveStore(store);
          window.location.href = 'painel.html';
        });
      }
    });
  }

  if(path === 'painel.html'){
    document.addEventListener('DOMContentLoaded', ()=>{
      el('empresaTitle').textContent = store.config.empresa;
      renderEmployeeList();
      el('btnAddEmp').addEventListener('click', addEmployee);
      el('btnSettings').addEventListener('click', ()=> location.href='configuracoes.html');
      renderOverview();
    });
    function renderEmployeeList(){
      const list = el('empList'); list.innerHTML = '';
      store.employees.forEach(emp=>{
        const d = document.createElement('div'); d.style.padding='8px'; d.style.border='1px solid #f1f7ff'; d.style.borderRadius='6px'; d.style.marginTop='8px';
        d.innerHTML = `<strong>${emp.name}</strong><div class="small">${emp.role||''} ${emp.active? '':'(Inativo)'}</div><div class="small-ghost">${emp.payType}</div><div style="margin-top:8px"><button class="btn openEmp" data-id="${emp.id}">Abrir</button></div>`;
        list.appendChild(d);
      });
      document.querySelectorAll('.openEmp').forEach(b=> b.addEventListener('click', (e)=> { const id=e.target.dataset.id; window.location.href = 'funcionario.html?id=' + id; }));
    }
    function addEmployee(){
      const name = prompt('Nome do funcionário:'); if(!name) return;
      const id = 'e' + (store.employees.length+1);
      store.employees.push({ id, name, role:'', active:true, payType:'Quinzenal', foodMode:'Acumulada', sellMode:'Acumulada' });
      saveStore(store); renderEmployeeList();
    }
    function renderOverview(){
      const mk = monthKey();
      const div = el('overview'); div.innerHTML = '';
      store.employees.forEach(emp=>{
        const totals = calcTotalsForPeriod(emp.id, mk, null);
        const box = document.createElement('div'); box.style.padding='10px'; box.style.border='1px solid #eef6ff'; box.style.borderRadius='8px'; box.style.marginTop='8px';
        box.innerHTML = `<strong>${emp.name}</strong><div class="small-ghost">${emp.payType}</div><div class="total-box">Total a receber (exemplo atual): ${money(totals.net)}</div>`;
        div.appendChild(box);
      });
    }
  }

  if(path === 'configuracoes.html'){
    document.addEventListener('DOMContentLoaded', ()=>{
      el('cEmpresa').value = store.config.empresa;
      el('cEmail').value = store.config.email;
      el('cUser').value = store.config.admin.user;
      el('cPass').value = store.config.admin.pass;
      el('cSell').value = store.config.settings.sellDayValue;
      el('cFood').value = store.config.settings.foodPerDay;
      el('cLate').value = store.config.settings.latePenalty;
      el('cLateLimit').value = store.config.settings.lateLimit;

      el('saveCfg').addEventListener('click', ()=>{
        store.config.empresa = el('cEmpresa').value || store.config.empresa;
        store.config.email = el('cEmail').value || store.config.email;
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
    });
  }

  if(path === 'funcionario.html'){
    document.addEventListener('DOMContentLoaded', ()=>{
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const emp = store.employees.find(e=>e.id===id);
      if(!emp){ alert('Funcionário não encontrado'); window.location.href='painel.html'; return; }
      el('empTitle').textContent = emp.name;
      el('empSub').textContent = emp.role + ' — ' + emp.payType;
      renderPoints(emp);
    });

    function renderPoints(emp){
      const mk = monthKey();
      store.records[mk] = store.records[mk] || {};
      store.records[mk][emp.id] = store.records[mk][emp.id] || {};
      const rec = store.records[mk][emp.id];

      let html = `<h3>${emp.name} — ${emp.payType}</h3><div class="small-note">Mês: ${mk}</div>`;
      html += `<div class="controls">`;
      if(emp.payType === 'Semanal') html += `<button id="btnChoosePeriod" class="btn">Escolher Período Semanal</button>`;
      if(emp.payType === 'Quinzenal') html += `<button id="btnChoosePeriod" class="btn">Escolher Período Quinzenal</button>`;
      html += `<button id="btnGenReport" class="btn secondary">Gerar Relatório (abrir/print)</button>`;
      // botão novo para detalhes de descontos
      html += `<button id="btnDiscounts" class="btn">Detalhes Descontos</button>`;
      html += `</div>`;

      // Adicionei coluna "Desc. Extra" e "Motivo" (descReason), mantendo td-desc para desconto por atraso
      html += `<table class="table"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída Almoço</th><th>Volta Almoço</th><th>Folga</th><th>Vendeu</th><th>Vales (R$)</th><th>Desc. Extra (R$)</th><th>Motivo</th><th>Desconto</th></tr></thead><tbody>`;
      for(let d=1; d<=31; d++){
        const r = rec[String(d)] || {entry:'', lunchOut:'', lunchIn:'', folga:false, sold:false, vale:0, descExtra:0, descReason:''};
        html += `<tr>
          <td>${d}</td>
          <td><input class="inp-time entry" data-day="${d}" value="${r.entry||''}"></td>
          <td><input class="inp-time lunchOut" data-day="${d}" value="${r.lunchOut||''}"></td>
          <td><input class="inp-time lunchIn" data-day="${d}" value="${r.lunchIn||''}"></td>
          <td style="text-align:center"><input type="checkbox" class="chk-folga" data-day="${d}" ${r.folga? 'checked':''}></td>
          <td style="text-align:center"><input type="checkbox" class="chk-sold" data-day="${d}" ${r.sold? 'checked':''}></td>
          <td><input class="inp-time vale" data-day="${d}" value="${r.vale||0}" type="number" min="0" step="0.01"></td>
          <td><input class="inp-time descExtra" data-day="${d}" value="${r.descExtra||0}" type="number" min="0" step="0.01"></td>
          <td><input class="inp-text descReason" data-day="${d}" value="${r.descReason||''}" type="text" placeholder="motivo (opcional)"></td>
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

      // Eventos
      document.querySelectorAll('.inp-time').forEach(i=> i.addEventListener('blur', (e)=> { saveField(emp.id, e.target.dataset.day); }));
      document.querySelectorAll('.chk-folga, .chk-sold').forEach(cb=> cb.addEventListener('change', (e)=> { saveField(emp.id, e.target.dataset.day); }));
      document.querySelectorAll('.vale').forEach(v=> v.addEventListener('change', (e)=> { saveField(emp.id, e.target.dataset.day); }));
      document.querySelectorAll('.descExtra').forEach(v=> v.addEventListener('change', (e)=> { saveField(emp.id, e.target.dataset.day); }));
      document.querySelectorAll('.descReason').forEach(v=> v.addEventListener('blur', (e)=> { saveField(emp.id, e.target.dataset.day); }));

      el('payType').addEventListener('change', ()=> { emp.payType = el('payType').value; saveStore(store); renderPoints(emp); });
      el('foodMode').addEventListener('change', ()=> { emp.foodMode = el('foodMode').value; saveStore(store); });
      el('sellMode').addEventListener('change', ()=> { emp.sellMode = el('sellMode').value; saveStore(store); });
      el('activeMode').addEventListener('change', ()=> { emp.active = (el('activeMode').value === 'Sim'); saveStore(store); });

      if(el('btnChoosePeriod')) el('btnChoosePeriod').addEventListener('click', ()=> openPeriodSelector(emp));
      el('btnGenReport').addEventListener('click', ()=> { const p = store.periods[monthKey()]; const period = p && p[emp.id] ? p[emp.id] : null; if(!period) return alert('Escolha primeiro o período (semana/quinzena) para gerar relatório.'); const totals = calcTotalsForGivenRange(emp.id, period.start, period.end); openReport(emp, period.start, period.end, totals); });

      if(el('btnDiscounts')) el('btnDiscounts').addEventListener('click', ()=> { const p = store.periods[monthKey()]; const period = p && p[emp.id] ? p[emp.id] : null; if(!period) return alert('Escolha primeiro o período (semana/quinzena) para ver detalhes dos descontos.'); openDiscountDetails(emp, period.start, period.end); });

      for(let d=1; d<=31; d++) calcRow(emp.id, d);
      const p = store.periods[monthKey()] || {};
      const per = p[emp.id] || null;
      if(per) updateTotalsUI(emp.id, per.start, per.end);
    }

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

    function openPeriodSelector(emp){
      const start = prompt('Digite data de início (YYYY-MM-DD):');
      if(!start) return;
      const end = prompt('Digite data de fim (YYYY-MM-DD) — para semanal o final deve ser domingo (YYYY-MM-DD):');
      if(!end) return;
      const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00');
      if(isNaN(s.getTime()) || isNaN(e.getTime())) return alert('Formato de data inválido.');
      if(emp.payType === 'Semanal'){
        if(e.getDay() !== 0) return alert('Para pagamento semanal o dia final precisa ser domingo.');
      }
      const mk = monthKey(s);
      store.periods[mk] = store.periods[mk] || {};
      store.periods[mk][emp.id] = { start: start, end: end };
      saveStore(store);
      alert('Período salvo: ' + start + ' até ' + end);
      updateTotalsUI(emp.id, start, end);
    }

    function updateTotalsUI(empId, startStr, endStr){
      const emp = store.employees.find(e=>e.id===empId);
      const totals = calcTotalsForGivenRange(empId, startStr, endStr);
      el('baseVal').innerText = money(totals.base);
      // descVal agora inclui soma de penalidades por atraso + descontos extras
      el('descVal').innerText = money(totals.totalDesc + totals.totalExtraDesc);
      el('valesVal').innerText = money(totals.totalVales);
      el('sellVal').innerText = money(totals.totalSold);
      el('foodVal').innerText = money(totals.foodAccum);
      el('netVal').innerText = money(totals.net);
    }

    function calcTotalsForGivenRange(empId, startStr, endStr){
      const start = new Date(startStr + 'T00:00:00'), end = new Date(endStr + 'T00:00:00');
      const emp = store.employees.find(e=>e.id===empId);
      const rec = (store.records[monthKey(start)] && store.records[monthKey(start)][empId]) || {};
      const weekly = Number(store.config.settings.weeklySalary) || 350;
      const base = (emp.payType === 'Quinzenal') ? weekly*2 : weekly;
      let totalVales = 0, totalSold = 0, totalDesc = 0, foodAccum = 0, totalExtraDesc = 0;
      for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
        const daynum = d.getDate();
        const r = rec[String(daynum)] || null;
        if(!r) continue;
        if(r.vale) totalVales += Number(r.vale || 0);
        if(r.descExtra) totalExtraDesc += Number(r.descExtra || 0);
        if(r.sold && emp.sellMode === 'Acumulada') totalSold += Number(store.config.settings.sellDayValue || 0);
        if(r.entry){
          const mm = parseMin(r.entry);
          if(mm !== null && mm >= parseMin(store.config.settings.lateLimit)) totalDesc += Number(store.config.settings.latePenalty || 0);
          if(emp.foodMode === 'Acumulada') foodAccum += Number(store.config.settings.foodPerDay || 0);
        }
      }
      // totalDesc = penalidades por atraso; totalExtraDesc é o desconto manual. Ambos descontados.
      const net = Math.max(0, base - (totalDesc + totalVales + totalExtraDesc) + totalSold + foodAccum);
      return { base, totalVales, totalSold, totalDesc, totalExtraDesc, foodAccum, net };
    }

    function openReport(emp, startStr, endStr, totals){
      let html = `<html><head><meta charset="utf-8"><title>Relatório ${emp.name}</title><link rel="stylesheet" href="style.css"></head><body><div style="padding:20px">`;
      html += `<h2>${store.config.empresa}</h2><h3>Relatório: ${emp.name}</h3>`;
      html += `<div>Período: ${startStr} até ${endStr}</div>`;
      // Cabeçalho com nova coluna "Desc. Extra" e "Motivo"
      html += `<table border="1" cellpadding="6" style="border-collapse:collapse;margin-top:10px"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída Almoço</th><th>Volta</th><th>Folga</th><th>Vendeu</th><th>Vales</th><th>Desc. Extra</th><th>Motivo</th><th>Desconto (Atraso)</th></tr></thead><tbody>`;
      const start = new Date(startStr + 'T00:00:00'), end = new Date(endStr + 'T00:00:00');
      const rec = (store.records[monthKey(start)] && store.records[monthKey(start)][emp.id]) || {};
      for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
        const daynum = d.getDate();
        const r = rec[String(daynum)] || {};
        const descAtraso = (r.entry && parseMin(r.entry) >= parseMin(store.config.settings.lateLimit)) ? store.config.settings.latePenalty : 0;
        html += `<tr><td>${daynum}</td><td>${r.entry||''}</td><td>${r.lunchOut||''}</td><td>${r.lunchIn||''}</td><td>${r.folga? 'Sim':''}</td><td>${r.sold? 'Sim':''}</td><td>R$ ${(Number(r.vale||0)).toFixed(2)}</td><td>R$ ${(Number(r.descExtra||0)).toFixed(2)}</td><td>${(r.descReason||'')}</td><td>R$ ${Number(descAtraso).toFixed(2)}</td></tr>`;
      }
      html += `</tbody></table>`;
      html += `<h4>Resumo</h4><div>Base: ${money(totals.base)}</div><div>Descontos por atrasos: ${money(totals.totalDesc)}</div><div>Descontos extras: ${money(totals.totalExtraDesc)}</div><div>Vales: ${money(totals.totalVales)}</div><div>Vendas de folga (acumuladas): ${money(totals.totalSold)}</div><div>Alimentação (acumulada): ${money(totals.foodAccum)}</div><div style="margin-top:8px" class="total-box">Total líquido: ${money(totals.net)}</div>`;
      html += `<div style="margin-top:20px" class="creditos">Desenvolvido por Suzydxx - GZS Manager 2k25</div>`;
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

    // Nova função: relatório detalhado só dos descontos (separado)
    function openDiscountDetails(emp, startStr, endStr){
      const start = new Date(startStr + 'T00:00:00'), end = new Date(endStr + 'T00:00:00');
      const rec = (store.records[monthKey(start)] && store.records[monthKey(start)][emp.id]) || {};
      let rows = '';
      let totalAtrasos = 0, totalExtras = 0;
      for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
        const daynum = d.getDate();
        const r = rec[String(daynum)] || {};
        const atras = (r.entry && parseMin(r.entry) >= parseMin(store.config.settings.lateLimit)) ? Number(store.config.settings.latePenalty || 0) : 0;
        const extra = Number(r.descExtra || 0);
        if(atras > 0){
          rows += `<tr><td>${daynum}</td><td>Atraso</td><td>R$ ${Number(atras).toFixed(2)}</td><td>-</td></tr>`;
          totalAtrasos += atras;
        }
        if(extra > 0){
          const reason = (r.descReason || '');
          rows += `<tr><td>${daynum}</td><td>Desconto Extra</td><td>R$ ${Number(extra).toFixed(2)}</td><td>${escapeHtml(reason)}</td></tr>`;
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

    // helper para escapar texto em HTML
    function escapeHtml(str){
      if(!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

  }

  saveStore(store);
})();
