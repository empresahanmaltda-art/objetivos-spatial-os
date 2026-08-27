(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = 'objetivosSpatialOS.v1';
  const todayISO = () => new Date().toISOString().slice(0,10);
  const fmtDate = (iso) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'short'}).format(new Date(iso+'T12:00:00'));
  const fmtShort = (iso) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(new Date(iso+'T12:00:00'));
  const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  const uid = (p='id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const minutes = t => { const [h,m='0'] = String(t||'0:0').split(':').map(Number); return h*60+m; };
  const timeFromMin = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const addDays = (iso,d) => { const x=new Date(iso+'T12:00:00'); x.setDate(x.getDate()+d); return x.toISOString().slice(0,10); };
  const dayIndex = iso => new Date(iso+'T12:00:00').getDay();
  const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const seed = () => ({
    version: 1,
    currentView: 'today',
    cycleStart: addDays(todayISO(),-42),
    profile: { level:24, xp:6840, streak:17, name:'Kauan' },
    settings: { autoOptimize:true, sound:false, spotifyUrl:'', startHour:7, endHour:23 },
    tasks: [
      {id:'t1',title:'Russo — revisão e exercícios',date:todayISO(),duration:45,start:'09:00',fixed:false,priority:2,category:'russo',recurrence:null,goalId:'g3',xp:35},
      {id:'t2',title:'Campanha TikTok — Bloco 1',date:todayISO(),duration:70,start:'11:00',fixed:false,priority:3,category:'tiktok',recurrence:null,goalId:'g2',xp:55},
      {id:'t3',title:'Almoço',date:todayISO(),duration:40,start:'13:30',fixed:true,priority:1,category:'dieta',recurrence:null,xp:10},
      {id:'t4',title:'Reunião',date:todayISO(),duration:90,start:'15:00',fixed:true,priority:3,category:'trabalho',recurrence:null,xp:20},
      {id:'t5',title:'Criativos campanha',date:todayISO(),duration:75,start:'16:45',fixed:false,priority:3,category:'marketing',recurrence:null,goalId:'g2',xp:50},
      {id:'t6',title:'Academia',date:todayISO(),duration:75,start:'18:40',fixed:false,priority:3,category:'academia',recurrence:{days:[1,2,3,4,5,6]},goalId:'g4',xp:60},
      {id:'t7',title:'Jantar',date:todayISO(),duration:35,start:'20:25',fixed:true,priority:1,category:'dieta',recurrence:{days:[0,1,2,3,4,5,6]},xp:10}
    ],
    completions: {},
    scheduleOverrides: {},
    goals: [
      {id:'g1',title:'Meta financeira mensal',area:'financeiro',target:100000,unit:'R$',deadline:addDays(todayISO(),30),type:'finance',manualCurrent:null},
      {id:'g2',title:'Execução de conteúdo',area:'tiktok',target:30,unit:'entregas',deadline:addDays(todayISO(),84),type:'taskCount',category:'tiktok'},
      {id:'g3',title:'Russo consistente',area:'russo',target:60,unit:'sessões',deadline:addDays(todayISO(),84),type:'taskCount',category:'russo'},
      {id:'g4',title:'Treinar com consistência',area:'academia',target:60,unit:'treinos',deadline:addDays(todayISO(),84),type:'taskCount',category:'academia'},
      {id:'g5',title:'Chegar a 60 kg',area:'academia',target:60,unit:'kg',deadline:addDays(todayISO(),120),type:'manual',manualCurrent:42.9}
    ],
    finance: [
      {id:'f1',date:addDays(todayISO(),-18),label:'Venda Produto A',amount:7800,type:'income'},
      {id:'f2',date:addDays(todayISO(),-16),label:'Tráfego pago',amount:2150,type:'expense'},
      {id:'f3',date:addDays(todayISO(),-14),label:'Venda Produto A',amount:12400,type:'income'},
      {id:'f4',date:addDays(todayISO(),-11),label:'Ferramentas',amount:780,type:'expense'},
      {id:'f5',date:addDays(todayISO(),-9),label:'Venda Produto B',amount:9650,type:'income'},
      {id:'f6',date:addDays(todayISO(),-7),label:'Tráfego pago',amount:3920,type:'expense'},
      {id:'f7',date:addDays(todayISO(),-5),label:'Venda Produto A',amount:14300,type:'income'},
      {id:'f8',date:addDays(todayISO(),-3),label:'Venda Produto B',amount:9850,type:'income'},
      {id:'f9',date:addDays(todayISO(),-2),label:'Ferramentas',amount:1260,type:'expense'},
      {id:'f10',date:todayISO(),label:'Venda Produto A',amount:13450,type:'income'}
    ],
    weights: [{date:addDays(todayISO(),-40),value:41.8},{date:addDays(todayISO(),-20),value:42.3},{date:todayISO(),value:42.9}],
    notes: [],
    aiLog: [{date:Date.now(),text:'Agenda otimizada automaticamente. “Criativos campanha” foi posicionado após a reunião.'}]
  });

  let state = load();
  let currentDate = todayISO();

  const navItems = [
    ['today','H','Hoje'],['week','W','Semana'],['goals','G','Metas'],['finance','$','Financeiro'],['areas','A','Áreas'],['control','C','Controle']
  ];

  function load(){
    try { const raw=localStorage.getItem(STORAGE_KEY); return raw ? {...seed(),...JSON.parse(raw)} : seed(); }
    catch { return seed(); }
  }
  function save(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    $('#syncStatus').textContent='salvo agora';
    setTimeout(()=>{$('#syncStatus').textContent='salvo localmente';},900);
  }
  function reset(){ state=seed(); currentDate=todayISO(); save(); render(); }

  function occurrenceKey(task,date){ return `${task.id}@${date}`; }
  function isRecurringOn(task,date){
    if(!task.recurrence) return task.date===date;
    return date>=task.date && task.recurrence.days?.includes(dayIndex(date));
  }
  function taskDateEligible(task,date){ return task.recurrence ? isRecurringOn(task,date) : task.date===date; }
  function isDone(task,date){ return !!state.completions[occurrenceKey(task,date)]; }
  function effectiveStart(task,date){ return state.scheduleOverrides[occurrenceKey(task,date)] || task.start || ''; }
  function getTasksForDate(date){
    return state.tasks.filter(t=>taskDateEligible(t,date)).map(t=>({...t,start:effectiveStart(t,date)})).sort((a,b)=>minutes(a.start)-minutes(b.start));
  }
  function completedCountCategory(category){
    return Object.keys(state.completions).filter(k=>{
      const id=k.split('@')[0], t=state.tasks.find(x=>x.id===id); return t?.category===category;
    }).length;
  }
  function financeSummary(){
    const income=state.finance.filter(x=>x.type==='income').reduce((a,b)=>a+b.amount,0);
    const expense=state.finance.filter(x=>x.type==='expense').reduce((a,b)=>a+b.amount,0);
    return {income,expense,profit:income-expense,balance:income-expense};
  }
  function goalCurrent(g){
    if(g.type==='finance') return financeSummary().income;
    if(g.type==='taskCount') return completedCountCategory(g.category);
    if(g.type==='manual') return g.manualCurrent||0;
    return 0;
  }
  function goalProgress(g){ return clamp(goalCurrent(g)/g.target,0,1); }
  function todayProgress(){ const list=getTasksForDate(currentDate); if(!list.length)return 0; return list.filter(t=>isDone(t,currentDate)).length/list.length; }
  function xpToday(){ return getTasksForDate(currentDate).filter(t=>isDone(t,currentDate)).reduce((a,t)=>a+(t.xp||20),0); }

  function syncLevel(){ state.profile.level=Math.max(1,Math.floor(state.profile.xp/300)+2); }
  function toggleTask(id,date=currentDate){
    const task=state.tasks.find(t=>t.id===id); if(!task)return;
    const key=occurrenceKey(task,date);
    if(state.completions[key]){
      delete state.completions[key]; state.profile.xp=Math.max(0,state.profile.xp-(task.xp||20)); toast('Conclusão desfeita.');
    } else {
      state.completions[key]={at:Date.now()}; state.profile.xp+=(task.xp||20); toast(`+${task.xp||20} XP · ${task.title}`);
    }
    syncLevel(); save(); render();
  }

  function findSlot(date,duration,occupied,preferredStart=null){
    const start=state.settings.startHour*60, end=state.settings.endHour*60;
    const sorted=[...occupied].sort((a,b)=>a[0]-b[0]);
    const candidates=[];
    for(let m=start;m+duration<=end;m+=5){
      if(sorted.every(([a,b])=>m+duration<=a || m>=b)) candidates.push(m);
    }
    if(!candidates.length)return null;
    if(preferredStart!=null) return candidates.sort((a,b)=>Math.abs(a-preferredStart)-Math.abs(b-preferredStart))[0];
    return candidates[0];
  }

  function optimizeDay(date, reason='Otimização automática'){
    const tasks=state.tasks.filter(t=>taskDateEligible(t,date));
    const fixed=tasks.filter(t=>t.fixed && effectiveStart(t,date));
    const flex=tasks.filter(t=>!t.fixed);
    const occupied=fixed.map(t=>[minutes(effectiveStart(t,date)),minutes(effectiveStart(t,date))+t.duration,t.id]);
    const changes=[];
    flex.sort((a,b)=>(b.priority||1)-(a.priority||1) || new Date(a.deadline||'2999-01-01')-new Date(b.deadline||'2999-01-01'));
    for(const task of flex){
      const old=effectiveStart(task,date); const pref=old?minutes(old):null;
      const slot=findSlot(date,task.duration,occupied,pref);
      if(slot==null) continue;
      const next=timeFromMin(slot); state.scheduleOverrides[occurrenceKey(task,date)]=next;
      occupied.push([slot,slot+task.duration,task.id]);
      if(old!==next) changes.push({task:task.title,from:old||'sem horário',to:next});
    }
    if(changes.length){ state.aiLog.unshift({date:Date.now(),text:`${reason}: ${changes.map(c=>`${c.task} ${c.from} → ${c.to}`).join('; ')}`}); }
    save(); return changes;
  }

  function detectFixedConflicts(date){ const fixed=state.tasks.filter(t=>taskDateEligible(t,date)&&t.fixed&&effectiveStart(t,date)).map(t=>({...t,start:effectiveStart(t,date)})); const out=[]; for(let i=0;i<fixed.length;i++)for(let j=i+1;j<fixed.length;j++){const a=fixed[i],b=fixed[j],as=minutes(a.start),bs=minutes(b.start);if(as+a.duration>bs&&bs+b.duration>as)out.push([a,b]);} return out; }

  function addTask(data){
    const task={id:uid('task'),title:data.title.trim(),date:data.date||currentDate,duration:Number(data.duration)||45,start:data.start||'',fixed:!!data.fixed,priority:Number(data.priority)||2,category:data.category||'pessoal',deadline:data.deadline||'',goalId:data.goalId||null,xp:Number(data.xp)||30,recurrence:data.recurrenceDays?.length?{days:data.recurrenceDays}:null,notes:data.notes||''};
    state.tasks.push(task);
    let changes=[];
    if(state.settings.autoOptimize) changes=optimizeDay(task.date, task.fixed?'Novo compromisso fixo':'Nova tarefa'); else save();
    const fixedConflicts=detectFixedConflicts(task.date); if(fixedConflicts.length) state.aiLog.unshift({date:Date.now(),text:`Conflito entre compromissos fixos: ${fixedConflicts.map(x=>x[0].title+' × '+x[1].title).join('; ')}. Requer decisão manual.`}); save();
    toast(fixedConflicts.length?'Compromissos fixos em conflito — confira a agenda.':changes.length?`Agenda otimizada · ${changes.length} ajuste(s)`:'Tarefa adicionada.');
    render();
    return task;
  }

  function deleteTask(id){ state.tasks=state.tasks.filter(t=>t.id!==id); save(); render(); }

  function addFinance(data){
    state.finance.push({id:uid('fin'),date:data.date||todayISO(),label:data.label||'Movimento',amount:Number(data.amount)||0,type:data.type||'income'});save();render();toast('Financeiro atualizado.');
  }

  function setView(view){ state.currentView=view; save(); render(); requestAnimationFrame(()=>$('#viewRoot')?.focus()); }

  function renderNav(){
    $('#railNav').innerHTML=navItems.map(([id,icon,label])=>`<button class="rail-btn ${state.currentView===id?'active':''}" data-view="${id}" title="${label}">${icon}</button>`).join('');
    $('#bottomDock').innerHTML=navItems.map(([id,icon,label])=>`<button class="dock-btn ${state.currentView===id?'active':''}" data-view="${id}" title="${label}">${icon}</button>`).join('');
  }

  function header(title,subtitle,eyebrow='',actions=''){
    return `<div class="view-header"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 class="view-title">${esc(title)}</h1><div class="view-subtitle">${esc(subtitle)}</div></div>${actions?`<div class="header-actions">${actions}</div>`:''}</div>`;
  }
  function metric(label,value,sub=''){ return `<div class="metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-sub">${esc(sub)}</div></div>`; }
  function progress(value,left,right){ return `<div class="progress-track"><div class="progress-fill" style="width:${clamp(value,0,1)*100}%"></div></div><div class="progress-meta"><span>${esc(left)}</span><span>${esc(right)}</span></div>`; }

  function renderToday(){
    const tasks=getTasksForDate(currentDate); const p=todayProgress();
    const next=tasks.find(t=>!isDone(t,currentDate)&&minutes(t.start)>=minutes(new Date().toTimeString().slice(0,5))) || tasks.find(t=>!isDone(t,currentDate));
    const upcoming=next?`${next.start||'—'} · ${next.title}`:'Tudo concluído';
    return `<div class="view-enter">
      ${header('Hoje','Seu dia, reorganizado em tempo real pela IA.',fmtDate(currentDate),`<button class="soft-btn" data-action="prevDay">‹</button><button class="soft-btn" data-action="todayNow">Hoje</button><button class="soft-btn" data-action="nextDay">›</button><button class="primary-btn" data-action="addTask">+ Adicionar</button>`)}
      <div class="metrics-grid">
        ${metric('PROGRESSO DO DIA',`${Math.round(p*100)}%`,`${tasks.filter(t=>isDone(t,currentDate)).length} de ${tasks.length} concluídos`)}
        ${metric('STREAK',`${state.profile.streak} dias`,'sequência atual')}
        ${metric('XP HOJE',`+${xpToday()}`,`nível ${state.profile.level} · ${state.profile.xp} XP`)}
        ${metric('PRÓXIMO',next?.start||'—',next?.title||'sem pendências')}
      </div>
      <div class="grid-2">
        <section class="panel hoverable"><div class="panel-title">Linha do dia</div><div class="panel-sub">Fixos não são movidos. Flexíveis são ajustados automaticamente.</div>
          <div class="timeline">${tasks.length?tasks.map(t=>`<div class="timeline-row ${isDone(t,currentDate)?'done':''} ${t.fixed?'fixed':''}"><div class="time">${esc(t.start||'—')}</div><div class="timeline-dot"></div><div><div class="task-name">${esc(t.title)}</div><div class="task-meta">${t.fixed?'Fixo':'Flexível'} · ${t.duration} min · ${esc(t.category)}</div></div><div class="task-actions"><button class="check-btn" data-action="toggleTask" data-id="${t.id}" title="Concluir">${isDone(t,currentDate)?'✓':'○'}</button><button class="check-btn" data-action="editTask" data-id="${t.id}" title="Editar">⋯</button></div></div>`).join(''):`<div class="empty">Nenhuma atividade neste dia.</div>`}</div>
        </section>
        <div class="section-stack">
          <section class="panel hoverable"><div class="panel-title">Meta em foco</div>${goalMini(state.goals[0])}</section>
          <section class="panel hoverable"><div class="panel-title">Consistência · 14 dias</div>${consistencyBars()}<div class="metric-sub">atividade recente calculada pelas conclusões registradas</div></section>
          <section class="panel hoverable"><div class="panel-title">Ações rápidas</div><div class="quick-row"><button class="soft-btn" data-action="optimize">Otimizar dia</button><button class="soft-btn" data-action="addMeeting">Reunião</button><button class="soft-btn" data-view="goals">Metas</button><button class="soft-btn" data-view="finance">Financeiro</button></div></section>
        </div>
      </div>
    </div>`;
  }

  function consistencyBars(){
    const days=Array.from({length:14},(_,i)=>addDays(todayISO(),i-13));
    const vals=days.map(d=>{const t=getTasksForDate(d);return t.length?t.filter(x=>isDone(x,d)).length/t.length:0;});
    return `<div style="display:grid;grid-template-columns:repeat(14,1fr);gap:6px;height:78px;align-items:end">${vals.map(v=>`<div style="height:${Math.max(8,v*74)}px;border-radius:8px;background:rgba(255,255,255,${.08+v*.55})"></div>`).join('')}</div>`;
  }

  function goalMini(g){ const c=goalCurrent(g),p=goalProgress(g);return `<div style="font-size:19px;font-weight:650;margin-bottom:14px">${esc(g.title)}</div>${progress(p,formatGoalValue(g,c),formatGoalValue(g,g.target))}`; }
  function formatGoalValue(g,v){ if(g.unit==='R$')return `R$ ${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0})}`; return `${Number(v).toLocaleString('pt-BR')} ${g.unit}`; }

  function renderWeek(){
    const base=new Date(currentDate+'T12:00:00'); const dow=(base.getDay()+6)%7; const monday=addDays(currentDate,-dow); const days=Array.from({length:7},(_,i)=>addDays(monday,i));
    const hours=[8,10,12,14,16,18,20];
    return `<div class="view-enter">${header('Semana','Capacidade, compromissos e tarefas flexíveis em uma única visão.',`${fmtShort(days[0])} — ${fmtShort(days[6])}`,`<button class="primary-btn" data-action="addTask">+ Adicionar</button>`)}
      <section class="panel"><div class="week-grid"><div class="week-head"></div>${days.map((d,i)=>`<div class="week-head">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'][i]}<strong>${new Date(d+'T12:00:00').getDate()}</strong></div>`).join('')}
        ${hours.map(h=>`<div class="week-time">${String(h).padStart(2,'0')}:00</div>${days.map(d=>{const ev=getTasksForDate(d).filter(t=>{const m=minutes(t.start);return m>=h*60&&m<(h+2)*60;});return `<div class="week-cell">${ev.map(t=>`<div class="week-event ${t.fixed?'fixed':''}" data-action="editTask" data-id="${t.id}" data-date="${d}">${esc(t.start)} ${esc(t.title)}</div>`).join('')}</div>`}).join('')}`).join('')}
      </div></section>
      <div class="grid-equal" style="margin-top:14px"><section class="panel"><div class="panel-title">Carga semanal</div>${days.map(d=>{const min=getTasksForDate(d).reduce((a,t)=>a+t.duration,0);return `<div style="display:grid;grid-template-columns:42px 1fr 54px;gap:8px;align-items:center;margin:9px 0"><span class="metric-sub">${fmtShort(d)}</span><div class="progress-track"><div class="progress-fill" style="width:${clamp(min/(8*60),0,1)*100}%"></div></div><span class="metric-sub">${Math.round(min/60*10)/10}h</span></div>`}).join('')}</section><section class="panel"><div class="panel-title">IA · equilíbrio</div><p class="view-subtitle">Use “Otimizar semana” para reposicionar tarefas flexíveis em cada dia sem tocar nos compromissos fixos.</p><button class="primary-btn" data-action="optimizeWeek">Otimizar semana</button></section></div>
    </div>`;
  }

  function renderGoals(){
    const currentWeek=clamp(Math.floor((new Date(todayISO()+'T12:00:00')-new Date((state.cycleStart||todayISO())+'T12:00:00'))/(7*86400000))+1,1,12);
    return `<div class="view-enter">${header('Metas','Objetivos conectados a ações, ritmo e previsão.','Ciclo de 12 semanas',`<button class="primary-btn" data-action="addGoal">+ Nova meta</button>`)}
      <section class="panel" style="margin-bottom:14px"><div class="panel-title">Ciclo atual · semana ${currentWeek} de 12</div><div class="week-cycle">${Array.from({length:12},(_,i)=>`<div class="week-node ${i<currentWeek?'on':''} ${i===currentWeek-1?'current':''}"></div>`).join('')}</div><div class="progress-meta"><span>Semana 1</span><span>58% do ciclo</span><span>Semana 12</span></div></section>
      <div class="grid-equal">${state.goals.map(g=>`<section class="goal-card"><div class="goal-top"><div><div class="eyebrow">${esc(g.area)}</div><div class="goal-title">${esc(g.title)}</div></div><div class="goal-value">${Math.round(goalProgress(g)*100)}%</div></div>${progress(goalProgress(g),formatGoalValue(g,goalCurrent(g)),formatGoalValue(g,g.target))}<div class="goal-meta"><span>Prazo ${fmtShort(g.deadline)}</span><button class="soft-btn" data-action="editGoal" data-id="${g.id}">Detalhes</button></div></section>`).join('')}</div>
      <div class="grid-equal" style="margin-top:14px"><section class="panel"><div class="panel-title">Ações que movem suas metas</div>${getTasksForDate(currentDate).filter(t=>t.goalId).slice(0,5).map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${esc(t.category)} · ${t.duration} min</span></div><span class="chip">${isDone(t,currentDate)?'concluído':'pendente'}</span></div>`).join('')||'<div class="empty">Sem ações ligadas às metas hoje.</div>'}</section><section class="panel"><div class="panel-title">Previsão</div><div class="metric-value">${state.goals.filter(g=>goalProgress(g)>=.5).length} de ${state.goals.length}</div><div class="view-subtitle">metas estão em ritmo razoável considerando o progresso registrado.</div><button class="primary-btn" data-action="optimize" style="margin-top:18px">Ajustar agenda pelo ciclo</button></section></div>
    </div>`;
  }

  function financeSeries(days=30){
    const arr=[]; let acc=0;
    for(let i=days-1;i>=0;i--){const d=addDays(todayISO(),-i);acc+=state.finance.filter(x=>x.date===d&&x.type==='income').reduce((a,b)=>a+b.amount,0);arr.push({date:d,value:acc});}
    return arr;
  }
  function chartSvg(series){
    const w=760,h=250,pad=18,max=Math.max(1,...series.map(x=>x.value));
    const pts=series.map((x,i)=>[pad+i*(w-pad*2)/(series.length-1||1),h-pad-(x.value/max)*(h-pad*2)]);
    const path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area=`${path} L${pts.at(-1)[0]},${h-pad} L${pts[0][0]},${h-pad} Z`;
    return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="white" stop-opacity=".15"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line x1="18" y1="60" x2="742" y2="60"/><line x1="18" y1="125" x2="742" y2="125"/><line x1="18" y1="190" x2="742" y2="190"/></g><path d="${area}" class="chart-area"/><path d="${path}" class="chart-line"/>${pts.filter((_,i)=>i===pts.length-1).map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" class="chart-dot"/>`).join('')}<text x="18" y="242" class="chart-axis">${fmtShort(series[0].date)}</text><text x="710" y="242" class="chart-axis">${fmtShort(series.at(-1).date)}</text></svg></div>`;
  }
  function renderFinance(){
    const s=financeSummary(); const goal=state.goals.find(g=>g.type==='finance')||state.goals[0]; const p=goalProgress(goal); const remaining=Math.max(0,goal.target-s.income); const required=Math.round(remaining/Math.max(1,30-new Date().getDate()));
    return `<div class="view-enter">${header('Financeiro','Performance, ritmo da meta e histórico em uma única leitura.','Visão executiva',`<div class="segmented"><button class="seg-btn">7D</button><button class="seg-btn active">30D</button><button class="seg-btn">3M</button><button class="seg-btn">1A</button></div><button class="primary-btn" data-action="addFinance">+ Movimento</button>`)}
      <div class="metrics-grid">${metric('RECEITA',`R$ ${s.income.toLocaleString('pt-BR')}`,'acumulado registrado')}${metric('LUCRO LÍQUIDO',`R$ ${s.profit.toLocaleString('pt-BR')}`,`${s.income?Math.round(s.profit/s.income*100):0}% de margem`)}${metric('DESPESAS',`R$ ${s.expense.toLocaleString('pt-BR')}`,'total registrado')}${metric('META MENSAL',`${Math.round(p*100)}%`,`faltam R$ ${remaining.toLocaleString('pt-BR')}`)}</div>
      <div class="grid-2"><section class="panel"><div class="panel-title">Receita acumulada · 30 dias</div>${chartSvg(financeSeries(30))}</section><div class="section-stack"><section class="panel"><div class="panel-title">Ritmo da meta</div><div class="metric-value">R$ ${required.toLocaleString('pt-BR')}/dia</div><div class="view-subtitle">necessário a partir de hoje para atingir a meta configurada.</div>${progress(p,`${Math.round(p*100)}%`,`R$ ${goal.target.toLocaleString('pt-BR')}`)}</section><section class="panel"><div class="panel-title">Recentes</div><table class="data-table"><tbody>${[...state.finance].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>`<tr><td><strong>${esc(x.label)}</strong><div class="metric-sub">${fmtShort(x.date)}</div></td><td class="${x.type==='income'?'positive':'negative'}">${x.type==='income'?'+':'−'} R$ ${x.amount.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></section></div></div>
    </div>`;
  }

  const areas = {
    tiktok:{title:'TikTok',icon:'◒',desc:'Conteúdo, blocos, views e execução semanal.'},
    russo:{title:'Russo',icon:'Я',desc:'Sessões, consistência, vocabulário e tarefas.'},
    dieta:{title:'Dieta',icon:'◐',desc:'Refeições, consistência e metas diárias.'},
    academia:{title:'Academia',icon:'⌁',desc:'Treinos, peso e progresso físico.'},
    marketing:{title:'Marketing',icon:'↗',desc:'Campanhas, entregas e performance.'}
  };
  function renderAreas(){
    return `<div class="view-enter">${header('Áreas','Cada módulo alimenta a agenda, as metas e o painel de controle.','Módulos conectados')}
      <div class="area-grid">${Object.entries(areas).map(([id,a])=>`<div class="area-card" data-action="openArea" data-area="${id}"><div class="area-icon">${a.icon}</div><h3>${a.title}</h3><p>${a.desc}</p><div class="metric-sub" style="margin-top:18px">${completedCountCategory(id)} ações concluídas</div></div>`).join('')}</div>
      <section class="panel" style="margin-top:14px"><div class="panel-title">Integração automática</div><div class="view-subtitle">Tarefas criadas dentro de qualquer área entram na agenda principal. Conclusões atualizam XP, histórico e metas relacionadas sem entrada duplicada.</div></section>
    </div>`;
  }
  function areaGoal(area){ return state.goals.find(g=>g.area===area); }
  function renderArea(area){
    const a=areas[area]||areas.tiktok, tasks=state.tasks.filter(t=>t.category===area), goal=areaGoal(area);
    if(area==='academia') return renderGymArea(a,tasks,goal);
    if(area==='tiktok') return renderTikTokArea(a,tasks,goal);
    if(area==='russo') return renderRussianArea(a,tasks,goal);
    if(area==='dieta') return renderDietArea(a,tasks,goal);
    return `<div class="view-enter">${header(a.title,a.desc,'Área',`<button class="soft-btn" data-view="areas">Voltar</button><button class="primary-btn" data-action="addTask" data-category="${area}">+ Tarefa</button>`)}<div class="metrics-grid">${metric('CONCLUÍDAS',String(completedCountCategory(area)),'histórico')}${metric('PENDENTES',String(tasks.filter(t=>!isDone(t,currentDate)).length),'tarefas cadastradas')}${metric('HOJE',String(getTasksForDate(currentDate).filter(t=>t.category===area).length),'na agenda')}${goal?metric('META',`${Math.round(goalProgress(goal)*100)}%`,goal.title):metric('META','—','sem meta vinculada')}</div><div class="grid-equal"><section class="panel"><div class="panel-title">Execução</div>${tasks.length?tasks.map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${t.duration} min · ${t.fixed?'fixo':'flexível'}</span></div><button class="soft-btn" data-action="editTask" data-id="${t.id}">Editar</button></div>`).join(''):'<div class="empty">Sem tarefas cadastradas.</div>'}</section><section class="panel"><div class="panel-title">IA · recomendação</div><p class="view-subtitle">As atividades desta área entram automaticamente na otimização diária e semanal conforme prioridade, duração e compromissos fixos.</p><button class="primary-btn" data-action="optimize">Otimizar hoje</button></section></div></div>`;
  }
  function renderGymArea(a,tasks,goal){ const weight=state.weights.at(-1)?.value||0;return `<div class="view-enter">${header('Academia','Treino de segunda a sábado conectado à agenda e à meta física.','Área',`<button class="soft-btn" data-view="areas">Voltar</button><button class="primary-btn" data-action="addWeight">+ Peso</button>`)}<div class="metrics-grid">${metric('PESO ATUAL',`${weight} kg`,'último registro')}${metric('META','60 kg',`${Math.round(weight/60*100)}% do alvo`)}${metric('TREINOS',String(completedCountCategory('academia')),'concluídos')}${metric('ROTINA','SEG — SÁB','recorrência ativa')}</div><div class="grid-equal"><section class="panel"><div class="panel-title">Progresso de peso</div>${chartSvg(state.weights.map(x=>({date:x.date,value:x.value})))}</section><section class="panel"><div class="panel-title">Rotina</div>${tasks.map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${t.recurrence?'recorrente':'pontual'} · ${t.duration} min</span></div><button class="soft-btn" data-action="editTask" data-id="${t.id}">Editar</button></div>`).join('')}</section></div></div>`; }
  function renderTikTokArea(a,tasks,goal){ return `<div class="view-enter">${header('TikTok','Conteúdo e execução conectados às metas e ao calendário.','Área',`<button class="soft-btn" data-view="areas">Voltar</button><button class="primary-btn" data-action="addTask" data-category="tiktok">+ Entrega</button>`)}<div class="metrics-grid">${metric('BLOCO 1','Ativo','fase atual')}${metric('ENTREGAS',String(completedCountCategory('tiktok')),'concluídas')}${metric('META',goal?`${Math.round(goalProgress(goal)*100)}%`:'—',goal?.title||'sem meta')}${metric('HOJE',String(getTasksForDate(currentDate).filter(t=>t.category==='tiktok').length),'na agenda')}</div><div class="grid-equal"><section class="panel"><div class="panel-title">Bloco 1 · execução</div>${tasks.map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${t.duration} min · prioridade ${t.priority}</span></div><span class="chip">${effectiveStart(t,currentDate)||'flexível'}</span></div>`).join('')}</section><section class="panel"><div class="panel-title">Ritmo</div>${goal?progress(goalProgress(goal),formatGoalValue(goal,goalCurrent(goal)),formatGoalValue(goal,goal.target)):''}<p class="view-subtitle" style="margin-top:16px">A IA posiciona automaticamente as entregas em janelas livres sem mover compromissos fixos.</p></section></div></div>`; }
  function renderRussianArea(a,tasks,goal){ return `<div class="view-enter">${header('Russo','Sessões, exercícios e consistência de estudo.','Área',`<button class="soft-btn" data-view="areas">Voltar</button><button class="primary-btn" data-action="addTask" data-category="russo">+ Sessão</button>`)}<div class="metrics-grid">${metric('SESSÕES',String(completedCountCategory('russo')),'concluídas')}${metric('STREAK',`${Math.max(1,Math.min(state.profile.streak,12))} dias`,'estudo')}${metric('META',goal?`${Math.round(goalProgress(goal)*100)}%`:'—',goal?.title||'sem meta')}${metric('HOJE',String(getTasksForDate(currentDate).filter(t=>t.category==='russo').length),'sessões')}</div><section class="panel"><div class="panel-title">Plano de estudo</div>${tasks.map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${t.duration} min · ${t.recurrence?'recorrente':'pontual'}</span></div><button class="soft-btn" data-action="editTask" data-id="${t.id}">Editar</button></div>`).join('')}</section></div>`; }
  function renderDietArea(a,tasks,goal){ return `<div class="view-enter">${header('Dieta','Refeições e consistência integradas ao dia.','Área',`<button class="soft-btn" data-view="areas">Voltar</button><button class="primary-btn" data-action="addTask" data-category="dieta">+ Refeição</button>`)}<div class="metrics-grid">${metric('HOJE',`${getTasksForDate(currentDate).filter(t=>t.category==='dieta'&&isDone(t,currentDate)).length}/${getTasksForDate(currentDate).filter(t=>t.category==='dieta').length}`,'refeições')}${metric('CONSISTÊNCIA',`${Math.round(todayProgress()*100)}%`,'dia geral')}${metric('PESO',`${state.weights.at(-1)?.value||'—'} kg`,'registro atual')}${metric('ROTINA','Ativa','itens recorrentes')}</div><section class="panel"><div class="panel-title">Refeições</div>${tasks.map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.title)}</strong><span>${t.start||'sem horário'} · ${t.duration} min</span></div><button class="soft-btn" data-action="editTask" data-id="${t.id}">Editar</button></div>`).join('')}</section></div>`; }

  function renderAchievements(){
    const earned=[
      {title:'Consistência',desc:'7 dias de sequência',on:state.profile.streak>=7},
      {title:'Ritmo sólido',desc:'14 dias de sequência',on:state.profile.streak>=14},
      {title:'Primeiros 10 treinos',desc:'10 sessões concluídas',on:completedCountCategory('academia')>=10},
      {title:'Russo em movimento',desc:'10 sessões de estudo',on:completedCountCategory('russo')>=10},
      {title:'Conteúdo consistente',desc:'10 entregas de TikTok',on:completedCountCategory('tiktok')>=10},
      {title:'Meta financeira 50%',desc:'metade da meta mensal',on:goalProgress(state.goals.find(g=>g.type==='finance'))>=.5}
    ];
    return `<div class="view-enter">${header('Conquistas','Marcos relevantes, sem transformar o sistema em um jogo infantil.','Progressão',`<button class="soft-btn" data-view="control">Voltar</button>`)}<div class="area-grid">${earned.map(a=>`<div class="area-card" style="opacity:${a.on?1:.42}"><div class="area-icon">${a.on?'◇':'○'}</div><h3>${esc(a.title)}</h3><p>${esc(a.desc)}</p><div class="metric-sub" style="margin-top:18px">${a.on?'desbloqueada':'a conquistar'}</div></div>`).join('')}</div></div>`;
  }

  function renderControl(){
    const fs=financeSummary(), p=todayProgress(), topGoals=[...state.goals].sort((a,b)=>goalProgress(a)-goalProgress(b)).slice(0,3);
    return `<div class="view-enter">${header('Controle','O que merece atenção agora, sem repetir os dashboards.','Visão executiva')}
      <div class="metrics-grid">${metric('DIA',`${Math.round(p*100)}%`,'progresso atual')}${metric('FINANCEIRO',`R$ ${fs.profit.toLocaleString('pt-BR')}`,'lucro líquido registrado')}${metric('XP',String(state.profile.xp),`nível ${state.profile.level}`)}${metric('STREAK',`${state.profile.streak} dias`,'consistência geral')}</div>
      <div class="grid-equal"><section class="panel"><div class="panel-title">Prioridades</div>${topGoals.map(g=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(g.title)}</strong><span>${Math.round(goalProgress(g)*100)}% · prazo ${fmtShort(g.deadline)}</span></div><span class="chip ${goalProgress(g)<.4?'warning':''}">${goalProgress(g)<.4?'atenção':'em ritmo'}</span></div>`).join('')}</section><section class="panel"><div class="panel-title">Últimas decisões da IA</div>${state.aiLog.slice(0,5).map(x=>`<div class="setting-row"><div class="setting-copy"><strong>${new Date(x.date).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</strong><span>${esc(x.text)}</span></div></div>`).join('')}</section></div>
      <div class="grid-equal" style="margin-top:14px"><section class="panel"><div class="panel-title">Agenda de hoje</div>${getTasksForDate(currentDate).slice(0,6).map(t=>`<div class="setting-row"><div class="setting-copy"><strong>${esc(t.start||'—')} · ${esc(t.title)}</strong><span>${t.fixed?'fixo':'flexível'} · ${isDone(t,currentDate)?'concluído':'pendente'}</span></div></div>`).join('')}</section><section class="panel"><div class="panel-title">Ações</div><div class="quick-row"><button class="primary-btn" data-action="optimize">Otimizar hoje</button><button class="soft-btn" data-action="addTask">Nova tarefa</button><button class="soft-btn" data-action="addFinance">Novo movimento</button><button class="soft-btn" data-action="command">Comando IA</button><button class="soft-btn" data-view="achievements">Conquistas</button></div></section></div>
    </div>`;
  }

  function renderContext(){
    const layer=$('#contextLayer');
    if(state.currentView==='today'){
      const latest=state.aiLog[0]; const goal=state.goals[0];
      layer.innerHTML=`<div class="context-card glass depth-4"><div class="eyebrow">IA</div><h3>Agenda inteligente</h3><p>${esc(latest?.text||'Seu dia está organizado.')}</p><div class="context-actions"><button class="primary-btn" data-action="optimize">Otimizar</button></div></div><div class="context-card glass depth-3"><div class="eyebrow">META EM FOCO</div><h3>${Math.round(goalProgress(goal)*100)}%</h3><p>${esc(goal.title)}</p></div>`;
    } else if(state.currentView==='finance'){
      const g=state.goals.find(x=>x.type==='finance'), p=goalProgress(g);
      layer.innerHTML=`<div class="context-card glass depth-4"><div class="eyebrow">ANÁLISE IA</div><h3>${p>=.67?'Meta no caminho':'Ritmo insuficiente'}</h3><p>${p>=.67?'O ritmo registrado está próximo do necessário.':'A receita atual está abaixo do ritmo necessário para a meta.'}</p></div>`;
    } else layer.innerHTML='';
  }

  function render(){
    renderNav(); const root=$('#viewRoot'); let html='';
    if(state.currentView==='today') html=renderToday();
    else if(state.currentView==='week') html=renderWeek();
    else if(state.currentView==='goals') html=renderGoals();
    else if(state.currentView==='finance') html=renderFinance();
    else if(state.currentView==='areas') html=renderAreas();
    else if(state.currentView.startsWith('area:')) html=renderArea(state.currentView.split(':')[1]);
    else if(state.currentView==='control') html=renderControl();
    else if(state.currentView==='achievements') html=renderAchievements();
    root.innerHTML=html; renderContext(); bindDynamic(); updateSpotify();
  }

  function bindDynamic(){
    $$('[data-view]').forEach(el=>el.onclick=()=>setView(el.dataset.view));
    $$('[data-action]').forEach(el=>{
      el.onclick=(e)=>{e.stopPropagation();handleAction(el.dataset.action,el.dataset,el);};
    });
  }

  function handleAction(action,data,el){
    if(action==='prevDay'){currentDate=addDays(currentDate,-1);render();}
    if(action==='nextDay'){currentDate=addDays(currentDate,1);render();}
    if(action==='todayNow'){currentDate=todayISO();render();}
    if(action==='toggleTask')toggleTask(data.id,currentDate);
    if(action==='addTask')openTaskModal(null,{category:data.category});
    if(action==='addMeeting')openTaskModal(null,{fixed:true,title:'Reunião'});
    if(action==='editTask')openTaskModal(state.tasks.find(t=>t.id===data.id),{date:data.date});
    if(action==='optimize'){const c=optimizeDay(currentDate);toast(c.length?`${c.length} tarefa(s) reposicionada(s).`:'Seu dia já está otimizado.');render();}
    if(action==='optimizeWeek'){const base=new Date(currentDate+'T12:00:00');const dow=(base.getDay()+6)%7;const m=addDays(currentDate,-dow);let total=0;for(let i=0;i<7;i++)total+=optimizeDay(addDays(m,i),'Otimização semanal').length;toast(`${total} ajuste(s) feitos na semana.`);render();}
    if(action==='addGoal')openGoalModal();
    if(action==='editGoal')openGoalModal(state.goals.find(g=>g.id===data.id));
    if(action==='addFinance')openFinanceModal();
    if(action==='openArea')setView(`area:${data.area}`);
    if(action==='addWeight')openWeightModal();
    if(action==='command')openCommand();
  }

  function openModal(content,klass=''){
    const layer=$('#modalLayer'); $('#viewRoot').classList.add('receded'); layer.className='modal-layer open'; layer.innerHTML=`<div class="modal glass depth-5 ${klass}">${content}</div>`;
    $$('.modal-close',layer).forEach(b=>b.onclick=closeModal);
    layer.onclick=e=>{if(e.target===layer)closeModal();};
  }
  function closeModal(){ $('#modalLayer').className='modal-layer'; $('#modalLayer').innerHTML=''; $('#viewRoot').classList.remove('receded'); }

  function openTaskModal(task=null,preset={}){
    const t=task||{}; const rec=t.recurrence?.days||[]; const selectedCat=preset.category||t.category||'pessoal';
    openModal(`<div class="modal-head"><div><h2>${task?'Editar atividade':'Nova atividade'}</h2><p>A IA pode reposicionar itens flexíveis automaticamente.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div>
      <form id="taskForm"><div class="input-grid">
      <div class="field full"><label>Título</label><input name="title" required value="${esc(preset.title||t.title||'')}" placeholder="O que precisa acontecer?" /></div>
      <div class="field"><label>Data</label><input type="date" name="date" value="${esc(preset.date||t.date||currentDate)}" /></div>
      <div class="field"><label>Horário</label><input type="time" name="start" value="${esc(t.start||'')}" /></div>
      <div class="field"><label>Duração (min)</label><input type="number" min="5" step="5" name="duration" value="${t.duration||45}" /></div>
      <div class="field"><label>Prioridade</label><select name="priority"><option value="1" ${t.priority===1?'selected':''}>Baixa</option><option value="2" ${!t.priority||t.priority===2?'selected':''}>Média</option><option value="3" ${t.priority===3?'selected':''}>Alta</option></select></div>
      <div class="field"><label>Categoria</label><select name="category">${['pessoal','trabalho','tiktok','marketing','russo','dieta','academia'].map(c=>`<option value="${c}" ${selectedCat===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Prazo</label><input type="date" name="deadline" value="${esc(t.deadline||'')}" /></div>
      <div class="field"><label>Tipo</label><select name="fixed"><option value="0" ${!t.fixed&&!preset.fixed?'selected':''}>Flexível</option><option value="1" ${t.fixed||preset.fixed?'selected':''}>Fixo</option></select></div>
      <div class="field full"><label>Recorrência</label><div class="quick-row">${[['D',0],['S',1],['T',2],['Q',3],['Q',4],['S',5],['S',6]].map(([l,d])=>`<label class="chip"><input type="checkbox" name="rec" value="${d}" ${rec.includes(d)?'checked':''}/> ${l}</label>`).join('')}</div></div>
      <div class="field full"><label>Notas</label><textarea name="notes">${esc(t.notes||'')}</textarea></div></div>
      <div class="modal-actions">${task?`<button type="button" class="danger-btn" id="deleteTaskBtn">Excluir</button>`:''}<button type="button" class="soft-btn modal-close">Cancelar</button><button class="primary-btn" type="submit">${task?'Salvar':'Adicionar'}</button></div></form>`);
    $('#taskForm').onsubmit=e=>{
      e.preventDefault(); const f=new FormData(e.currentTarget); const d=Object.fromEntries(f.entries()); d.fixed=d.fixed==='1'; d.recurrenceDays=$$('input[name=rec]:checked',e.currentTarget).map(x=>Number(x.value));
      if(task){ Object.assign(task,{title:d.title,date:d.date,start:d.start,duration:Number(d.duration),priority:Number(d.priority),category:d.category,deadline:d.deadline,fixed:d.fixed,recurrence:d.recurrenceDays.length?{days:d.recurrenceDays}:null,notes:d.notes}); if(state.settings.autoOptimize)optimizeDay(d.date,'Atividade alterada'); else save();toast('Atividade atualizada.');render(); }
      else addTask(d);
      closeModal();
    };
    if(task)$('#deleteTaskBtn').onclick=()=>{deleteTask(task.id);closeModal();toast('Atividade excluída.');};
  }

  function openGoalModal(g=null){
    openModal(`<div class="modal-head"><div><h2>${g?'Editar meta':'Nova meta'}</h2><p>Metas podem ser manuais, financeiras ou alimentadas por tarefas.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div><form id="goalForm"><div class="input-grid"><div class="field full"><label>Título</label><input name="title" required value="${esc(g?.title||'')}"/></div><div class="field"><label>Tipo</label><select name="type"><option value="manual" ${g?.type==='manual'?'selected':''}>Manual</option><option value="taskCount" ${g?.type==='taskCount'?'selected':''}>Contagem de tarefas</option><option value="finance" ${g?.type==='finance'?'selected':''}>Financeira</option></select></div><div class="field"><label>Área</label><select name="area">${['pessoal','financeiro','tiktok','russo','academia','marketing'].map(a=>`<option ${g?.area===a?'selected':''}>${a}</option>`).join('')}</select></div><div class="field"><label>Meta</label><input name="target" type="number" step="0.1" value="${g?.target||100}"/></div><div class="field"><label>Atual (manual)</label><input name="manualCurrent" type="number" step="0.1" value="${g?.manualCurrent??0}"/></div><div class="field"><label>Unidade</label><input name="unit" value="${esc(g?.unit||'unid.')}"/></div><div class="field"><label>Prazo</label><input name="deadline" type="date" value="${g?.deadline||addDays(todayISO(),84)}"/></div><div class="field full"><label>Categoria vinculada</label><select name="category"><option value="">Nenhuma</option>${['tiktok','marketing','russo','dieta','academia'].map(a=>`<option value="${a}" ${g?.category===a?'selected':''}>${a}</option>`).join('')}</select></div></div><div class="modal-actions"><button type="button" class="soft-btn modal-close">Cancelar</button><button class="primary-btn">Salvar</button></div></form>`);
    $('#goalForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries()); const obj={id:g?.id||uid('goal'),title:d.title,type:d.type,area:d.area,target:Number(d.target),manualCurrent:Number(d.manualCurrent),unit:d.unit,deadline:d.deadline,category:d.category||null}; if(g)Object.assign(g,obj);else state.goals.push(obj);save();closeModal();render();toast('Meta salva.');};
  }
  function openFinanceModal(){
    openModal(`<div class="modal-head"><div><h2>Novo movimento</h2><p>Atualiza automaticamente o dashboard e as metas financeiras.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div><form id="financeForm"><div class="input-grid"><div class="field full"><label>Descrição</label><input name="label" required placeholder="Ex.: Venda Produto A"/></div><div class="field"><label>Valor</label><input name="amount" type="number" step="0.01" required/></div><div class="field"><label>Tipo</label><select name="type"><option value="income">Receita</option><option value="expense">Despesa</option></select></div><div class="field"><label>Data</label><input name="date" type="date" value="${todayISO()}"/></div></div><div class="modal-actions"><button type="button" class="soft-btn modal-close">Cancelar</button><button class="primary-btn">Adicionar</button></div></form>`);
    $('#financeForm').onsubmit=e=>{e.preventDefault();addFinance(Object.fromEntries(new FormData(e.currentTarget).entries()));closeModal();};
  }
  function openWeightModal(){
    openModal(`<div class="modal-head"><div><h2>Registrar peso</h2><p>Atualiza a área Academia e a meta física.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div><form id="weightForm"><div class="input-grid"><div class="field"><label>Peso (kg)</label><input name="value" type="number" step="0.1" value="${state.weights.at(-1)?.value||''}"/></div><div class="field"><label>Data</label><input name="date" type="date" value="${todayISO()}"/></div></div><div class="modal-actions"><button type="button" class="soft-btn modal-close">Cancelar</button><button class="primary-btn">Salvar</button></div></form>`);
    $('#weightForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());state.weights.push({date:d.date,value:Number(d.value)});const g=state.goals.find(x=>x.type==='manual'&&x.unit==='kg');if(g)g.manualCurrent=Number(d.value);save();closeModal();render();toast('Peso registrado.');};
  }

  function openSettings(){
    openModal(`<div class="modal-head"><div><h2>Configurações</h2><p>Preferências do sistema local.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div><div class="setting-row"><div class="setting-copy"><strong>Otimização automática</strong><span>Reorganiza tarefas flexíveis após mudanças no calendário.</span></div><input class="toggle" id="autoOptimizeToggle" type="checkbox" ${state.settings.autoOptimize?'checked':''}></div><div class="setting-row"><div class="setting-copy"><strong>Spotify</strong><span>Cole uma URL de embed do Spotify para abrir no widget.</span></div><button class="soft-btn" id="spotifySettings">Configurar</button></div><div class="setting-row"><div class="setting-copy"><strong>Backup</strong><span>Exporte ou importe todos os seus dados em JSON.</span></div><div><button class="soft-btn" id="exportBtn">Exportar</button> <button class="soft-btn" id="importBtn">Importar</button><input id="importFile" type="file" accept="application/json" hidden></div></div><div class="setting-row"><div class="setting-copy"><strong>Dados locais</strong><span>As informações ficam no armazenamento deste navegador.</span></div><button class="danger-btn" id="resetBtn">Restaurar demo</button></div>`);
    $('#autoOptimizeToggle').onchange=e=>{state.settings.autoOptimize=e.target.checked;save();toast(e.target.checked?'Otimização automática ativada.':'Otimização automática desativada.');};
    $('#spotifySettings').onclick=()=>{const url=prompt('Cole a URL de embed do Spotify (https://open.spotify.com/embed/...):',state.settings.spotifyUrl||'');if(url!==null){state.settings.spotifyUrl=url.trim();save();updateSpotify();}};
    $('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`objetivos-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Backup exportado.');};
    $('#importBtn').onclick=()=>$('#importFile').click();
    $('#importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed.tasks||!parsed.goals)throw new Error('invalid');state={...seed(),...parsed};save();closeModal();render();toast('Backup importado.');}catch{toast('Arquivo de backup inválido.');}};
    $('#resetBtn').onclick=()=>{if(confirm('Restaurar todos os dados de demonstração?')){reset();closeModal();}};
  }

  function openCommand(){
    openModal(`<div class="modal-head"><div><h2>Comando IA</h2><p>Escreva naturalmente. O sistema executa ações reconhecidas.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div><input id="commandInput" class="command-input" placeholder="Ex.: Tenho uma reunião amanhã às 15h por 90 minutos" autocomplete="off"/><div class="command-hints"><button class="hint">Adicione academia amanhã às 18h</button><button class="hint">Tenho uma reunião amanhã às 15h por 90 minutos</button><button class="hint">Reorganize meu dia</button><button class="hint">Quanto falta para minha meta financeira?</button></div><div id="commandResult" class="command-result"></div>`, 'command-modal');
    const input=$('#commandInput'); setTimeout(()=>input.focus(),80);
    $$('.hint').forEach(h=>h.onclick=()=>{input.value=h.textContent;executeCommand(input.value);});
    input.onkeydown=e=>{if(e.key==='Enter')executeCommand(input.value);};
  }

  function parseHour(txt){ const m=txt.match(/(?:às|as|@)\s*(\d{1,2})(?::(\d{2}))?\s*h?/i); if(!m)return'';return `${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2]||0)).padStart(2,'0')}`; }
  function parseDuration(txt){ const m=txt.match(/por\s+(\d+)\s*(?:min|minutos?)/i); if(m)return Number(m[1]); const h=txt.match(/por\s+(\d+(?:[.,]\d+)?)\s*h/i); return h?Math.round(Number(h[1].replace(',','.'))*60):60; }
  function executeCommand(raw){
    const txt=raw.trim(); if(!txt)return; let msg='Não entendi essa ação ainda. Tente adicionar uma tarefa, reunião, otimizar o dia ou perguntar sobre a meta financeira.';
    const lower=txt.toLowerCase(); const date=lower.includes('amanhã')||lower.includes('amanha')?addDays(todayISO(),1):lower.includes('hoje')?todayISO():currentDate;
    if(/reorganiz|otimiz/.test(lower)){ const c=optimizeDay(date,'Comando de IA'); msg=c.length?`Pronto. Reorganizei ${c.length} tarefa(s) flexível(is) em ${fmtDate(date)}.`:'A agenda já estava organizada sem conflitos.'; render(); }
    else if(/meta financeira|quanto falta/.test(lower)){const g=state.goals.find(x=>x.type==='finance'),cur=goalCurrent(g),left=Math.max(0,g.target-cur);msg=`A meta é ${formatGoalValue(g,g.target)}. Você registrou ${formatGoalValue(g,cur)} e faltam ${formatGoalValue(g,left)} (${Math.round(goalProgress(g)*100)}% concluído).`;}
    else if(/reuni[aã]o/.test(lower)){
      const start=parseHour(lower)||'15:00', duration=parseDuration(lower), title='Reunião'; addTask({title,date,start,duration,fixed:true,priority:3,category:'trabalho'});msg=`Reunião criada em ${fmtDate(date)}, ${start}, por ${duration} min. A agenda foi reanalisada automaticamente.`;
    } else if(/adicione|adicionar|crie|coloque/.test(lower)){
      const start=parseHour(lower); let title=txt.replace(/^(adicione|adicionar|crie|coloque)\s+/i,'').replace(/\s+(hoje|amanhã|amanha).*$/i,'').replace(/\s+às\s+.*$/i,'').trim(); if(!title)title='Nova tarefa'; const cat=/academia|treino/.test(lower)?'academia':/russo/.test(lower)?'russo':/tiktok/.test(lower)?'tiktok':'pessoal'; addTask({title,date,start,duration:60,fixed:!!start,priority:2,category:cat}); msg=`Adicionei “${title}” em ${fmtDate(date)}${start?` às ${start}`:''}.`;
    }
    const box=$('#commandResult'); if(box){box.textContent=msg;box.classList.add('show');}
    toast('Comando processado.');
  }

  function updateSpotify(){
    const status=$('#spotifyStatus'),btn=$('#spotifyToggle'); if(!status||!btn)return;
    if(state.settings.spotifyUrl){status.textContent='embed configurado';btn.textContent='Abrir';} else {status.textContent='não conectado';btn.textContent='Conectar';}
  }
  function spotifyAction(){
    if(state.settings.spotifyUrl){ openSpotifyModal(); }
    else { const url=prompt('Cole a URL de embed do Spotify (https://open.spotify.com/embed/...):',''); if(url){state.settings.spotifyUrl=url.trim();save();updateSpotify();openSpotifyModal();} }
  }
  function openSpotifyModal(){
    const url=state.settings.spotifyUrl;
    openModal(`<div class="modal-head"><div><h2>Spotify</h2><p>Player flutuante integrado ao workspace.</p></div><button class="icon-btn modal-close" style="width:32px;height:32px">×</button></div>${url?`<iframe title="Spotify" style="border:0;border-radius:20px;width:100%;height:352px" src="${esc(url)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`:`<div class="empty">Configure uma URL de embed do Spotify.</div>`}`);
  }

  function toast(text){
    const el=document.createElement('div');el.className='toast';el.textContent=text;$('#toastLayer').appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-8px)';setTimeout(()=>el.remove(),240)},2600);
  }

  function bindStatic(){
    $('#commandBtn').onclick=openCommand; $('#settingsBtn').onclick=openSettings; $('#spotifyToggle').onclick=spotifyAction;
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand();} if(e.key==='Escape')closeModal();});
    document.addEventListener('pointermove',e=>{
      if(matchMedia('(max-width:760px)').matches)return;
      const x=(e.clientX/window.innerWidth-.5), y=(e.clientY/window.innerHeight-.5);
      document.documentElement.style.setProperty('--mx',x); document.documentElement.style.setProperty('--my',y);
      const root=$('#viewRoot'); if(root&&!$('#modalLayer').classList.contains('open')) root.style.transform=`translateZ(18px) rotateX(${(-y*.65).toFixed(2)}deg) rotateY(${(x*.65).toFixed(2)}deg)`;
    });
    document.addEventListener('pointerleave',()=>{const root=$('#viewRoot');if(root)root.style.transform='translateZ(18px)';});
    if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  window.__OBJETIVOS__={getState:()=>JSON.parse(JSON.stringify(state)),optimizeDay,addTask,toggleTask,financeSummary,goalProgress,setView,executeCommand,detectFixedConflicts,reset};
  bindStatic(); render();
})();
