/* =========================================================
   Noi Due — spese di coppia (derivata da Bilancio 1.10.7)
   Stato persistito in localStorage, nessuna dipendenza esterna.
   ========================================================= */

const STORAGE_KEY = "noidue_v1";
const THEME_KEY = "noidue_theme";
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_BREVI = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const FREQ_LABEL = { weekly: "Ogni settimana", monthly: "Ogni mese", bimonthly:"Ogni 2 mesi", quarterly:"Ogni 3 mesi", semiannual:"Ogni 6 mesi", yearly: "Ogni anno" };

const PALETTE = ["#1F5D4C","#3AA684","#D4A83A","#A8322D","#6B7FD7","#C25B9E","#4FA8C9","#8A6A16","#5B7553","#946638","#E67E5F","#7A5CFA","#D84C7F","#159C9C","#B06428","#546E7A"];
const EMOJIS = ["🛒","🚗","💡","🏠","💊","🎬","👕","✈️","📚","🐾","☕","🍽️","🎁","💰","➕","📱","🏋️","🧾","🎓","🐶","🍔","🍕","🚌","🚆","⛽","🧾","💻","🎮","🎵","🎓","🏥","🧑‍💼","🏦","💳","🎯","🪙","📦","🔧","🌱","🎁","👶","🐱"];

/* ---------------- Utilities ---------------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function pad2(n){ return String(n).padStart(2,"0"); }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fmt(n){
  const v = Math.round((n||0)*100)/100;
  return "€" + v.toLocaleString("it-IT", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
function fmtSigned(n){ return (n>=0?"+":"−") + fmt(Math.abs(n)); }
/* Con il saldo nascosto le cifre dei grafici diventano pallini (non spariscono). */
function maskAmt(text,dots="••••"){ return balancesHidden ? dots : text; }
function parseAmount(str){
  if(!str) return 0;
  const cleaned = String(str).replace(/[€\s]/g,"").replace(",",".");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : Math.abs(v);
}
function autoGrowAmountInput(el){
  const grow = ()=>{ el.style.width = Math.max(2, el.value.length + 1) + "ch"; };
  el.addEventListener("input", grow);
  grow();
}
function stepDateISO(iso, freq, anchorISO=iso){
  const d = new Date(iso+"T00:00:00");
  const anchor = new Date(anchorISO+"T00:00:00");
  if(freq==="weekly"){
    d.setDate(d.getDate()+7);
  } else {
    const months = freq==="yearly" ? 12 : freq==="bimonthly" ? 2 : freq==="quarterly" ? 3 : freq==="semiannual" ? 6 : 1;
    const anchorDay = anchor.getDate();
    const anchorLastDay = new Date(anchor.getFullYear(), anchor.getMonth()+1, 0).getDate();
    const anchorIsEndOfMonth = anchorDay===anchorLastDay;
    const target = new Date(d.getFullYear(), d.getMonth()+months, 1);
    const targetLastDay = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
    target.setDate(anchorIsEndOfMonth ? targetLastDay : Math.min(anchorDay, targetLastDay));
    d.setTime(target.getTime());
  }
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

/* ---------------- Default seed data ---------------- */
function seedState(){
  const accId = { a: uid(), b: uid(), joint: uid() };
  const macroId = { casa: uid(), quotidiane: uid(), insieme: uid(), trasporti: uid(), entrate: uid() };
  const C=(name,emoji,color,kind,budget,macro)=>({ id: uid(), name, emoji, color, kind, budget, macroCategoryId: macro });
  const seedGroups = defaultGroups();
  return {
    couple: { a: { name: "Persona 1", color: "#3AA684" }, b: { name: "Persona 2", color: "#C25B9E" }, defaultSplit: "half", lastGroupId: null },
    groups: seedGroups,
    lists: defaultLists(seedGroups),
    accounts: [
      { id: accId.a, name: "Persona 1", balance: 0, color: "#3AA684", owner: "a" },
      { id: accId.b, name: "Persona 2", balance: 0, color: "#C25B9E", owner: "b" },
      { id: accId.joint, name: "Cassa comune", balance: 0, color: "#D4A83A", owner: "joint" },
    ],
    macroCategories: [
      { id: macroId.casa, name: "Casa e utenze", emoji: "🏠", color: PALETTE[4], budget: null, kind:"expense" },
      { id: macroId.quotidiane, name: "Spese quotidiane", emoji: "🛒", color: PALETTE[1], budget: 500, kind:"expense" },
      { id: macroId.insieme, name: "Tempo insieme", emoji: "🥂", color: PALETTE[5], budget: null, kind:"expense" },
      { id: macroId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], budget: null, kind:"expense" },
      { id: macroId.entrate, name: "Entrate", emoji: "💰", color: PALETTE[0], budget: null, kind:"income" },
    ],
    categories: [
      C("Affitto / mutuo","🔑",PALETTE[4],"expense",null,macroId.casa),
      C("Bollette","💡",PALETTE[2],"expense",150,macroId.casa),
      C("Casa","🏠",PALETTE[9],"expense",null,macroId.casa),
      C("Spesa","🛒",PALETTE[1],"expense",400,macroId.quotidiane),
      C("Farmacia","💊",PALETTE[3],"expense",null,macroId.quotidiane),
      C("Ristoranti","🍝",PALETTE[10],"expense",150,macroId.insieme),
      C("Svago","🎬",PALETTE[5],"expense",80,macroId.insieme),
      C("Viaggi","✈️",PALETTE[6],"expense",null,macroId.insieme),
      C("Regali","🎁",PALETTE[12],"expense",null,macroId.insieme),
      C("Trasporti","🚗",PALETTE[2],"expense",100,macroId.trasporti),
      C("Stipendio","💰",PALETTE[0],"income",null,macroId.entrate),
      C("Altre entrate","➕",PALETTE[7],"income",null,macroId.entrate),
    ],
    recurring: [],
    transactions: [],
    planned: [],
    trash: [],
    mainAccountId: accId.joint,
  };
}

/* ---------------- State load/save ---------------- */
const TRASH_MAX_ITEMS = 100;
const TRASH_RETENTION_DAYS = 90;
const BACKUP_WARNING_DAYS = 30;
let balanceCache = new Map();
let state = load();
let balancesHidden = localStorage.getItem("noidue_hide_balances") !== "0";
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return seedState();
    const parsed = JSON.parse(raw);
    if(!parsed.accounts || !parsed.categories) return seedState();
    return migrate(parsed);
  }catch(e){ return seedState(); }
}
function migrate(parsed){
  // Aggiunge le macrocategorie a stati salvati prima della loro introduzione.
  if(!Array.isArray(parsed.macroCategories)) parsed.macroCategories = [];
  parsed.macroCategories.forEach(m=>{
    if(m.budget===undefined) m.budget = null;
    if(!m.kind){
      const linked=parsed.categories.find(c=>c.macroCategoryId===m.id);
      m.kind=linked?.kind || (/entrate|stipendio/i.test(m.name)?"income":"expense");
    }
  });
  parsed.categories.forEach(c=>{ if(c.macroCategoryId===undefined) c.macroCategoryId = null; });
  if(!Array.isArray(parsed.recurring)) parsed.recurring = [];
  parsed.recurring.forEach(r=>{
    if(r.active===undefined) r.active=true;
    if(r.endDate===undefined) r.endDate="";
    if(r.maxOccurrences===undefined) r.maxOccurrences=null;
  });
  if(!Array.isArray(parsed.planned)) parsed.planned = [];
  if(!Array.isArray(parsed.trash)) parsed.trash = [];
  if(parsed.mainAccountId===undefined) parsed.mainAccountId = null;
  if(parsed.mainAccountId && !parsed.accounts.some(a=>String(a.id)===String(parsed.mainAccountId))) parsed.mainAccountId = null;
  parsed.trash = pruneTrashArray(parsed.trash);
  sanitizeLoadedState(parsed);
  sanitizeCouple(parsed);
  // I modelli rapidi sono stati sostituiti da categorie/macrocategorie: rimuovi eventuali residui.
  delete parsed.templates;
  return parsed;
}
function sanitizeLoadedState(data){
  const text=(value,max=240)=>String(value ?? "").slice(0,max);
  const id=value=>text(value,120);
  const date=(value,fallback="")=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):fallback;
  const amount=value=>{const n=Number(value);return Number.isFinite(n)?Math.abs(n):0;};
  const signed=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  data.accounts=(Array.isArray(data.accounts)?data.accounts:[]).map(a=>({...a,id:id(a.id),name:text(a.name,120),balance:signed(a.balance),color:safeColor(a.color,PALETTE[0])}));
  data.mainAccountId=data.mainAccountId==null?null:id(data.mainAccountId);
  if(data.mainAccountId && !data.accounts.some(a=>a.id===data.mainAccountId)) data.mainAccountId=null;
  data.macroCategories=(Array.isArray(data.macroCategories)?data.macroCategories:[]).map(m=>({...m,id:id(m.id),name:text(m.name,120),emoji:text(m.emoji,12),color:safeColor(m.color,PALETTE[0]),kind:m.kind==="income"?"income":"expense",budget:m.budget==null?null:amount(m.budget)}));
  data.categories=(Array.isArray(data.categories)?data.categories:[]).map(c=>({...c,id:id(c.id),name:text(c.name,120),emoji:text(c.emoji,12),color:safeColor(c.color,PALETTE[0]),kind:c.kind==="income"?"income":"expense",budget:c.budget==null?null:amount(c.budget),macroCategoryId:c.macroCategoryId==null?null:id(c.macroCategoryId)}));
  data.transactions=(Array.isArray(data.transactions)?data.transactions:[]).map(t=>({...t,id:id(t.id),date:date(t.date,todayISO()),amount:amount(t.amount),type:["income","expense","transfer"].includes(t.type)?t.type:"expense",name:text(t.name,160),note:text(t.note,500),categoryId:t.categoryId==null?null:id(t.categoryId),accountId:t.accountId==null?null:id(t.accountId),toAccountId:t.toAccountId==null?null:id(t.toAccountId),recurringId:t.recurringId==null?undefined:id(t.recurringId),plannedId:t.plannedId==null?undefined:id(t.plannedId)}));
  const freqs=new Set(["weekly","monthly","bimonthly","quarterly","semiannual","yearly"]);
  data.recurring=(Array.isArray(data.recurring)?data.recurring:[]).map(r=>({...r,id:id(r.id),name:text(r.name,160),note:text(r.note,500),amount:amount(r.amount),type:r.type==="income"?"income":"expense",categoryId:r.categoryId==null?null:id(r.categoryId),accountId:r.accountId==null?null:id(r.accountId),freq:freqs.has(r.freq)?r.freq:"monthly",startDate:date(r.startDate,todayISO()),nextDate:date(r.nextDate,date(r.startDate,todayISO())),endDate:date(r.endDate,""),active:r.active!==false,maxOccurrences:Number.isFinite(Number(r.maxOccurrences))&&Number(r.maxOccurrences)>0?Math.floor(Number(r.maxOccurrences)):null}));
  data.planned=(Array.isArray(data.planned)?data.planned:[]).map(p=>({...p,id:id(p.id),name:text(p.name,160),note:text(p.note,500),amount:amount(p.amount),type:p.type==="income"?"income":"expense",categoryId:p.categoryId==null?null:id(p.categoryId),accountId:p.accountId==null?null:id(p.accountId),date:date(p.date,todayISO()),recurringId:p.recurringId==null?undefined:id(p.recurringId)}));
}
function pruneTrashArray(items){
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate()-TRASH_RETENTION_DAYS);
  const cutoffISO = `${cutoff.getFullYear()}-${pad2(cutoff.getMonth()+1)}-${pad2(cutoff.getDate())}`;
  return (Array.isArray(items)?items:[])
    .filter(entry=>!entry.deletedAt || String(entry.deletedAt).slice(0,10)>=cutoffISO)
    .slice(0,TRASH_MAX_ITEMS);
}
function safeSetLocalStorage(key,value,{notify=true}={}){
  try{
    localStorage.setItem(key,value);
    return true;
  }catch(err){
    console.error("Impossibile salvare in localStorage",err);
    if(notify) showToast("Spazio di archiviazione esaurito: esporta un backup e libera spazio");
    return false;
  }
}
function persist(){
  balanceCache.clear();
  state.updatedAt=new Date().toISOString();
  state.trash = pruneTrashArray(state.trash);
  return safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
}
function toggleBalances(){balancesHidden=!balancesHidden;safeSetLocalStorage("noidue_hide_balances",balancesHidden?"1":"0",{notify:false});renderAll();}
function moveToTrash(kind, item){
  if(!Array.isArray(state.trash)) state.trash=[];
  state.trash.unshift({id:uid(),kind,data:JSON.parse(JSON.stringify(item)),deletedAt:todayISO()});
  state.trash=pruneTrashArray(state.trash);
}
function restoreTrashItem(trashId){
  const entry=state.trash.find(x=>x.id===trashId); if(!entry) return;
  if(entry.kind==="transaction") state.transactions.push(entry.data);
  if(entry.kind==="planned") state.planned.push(entry.data);
  if(entry.kind==="recurring") state.recurring.push(entry.data);
  state.trash=state.trash.filter(x=>x.id!==trashId);
  sanitizeLoadedState(state);
  if(entry.kind==="recurring") refreshRecurringTransactions(String(entry.data.id));
  if(entry.kind==="planned") generatePlannedTransactions();
  persist();renderAll();
}

/* ---------------- Tema (chiaro/scuro/sistema) ---------------- */
const systemDarkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function effectiveTheme(mode){
  if(mode==="system") return (systemDarkMQ && systemDarkMQ.matches) ? "dark" : "light";
  return mode;
}
function applyTheme(mode){
  const theme = effectiveTheme(mode);
  document.documentElement.setAttribute("data-theme", theme);
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  if(themeMeta) themeMeta.setAttribute("content", theme==="dark" ? "#12181F" : "#F1F2ED");
  document.querySelectorAll("#themeModeToggle .type-opt").forEach(opt=>{
    opt.classList.toggle("active", opt.dataset.themeMode===mode);
  });
}
let currentThemeMode = localStorage.getItem(THEME_KEY) || "system";
applyTheme(currentThemeMode);
if(systemDarkMQ){
  systemDarkMQ.addEventListener("change", ()=>{
    if(currentThemeMode==="system") applyTheme(currentThemeMode);
  });
}

/* ---------------- View / month state ---------------- */
const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0-indexed
let activeView = "home";
let txFilter = "all";
let txSearchQuery="", txDateFrom="", txDateTo="";
const TX_PAGE_SIZE=50;
let txVisibleLimit=TX_PAGE_SIZE;
let txSearchTimer=null;
let rpMode = "total";
let viewDay = now.getDate();
const periodModes = {home:"month", recurring:"month", stats:"month", transactions:"month", rpall:"month"};
let rpAllKind="total", rpAllQuery="";
function selectedDate(){return `${viewYear}-${pad2(viewMonth+1)}-${pad2(viewDay)}`;}
/* v1.7.0 — Periodo: mese intero, singolo giorno oppure intervallo di giorni (anche tra mesi diversi). */
let periodRange={from:null,to:null};
function periodBounds(view){
  const mode=periodModes[view]||"month";
  if(mode==="day"){const d=selectedDate();return {from:d,to:d};}
  if(mode==="range" && periodRange.from && periodRange.to) return {from:periodRange.from,to:periodRange.to};
  return {from:`${viewYear}-${pad2(viewMonth+1)}-01`,to:`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`};
}
function inPeriod(view,iso){ if(!iso) return false; const b=periodBounds(view); return iso>=b.from && iso<=b.to; }
function shortDate(iso,withYear=false){const d=new Date(iso+"T00:00:00");return `${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${withYear?" "+d.getFullYear():""}`;}
function periodLabel(view){
  const mode=periodModes[view]||"month";
  if(mode==="day"){const d=new Date(selectedDate()+"T00:00:00");const wd=["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d.getDay()];return `${wd} ${d.getDate()} ${MESI[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;}
  if(mode==="range" && periodRange.from){
    const a=new Date(periodRange.from+"T00:00:00"), b=new Date(periodRange.to+"T00:00:00");
    if(a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MESI[a.getMonth()].toLowerCase()} ${a.getFullYear()}`;
    return `${shortDate(periodRange.from,a.getFullYear()!==b.getFullYear())} – ${shortDate(periodRange.to,true)}`;
  }
  return `${MESI[viewMonth]} ${viewYear}`;
}
function periodSubLabel(view){const m=periodModes[view]||"month";return m==="day"?"Solo questo giorno":m==="range"?"Periodo scelto":"Tutto il mese";}
function monthsInPeriod(view){
  const b=periodBounds(view); const out=[];
  let d=new Date(b.from+"T00:00:00"); d=new Date(d.getFullYear(),d.getMonth(),1);
  const end=new Date(b.to+"T00:00:00");
  while(d<=end && out.length<36){out.push([d.getFullYear(),d.getMonth()]);d=new Date(d.getFullYear(),d.getMonth()+1,1);}
  return out;
}
function plannedItemsInPeriod(view){
  return monthsInPeriod(view).flatMap(([y,m])=>plannedItemsForMonth(y,m)).filter(t=>inPeriod(view,t.date));
}
function periodTx(view){
  if((periodModes[view]||"month")==="month") return monthTx();
  return state.transactions.filter(t=>inPeriod(view,t.date));
}
function sumTransactions(tx){
  const income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,net:income-expense};
}
function moneyColor(value){return value>0?"var(--emerald)":value<0?"var(--rust)":"var(--ink)";}

/* ---------------- Noi Due — logica di coppia ----------------
   Ogni conto appartiene a una persona ("a", "b") o è "joint" (comune).
   Una spesa pagata da un conto personale si divide con t.split:
     half = a metà · pct = percentuale (pctA = quota di A) · other = tutto all'altro · personal = solo chi paga.
   Le spese dal conto comune non creano debiti. Un trasferimento tra conti di persone diverse è un rimborso.
   Saldo di coppia > 0: B deve ad A. */
// Funzione (non const): sanitizeCouple gira già durante load(), prima che le const più in basso esistano.
function coupleDefaults(){ return {a:{name:"Persona 1",color:"#3AA684"},b:{name:"Persona 2",color:"#C25B9E"},defaultSplit:"half"}; }
function sanitizeCouple(data){
  const c=data.couple&&typeof data.couple==="object"?data.couple:{};
  const COUPLE_DEFAULT=coupleDefaults();
  const person=(p,def)=>({name:String(p?.name||def.name).trim().slice(0,24)||def.name,color:safeColor(p?.color,def.color)});
  data.couple={a:person(c.a,COUPLE_DEFAULT.a),b:person(c.b,COUPLE_DEFAULT.b),defaultSplit:c.defaultSplit==="personal"?"personal":"half",lastGroupId:c.lastGroupId?String(c.lastGroupId):null};
  (data.accounts||[]).forEach(a=>{ if(!["a","b","joint"].includes(a.owner)) a.owner="joint"; });
  if(["a","b","joint"].includes(c.lastPayer)) data.couple.lastPayer=c.lastPayer;
  // Noi Due 1.4.0: niente conti. Ci sono solo tre "pagatori": persona 1, persona 2 e cassa comune.
  // I conti in più di una stessa persona vengono uniti; i giroconti tra di loro spariscono.
  if(!Array.isArray(data.accounts)) data.accounts=[];
  const canon={};
  ["a","b","joint"].forEach(o=>{ const first=data.accounts.find(a=>a.owner===o); if(first) canon[o]=first.id; else { const acc={id:uid(),name:"",balance:0,color:"#D4A83A",owner:o}; data.accounts.push(acc); canon[o]=acc.id; } });
  const remap={}; data.accounts.forEach(a=>{ if(canon[a.owner]!==a.id) remap[a.id]=canon[a.owner]; });
  if(Object.keys(remap).length){
    const m=id=>remap[id]||id;
    ["transactions","recurring","planned"].forEach(k=>{ data[k]=(data[k]||[]).map(t=>({...t,accountId:m(t.accountId),toAccountId:t.toAccountId?m(t.toAccountId):t.toAccountId})).filter(t=>!(t.type==="transfer"&&t.accountId===t.toAccountId)); });
    if(data.mainAccountId) data.mainAccountId=m(data.mainAccountId);
  }
  data.accounts=["a","b","joint"].map(o=>{ const acc=data.accounts.find(a=>a.id===canon[o]); return {...acc,owner:o,name:o==="joint"?"Cassa comune":data.couple[o].name,color:o==="joint"?"#D4A83A":data.couple[o].color}; });
  data.mainAccountId=canon.joint;
  // Gruppi (Casa, Spese di coppia, …): ognuno ha il suo saldo; il totale è la somma.
  data.groups=(Array.isArray(data.groups)?data.groups:[]).filter(g=>g&&g.id).map(g=>({id:String(g.id).slice(0,120),name:String(g.name||"Gruppo").slice(0,40),emoji:cleanEmoji(String(g.emoji||"👥"))||"👥",color:safeColor(g.color,PALETTE[4]),defaultSplit:g.defaultSplit==="personal"?"personal":"half"}));
  if(!data.groups.length) data.groups=defaultGroups();
  const ids=new Set(data.groups.map(g=>g.id));
  const fallback=(data.groups.find(g=>/coppia/i.test(g.name))||data.groups[0]).id;
  [...(data.transactions||[]),...(data.recurring||[]),...(data.planned||[])].forEach(t=>{ if(t.groupId!=null && !ids.has(t.groupId)) t.groupId=fallback; if(t.groupId==null && t.type!=="transfer") t.groupId=fallback; });
  (data.transactions||[]).forEach(t=>{ if(t.settleAlloc){ Object.keys(t.settleAlloc).forEach(k=>{ if(!ids.has(k)){ t.settleAlloc[fallback]=(t.settleAlloc[fallback]||0)+t.settleAlloc[k]; delete t.settleAlloc[k]; } }); } });
  if(data.couple.lastGroupId && !ids.has(data.couple.lastGroupId)) data.couple.lastGroupId=null;
  // Liste della spesa / cose da comprare.
  if(!Array.isArray(data.lists)) data.lists=defaultLists(data.groups);
  data.lists=data.lists.filter(l=>l&&l.id).map(l=>({id:String(l.id).slice(0,120),name:String(l.name||"Lista").slice(0,40),emoji:cleanEmoji(String(l.emoji||"🛒"))||"🛒",groupId:ids.has(l.groupId)?l.groupId:fallback,
    items:(Array.isArray(l.items)?l.items:[]).filter(i=>i&&i.id).map(i=>({id:String(i.id).slice(0,120),text:String(i.text||"").slice(0,120),price:Number.isFinite(Number(i.price))&&Number(i.price)>0?Math.round(Number(i.price)*100)/100:null,done:!!i.done,
      code:String(i.code||"").replace(/[^0-9A-Za-z-]/g,"").slice(0,32),image:/^https:\/\//.test(String(i.image||""))?String(i.image).slice(0,500):"",url:/^https:\/\//.test(String(i.url||""))?String(i.url).slice(0,500):"",
      photo:/^data:image\/(jpeg|png|webp);base64,/.test(String(i.photo||""))&&String(i.photo).length<300000?String(i.photo):""}))}));
  // Elementi eliminati (liste, articoli, gruppi, conti, categorie): servono a unire i backup senza farli ricomparire.
  const del=data.deleted&&typeof data.deleted==="object"?data.deleted:{};
  const cut=new Date(); cut.setDate(cut.getDate()-180); const cutISO=`${cut.getFullYear()}-${pad2(cut.getMonth()+1)}-${pad2(cut.getDate())}`;
  data.deleted=Object.fromEntries(Object.entries(del).filter(([k,v])=>k&&/^\d{4}-\d{2}-\d{2}$/.test(String(v))&&v>=cutISO).slice(-5000));
}
function defaultLists(groups){
  const casa=(groups.find(g=>/casa/i.test(g.name))||groups[0])?.id, coppia=(groups.find(g=>/coppia/i.test(g.name))||groups[0])?.id;
  return [
    {id:uid(),name:"Spesa",emoji:"🛒",groupId:coppia,items:[]},
    {id:uid(),name:"Per la casa",emoji:"🏠",groupId:casa,items:[]},
  ];
}
function defaultGroups(){
  return [
    {id:uid(),name:"Casa",emoji:"🏠",color:"#6B7FD7",defaultSplit:"half"},
    {id:uid(),name:"Spese di coppia",emoji:"💑",color:"#C25B9E",defaultSplit:"half"},
    {id:uid(),name:"Viaggi",emoji:"✈️",color:"#159C9C",defaultSplit:"half"},
  ];
}
function groupsById(){ return Object.fromEntries(state.groups.map(g=>[g.id,g])); }
function defaultPayerId(){
  const o=["a","b","joint"].includes(state.couple?.lastPayer)?state.couple.lastPayer:"a";
  return state.accounts.find(a=>a.owner===o)?.id || state.accounts[0]?.id || null;
}
function defaultGroupId(){
  const last=state.couple.lastGroupId;
  if(last && state.groups.some(g=>g.id===last)) return last;
  return (state.groups.find(g=>/coppia/i.test(g.name))||state.groups[0])?.id||null;
}
function groupOf(t){ return state.groups.some(g=>g.id===t.groupId) ? t.groupId : (state.groups.find(g=>/coppia/i.test(g.name))||state.groups[0])?.id; }
function groupLabel(gid){ const g=groupsById()[gid]; return g?`${g.emoji} ${g.name}`:"Gruppo"; }
function personName(k){ return k==="a"||k==="b" ? state.couple[k].name : "Cassa comune"; }
function personColor(k){ return k==="a"||k==="b" ? state.couple[k].color : "#D4A83A"; }
function personInitial(k){ return (personName(k).trim()[0]||(k==="a"?"1":"2")).toUpperCase(); }
function otherPerson(k){ return k==="a"?"b":"a"; }
function accOwner(id){ return state.accounts.find(a=>a.id===id)?.owner || "joint"; }
function ownerLabel(owner){ return owner==="a"||owner==="b" ? `Di ${personName(owner)}` : "Comune"; }
function defaultSplitFor(type,gid=null){
  if(type==="income") return "personal";
  const g=gid?groupsById()[gid]:null;
  return g?.defaultSplit || state.couple.defaultSplit || "half";
}
function splitShareA(split,owner,type,gid=null){
  const mode=split?.mode || defaultSplitFor(type,gid);
  if(mode==="pct") return Math.min(100,Math.max(0,Number(split?.pctA ?? 50)))/100;
  if(mode==="other") return owner==="a"?0:1;
  if(mode==="personal") return owner==="a"?1:0;
  return 0.5;
}
function txDebt(t){
  if(!t || t.isBalanceAdjustment) return 0;
  const amount=Number(t.amount)||0;
  if(t.type==="transfer"){
    const from=accOwner(t.accountId), to=accOwner(t.toAccountId);
    if(from==="a"&&to==="b") return amount;
    if(from==="b"&&to==="a") return -amount;
    return 0;
  }
  const owner=accOwner(t.accountId);
  if(owner!=="a"&&owner!=="b") return 0;
  const shareA=splitShareA(t.split,owner,t.type,t.groupId);
  const v=owner==="a" ? amount*(1-shareA) : -amount*shareA;
  return t.type==="income" ? -v : v;
}
function isCoupleSettle(t){ return t.type==="transfer" && txDebt(t)!==0; }
function coupleBalance(){
  const today=todayISO();
  return Math.round(state.transactions.filter(t=>t.date<=today).reduce((s,t)=>s+txDebt(t),0)*100)/100;
}
/* Quota di un movimento in un gruppo. Un rimborso "di tutti i gruppi" porta in settleAlloc
   la parte assegnata a ciascun gruppo (la somma è uguale al rimborso). */
function txDebtIn(t,gid){
  if(t.settleAlloc) return Number(t.settleAlloc[gid])||0;
  return groupOf(t)===gid ? txDebt(t) : 0;
}
function rescaleAlloc(t){
  const target=txDebt(t), keys=Object.keys(t.settleAlloc||{});
  const sum=keys.reduce((s,k)=>s+(Number(t.settleAlloc[k])||0),0);
  if(!keys.length||Math.abs(sum)<0.005){ delete t.settleAlloc; return; }
  keys.forEach(k=>{ t.settleAlloc[k]=Math.round(t.settleAlloc[k]*target/sum*100)/100; });
  const diff=Math.round((target-keys.reduce((s,k)=>s+t.settleAlloc[k],0))*100)/100;
  if(diff){ const big=keys.reduce((m,k)=>Math.abs(t.settleAlloc[k])>Math.abs(t.settleAlloc[m])?k:m,keys[0]); t.settleAlloc[big]=Math.round((t.settleAlloc[big]+diff)*100)/100; }
}
function groupBalance(gid){
  const today=todayISO();
  return Math.round(state.transactions.filter(t=>t.date<=today).reduce((s,t)=>s+txDebtIn(t,gid),0)*100)/100;
}
function debtSentence(v,{future=false}={}){
  if(Math.abs(v)<0.005) return "Siete in pari";
  const debtor=v>0?"b":"a", creditor=otherPerson(debtor);
  return `${personName(debtor)} ${future?"dovrà":"deve"} ${fmt(Math.abs(v))} a ${personName(creditor)}`;
}
function splitLabel(t){
  if(t.type==="transfer"||t.isBalanceAdjustment) return "";
  const owner=accOwner(t.accountId);
  if(owner!=="a"&&owner!=="b") return "comune";
  const mode=t.split?.mode || defaultSplitFor(t.type,t.groupId);
  if(mode==="half") return "a metà";
  if(mode==="pct"){const p=Math.round(Number(t.split?.pctA ?? 50));return `${p}/${100-p}`;}
  if(mode==="other") return `per ${personName(otherPerson(owner))}`;
  return "personale";
}
function coupleMonthStats(y,m,gid=null){
  const prefix=`${y}-${pad2(m+1)}`;
  const tx=state.transactions.filter(t=>t.date.startsWith(prefix) && t.type==="expense" && !t.isBalanceAdjustment && (!gid || groupOf(t)===gid));
  const out={paid:{a:0,b:0,joint:0},quota:{a:0,b:0},shared:[]};
  tx.forEach(t=>{
    const owner=accOwner(t.accountId);
    out.paid[owner==="a"||owner==="b"?owner:"joint"]+=t.amount;
    if(owner==="a"||owner==="b"){
      const sA=splitShareA(t.split,owner,t.type,t.groupId);
      out.quota.a+=t.amount*sA; out.quota.b+=t.amount*(1-sA);
      if(Math.abs(txDebt(t))>=0.005) out.shared.push(t);
    }
  });
  return out;
}
/* Campi "Gruppo" e "Come dividere" riutilizzati da movimento, ricorrente, pianificato e trasferimento. */
function mountSplitPicker(node, afterRow, {account, toAccount=()=>null, type, amount, initial, initialGroup=null}){
  const row=document.createElement("div");
  row.className="field-row split-field";
  row.innerHTML=`<label class="grp-lbl">Gruppo</label><div class="chip-row group-chips"></div>
    <label class="split-lbl">Come dividere</label><div class="chip-row split-chips"></div>
    <div class="split-custom" hidden><span class="sc-a"></span><input type="range" min="0" max="100" step="5" aria-label="Percentuale a carico della persona 1"><span class="sc-b"></span></div>
    <p class="field-hint split-hint"></p>`;
  afterRow.after(row);
  let mode=initial?.mode || null;
  let groupId=state.groups.some(g=>g.id===initialGroup)?initialGroup:defaultGroupId();
  const chips=row.querySelector(".split-chips"), custom=row.querySelector(".split-custom"), range=custom.querySelector("input"), hint=row.querySelector(".split-hint"), label=row.querySelector(".split-lbl");
  const gChips=row.querySelector(".group-chips"), gLabel=row.querySelector(".grp-lbl");
  range.value=String(Number.isFinite(Number(initial?.pctA))?Number(initial.pctA):50);
  function get(){ return {mode:mode||defaultSplitFor(type(),groupId), pctA:Number(range.value)}; }
  function renderGroups(show){
    gChips.hidden=!show; gLabel.hidden=!show;
    if(!show) return;
    gChips.innerHTML=state.groups.map(g=>`<button type="button" class="chip${g.id===groupId?" active":""}" data-group="${escapeHtml(g.id)}"><span class="em">${escapeHtml(g.emoji)}</span>${escapeHtml(g.name)}</button>`).join("");
    gChips.querySelectorAll("[data-group]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();groupId=b.dataset.group;refresh();}));
  }
  function refresh(){
    const t=type(), owner=accOwner(account());
    row.hidden=false; label.hidden=false; chips.hidden=false;
    if(t==="transfer"){
      const to=toAccount()?accOwner(toAccount()):null;
      chips.hidden=true; custom.hidden=true; label.hidden=true;
      const settle=to && (owner==="a"||owner==="b") && (to==="a"||to==="b") && owner!==to;
      renderGroups(!!settle);
      hint.textContent=settle?`🤝 Conta come rimborso nel gruppo scelto: ${personName(owner)} dà a ${personName(to)}.`:"";
      row.hidden=!settle; return;
    }
    renderGroups(true);
    if(owner!=="a"&&owner!=="b"){
      chips.hidden=true; custom.hidden=true; label.hidden=true;
      hint.textContent="Dalla cassa comune: non cambia il saldo tra voi."; return;
    }
    const cur=mode||defaultSplitFor(t,groupId), other=otherPerson(owner);
    const opts=[["half","A metà"],["pct","Percentuale"],["other",`Tutto a ${personName(other)}`],["personal",`Solo ${personName(owner)}`]];
    chips.innerHTML=opts.map(([k,l])=>`<button type="button" class="chip${cur===k?" active":""}" data-split="${k}">${escapeHtml(l)}</button>`).join("");
    chips.querySelectorAll("[data-split]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();mode=b.dataset.split;refresh();}));
    custom.hidden=cur!=="pct";
    custom.querySelector(".sc-a").textContent=`${personName("a")} ${range.value}%`;
    custom.querySelector(".sc-b").textContent=`${100-Number(range.value)}% ${personName("b")}`;
    const amt=amount();
    const v=txDebt({type:t,amount:amt||0,accountId:account(),split:get(),groupId});
    hint.textContent=amt>0 ? (Math.abs(v)<0.005 ? (t==="income"?"Entrata personale: non cambia il saldo tra voi.":"Spesa personale: non cambia il saldo tra voi.") : debtSentence(v,{future:true})+".") : "";
  }
  range.addEventListener("input",refresh);
  node.addEventListener("click",()=>setTimeout(refresh,0));
  node.addEventListener("input",e=>{ if(e.target!==range) refresh(); });
  refresh();
  return {get,refresh,getGroup:()=>{ state.couple.lastGroupId=groupId; return groupId; }};
}

let txType = "expense";
let selectedCategoryId = null;
let selectedAccountId = null;
let statsGroupMode = "category", statsNature="expense";

/* ---------------- Helpers on state ---------------- */
function accountsById(){ return Object.fromEntries(state.accounts.map(a=>[a.id,a])); }
function categoriesById(){ return Object.fromEntries(state.categories.map(c=>[c.id,c])); }
function macroCategoriesById(){ return Object.fromEntries(state.macroCategories.map(m=>[m.id,m])); }

/* Picker categoria: la macrocategoria è un filtro, ma all'apertura vengono
   mostrate tutte le categorie. Così una categoria appena creata è sempre
   disponibile subito nel nuovo movimento. */
function renderCategoryPicker(container, kind, getSelected, onSelect){
  const macros = macroCategoriesById();
  const cats = state.categories.filter(c=>c.kind===kind);
  const groups = new Map();
  cats.forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  const macroOrder = state.macroCategories.filter(m=>groups.has(m.id)).map(m=>m.id);
  if(groups.has("none")) macroOrder.push("none");

  const selId = getSelected();
  const selCat = cats.find(c=>c.id===selId);
  let activeMacro = container._activeMacro;
  if(selCat) activeMacro = selCat.macroCategoryId && macros[selCat.macroCategoryId] ? selCat.macroCategoryId : "none";
  if(!activeMacro || (activeMacro!=="all" && !groups.has(activeMacro))) activeMacro = "all";
  container._activeMacro = activeMacro;

  container.innerHTML = "";
  const showMacroRow = macroOrder.length>1 || (macroOrder.length===1 && macroOrder[0]!=="none");

  if(showMacroRow){
    const macroWrap = document.createElement("div");
    macroWrap.className = "chip-group";
    macroWrap.innerHTML = `<p class="chip-group-title">Macrocategoria</p>`;
    const macroRow = document.createElement("div");
    macroRow.className = "chip-row";
    ["all", ...macroOrder].forEach(key=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (activeMacro===key ? " active":"");
      chip.innerHTML = key==="all" ? `Tutte` : key==="none" ? `<span class="em">🏷️</span>Altre` : `<span class="em">${escapeHtml(macros[key].emoji)}</span>${escapeHtml(macros[key].name)}`;
      chip.addEventListener("click", ()=>{
        container._activeMacro = key;
        const list = key==="all" ? cats : (groups.get(key) || []);
        if(!list.find(c=>c.id===getSelected())) onSelect(list[0]?.id || null);
        renderCategoryPicker(container, kind, getSelected, onSelect);
      });
      macroRow.appendChild(chip);
    });
    macroWrap.appendChild(macroRow);
    container.appendChild(macroWrap);
  }

  const catWrap = document.createElement("div");
  catWrap.className = "chip-group";
  catWrap.innerHTML = `<p class="chip-group-title">Categoria</p>`;
  const catRow = document.createElement("div");
  catRow.className = "chip-row";
  const currentList = activeMacro==="all" ? cats : (groups.get(activeMacro) || []);
  currentList.forEach(c=>{
    const chip = document.createElement("button");
    chip.className = "chip" + (getSelected()===c.id ? " active":"");
    chip.innerHTML = `<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}`;
    chip.addEventListener("click", ()=>{
      onSelect(c.id);
      renderCategoryPicker(container, kind, getSelected, onSelect);
    });
    catRow.appendChild(chip);
  });
  catWrap.appendChild(catRow);
  container.appendChild(catWrap);

  if(!currentList.find(c=>c.id===getSelected())) onSelect(currentList[0]?.id || null);
}
function monthTx(y=viewYear, m=viewMonth){
  const prefix = `${y}-${pad2(m+1)}`;
  return state.transactions.filter(t=>t.date.startsWith(prefix));
}
function sortedMonthTx(y=viewYear,m=viewMonth){
  return monthTx(y,m).slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function monthTotals(y=viewYear,m=viewMonth){
  const tx = monthTx(y,m);
  let income=0, expense=0;
  tx.forEach(t=>{ if(t.type==="income") income+=t.amount; else if(t.type==="expense") expense+=t.amount; });
  return { income, expense, net: income-expense };
}
function accountBalance(accId){
  if(balanceCache.has(accId)) return balanceCache.get(accId);
  const start = state.accounts.find(a=>a.id===accId)?.balance || 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  const value=start+delta;
  balanceCache.set(accId,value);
  return value;
}
function totalBalance(){
  return state.accounts.reduce((sum,a)=> sum + accountBalance(a.id), 0);
}
function accountBalanceAt(accId, y, m){
  // Saldo del conto al termine del mese y-m (incluso).
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return 0;
  const cutoff = `${y}-${pad2(m+1)}-31`;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.date>cutoff) return sum;
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}
function accountBalanceAtDate(accId, iso){
  // Saldo del conto al termine della giornata iso (incluso).
  const acc = state.accounts.find(a=>a.id===accId);
  if(!acc) return 0;
  const delta = state.transactions.reduce((sum,t)=>{
    if(t.date>iso) return sum;
    if(t.type==="transfer") return sum + (t.accountId===accId ? -t.amount : t.toAccountId===accId ? t.amount : 0);
    if(t.accountId!==accId) return sum;
    return sum + (t.type==="income" ? t.amount : -t.amount);
  },0);
  return acc.balance + delta;
}
function totalBalanceAtDate(iso){return state.accounts.reduce((sum,a)=>sum+accountBalanceAtDate(a.id,iso),0);}
function previousISO(iso){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()-1);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}

function recurringOccurrenceIndex(r,date){
  if(!r?.startDate || !date) return null;
  let d=r.startDate, index=1, safety=0;
  while(d<date && safety<2000){ d=stepDateISO(d,r.freq,r.startDate); index++; safety++; }
  return d===date ? index : null;
}
function recurringDateWithinLimits(r,date){
  if(!date) return false;
  if(r.endDate && date>r.endDate) return false;
  const max=Number(r.maxOccurrences)||0;
  if(max>0){
    const index=recurringOccurrenceIndex(r,date);
    if(!index || index>max) return false;
  }
  return true;
}
function recurringDurationLabel(r){
  const max=Number(r?.maxOccurrences)||0;
  if(max>0) return `${max} ${max===1?"rata":"rate"}`;
  if(r?.endDate) return `Fino al ${r.endDate.split("-").reverse().join("/")}`;
  return "Senza scadenza";
}

/* ---------------- Movimenti ricorrenti ---------------- */
function generateRecurringTransactions(askConfirmation=false){
  const todayStr = todayISO();
  const due=state.recurring.filter(r=>{const next=r.nextDate||r.startDate;return r.active!==false && next && next<=todayStr && recurringDateWithinLimits(r,next);});
  if(askConfirmation && due.length && !confirm(`Oggi verranno registrati: ${due.slice(0,4).map(r=>r.name||"Ricorrente").join(", ")}${due.length>4?" e altri":""}. Confermi?`)) return;
  let changed = false;
  state.recurring.forEach(r=>{
    if(!r.nextDate) r.nextDate = r.startDate;
    let safety = 0;
    while(r.active!==false && r.nextDate <= todayStr && recurringDateWithinLimits(r,r.nextDate) && safety < 1000){
      if(!state.transactions.some(t=>t.recurringId===r.id && t.date===r.nextDate)){
        state.transactions.push({
          id: uid(), date: r.nextDate, amount: r.amount, type: r.type,
          categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", recurringId: r.id, split: r.split || null, groupId: r.groupId || null,
        });
      }
      r.nextDate = stepDateISO(r.nextDate, r.freq, r.startDate);
      changed = true;
      safety++;
    }
  });
  if(changed) persist();
}
function refreshRecurringTransactions(recurringId){
  const rec = state.recurring.find(r=>r.id===recurringId);
  if(!rec) return;
  const today = todayISO();
  // Lo storico già contabilizzato è immutabile: una modifica alla ricorrenza
  // cambia solo l'occorrenza odierna (se ancora dovuta) e quelle future.
  state.transactions = state.transactions.filter(t=>t.recurringId!==recurringId || t.date<today);
  rec.nextDate = rec.startDate;
  let safety=0;
  while(rec.nextDate && rec.nextDate<today && safety<2000){
    rec.nextDate = stepDateISO(rec.nextDate, rec.freq, rec.startDate);
    safety++;
  }
  generateRecurringTransactions();
}
function removeRecurring(recurringId){
  const today=todayISO();
  state.recurring = state.recurring.filter(r=>r.id!==recurringId);
  state.planned = state.planned.filter(p=>p.recurringId!==recurringId);
  // Eliminare la regola non deve cancellare la contabilità storica già registrata.
  state.transactions = state.transactions.filter(t=>t.recurringId!==recurringId || t.date<today);
}

/* ---------------- Spese pianificate (una tantum + proiezione ricorrenti future) ---------------- */
function generatePlannedTransactions(){
  // Quando arriva la data prevista (compreso oggi), la pianificata diventa un movimento reale.
  // Il plannedId resta sul movimento per poterla mostrare nello storico "Pagati nel mese".
  const todayStr = todayISO();
  let changed = false;
  state.planned = state.planned.filter(p=>{
    if(p.date <= todayStr){
      if(!state.transactions.some(t=>t.plannedId===p.id && t.date===p.date)){
        state.transactions.push({
          id: uid(), date: p.date, amount: p.amount, type: p.type,
          categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "",
          plannedId: p.id, split: p.split || null, groupId: p.groupId || null,
        });
      }
      changed = true;
      return false;
    }
    return true;
  });
  if(changed) persist();
}
function recurringOccurrencesInMonth(r, y, m){
  if(r.active===false) return [];
  // Date (future, non ancora generate) in cui un ricorrente cadrà nel mese y-m.
  const monthStart = `${y}-${pad2(m+1)}-01`;
  const monthEnd = `${y}-${pad2(m+1)}-31`;
  const dates = [];
  let d = r.nextDate;
  let safety = 0;
  while(d && d<=monthEnd && safety<500){
    if(!recurringDateWithinLimits(r,d)) break;
    if(d>=monthStart) dates.push(d);
    d = stepDateISO(d, r.freq, r.startDate);
    safety++;
  }
  return dates;
}
function plannedItemsForMonth(y=viewYear, m=viewMonth){
  // Elenco "virtuale" (non incide sul saldo) delle spese pianificate visibili nel mese y-m:
  // una tantum con data in quel mese + prossime occorrenze dei ricorrenti che cadono in quel mese.
  const prefix = `${y}-${pad2(m+1)}`;
  const once = state.planned.filter(p=>p.date.startsWith(prefix)).map(p=>({
    id: "planned_"+p.id, plannedId: p.id, date: p.date, amount: p.amount, type: p.type,
    categoryId: p.categoryId, accountId: p.accountId, name:p.name || "", note: p.note || "", planned: true,
  }));
  const recurringOcc = [];
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      recurringOcc.push({
        id: "rec_"+r.id+"_"+date, recurringId: r.id, date, amount: r.amount, type: r.type,
        categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", planned: true,
      });
    });
  });
  return [...once, ...recurringOcc];
}
function plannedItemsForDate(iso){
  const y = parseInt(iso.slice(0,4),10), m = parseInt(iso.slice(5,7),10)-1;
  return plannedItemsForMonth(y,m).filter(t=>t.date===iso);
}

/* ---------------- Rendering: header ---------------- */
function renderHeader(){
  const daily=periodModes[activeView]==="day";
  {const lbl=document.getElementById("monthLabel");
  lbl.innerHTML=`<span class="pl-main">${periodLabel(activeView)}</span><span class="pl-sub">${periodSubLabel(activeView)} ▾</span>`;
  lbl.classList.toggle("is-day",periodModes[activeView]!=="month");}
  document.getElementById("monthLabel").setAttribute("aria-label",(daily?"Stai vedendo un solo giorno":"Stai vedendo tutto il mese")+". Tocca per cambiare");
  document.getElementById("periodDate").value=selectedDate();
  document.getElementById("periodReturn").hidden=true;
  document.getElementById("periodX").hidden=true;
  document.getElementById("dayControl").hidden=!daily;
  document.getElementById("prevMonth").setAttribute("aria-label",daily?"Giorno precedente":"Mese precedente");
  document.getElementById("nextMonth").setAttribute("aria-label",daily?"Giorno successivo":"Mese successivo");
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===periodModes[activeView])));
}

function isStandalonePWA(){
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone===true);
}
function renderMainAccountSetupNotice(){
  const notice=document.getElementById("mainAccountSetupNotice");
  if(!notice) return;
  const missing=!state.mainAccountId || !state.accounts.some(a=>a.id===state.mainAccountId);
  notice.hidden=!(missing && isStandalonePWA() && state.accounts.length>0);
}

/* Icona occhio per mostra/nascondi importi (v1.3.21). */
function setEyeIcon(btn,hidden,showLabel,hideLabel){
  if(!btn) return;
  const open='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const closed='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5.6 19 2 12 2 12a18.6 18.6 0 0 1 5.1-5.9"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a18.7 18.7 0 0 1-2.2 3.2"/><path d="M14.1 14.2a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';
  btn.innerHTML=hidden?closed:open;
  btn.setAttribute("aria-label",hidden?(showLabel||"Mostra importi"):(hideLabel||"Nascondi importi"));
}

/* ---------------- Noi Due: card principale della Home (spese e chi ha pagato) ---------------- */
function renderNdHome(){
  const el=id=>document.getElementById(id);
  if(!el("ndMonthSpent")) return;
  const tx=periodTx("home").filter(t=>t.type==="expense"&&!t.isBalanceAdjustment);
  const paid={a:0,b:0,joint:0};
  tx.forEach(t=>{ const o=accOwner(t.accountId); paid[o==="a"||o==="b"?o:"joint"]+=t.amount; });
  const total=paid.a+paid.b+paid.joint, show=v=>balancesHidden?"••••":fmt(v);
  el("ndMonthSpent").textContent=show(total);
  el("ndMonthSpent").style.color="var(--ink)";
  ["a","b"].forEach(k=>{ const K=k.toUpperCase(); el("ndPaid"+K+"Label").textContent=personName(k); el("ndPaid"+K).textContent=show(paid[k]); el("ndDot"+K).style.background=personColor(k); });
  el("ndPaidJoint").textContent=show(paid.joint);
  // Budget rimasto: budget delle macrocategorie, più quello delle categorie la cui macro non ne ha uno.
  const left=el("ndBudgetLeft");
  if(periodModes.home!=="month"){ left.textContent="—"; left.style.color=""; return; }
  let budget=0; const counted=new Set();
  state.macroCategories.filter(m=>m.kind!=="income"&&Number(m.budget)>0).forEach(m=>{ budget+=Number(m.budget); state.categories.filter(c=>c.macroCategoryId===m.id).forEach(c=>counted.add(c.id)); });
  state.categories.filter(c=>c.kind==="expense"&&Number(c.budget)>0&&!counted.has(c.id)).forEach(c=>{ budget+=Number(c.budget); counted.add(c.id); });
  if(!(budget>0)){ left.textContent="Nessuno"; left.style.color=""; return; }
  const spent=tx.filter(t=>counted.has(t.categoryId)).reduce((s,t)=>s+t.amount,0);
  const rest=budget-spent;
  left.textContent=balancesHidden?"••••":(rest>=0?fmt(rest):`−${fmt(-rest)}`);
  left.style.color=rest<0?"var(--rust)":"var(--emerald)";
}

/* ---------------- Rendering: Home ---------------- */
function renderHome(){
  const { income, expense, net } = sumTransactions(periodTx("home"));
  document.getElementById("netAmount").textContent = balancesHidden ? "••••" : fmt(net);
  document.getElementById("netAmount").style.color = moneyColor(net);
  document.getElementById("incomeAmount").textContent = balancesHidden ? "••••" : fmt(income);
  document.getElementById("expenseAmount").textContent = balancesHidden ? "••••" : fmt(expense);
  setEyeIcon(document.getElementById("toggleHomeBalance"),balancesHidden);
  const mainAccount=state.accounts.find(a=>a.id===state.mainAccountId) || null;
  const mainBalance=mainAccount?accountBalance(mainAccount.id):null;
  const allAccountsBalance=totalBalance();
  const mainName=document.getElementById("homeMainAccountName");
  const mainAmount=document.getElementById("homeMainAccountBalance");
  const allAmount=document.getElementById("homeAllAccountsBalance");
  if(mainName) mainName.textContent=mainAccount?`Conto principale · ${mainAccount.name}`:"Conto principale non impostato";
  if(mainAmount){mainAmount.textContent=mainAccount?(balancesHidden?"••••":fmt(mainBalance)):"Imposta";mainAmount.style.color=mainAccount?moneyColor(mainBalance):"";}
  if(allAmount){allAmount.textContent=balancesHidden?"••••":fmt(allAccountsBalance);allAmount.style.color=moneyColor(allAccountsBalance);}
  renderMainAccountSetupNotice();
  renderCoupleStrip();
  renderHomeLists();

  {const c=document.getElementById("seeAllTxCount"); if(c) c.textContent=periodTx("home").filter(t=>!t.isBalanceAdjustment).length;}
  document.querySelector("#view-home .hero-label").textContent=periodModes.home==="day"?"Spese del giorno":periodModes.home==="range"?"Spese del periodo":"Spese del mese";
  renderNdHome();
  const today=todayISO(), monthEnd=`${viewYear}-${pad2(viewMonth+1)}-31`;
  const future=plannedItemsForMonth(viewYear,viewMonth).filter(t=>t.date>=today && t.date<=monthEnd);
  const futureNet=future.reduce((s,t)=>s+(t.type==="income"?t.amount:-t.amount),0);
  const current=totalBalance(), forecast=current+futureNet;
  const show=v=>balancesHidden?"••••":fmt(v);
  document.getElementById("currentBalanceAmount").textContent=show(current);
  document.getElementById("forecastBalanceAmount").textContent=show(forecast);
  document.getElementById("upcomingImpactAmount").textContent=balancesHidden?"••••":`${futureNet>=0?"+":"−"}${fmt(Math.abs(futureNet))}`;
  document.getElementById("forecastBalanceAmount").style.color=moneyColor(forecast);
  document.getElementById("upcomingImpactAmount").style.color=moneyColor(futureNet);
  renderUnifiedBudgets();

  // Recent tx
  const recent = periodTx("home").filter(t=>!t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  document.getElementById("txEmptyHint").hidden = recent.length>0;
  document.getElementById("txEmptyHint").textContent=periodModes.home==="day"?"Nessun movimento in questo giorno.":periodModes.home==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";
  const upcoming=future.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  renderTxRows(document.getElementById("upcomingHomeList"),upcoming);
  document.getElementById("upcomingHomeEmpty").hidden=upcoming.length>0;
}

const budgetExpanded = {};
function renderUnifiedBudgets(){
  const list=document.getElementById("budgetList");list.innerHTML="";
  const tx=periodTx("home");
  function renderKind(kind,title,icon){
    const cats=state.categories.filter(c=>c.kind===kind);
    const groups=state.macroCategories
      .filter(m=>m.kind===kind || cats.some(c=>c.macroCategoryId===m.id))
      .map(m=>({...m,cats:cats.filter(c=>c.macroCategoryId===m.id)}));
    const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
    if(orphan.length) groups.push({id:`none-${kind}`,name:"Senza macrocategoria",emoji:"🏷️",cats:orphan,budget:null});
    if(!groups.some(g=>g.cats.length || g.budget>0)) return false;
    const section=document.createElement("section");section.className=`budget-kind ${kind}`;
    section.innerHTML=`<h3>${icon} ${title}</h3>`;
    const spentFor=c=>tx.filter(t=>t.type===kind && t.categoryId===c.id).reduce((s,t)=>s+t.amount,0);
    const row=(name,emoji,total,budget,child)=>{
      const limit=kind==="expense" && Number(budget)>0?Number(budget):0;
      const totalClass=kind==="income"?"budget-earned":"budget-spent";
      const word=kind==="income"?"entrate":"spesi";
      const pct=limit?Math.round(total/limit*100):0, tone=pct>=100?"var(--rust)":pct>=80?"#E8A33D":"var(--emerald)";
      return `<div class="${child?"budget-child":"budget-parent"}"><div class="budget-item-top"><span class="budget-item-name">${escapeHtml(emoji||"")} ${escapeHtml(name)}</span><span class="budget-item-amounts"><span class="${totalClass}">${fmt(total)}</span>${limit?` <span class="budget-limit">/ ${fmt(limit)} · ${pct}%</span>`:` <span class="budget-word">${word}</span>`}</span></div>${limit?`<div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.min(100,pct)}%;background:${tone}"></div></div>`:""}</div>`;
    };
    groups.filter(g=>g.cats.length || g.budget>0).forEach(g=>{
      const total=g.cats.reduce((s,c)=>s+spentFor(c),0), key=`${kind}-${g.id||g.name}`;
      const item=document.createElement("div");item.className="budget-item";
      item.innerHTML=`<button type="button" class="budget-macro-toggle" aria-expanded="${Boolean(budgetExpanded[key])}">${row(g.name,g.emoji,total,g.budget,false)}<span class="budget-chevron" aria-hidden="true">${budgetExpanded[key]?"▴":"▾"}</span></button><div class="budget-children" ${budgetExpanded[key]?"":"hidden"}>${g.cats.map(c=>row(c.name,c.emoji,spentFor(c),c.budget,true)).join("")}</div>`;
      const macroBtn=item.querySelector(".budget-macro-toggle");
      macroBtn.addEventListener("click",()=>{budgetExpanded[key]=!budgetExpanded[key];renderUnifiedBudgets();});
      // v1.10.5: tieni premuto su una macrocategoria o su una categoria per vedere gli ultimi 5 movimenti.
      const catIds=new Set(g.cats.map(c=>c.id));
      bindLongPress(macroBtn,()=>showLongPressPopup(macroBtn,`Ultimi 5 · ${g.name}`,lpLastMovements(t=>t.type===kind&&catIds.has(t.categoryId)),{emptyText:"Nessun movimento in questa macrocategoria."}));
      item.querySelectorAll(".budget-children .budget-child").forEach((el,i)=>{
        const c=g.cats[i]; if(!c) return;
        bindLongPress(el,()=>showLongPressPopup(el,`Ultimi 5 · ${c.name}`,lpLastMovements(t=>t.type===kind&&t.categoryId===c.id),{emptyText:"Nessun movimento in questa categoria."}));
      });
      section.appendChild(item);
    });
    list.appendChild(section);return true;
  }
  const expenses=renderKind("expense","Uscite per macrocategoria","↓");
  const income=renderKind("income","Entrate per macrocategoria","↑");
  document.getElementById("budgetEmptyHint").hidden=expenses||income;
  document.getElementById("budgetPeriodHint").textContent=periodModes.home==="range"?"Totali del periodo selezionato · budget mensili":periodModes.home==="day"?"Totali del giorno selezionato · budget mensili":"Totali e budget del mese selezionato";
}

/* v1.4.0 — Conferma in-app al posto del confirm() del browser. */
function askConfirm(message,{ok="Conferma",cancel="Annulla",danger=null}={}){
  return new Promise(resolve=>{
    const isDanger=danger??/elimin|azzera|sovrascriv|irreversib|non è reversibile/i.test(message);
    let d=document.getElementById("askDialog");
    if(!d){d=document.createElement("dialog");d.id="askDialog";d.className="ask-dialog";document.body.appendChild(d);}
    if(d.open) d.close();
    d.innerHTML=`<p class="ask-msg"></p><div class="ask-actions"><button type="button" class="ask-cancel"></button><button type="button" class="ask-ok"></button></div>`;
    d.querySelector(".ask-msg").textContent=message;
    const okBtn=d.querySelector(".ask-ok"),noBtn=d.querySelector(".ask-cancel");
    okBtn.textContent=isDanger&&ok==="Conferma"?"Elimina":ok; noBtn.textContent=cancel;
    okBtn.classList.toggle("danger",!!isDanger);
    let settled=false;
    const done=v=>{if(settled)return;settled=true;d.close();resolve(v);};
    okBtn.onclick=()=>done(true); noBtn.onclick=()=>done(false);
    d.oncancel=e=>{e.preventDefault();done(false);};
    d.onclick=e=>{if(e.target===d)done(false);};
    d.showModal(); noBtn.focus();
  });
}

function showToast(message){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.textContent=message;toast.classList.add("show");clearTimeout(toast._timer);toast._timer=setTimeout(()=>toast.classList.remove("show"),2000);
}
function showUndo(message, trashId){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">Annulla</button>`;
  toast.classList.add("show");clearTimeout(toast._timer);
  toast.querySelector("button").addEventListener("click",()=>{restoreTrashItem(trashId);toast.classList.remove("show");});
  toast._timer=setTimeout(()=>toast.classList.remove("show"),5000);
}
function openMovementActionMenu({title="Movimento",onEdit,onDelete,onDuplicate,onRecurring,onPlanned}){
  document.getElementById("movementActionOverlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="movementActionOverlay";
  overlay.className="movement-action-overlay";
  overlay.innerHTML=`
    <div class="movement-action-menu" role="dialog" aria-modal="true" aria-label="Azioni movimento">
      <div class="movement-action-handle" aria-hidden="true"></div>
      <p class="movement-action-title">${escapeHtml(title)}</p>
      <div class="movement-action-buttons"></div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  const actions=overlay.querySelector(".movement-action-buttons");
  const addAction=(label,cls,fn)=>{
    if(!fn) return;
    const icons={
      edit:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4Zm12.5-16.5 4 4 1.2-1.2a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0L16.5 3.5Z"/></svg>`,
      duplicate:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8V8Zm-3 8H3V3h13v2H5v11Z"/></svg>`,
      recurring:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4V8H8a3 3 0 0 0-3 3v1H3v-1a5 5 0 0 1 5-5h9V3Zm-10 18l-4-4 4-4v3h9a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7v3Z"/></svg>`,
      planned:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v5.2l3.6 2.1-1 1.7L11 13.3V7h2Z"/></svg>`,
      delete:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20a2 2 0 0 1-2-2V7h14v11a2 2 0 0 1-2 2H7Zm1-10v7h2v-7H8Zm6 0v7h2v-7h-2ZM4 6V4h5l1-1h4l1 1h5v2H4Z"/></svg>`
    };
    const btn=document.createElement("button");
    btn.type="button";btn.className=`movement-action-btn ${cls}`;
    btn.innerHTML=`<span class="movement-action-icon">${icons[cls]||""}</span><span>${label}</span>`;
    btn.addEventListener("click",()=>{overlay.remove();fn();});
    actions.appendChild(btn);
  };
  addAction("Modifica","edit",onEdit);
  addAction("Duplica","duplicate",onDuplicate);
  addAction("Rendi ricorrente","recurring",onRecurring);
  addAction("Pianifica di nuovo","planned",onPlanned);
  addAction("Elimina","delete",onDelete);
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  bindOverlaySwipeDismiss(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
function enableLongPressActions(row,{title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned}){
  row.classList.add("longpress-actionable");
  let timer=null,startX=0,startY=0,longPressed=false;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}};
  row.addEventListener("touchstart",e=>{
    if(e.touches.length!==1) return;
    const t=e.touches[0];startX=t.clientX;startY=t.clientY;longPressed=false;
    cancel();
    timer=setTimeout(()=>{
      timer=null;longPressed=true;row._skipClick=true;
      if(navigator.vibrate) navigator.vibrate(18);
      openMovementActionMenu({title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned});
      setTimeout(()=>row._skipClick=false,450);
    },520);
  },{passive:true});
  row.addEventListener("touchmove",e=>{
    if(!timer || !e.touches.length) return;
    const t=e.touches[0];
    if(Math.hypot(t.clientX-startX,t.clientY-startY)>9) cancel();
  },{passive:true});
  row.addEventListener("touchend",()=>{cancel();if(longPressed){row._skipClick=true;setTimeout(()=>row._skipClick=false,250);}}, {passive:true});
  row.addEventListener("touchcancel",cancel,{passive:true});
  row.addEventListener("contextmenu",e=>{e.preventDefault();row._skipClick=true;openMovementActionMenu({title,onEdit,onDelete,onDuplicate,onRecurring,onPlanned});setTimeout(()=>row._skipClick=false,250);});
}
function duplicateTransaction(t){
  if(!t || t.planned || t.isBalanceAdjustment) return null;
  const copy={...t,id:uid(),date:todayISO(),planned:false};
  delete copy.recurringId;
  delete copy.plannedId;
  state.transactions.push(copy);
  persist();
  renderAll();
  showToast("Movimento duplicato con la data di oggi");
  return copy;
}
/* v1.7.0 — Evidenzia nei risultati il testo cercato (nome, categoria, conto). */
let HL="";
function hlText(str){
  const e=escapeHtml(str);
  const q=String(HL||"").trim();
  if(!q) return e;
  const needle=escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return e.replace(new RegExp(needle,"gi"),m=>`<mark class="hl">${m}</mark>`);
}
function withHighlight(q,fn){const prev=HL;HL=q||"";try{return fn();}finally{HL=prev;}}
/* v1.6.3 — Riga movimento unica per Home e R&P:
   riga 1: icona · nome · importo   —   riga 2: etichetta · categoria · conto · data (pastiglia). */
const KIND_ICONS={
  recurring:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M4 12a8 8 0 0113.6-5.7M20 12a8 8 0 01-13.6 5.7M17 3v4h-4M7 21v-4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  planned:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  paid:'<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function datePillHtml(iso,{relative=true,kind=null,paid=false}={}){
  if(!iso) return "";
  const d=new Date(iso+"T00:00:00");
  const days=Math.round((d-new Date(todayISO()+"T00:00:00"))/86400000);
  const rel=!relative?"":days===0?"oggi":days===1?"domani":days>1?`tra ${days} gg`:"";
  const label=kind==="recurring"?"Ricorrente":kind==="planned"?"Pianificata":"";
  const icon=paid?KIND_ICONS.paid:(kind?KIND_ICONS[kind]:"");
  const cls=`mv-date${kind?" kind-"+kind:""}${paid?" is-paid":""}${days===0?" is-today":days>0&&relative?" is-future":""}`;
  return `<span class="${cls}"${label?` title="${label}${paid?" · registrato":""}" aria-label="${label}${paid?" registrato":""}, ${d.getDate()} ${MESI[d.getMonth()]}"`:""}>${icon}${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${rel?` · ${rel}`:""}</span>`;
}
/* v1.10.6 — Icona libera: si scrive con la tastiera emoji dell'iPhone, anche più di una.
   I suggerimenti sotto si aggiungono al campo; ✕ lo svuota. */
function emojiGraphemes(str){
  const t=String(str||"");
  try{ if(typeof Intl!=="undefined" && Intl.Segmenter) return [...new Intl.Segmenter("it",{granularity:"grapheme"}).segment(t)].map(x=>x.segment); }catch(e){}
  return Array.from(t);
}
function cleanEmoji(str,max=4){
  const isEmoji=g=>/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u20E3\uFE0F]/u.test(g);
  return emojiGraphemes(str).filter(g=>g.trim() && isEmoji(g)).slice(0,max).join("");
}
function buildEmojiField(row, initial, onChange){
  row.innerHTML="";row.classList.add("emoji-field");
  const wrap=document.createElement("div");wrap.className="emoji-input-wrap";
  const input=document.createElement("input");
  input.type="text";input.className="text-input emoji-input";input.value=cleanEmoji(initial)||"";
  input.setAttribute("aria-label","Icona: scrivi una o più emoji");input.placeholder="Tocca e usa la tastiera 😀";
  input.autocomplete="off";input.setAttribute("autocorrect","off");input.setAttribute("autocapitalize","off");input.spellcheck=false;
  const clear=document.createElement("button");clear.type="button";clear.className="emoji-clear";clear.textContent="✕";clear.setAttribute("aria-label","Svuota icona");
  wrap.append(input,clear);
  const hint=document.createElement("p");hint.className="field-hint emoji-hint";hint.textContent="Sulla tastiera tocca 🌐 o 😀 per le emoji. Puoi metterne fino a 4.";
  const sugg=document.createElement("div");sugg.className="emoji-row emoji-suggest";
  const used=[...new Set([...state.categories,...state.macroCategories].flatMap(c=>emojiGraphemes(c.emoji||"")).filter(Boolean))];
  [...new Set([...used,...EMOJIS])].slice(0,36).forEach(em=>{
    const b=document.createElement("button");b.type="button";b.className="emoji-opt";b.textContent=em;
    b.addEventListener("click",()=>{input.value=cleanEmoji(input.value+em);commit();});
    sugg.appendChild(b);
  });
  const commit=()=>{const v=cleanEmoji(input.value);onChange(v||EMOJIS[0]);};
  input.addEventListener("input",()=>{const v=cleanEmoji(input.value);if(v!==input.value&&!input.value.endsWith("\u200D"))input.value=v;commit();});
  input.addEventListener("blur",()=>{input.value=cleanEmoji(input.value);commit();});
  clear.addEventListener("click",()=>{input.value="";input.focus();onChange(EMOJIS[0]);});
  row.append(wrap,hint,sugg);
  commit();
}
function movementRowHtml({emoji,color,title,badges="",meta="",amountHtml,type,date,relative=true,kind=null,paid=false}){
  const nEm=Math.min(4,emojiGraphemes(emoji).length||1);
  return `<span class="mv-ic${nEm>1?` mv-ic-n${nEm}`:""}" style="background:${safeColor(color,"#999999")}22;">${escapeHtml(emoji)}</span>
    <span class="mv-title"><span class="mv-name">${hlText(title)}</span></span>
    <span class="mv-amt ${type}">${amountHtml}</span>
    <span class="mv-meta"><span class="mv-meta-text">${meta}</span></span>
    ${datePillHtml(date,{relative:false,kind,paid})}`;
}
function nextMonthSameDay(iso){
  const d=new Date(iso+"T12:00:00"), day=d.getDate();
  const n=new Date(d.getFullYear(),d.getMonth()+1,1);
  n.setDate(Math.min(day,new Date(n.getFullYear(),n.getMonth()+1,0).getDate()));
  let out=`${n.getFullYear()}-${pad2(n.getMonth()+1)}-${pad2(n.getDate())}`;
  while(out<=todayISO()){const m=new Date(out+"T12:00:00");const k=new Date(m.getFullYear(),m.getMonth()+1,1);k.setDate(Math.min(day,new Date(k.getFullYear(),k.getMonth()+1,0).getDate()));out=`${k.getFullYear()}-${pad2(k.getMonth()+1)}-${pad2(k.getDate())}`;}
  return out;
}
function futureFromTx(t){
  const d=nextMonthSameDay(t.date);
  return {name:t.name||"",amount:t.amount,type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",split:t.split||null,groupId:t.groupId||null,freq:"monthly",startDate:d,date:d,active:true};
}
function transferName(fromId,toId){
  const accs=accountsById();
  return `${accs[fromId]?.name||"Conto"} → ${accs[toId]?.name||"Conto"}`;
}
function renderTxRows(container, list, {paidLabel=false}={}){
  const cats = categoriesById(), accs = accountsById(), macros = macroCategoriesById();
  container.innerHTML = "";
  list.forEach(t=>{
    const isTransfer=t.type==="transfer";
    const settle = isTransfer && isCoupleSettle(t);
    const cat = isTransfer ? (settle ? {name:"Rimborso",emoji:"🤝",color:personColor(accOwner(t.toAccountId)),macroCategoryId:null} : {name:t.atm?"Prelievo ATM":"Trasferimento",emoji:t.atm?"🏧":"↔",color:"#E8A33D",macroCategoryId:null}) : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️",color:"#7BAE9D",macroCategoryId:null} : (cats[t.categoryId] || { name:"Categoria eliminata", emoji:"❔", color:"#999" }));
    const acc = accs[t.accountId] || { name:"Conto eliminato" };
    const destination=accs[t.toAccountId] || {name:"Conto eliminato"};
    const row = document.createElement("div");
    row.setAttribute("role","button"); row.tabIndex=0;
    row.className = "tx-row mv-row" + (t.planned ? " planned mv-kind-"+(t.recurringId?"recurring":"planned") : " mv-kind-past");
    row.dataset.id = t.id;
    const d = new Date(t.date+"T00:00:00");
    const originKind=t.recurringId?"recurring":(t.plannedId?"planned":null);
    const originLabel=originKind==="recurring"?"Ricorrente":originKind==="planned"?"Pianificata":"";
    const statusBadge = t.planned
      ? `<span class="status-badge ${t.recurringId?"recurring":"planned"}">${t.recurringId?"Ricorrente":"Pianificata"}</span>`
      : originKind
        ? `<span class="status-badge ${originKind}">${originLabel}</span>${paidLabel?`<span class="status-badge paid">Pagato</span>`:""}`
        : "";
    const title = settle ? `${personName(accOwner(t.accountId))} → ${personName(accOwner(t.toAccountId))}` : isTransfer ? `${acc.name} → ${destination.name}` : (t.name || t.note || cat.name);
    const sLabel = splitLabel(t) ? `${groupsById()[groupOf(t)]?.emoji||""} ${splitLabel(t)}`.trim() : "";
    const metaParts=isTransfer
      ? `<span>${settle?`Rimborso tra voi · ${t.settleAlloc?"tutti i gruppi":escapeHtml(groupLabel(groupOf(t)))}`:t.atm?"Prelievo ATM":"Trasferimento"}</span>`
      : `<span>${hlText(cat.name)}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${sLabel?`<span class="mv-sep" aria-hidden="true">·</span><span class="mv-split">${escapeHtml(sLabel)}</span>`:""}`;
    row.innerHTML = movementRowHtml({emoji:cat.emoji,color:cat.color,title,badges:statusBadge,meta:metaParts,
      amountHtml:`${isTransfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}`,type:t.type,date:t.date,relative:!!t.planned,
      kind:t.recurringId?"recurring":(t.plannedId?"planned":null),paid:!t.planned&&paidLabel});
    const openRow=()=>{
      if(row._skipClick) return;
      if(t.planned) openScheduledDetail(t.recurringId ? "recurring" : "planned", t.recurringId || t.plannedId, t.date);
      else openTxDetail(t.id);
    };
    row.addEventListener("click", openRow);
    activateRowFromKeyboard(row,openRow);
    const canDuplicate=!t.planned && !t.isBalanceAdjustment;
    enableLongPressActions(row,{
      title:title,
      onDuplicate:canDuplicate?()=>duplicateTransaction(t):null,
      // v1.10.7: un movimento registrato può diventare ricorrente o essere pianificato di nuovo.
      onRecurring:canDuplicate&&!isTransfer&&!t.recurringId?()=>openRecurringForm(null,futureFromTx(t)):null,
      onPlanned:canDuplicate&&!isTransfer?()=>openPlannedForm(null,futureFromTx(t)):null,
      onEdit:()=>{
        if(t.recurringId && state.recurring.some(r=>r.id===t.recurringId)) openRecurringForm(t.recurringId);
        else if(t.planned) openPlannedForm(t.plannedId);
        else openAddTransaction(t.id);
      },
      onDelete:()=>{
        let deleted;
        if(t.planned){const p=state.planned.find(x=>x.id===t.plannedId);if(p){moveToTrash("planned",p);deleted=state.trash[0]?.id;}state.planned=state.planned.filter(p=>p.id!==t.plannedId);}
        else {moveToTrash("transaction",t);deleted=state.trash[0]?.id;state.transactions=state.transactions.filter(x=>x.id!==t.id);}
        persist();renderAll();if(deleted) showUndo("Elemento eliminato",deleted);
      }
    });
    container.appendChild(row);
  });
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = String(str ?? "");
  return d.innerHTML;
}
function safeColor(value,fallback="#999999"){
  const v=String(value||"");
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}
function activateRowFromKeyboard(row,callback){
  row.addEventListener("keydown",e=>{
    if(e.target!==row || (e.key!=="Enter" && e.key!==" ")) return;
    e.preventDefault();callback();
  });
}

/* ---------------- Rendering: Transactions (full) ---------------- */
function renderTransactionsView(){
  document.getElementById("txMonthLabel").textContent = periodLabel("transactions");
  const pbtn=document.getElementById("txPeriodBtn"); if(pbtn) pbtn.innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${periodLabel("transactions")}</span>`;
  const cats=categoriesById(), accounts=accountsById();
  const matches=t=>{
    if(txFilter!=="all"&&t.type!==txFilter) return false;
    if(txDateFrom&&t.date<txDateFrom) return false;if(txDateTo&&t.date>txDateTo) return false;
    const q=txSearchQuery.toLocaleLowerCase("it"); if(!q) return true;
    const hay=[t.name,t.note,cats[t.categoryId]?.name,accounts[t.accountId]?.name,accounts[t.toAccountId]?.name,t.type].filter(Boolean).join(" ").toLocaleLowerCase("it");
    return hay.includes(q);
  };
  const base=periodTx("transactions").filter(t=>!t.isBalanceAdjustment);
  const all = base.filter(matches).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const visibleAll=all.slice(0,txVisibleLimit);
  withHighlight(txSearchQuery,()=>renderTxRows(document.getElementById("allTx"), visibleAll));
  const loadMore=document.getElementById("loadMoreTxBtn");
  if(loadMore){loadMore.hidden=visibleAll.length>=all.length;loadMore.textContent=`Carica altri (${all.length-visibleAll.length})`;}
  document.getElementById("allTxEmptyHint").hidden = all.length>0;
  document.getElementById("allTxEmptyHint").textContent=periodModes.transactions==="day"?"Nessun movimento in questo giorno.":periodModes.transactions==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";

  const planned = plannedItemsInPeriod("transactions").filter(t=>matches(t)).sort((a,b)=> a.date.localeCompare(b.date));
  const plannedWrap = document.getElementById("allTxPlannedWrap");
  const ph=plannedWrap.querySelector("h2"); if(ph) ph.textContent=periodModes.transactions==="month"?"In arrivo questo mese":periodModes.transactions==="day"?"In arrivo in questo giorno":"In arrivo nel periodo";
  if(planned.length){
    plannedWrap.hidden = false;
    withHighlight(txSearchQuery,()=>renderTxRows(document.getElementById("allTxPlanned"), planned));
  } else {
    plannedWrap.hidden = true;
  }
}

function rpEstimatesForMonth(y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  const future=plannedItemsForMonth(y,m);
  const itemsForOrigin=(origin)=>[
    ...state.transactions.filter(t=>t[origin] && t.date.startsWith(prefix)),
    ...future.filter(t=>t[origin])
  ];
  const summarize=(items)=>{
    const income=items.filter(t=>t.type==="income").reduce((sum,t)=>sum+t.amount,0);
    const expense=items.filter(t=>t.type==="expense").reduce((sum,t)=>sum+t.amount,0);
    const byAccount={};
    items.forEach(t=>{
      if(!t.accountId || !["income","expense"].includes(t.type)) return;
      if(!byAccount[t.accountId]) byAccount[t.accountId]={income:0,expense:0,net:0};
      byAccount[t.accountId][t.type]+=t.amount;
      byAccount[t.accountId].net += t.type==="income"?t.amount:-t.amount;
    });
    return {income,expense,net:income-expense,byAccount};
  };
  // v1.6.0: i contatori principali mostrano solo ciò che è ANCORA da registrare;
  // quando una voce diventa movimento esce dal contatore. Il totale del mese resta come riferimento.
  const pending=(origin)=>future.filter(t=>t[origin]);
  const recurring=summarize(pending("recurringId"));
  const planned=summarize(pending("plannedId"));
  const total=summarize([...pending("recurringId"),...pending("plannedId")]);
  recurring.month=summarize(itemsForOrigin("recurringId"));
  planned.month=summarize(itemsForOrigin("plannedId"));
  total.month=summarize([...itemsForOrigin("recurringId"),...itemsForOrigin("plannedId")]);
  return {recurring,planned,total};
}
function updateRPEstimates(){
  const estimates=rpEstimatesForMonth();
  const setMoney=(id,value,{signed=false}={})=>{
    const el=document.getElementById(id); if(!el) return;
    el.textContent=balancesHidden?"••••":(signed?fmtSigned(value):fmt(value));
    if(signed) el.className=`rp-estimate-value ${value<0?"neg":value>0?"pos":"zero"}`;
  };
  const renderAccounts=(id,summary)=>{
    const el=document.getElementById(id); if(!el) return;
    const rows=state.accounts
      .map(a=>({account:a,values:summary.byAccount[a.id]}))
      .filter(x=>x.values && (x.values.income || x.values.expense))
      .sort((a,b)=>Math.abs(b.values.net)-Math.abs(a.values.net));
    el.innerHTML=rows.length
      ? `<div class="rp-account-title">Per conto/carta</div>${rows.map(({account,values})=>`<div class="rp-account-row"><span>${escapeHtml(account.name)}</span><b class="${values.net<0?"neg":values.net>0?"pos":""}">${balancesHidden?"••••":fmtSigned(values.net)}</b></div>`).join("")}`
      : `<div class="rp-account-empty">Nessun importo per conto/carta</div>`;
  };
  const setLabel=(sel,title,summary)=>{
    const el=document.querySelector(sel); if(!el) return;
    const m=summary.month;
    const done=m.net-summary.net;
    el.innerHTML=title;
  };
  setLabel("#recurringEstimateCard .rp-estimate-label","Ricorrenti · da registrare",estimates.recurring);
  setLabel("#plannedEstimateCard .rp-estimate-label","Pianificate · da registrare",estimates.planned);
  setLabel("#rpCombinedEstimateCard > div:first-child > span","Totale R&amp;P · da registrare",estimates.total);
  setMoney("recurringEstimate",estimates.recurring.net,{signed:true});
  // v1.6.5: Entrate/Uscite = totale del mese; il numero grande e "per conto/carta" = ancora da registrare.
  setMoney("recurringIncomeEstimate",estimates.recurring.month.income);
  setMoney("recurringExpenseEstimate",estimates.recurring.month.expense);
  setMoney("plannedEstimate",estimates.planned.net,{signed:true});
  setMoney("plannedIncomeEstimate",estimates.planned.month.income);
  setMoney("plannedExpenseEstimate",estimates.planned.month.expense);
  setMoney("rpCombinedEstimate",estimates.total.net,{signed:true});
  setMoney("rpCombinedIncomeEstimate",estimates.total.month.income);
  setMoney("rpCombinedExpenseEstimate",estimates.total.month.expense);
  renderAccounts("recurringAccountBreakdown",estimates.recurring);
  renderAccounts("plannedAccountBreakdown",estimates.planned);
  renderAccounts("rpCombinedAccountBreakdown",estimates.total);
  const toggle=document.getElementById("toggleRPBalance");
  if(toggle){setEyeIcon(toggle,balancesHidden,"Mostra importi R&P","Nascondi importi R&P");}
}


function formatRPDate(iso){
  const d=new Date(iso+"T00:00:00");
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`;
}
function recurringDatesForMonth(r,y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  const actual=state.transactions.filter(t=>t.recurringId===r.id && t.date.startsWith(prefix)).map(t=>t.date);
  const projected=recurringOccurrencesInMonth(r,y,m);
  return [...new Set([...actual,...projected])].sort();
}
function rpDateMatchesPeriod(iso){
  return inPeriod("recurring",iso);
}
function recurringProjectedDatesForPeriod(r){
  return monthsInPeriod("recurring").flatMap(([y,m])=>recurringOccurrencesInMonth(r,y,m)).filter(iso=>inPeriod("recurring",iso));
}
function paidScheduledTransactionsForPeriod(kind,y=viewYear,m=viewMonth){
  const key=kind==="recurring"?"recurringId":"plannedId";
  return state.transactions
    .filter(t=>t[key] && rpDateMatchesPeriod(t.date,y,m))
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
}
function formatRecurringDatesLabel(dates,m=viewMonth){
  if(!dates.length) return "";
  if(dates.length===1) return formatRPDate(dates[0]);
  const days=dates.map(iso=>parseInt(iso.slice(8,10),10)).join(", ");
  return `${days} ${MESI_BREVI[m]} ${dates[0].slice(0,4)}`;
}
function recurringDateLabel(r,y=viewYear,m=viewMonth,datesOverride=null){
  const dates=datesOverride || recurringDatesForMonth(r,y,m);
  return formatRecurringDatesLabel(dates,m);
}
function plannedForRPMonth(){
  return state.planned.filter(p=>p.date && inPeriod("recurring",p.date));
}
function renderRPPaidSection({sectionId,noticeId,countId,listId,paid,hasUpcoming}){
  const section=document.getElementById(sectionId);
  const notice=document.getElementById(noticeId);
  const count=document.getElementById(countId);
  const list=document.getElementById(listId);
  if(!section || !list) return;
  section.hidden=paid.length===0;
  if(notice) notice.hidden=paid.length===0 || hasUpcoming;
  if(count) count.textContent=paid.length ? `${paid.length}` : "";
  if(paid.length){const lim=rpLimited(listId,paid);withHighlight(rpSearchQuery,()=>renderTxRows(list,lim.shown,{paidLabel:true}));rpAppendMore(list,listId,lim.hidden);}
  else list.innerHTML="";
}

/* v1.7.0 — R&P: ricerca e liste brevi (prossimi 5 / ultimi 5 pagati, con "Mostra tutti"). */
let rpSearchQuery="";
const rpShowAll={};
const RP_LIMIT=5;
function rpMatches(name,categoryId,accountId){
  const q=rpSearchQuery.trim().toLocaleLowerCase("it"); if(!q) return true;
  const cats=categoriesById(), accs=accountsById();
  return [name,cats[categoryId]?.name,accs[accountId]?.name].filter(Boolean).join(" ").toLocaleLowerCase("it").includes(q);
}
function rpLimited(listId,items){
  const searching=!!rpSearchQuery.trim(), total=items.length;
  // v1.7.1: pulsante "Vedi tutti ›" nell'intestazione della lista, come in Home.
  const pill=document.querySelector(`[data-see-all="${listId}"]`);
  if(pill){
    pill.hidden=total===0;
    pill.innerHTML=`<span class="sa-label">Vedi tutti</span><span class="count-badge">${total}</span><span class="chev">›</span>`;
  }
  if(total<=RP_LIMIT) return {shown:items,hidden:0};
  return {shown:items.slice(0,RP_LIMIT),hidden:total-RP_LIMIT};
}
function rpAppendMore(){}
document.querySelectorAll("[data-see-all]").forEach(b=>b.addEventListener("click",()=>{
  // v1.8.0: "Vedi tutti" in R&P apre un pannello dedicato, come in Home.
  const id=b.dataset.seeAll;
  rpAllKind=/recurring/i.test(id)?"recurring":/planned/i.test(id)?"planned":"total";
  periodModes.rpall=periodModes.recurring; rpAllQuery=""; const inp=document.getElementById("rpAllSearchInput"); if(inp) inp.value="";
  openSubView("rpall");
}));
/* ---------------- Rendering: Ricorrenti ---------------- */
function renderRecurringList(){
  const container = document.getElementById("recurringList");
  container.innerHTML = "";
  const upcoming=state.recurring
    .map(r=>({r,dates:recurringProjectedDatesForPeriod(r)}))
    .filter(x=>x.dates.length>0 && rpMatches(x.r.name,x.r.categoryId,x.r.accountId))
    .sort((a,b)=>a.dates[0].localeCompare(b.dates[0]));
  const lim=rpLimited("recurringList",upcoming);
  withHighlight(rpSearchQuery,()=>lim.shown.forEach(({r,dates})=>container.appendChild(recurringRowElement(r,{dates}))));
  rpAppendMore(container,"recurringList",lim.hidden);

  const paid=paidScheduledTransactionsForPeriod("recurring").filter(t=>rpMatches(t.name,t.categoryId,t.accountId));
  const empty=document.getElementById("recurringEmptyHint");
  if(empty){
    empty.hidden=upcoming.length>0 || paid.length>0;
    empty.textContent=periodModes.recurring==="range"?"Nessun movimento ricorrente nel periodo.":periodModes.recurring==="day"?"Nessun movimento ricorrente nel giorno selezionato.":"Nessun movimento ricorrente nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"recurringPaidSection",noticeId:"recurringAllPaidNotice",countId:"recurringPaidCount",listId:"recurringPaidList",
    paid,hasUpcoming:upcoming.length>0
  });
  updateRPEstimates();
}

/* ---------------- Rendering: Spese pianificate ---------------- */
function plannedRowElement(p,{compact=true}={}){
  const cats=categoriesById(), accs=accountsById();
  const cat=cats[p.categoryId]||{};
  const acc=accs[p.accountId]||{name:"Conto eliminato"};
  const d=p.date?new Date(p.date+"T00:00:00"):null;
  const whenLabel=d?`${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}`:"—";
  const days=d?Math.ceil((d-new Date(todayISO()+"T00:00:00"))/86400000):null;
  const relative=days===0?"oggi":days===1?"domani":days>1?`tra ${days} giorni`:"";
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;
  row.className="template-manage-row planned-row mv-row mv-kind-planned";
  row.dataset.sortDate=p.date||"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"📌",color:cat.color,title:p.name||cat.name||"Pianificata",
    badges:`<span class="status-badge planned">Pianificata</span>`,
    meta:`<span>${hlText(cat.name||"Senza categoria")}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>`,
    amountHtml:`${p.type==="income"?"+":"−"}${fmt(p.amount)}`,type:p.type,date:p.date,kind:"planned"});
  const openRow=()=>{if(!row._skipClick) openScheduledDetail("planned",p.id);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:p.name||cat.name||"Pianificata",onEdit:()=>openPlannedForm(p.id),onDelete:()=>{const item=state.planned.find(x=>x.id===p.id);if(item)moveToTrash("planned",item);const deleted=state.trash[0]?.id;state.planned=state.planned.filter(x=>x.id!==p.id);persist();renderAll();if(deleted)showUndo("Pianificata eliminata",deleted);}});
  return row;
}
function recurringRowElement(r,{dates=null}={}){
  const cats=categoriesById(),accs=accountsById();
  const cat=cats[r.categoryId]||{},acc=accs[r.accountId]||{name:"Conto eliminato"};
  const row=document.createElement("div");
  row.setAttribute("role","button");row.tabIndex=0;row.className="template-manage-row mv-row mv-kind-recurring";
  const displayDates=dates || recurringDatesForMonth(r,viewYear,viewMonth);
  row.dataset.sortDate=displayDates[0]||"";
  const extra=displayDates.length>1?`<span class="mv-sep" aria-hidden="true">·</span><span>anche ${displayDates.slice(1).map(x=>parseInt(x.slice(8,10),10)).join(", ")}</span>`:"";
  row.innerHTML=movementRowHtml({emoji:cat.emoji||"🔁",color:cat.color,title:r.name,
    badges:`<span class="status-badge recurring">Ricorrente</span>`,
    meta:`<span>${hlText(cat.name||"Senza categoria")}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${extra}`,
    amountHtml:`${r.type==="income"?"+":"−"}${fmt(r.amount)}`,type:r.type,date:displayDates[0],kind:"recurring"});
  const openRow=()=>{if(!row._skipClick)openScheduledDetail("recurring",r.id,displayDates[0]);};
  row.addEventListener("click",openRow);activateRowFromKeyboard(row,openRow);
  enableLongPressActions(row,{title:r.name,onEdit:()=>openRecurringForm(r.id),onDelete:()=>{moveToTrash("recurring",r);const deleted=state.trash[0]?.id;removeRecurring(r.id);persist();renderAll();if(deleted)showUndo("Ricorrente eliminato",deleted);}});
  return row;
}
function renderPlannedList(){
  const allContainer=document.getElementById("plannedList");
  const rpContainer=document.getElementById("plannedListRP");
  const allItems=state.planned.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const rpItems=plannedForRPMonth().filter(p=>rpMatches(p.name,p.categoryId,p.accountId)).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(allContainer){allContainer.innerHTML="";allItems.forEach(p=>allContainer.appendChild(plannedRowElement(p)));}
  if(rpContainer){rpContainer.innerHTML="";const lim=rpLimited("plannedListRP",rpItems);withHighlight(rpSearchQuery,()=>lim.shown.forEach(p=>rpContainer.appendChild(plannedRowElement(p))));rpAppendMore(rpContainer,"plannedListRP",lim.hidden);}
  const allHint=document.getElementById("plannedEmptyHint");if(allHint)allHint.hidden=allItems.length>0;

  const paid=paidScheduledTransactionsForPeriod("planned").filter(t=>rpMatches(t.name,t.categoryId,t.accountId));
  const rpHint=document.getElementById("plannedEmptyHintRP");
  if(rpHint){
    rpHint.hidden=rpItems.length>0 || paid.length>0;
    rpHint.textContent=periodModes.recurring==="range"?"Nessun movimento pianificato nel periodo.":periodModes.recurring==="day"?"Nessun movimento pianificato nel giorno selezionato.":"Nessun movimento pianificato nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"plannedPaidSection",noticeId:"plannedAllPaidNotice",countId:"plannedPaidCount",listId:"plannedPaidList",
    paid,hasUpcoming:rpItems.length>0
  });
  renderRPTotalList();
  updateRPEstimates();
}
function renderRPTotalList(){
  const container=document.getElementById("rpTotalList");if(!container)return;
  container.innerHTML="";
  const recs=state.recurring
    .map(r=>({r,dates:recurringProjectedDatesForPeriod(r)}))
    .filter(x=>x.dates.length>0 && rpMatches(x.r.name,x.r.categoryId,x.r.accountId));
  const planned=plannedForRPMonth().filter(p=>rpMatches(p.name,p.categoryId,p.accountId));
  const rows=withHighlight(rpSearchQuery,()=>[...recs.map(({r,dates})=>recurringRowElement(r,{dates})),...planned.map(p=>plannedRowElement(p))])
    .sort((a,b)=>(a.dataset.sortDate||"").localeCompare(b.dataset.sortDate||""));
  const lim=rpLimited("rpTotalList",rows);
  lim.shown.forEach(row=>container.appendChild(row));
  rpAppendMore(container,"rpTotalList",lim.hidden);

  const paid=[...paidScheduledTransactionsForPeriod("recurring"),...paidScheduledTransactionsForPeriod("planned")].filter(t=>rpMatches(t.name,t.categoryId,t.accountId))
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const hint=document.getElementById("rpTotalEmptyHint");
  if(hint){
    hint.hidden=rows.length>0 || paid.length>0;
    hint.textContent=periodModes.recurring==="range"?"Nessun movimento R&P nel periodo.":periodModes.recurring==="day"?"Nessun movimento R&P nel giorno selezionato.":"Nessun movimento R&P nel mese selezionato.";
  }
  renderRPPaidSection({
    sectionId:"rpTotalPaidSection",noticeId:"rpTotalAllPaidNotice",countId:"rpTotalPaidCount",listId:"rpTotalPaidList",
    paid,hasUpcoming:rows.length>0
  });
}

/* ---------------- Rendering: Stats ---------------- */
let statsTrendRange = "1m", trendMode="flow";
function statsTransactions(){
  const end = new Date(viewYear,viewMonth+1,0);
  const start = new Date(end);
  if(statsTrendRange==="1w") start.setDate(end.getDate()-6);
  else if(statsTrendRange==="2w") start.setDate(end.getDate()-13);
  else if(statsTrendRange==="1m") start.setDate(1);
  else {
    const months={"2m":2,"3m":3,"6m":6,"1y":12}[statsTrendRange] || 1;
    start.setMonth(end.getMonth()-(months-1),1);
  }
  const from=`${start.getFullYear()}-${pad2(start.getMonth()+1)}-${pad2(start.getDate())}`;
  const to=`${end.getFullYear()}-${pad2(end.getMonth()+1)}-${pad2(end.getDate())}`;
  return state.transactions.filter(t=>!t.isBalanceAdjustment && t.date>=from && t.date<=to);
}
function renderTopCategoriesChart(entries,cats){
  if(!entries.length) return `<div class="top-categories-empty">Nessuna spesa nel periodo selezionato.</div>`;
  const max=Math.max(...entries.map(([,v])=>v),1);
  return `<div class="top-categories-chart" role="img" aria-label="Top 5 categorie di spesa">${entries.map(([id,value],index)=>{
    const cat=cats[id]||{};
    const pct=Math.max(4,(value/max)*100);
    const color=safeColor(cat.color,PALETTE[index%PALETTE.length]);
    return `<div class="top-category-row">
      <div class="top-category-meta"><span class="top-category-name"><span class="top-category-emoji">${escapeHtml(cat.emoji||"•")}</span>${escapeHtml(cat.name||"Altro")}</span><strong>${fmt(value)}</strong></div>
      <div class="top-category-track" aria-hidden="true"><span class="top-category-bar" style="width:${pct.toFixed(1)}%;background:${color}"></span></div>
    </div>`;
  }).join("")}</div>`;
}
function renderStats(){
  const tx=statsTransactions(), income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const days=Math.max(1,Math.ceil((new Date(viewYear,viewMonth+1,0)-new Date(viewYear,viewMonth,1))/86400000)+1);
  const cats=categoriesById(), byCat={};tx.filter(t=>t.type==="expense").forEach(t=>{byCat[t.categoryId]=(byCat[t.categoryId]||0)+t.amount;});
  const topEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById("statsInsights").innerHTML=`<div class="stat-card"><p class="stat-card-label">Media spese/giorno</p><p class="stat-card-value neg">${fmt(expense/days)}</p></div><div class="stat-card"><p class="stat-card-label">Spese del periodo</p><p class="stat-card-value neg">${fmt(expense)}</p></div><div class="stat-card wide-stat top-categories-card"><p class="stat-card-label">Top 5 categorie</p>${renderTopCategoriesChart(topEntries,cats)}</div>`;
  renderPie();
  renderTrendSection();
  renderAccountBreakdown();
}

function renderPie(){
  const tx = statsTransactions().filter(t=>t.type===statsNature);
  const cats = categoriesById();
  const macros = macroCategoriesById();
  const totals = {};
  tx.forEach(t=>{
    let key;
    if(statsGroupMode==="macro"){
      const cat = cats[t.categoryId];
      key = (cat && cat.macroCategoryId && macros[cat.macroCategoryId]) ? cat.macroCategoryId : "none";
    } else {
      key = t.categoryId;
    }
    totals[key] = (totals[key]||0) + t.amount;
  });
  const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  const wrap = document.getElementById("pieWrap");
  const legend = document.getElementById("pieLegend");
  legend.innerHTML = "";

  if(total===0){
    wrap.innerHTML = `<svg class="chart money-donut" width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Nessuna spesa nel periodo selezionato">
      <circle cx="90" cy="90" r="70" fill="none" stroke="var(--line)" stroke-width="26"/>
      <text x="90" y="86" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${maskAmt(fmt(0))}</text>
      <text x="90" y="108" text-anchor="middle" font-size="11" fill="var(--ink-soft)">Nessun dato</text>
    </svg>`;
    makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
    return;
  }

  const size=180, r=70, cx=size/2, cy=size/2, circumference = 2*Math.PI*r;
  let offset = 0;
  let circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="26"/>`;
  entries.forEach(([key,val])=>{
    let info;
    if(statsGroupMode==="macro"){
      info = key==="none" ? {color:"#999",name:"Senza macrocategoria",emoji:"❔"} : macros[key];
    } else {
      info = cats[key] || {color:"#999",name:"Altro",emoji:"❔"};
    }
    const frac = val/total;
    const len = frac*circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${safeColor(info.color)}" stroke-width="26"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;

    const legItem = document.createElement("div");
    legItem.className = "pie-legend-item";
    legItem.innerHTML = `<span class="sw" style="background:${safeColor(info.color)}"></span><span class="lbl">${escapeHtml(info.emoji)} ${escapeHtml(info.name)}</span><span class="val">${fmt(val)} · ${Math.round(frac*100)}%</span>`;
    legend.appendChild(legItem);
  });

  wrap.innerHTML = `
    <svg class="chart money-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${circles}
      <text x="${cx}" y="${cy-4}" text-anchor="middle" font-weight="700" font-size="20" fill="var(--ink)">${maskAmt(fmt(total))}</text>
      <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="10.5" fill="var(--ink-soft)">${statsNature==="income"?"entrate":"uscite"} totali</text>
    </svg>`;
  makeChartExpandable(wrap,"Ripartizione per categoria","Mostra la distribuzione del periodo selezionato.");
}

function buildBarsSVG(data){
  const w=360, h=190, left=42, right=8, top=16, bottom=30;
  const plotW=w-left-right, plotH=h-top-bottom, baseline=h-bottom;
  const max=Math.max(1, ...data.map(d=>Math.max(d.income,d.expense)));
  const slot=plotW/Math.max(1,data.length), barW=slot*0.36;
  const labelStep=Math.max(1,Math.ceil(data.length/7));
  let chart="";
  for(let i=0;i<=3;i++){
    const y=baseline-plotH*i/3;
    const value=max*i/3;
    const label=new Intl.NumberFormat("it-IT", {notation:"compact",maximumFractionDigits:1}).format(value);
    chart+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="var(--line)" stroke-dasharray="3 5"/>
      <text x="${left-7}" y="${y+3}" text-anchor="end" font-size="10" fill="var(--ink-soft)">${maskAmt(label,"•••")}</text>`;
  }
  chart+=`<text x="${left-7}" y="10" text-anchor="end" font-size="10" fill="var(--ink-soft)">€</text>`;
  data.forEach((d,i)=>{
    const x=left+i*slot+slot*0.08;
    const incH=d.income>0?Math.max(1.5,d.income/max*plotH):0;
    const expH=d.expense>0?Math.max(1.5,d.expense/max*plotH):0;
    chart+=`<rect x="${x}" y="${baseline-incH}" width="${barW}" height="${incH}" rx="3" fill="var(--emerald)"><title>${d.label}: entrate ${maskAmt(fmt(d.income))}</title></rect>
      <rect x="${x+slot*0.44}" y="${baseline-expH}" width="${barW}" height="${expH}" rx="3" fill="var(--rust)"><title>${d.label}: uscite ${maskAmt(fmt(d.expense))}</title></rect>`;
    if(i%labelStep===0 || i===data.length-1){
      // Avoid crowding the last two labels in months with 31 days.
      if(i!==data.length-1 && data.length-1-i<labelStep*0.6) return;
      chart+=`<text x="${left+(i+0.5)*slot}" y="${h-10}" text-anchor="middle" font-size="10" fill="var(--ink-soft)">${d.label}</text>`;
    }
  });
  return `<svg class="chart money-bars" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento delle entrate e delle uscite">${chart}</svg>`;
}

/* ---------------- Andamento (Statistiche) ---------------- */
function statsMonthTotals(y=viewYear,m=viewMonth){
  const prefix=`${y}-${pad2(m+1)}`;
  let income=0,expense=0;
  state.transactions.filter(t=>!t.isBalanceAdjustment && t.date.startsWith(prefix)).forEach(t=>{
    if(t.type==="income") income+=t.amount; else if(t.type==="expense") expense+=t.amount;
  });
  return {income,expense,net:income-expense};
}

function computeTrendData(range){
  if(range==="1m"){
    const y=viewYear, m=viewMonth;
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const data = [];
    for(let d=1; d<=daysInMonth; d++){
      const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
      let income=0, expense=0;
      state.transactions.filter(t=>!t.isBalanceAdjustment && t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label:String(d), date:iso, income, expense });
    }
    return data;
  }
  if(range==="1w" || range==="2w"){
    const days = range==="1w" ? 7 : 14;
    const data = [];
    for(let i=days-1;i>=0;i--){
      const today = new Date();
      const inViewedMonth=today.getFullYear()===viewYear && today.getMonth()===viewMonth;
      const d = inViewedMonth ? new Date(viewYear,viewMonth,today.getDate()) : new Date(viewYear,viewMonth+1,0);
      d.setDate(d.getDate()-i);
      const iso = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      let income=0, expense=0;
      state.transactions.filter(t=>!t.isBalanceAdjustment && t.date===iso).forEach(t=>{ t.type==="income" ? income+=t.amount : expense+=t.amount; });
      data.push({ label: `${d.getDate()}/${d.getMonth()+1}`, date:iso, income, expense });
    }
    return data;
  }
  const monthsMap = { "2m":2, "3m":3, "6m":6, "1y":12 };
  const n = monthsMap[range] || 6;
  const months = [];
  for(let i=n-1;i>=0;i--){
    let m = viewMonth - i, y = viewYear;
    while(m<0){ m+=12; y-=1; }
    months.push({y,m});
  }
  return months.map(({y,m})=>({ ...statsMonthTotals(y,m), label: MESI_BREVI[m], date:`${y}-${pad2(m+1)}-${pad2(new Date(y,m+1,0).getDate())}` }));
}

function renderTrendSection(){
  const data = trendMode==="compare" ? computeTrendData("2m") : computeTrendData(statsTrendRange);
  if(trendMode==="balance"){
    let running=data.length?totalBalanceAtDate(previousISO(data[0].date)):totalBalance();
    const points=data.map(d=>{running+=d.income-d.expense;return {...d,balance:running};});
    const wrap=document.getElementById("barWrap");
    wrap.innerHTML=buildLineSVG(points,"var(--ink)");
    setupLineChart(wrap,points);
  }else {
    const wrap=document.getElementById("barWrap");wrap.innerHTML = buildBarsSVG(data);
    makeChartExpandable(wrap,trendMode==="compare"?"Confronto mensile":"Entrate e uscite","Confronta entrate e uscite nel periodo selezionato.");
  }
  const totalIncome = data.reduce((s,d)=>s+d.income,0);
  const totalExpense = data.reduce((s,d)=>s+d.expense,0);
  const net = totalIncome - totalExpense;
  document.getElementById("trendLegend").innerHTML = `
    <div class="stat-cards-row">
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:var(--emerald-soft)"></span>Entrate</p>
        <p class="stat-card-value" style="color:var(--emerald)">${fmt(totalIncome)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:var(--rust)"></span>Uscite</p>
        <p class="stat-card-value" style="color:var(--rust)">${fmt(totalExpense)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-label"><span class="sw" style="background:${net<0?"var(--rust)":"var(--emerald)"}"></span>Netto</p>
        <p class="stat-card-value ${net<0?"neg":net>0?"pos":"zero"}">${fmtSigned(net)}</p>
      </div>
    </div>
  `;
}
document.getElementById("statsRangeSelect").addEventListener("change", event=>{
  statsTrendRange=event.target.value;
  renderStats();
});
document.querySelectorAll("#trendModeToggle [data-trend-mode]").forEach(btn=>btn.addEventListener("click",()=>{trendMode=btn.dataset.trendMode;document.querySelectorAll("#trendModeToggle .type-opt").forEach(x=>x.classList.toggle("active",x===btn));renderTrendSection();}));

function renderAccountBreakdown(){
  const tx = statsTransactions();
  const container = document.getElementById("accountBreakdown");
  container.className = "stat-card-grid";
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const net = -tx.reduce((s,t)=>s+(t.type==="expense"&&!t.isBalanceAdjustment&&t.accountId===a.id?t.amount:0),0);
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <p class="stat-card-label"><span class="sw" style="background:${safeColor(a.color)}"></span>${escapeHtml(a.name)}</p>
      <p class="stat-card-value ${net<0?"neg":net>0?"pos":"zero"}">${fmtSigned(net)}</p>
    `;
    container.appendChild(card);
  });
}

/* ---------------- Rendering: Accounts ---------------- */
function renderAccounts(){
  const totalEl = document.getElementById("totalBalanceAmount");
  const total = totalBalance();
  totalEl.textContent = balancesHidden ? "••••" : fmt(total);
  setEyeIcon(document.getElementById("toggleAccountsBalance"),balancesHidden);
  totalEl.style.color = moneyColor(total);
  const mainSelect=document.getElementById("mainAccountSelect");
  if(mainSelect){
    mainSelect.innerHTML=`<option value="">Seleziona il conto principale</option>`+state.accounts.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("");
    mainSelect.value=state.accounts.some(a=>a.id===state.mainAccountId)?state.mainAccountId:"";
    mainSelect.onchange=()=>{
      state.mainAccountId=mainSelect.value || null;
      persist();renderAll();
      showToast(state.mainAccountId?"Conto principale impostato":"Conto principale rimosso");
    };
  }

  const container = document.getElementById("accountsList");
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const bal = accountBalance(a.id);
    const card = document.createElement("button");
    card.className = "account-card";
    card.innerHTML = `
      <span class="account-info">
        <p class="account-name">${escapeHtml(a.name)}${a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:""}</p>
        <p class="account-type">${escapeHtml(ownerLabel(a.owner))} · Saldo attuale</p>
      </span>
      <span class="account-balance" style="color:${balancesHidden?"var(--ink)":moneyColor(bal)}">${balancesHidden?"••••":fmt(bal)}</span>
      <span class="account-edit" role="button" tabindex="0" aria-label="Modifica ${escapeHtml(a.name)}">✎</span>
    `;
    card.addEventListener("click", (e)=>{
      if(e.target.closest(".account-edit")){ e.stopPropagation(); openAccountForm(a.id); return; }
      openAccountEvolution(a.id);
    });
    card.querySelector(".account-edit").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();openAccountForm(a.id);}});
    container.appendChild(card);
  });
}

function renderAccountsManageList(){
  const container = document.getElementById("accountsManageList");
  if(!container) return;
  container.innerHTML = "";
  state.accounts.forEach(a=>{
    const bal = accountBalance(a.id);
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${safeColor(a.color)}22;">●</span>
      <span class="info">
        <p class="nm">${escapeHtml(a.name)}${a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:""}</p>
        <p class="sub">Saldo attuale: <span class="amt">${fmt(bal)}</span></p>
      </span>
      <span class="chev">›</span>
    `;
    row.querySelector(".ic").style.color = safeColor(a.color);
    row.addEventListener("click", ()=> openAccountForm(a.id));
    container.appendChild(row);
  });
}

function renderBalanceAdjustmentHistory(){
  const container=document.getElementById("balanceAdjustmentsList");
  const empty=document.getElementById("balanceAdjustmentsEmpty");
  if(!container) return;
  const accs=accountsById();
  const items=state.transactions.filter(t=>t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  container.innerHTML="";
  items.forEach(t=>{
    const row=document.createElement("div");
    row.className="balance-adjustment-row";
    const d=new Date(t.date+"T00:00:00");
    const sign=t.type==="income"?"+":"−";
    row.innerHTML=`
      <span class="balance-adjustment-icon">⚖️</span>
      <span class="balance-adjustment-info">
        <strong>${escapeHtml(accs[t.accountId]?.name||"Conto eliminato")}</strong>
        <small>${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${d.getFullYear()}${t.note?` · ${escapeHtml(t.note)}`:""}</small>
      </span>
      <span class="balance-adjustment-amount ${t.type}">${sign}${fmt(t.amount)}</span>`;
    container.appendChild(row);
  });
  if(empty) empty.hidden=items.length>0;
}

/* ---------------- Rendering: More (macrocategorie, categorie, grafo, dati) ---------------- */
function moveCategory(id,delta){
  const index=state.categories.findIndex(c=>c.id===id); if(index<0) return;
  const groupKey=c=>(c.macroCategoryId||"none");
  const key=groupKey(state.categories[index]);
  const peerIndexes=state.categories.map((c,i)=>groupKey(c)===key?i:-1).filter(i=>i>=0);
  const pos=peerIndexes.indexOf(index), targetPos=pos+delta;
  if(targetPos<0 || targetPos>=peerIndexes.length) return;
  const targetIndex=peerIndexes[targetPos];
  [state.categories[index],state.categories[targetIndex]]=[state.categories[targetIndex],state.categories[index]];
  persist();renderAll();
}
function moveMacroCategory(id,delta){
  const index=state.macroCategories.findIndex(m=>m.id===id), target=index+delta;
  if(index<0 || target<0 || target>=state.macroCategories.length) return;
  [state.macroCategories[index],state.macroCategories[target]]=[state.macroCategories[target],state.macroCategories[index]];
  persist();renderAll();
}
function reorderControls(label,onUp,onDown,canUp,canDown){
  const controls=document.createElement("span");controls.className="reorder-actions";
  const up=document.createElement("button");up.type="button";up.className="reorder-btn";up.textContent="↑";up.setAttribute("aria-label",`Sposta ${label} su`);up.disabled=!canUp;up.addEventListener("click",e=>{e.stopPropagation();onUp();});
  const down=document.createElement("button");down.type="button";down.className="reorder-btn";down.textContent="↓";down.setAttribute("aria-label",`Sposta ${label} giù`);down.disabled=!canDown;down.addEventListener("click",e=>{e.stopPropagation();onDown();});
  controls.append(up,down);return controls;
}
function renderCategories(){
  const container = document.getElementById("categoriesList");
  if(!container) return;
  const macros = macroCategoriesById();
  container.innerHTML = "";

  function buildRow(c,position,total){
    const wrap=document.createElement("div");wrap.className="category-manage-row";
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${safeColor(c.color)}22;">${escapeHtml(c.emoji)}</span>
      <span class="info">
        <p class="nm">${escapeHtml(c.name)}</p>
        <p class="sub">${c.kind==="income"?"Entrata":"Uscita"}${c.budget?` · budget <span class="amt">${fmt(c.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openCategoryForm(c.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`categoria ${c.name}`,()=>moveCategory(c.id,-1),()=>moveCategory(c.id,1),position>0,position<total-1));
    return wrap;
  }

  const groups = new Map();
  state.categories.forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });

  state.macroCategories.forEach(m=>{
    if(!groups.has(m.id)) return;
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title"><span>${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}</p>`;
    const items=groups.get(m.id);items.forEach((c,i)=> group.appendChild(buildRow(c,i,items.length)));
    container.appendChild(group);
  });

  if(groups.has("none")){
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title">Senza macrocategoria</p>`;
    const items=groups.get("none");items.forEach((c,i)=> group.appendChild(buildRow(c,i,items.length)));
    container.appendChild(group);
  }
}

function renderMacroCategories(){
  const container = document.getElementById("macroCategoriesList");
  if(!container) return;
  container.innerHTML = "";
  state.macroCategories.forEach((m,index)=>{
    const count = state.categories.filter(c=>c.macroCategoryId===m.id).length;
    const wrap=document.createElement("div");wrap.className="category-manage-row";
    const row = document.createElement("button");
    row.className = "category-row";
    row.innerHTML = `
      <span class="ic" style="background:${safeColor(m.color)}22;">${escapeHtml(m.emoji)}</span>
      <span class="info">
        <p class="nm">${escapeHtml(m.name)}</p>
        <p class="sub">${count} categori${count===1?"a":"e"} associat${count===1?"a":"e"}${m.budget?` · budget <span class="amt">${fmt(m.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openMacroForm(m.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`macrocategoria ${m.name}`,()=>moveMacroCategory(m.id,-1),()=>moveMacroCategory(m.id,1),index>0,index<state.macroCategories.length-1));
    container.appendChild(wrap);
  });
  const hint = document.getElementById("macroEmptyHint");
  if(hint) hint.hidden = state.macroCategories.length>0;
}

function renderCategoryGraph(){
  const container = document.getElementById("categoryGraph");
  if(!container) return;
  container.innerHTML = "";

  function buildMacroNode(title, emoji, color, children){
    const macroNode = document.createElement("div");
    macroNode.className = "graph-macro";
    macroNode.innerHTML = `<div class="graph-macro-node" style="border-color:${safeColor(color,"#999999")}"><span class="em">${escapeHtml(emoji)}</span>${escapeHtml(title)}</div>`;
    if(children.length){
      const branch = document.createElement("div");
      branch.className = "graph-branch";
      children.forEach(c=>{
        const node = document.createElement("div");
        node.className = "graph-cat-node";
        node.innerHTML = `<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}`;
        branch.appendChild(node);
      });
      macroNode.appendChild(branch);
    }
    return macroNode;
  }

  state.macroCategories.forEach(m=>{
    const children = state.categories.filter(c=>c.macroCategoryId===m.id);
    container.appendChild(buildMacroNode(m.name, m.emoji, m.color, children));
  });

  const orphan = state.categories.filter(c=> !c.macroCategoryId || !state.macroCategories.find(m=>m.id===c.macroCategoryId));
  if(orphan.length){
    container.appendChild(buildMacroNode("Senza macrocategoria", "❔", "var(--line)", orphan));
  }

  if(!state.macroCategories.length && !orphan.length){
    container.innerHTML = `<p class="empty-hint">Crea categorie e macrocategorie per vedere la struttura.</p>`;
  }
}

/* ---------------- Master render ---------------- */
function renderAll(){
  // v1.10.4: con il saldo nascosto si nascondono tutti gli importi dell'app (movimenti, budget, statistiche).
  document.documentElement.classList.toggle("amounts-hidden",!!balancesHidden);
  // Mantiene coerente lo stato anche se l'app resta aperta o torna in primo piano
  // dopo la data di scadenza: ciò che è dovuto entra subito nei Movimenti.
  generatePlannedTransactions();
  generateRecurringTransactions(false);
  renderHeader();
  renderHome();
  renderCouple();
  renderTransactionsView();
  renderRecurringList();
  renderPlannedList();
  renderStats();
  renderAccounts();
  renderAccountsManageList();
  renderMacroCategories();
  renderCategories();
  renderCategoryGraph();
  setRPMode(rpMode);
  renderRPAllView();
  renderBackupStatus();
}
function renderBackupStatus(){
  const backup=document.getElementById("backupStatus");
  if(!backup) return;
  const last=localStorage.getItem("noidue_last_backup");
  backup.classList.remove("warning");
  if(!last){
    backup.textContent="Backup consigliato: non risulta ancora alcuna esportazione su questo dispositivo.";
    backup.classList.add("warning");
    return;
  }
  const lastDate=new Date(last);
  const days=Math.floor((Date.now()-lastDate.getTime())/86400000);
  if(!Number.isFinite(days) || days>=BACKUP_WARNING_DAYS){
    backup.textContent=`Backup consigliato: l'ultimo risale a ${Number.isFinite(days)?days+" giorni fa":"una data non valida"}.`;
    backup.classList.add("warning");
  }else{
    backup.textContent=`Ultimo backup esportato: ${lastDate.toLocaleDateString("it-IT")}`;
  }
}

/* ---------------- Navigation ---------------- */
function updateMonthNavVisibility(){
  // Il mese si sceglie solo in Home e R&P; nelle altre schede la barra è nascosta.
  const hideMonth = !(activeView==="home" || activeView==="recurring"); // v1.5.1: barra del mese solo in Home e R&P
  ["prevMonth","monthLabel","nextMonth"].forEach(id=>{
    document.getElementById(id).style.display = hideMonth ? "none" : "";
  });
  document.querySelector(".topbar").style.display = hideMonth ? "none" : "";
  // v1.5.0: la barra del mese sta sotto il titolo della scheda, così il titolo non cambia posizione.
  const section=document.getElementById("view-"+activeView);
  const bar=document.querySelector(".topbar"),ret=document.getElementById("periodReturn");
  if(section && !hideMonth){
    const anchor=section.querySelector(":scope > .rp-title-row, :scope > .view-title");
    if(anchor){ if(anchor.nextElementSibling!==bar) anchor.after(bar,ret); }
    else if(section.firstElementChild!==bar) section.prepend(bar,ret);
  }
  // Il FAB "+" ha senso solo dove si vedono/aggiungono movimenti reali (Home, Movimenti).
  const showFab = activeView!=="more";
  document.getElementById("fabAdd").classList.toggle("is-hidden",!showFab);
}
function switchView(view,{animate=false,direction=0,nav=null,restore=null}={}){
  closeDatePicker();
  closePeriodMenu();
  // v1.9.0: cambiando sezione dalla barra in basso si abbandona la sotto-pagina.
  if(!nav && subNav && !isSubView(view)){
    subNav=null;
    if(history.state && history.state.mtSub){ignoreNextPop=true;try{history.back();}catch(e){ignoreNextPop=false;}}
  }
  const prevView = activeView;
  activeView = view;
  const PAIR=["home","recurring"];
  if(restore){
    viewYear=restore.year;viewMonth=restore.month;viewDay=restore.day;
    if(restore.mode) periodModes[view]=restore.mode;
    if(restore.range) periodRange={...restore.range};
  }else if(PAIR.includes(view) && (PAIR.includes(prevView) || (isSubView(prevView) && PAIR.includes(SUBVIEW_PARENT[prevView])))){
    // v1.10.3: Home e R&P mostrano sempre lo stesso mese/periodo.
    const other=PAIR.includes(prevView)?prevView:SUBVIEW_PARENT[prevView]==="home"?"home":"recurring";
    if(other!==view) periodModes[view]=periodModes[other]==="day"&&view==="recurring"?"month":periodModes[other];
  }else if(["home","recurring","stats"].includes(view)){
    const today=new Date();
    viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
    periodModes[view]="month";
    if(PAIR.includes(view)){periodModes.home="month";periodModes.recurring="month";}
  }
  document.querySelectorAll(".view").forEach(v=>{
    v.classList.remove("view-swipe-next","view-swipe-prev");
    v.classList.toggle("active", v.dataset.view===view);
  });
  document.querySelectorAll(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===((view==="planned"||view==="transactions")?"home":view==="rpall"?"recurring":view)));
  updateMonthNavVisibility();
  renderAll();
  const active=document.querySelector(`.view[data-view="${view}"]`);
  if(animate && active){
    void active.offsetWidth;
    active.classList.add(direction>0?"view-swipe-next":"view-swipe-prev");
    active.addEventListener("animationend",()=>active.classList.remove("view-swipe-next","view-swipe-prev"),{once:true});
  }
  if(nav && active){
    const cls=nav==="push"?"view-push":"view-pop";
    active.classList.remove("view-push","view-pop");
    void active.offsetWidth;
    active.classList.add(cls);
    active.addEventListener("animationend",()=>active.classList.remove(cls),{once:true});
  }
  window.scrollTo(0,restore?restore.scrollY||0:0);
  if(restore) requestAnimationFrame(()=>window.scrollTo(0,restore.scrollY||0));
}
/* ---------------- v1.9.0 — Sotto-pagine e ritorno indietro ----------------
   "Vedi tutti" apre una sotto-pagina; si torna alla sezione da cui è stata
   aperta con il pulsante ‹, con uno swipe verso destra o con il tasto
   Indietro di Android. Periodo e posizione di scorrimento vengono ripristinati. */
const SUBVIEW_PARENT={transactions:"home",rpall:"recurring",planned:"home"};
var subNav=null, ignoreNextPop=false;
try{if("scrollRestoration" in history) history.scrollRestoration="manual";}catch(e){}
function isSubView(v){return Object.prototype.hasOwnProperty.call(SUBVIEW_PARENT,v);}
function openSubView(view){
  subNav={from:activeView,scrollY:window.scrollY,year:viewYear,month:viewMonth,day:viewDay,mode:periodModes[activeView],range:periodRange?{...periodRange}:null};
  switchView(view,{nav:"push"});
  try{history.pushState({mtSub:view},"");}catch(e){}
}
function performBack(){
  const n=subNav; subNav=null;
  if(n){
    switchView(n.from,{nav:"pop",restore:n});
    const y=n.scrollY||0;
    setTimeout(()=>{if(activeView===n.from && Math.abs(window.scrollY-y)>40) window.scrollTo(0,y);},320);
  }
  else if(isSubView(activeView)) switchView(SUBVIEW_PARENT[activeView],{nav:"pop"});
}
function goBack(){
  if(subNav && history.state && history.state.mtSub){try{history.back();return;}catch(e){}}
  performBack();
}
window.addEventListener("popstate",()=>{
  if(ignoreNextPop){ignoreNextPop=false;return;}
  // Con un pannello aperto, "Indietro" chiude prima il pannello.
  const sheets=[...overlayRoot.querySelectorAll(".sheet")];
  const top=sheets[sheets.length-1];
  if(top && typeof top._close==="function"){
    top._close();
    if(subNav && isSubView(activeView)){try{history.pushState({mtSub:activeView},"");}catch(e){}}
    return;
  }
  if(subNav || isSubView(activeView)) performBack();
});
document.querySelectorAll("[data-nav-back]").forEach(b=>b.addEventListener("click",goBack));
function setRPMode(mode){
  rpMode=mode;
  const rpView=document.getElementById("view-recurring");
  if(rpView){
    rpView.classList.remove("rp-mode-total","rp-mode-recurring","rp-mode-planned");
    rpView.classList.add(`rp-mode-${mode}`);
  }
  const total=document.getElementById("rpTotalSection"), recurring=document.getElementById("rpRecurringSection"), planned=document.getElementById("rpPlannedSection");
  if(total) total.hidden=mode!=="total";
  if(recurring) recurring.hidden=mode!=="recurring";
  if(planned) planned.hidden=mode!=="planned";
  const recurringCard=document.getElementById("recurringEstimateCard"),plannedCard=document.getElementById("plannedEstimateCard"),combined=document.getElementById("rpCombinedEstimateCard"),grid=document.getElementById("rpEstimatesGrid");
  if(recurringCard) recurringCard.hidden=mode==="planned";
  if(plannedCard) plannedCard.hidden=mode==="recurring";
  if(combined) combined.hidden=mode!=="total";
  if(grid) grid.classList.toggle("single",mode!=="total");
  document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.classList.toggle("active",btn.dataset.rpMode===mode));
}
document.querySelectorAll("#rpModeToggle [data-rp-mode]").forEach(btn=>btn.addEventListener("click",()=>setRPMode(btn.dataset.rpMode)));
document.querySelectorAll(".tab").forEach(tab=>{
  tab.addEventListener("click", ()=> switchView(tab.dataset.view));
});

// Swipe orizzontale: attivo solo in Home. In R&P è disabilitato.
// Direzione: swipe verso destra = mese precedente; swipe verso sinistra = mese successivo.
const MONTH_SWIPE_VIEWS=["home"];
const viewsRoot=document.getElementById("views");
let monthSwipeStartX=0,monthSwipeStartY=0,monthSwipeBlocked=false;
function moveMonthFromSwipe(delta){
  txVisibleLimit=TX_PAGE_SIZE;
  const d=new Date(viewYear,viewMonth+delta,1);
  viewYear=d.getFullYear();
  viewMonth=d.getMonth();
  viewDay=Math.min(viewDay,new Date(viewYear,viewMonth+1,0).getDate());
  closePeriodMenu();
  renderAll();
}
viewsRoot.addEventListener("touchstart",e=>{
  if(e.touches.length!==1 || !MONTH_SWIPE_VIEWS.includes(activeView)){monthSwipeBlocked=true;return;}
  const target=e.target;
  monthSwipeBlocked=Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay"));
  if(monthSwipeBlocked) return;
  const t=e.touches[0];monthSwipeStartX=t.clientX;monthSwipeStartY=t.clientY;
},{passive:true});
viewsRoot.addEventListener("touchend",e=>{
  if(monthSwipeBlocked || !MONTH_SWIPE_VIEWS.includes(activeView) || !e.changedTouches.length){monthSwipeBlocked=false;return;}
  const t=e.changedTouches[0],dx=t.clientX-monthSwipeStartX,dy=t.clientY-monthSwipeStartY;
  monthSwipeBlocked=false;
  if(Math.abs(dx)<58 || Math.abs(dx)<=Math.abs(dy)*1.25) return;
  moveMonthFromSwipe(dx>0 ? -1 : 1);
},{passive:true});
// v1.9.0 — Swipe verso destra nelle sotto-pagine: la pagina segue il dito
// e, superata la soglia, si torna alla sezione di origine (Home o R&P).
(function(){
  let g=null;
  const html=document.documentElement;
  const blocked=t=>t.closest("input,textarea,select,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay,.lp-popup,#overlayRoot,dialog");
  document.addEventListener("touchstart",e=>{
    g=null;
    if(!isSubView(activeView) || e.touches.length!==1 || overlayRoot.querySelector(".sheet")) return;
    if(blocked(e.target) || canScrollLeftWithin(e.target,document.body)) return;
    const t=e.touches[0];
    g={x:t.clientX,y:t.clientY,lastX:t.clientX,lastT:performance.now(),v:0,active:false,dead:false,view:document.querySelector(`.view[data-view="${activeView}"]`)};
  },{passive:true});
  document.addEventListener("touchmove",e=>{
    if(!g || g.dead || !g.view) return;
    const t=e.touches[0],dx=t.clientX-g.x,dy=t.clientY-g.y;
    if(!g.active){
      if(Math.abs(dy)>10 && Math.abs(dy)>=Math.abs(dx)){g.dead=true;return;}
      if(dx<-10){g.dead=true;return;}
      if(dx<12 || dx<Math.abs(dy)*1.3) return;
      g.active=true; g.view.classList.add("view-dragging"); html.classList.add("back-swiping");
    }
    e.preventDefault();
    const now=performance.now();
    g.v=(t.clientX-g.lastX)/Math.max(1,now-g.lastT); g.lastX=t.clientX; g.lastT=now;
    const x=Math.max(0,dx);
    g.view.style.transform=`translateX(${x}px)`;
    g.view.style.opacity=String(1-Math.min(x,420)/1000);
  },{passive:false});
  function end(e){
    if(!g) return;
    const s=g; g=null;
    if(!s.active) return;
    const endX=e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : s.lastX;
    const dx=endX-s.x;
    s.view.classList.remove("view-dragging");
    // Evita che il rilascio del dito apra la riga sotto.
    const stop=ev=>{ev.stopPropagation();ev.preventDefault();};
    document.addEventListener("click",stop,true);
    setTimeout(()=>document.removeEventListener("click",stop,true),350);
    const commit=dx>window.innerWidth*0.3 || (s.v>0.45 && dx>40);
    s.view.style.transition="transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s ease";
    if(commit){
      s.view.style.transform="translateX(100%)"; s.view.style.opacity="0";
      setTimeout(()=>{s.view.style.transition="";s.view.style.transform="";s.view.style.opacity="";html.classList.remove("back-swiping");goBack();},200);
    }else{
      s.view.style.transform=""; s.view.style.opacity="";
      setTimeout(()=>{s.view.style.transition="";html.classList.remove("back-swiping");},220);
    }
  }
  document.addEventListener("touchend",end,{passive:true});
  document.addEventListener("touchcancel",end,{passive:true});
})();
// v1.9.0 — Menu azioni e scelta R/P: si chiudono anche con swipe in basso o a destra.
function bindOverlaySwipeDismiss(overlay){
  const menu=overlay.querySelector(".movement-action-menu"); if(!menu) return;
  let st=null;
  menu.addEventListener("touchstart",e=>{if(e.touches.length===1){const t=e.touches[0];st={x:t.clientX,y:t.clientY,axis:null};}},{passive:true});
  menu.addEventListener("touchmove",e=>{
    if(!st) return; const t=e.touches[0],dx=t.clientX-st.x,dy=t.clientY-st.y;
    if(!st.axis){ if(dy>10&&dy>Math.abs(dx)) st.axis="y"; else if(dx>10&&dx>Math.abs(dy)) st.axis="x"; else if(Math.abs(dx)>10||dy<-10){st=null;return;} else return; menu.style.transition="none"; }
    e.preventDefault();
    menu.style.transform=st.axis==="y"?`translateY(${Math.max(0,dy)}px)`:`translateX(${Math.max(0,dx)}px)`;
  },{passive:false});
  menu.addEventListener("touchend",e=>{
    if(!st||!st.axis){st=null;return;} const t=e.changedTouches[0],d=st.axis==="y"?t.clientY-st.y:t.clientX-st.x,ax=st.axis; st=null;
    menu.style.transition="transform .2s ease";
    if(d>80){menu.style.transform=ax==="y"?"translateY(110%)":"translateX(110%)";overlay.classList.remove("show");setTimeout(()=>overlay.remove(),200);}
    else menu.style.transform="";
  },{passive:true});
}
document.querySelectorAll("#txTypeToggle [data-tx-type]").forEach(btn=>btn.addEventListener("click",()=>{txFilter=btn.dataset.txType;txVisibleLimit=TX_PAGE_SIZE;document.querySelectorAll("#txTypeToggle .type-opt").forEach(x=>x.classList.toggle("active",x===btn));renderTransactionsView();}));
document.getElementById("txSearchInput").addEventListener("input",e=>{
  const value=e.target.value.trim();
  clearTimeout(txSearchTimer);
  txSearchTimer=setTimeout(()=>{txSearchQuery=value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();},180);
});
document.getElementById("loadMoreTxBtn")?.addEventListener("click",()=>{txVisibleLimit+=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("toggleCustomRange").addEventListener("click",()=>{const el=document.getElementById("txCustomRange");el.hidden=!el.hidden;});
document.getElementById("txDateFrom").addEventListener("change",e=>{txDateFrom=e.target.value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("txDateTo").addEventListener("change",e=>{txDateTo=e.target.value;txVisibleLimit=TX_PAGE_SIZE;renderTransactionsView();});
document.getElementById("clearCustomRange").addEventListener("click",()=>{txDateFrom="";txDateTo="";txVisibleLimit=TX_PAGE_SIZE;document.getElementById("txDateFrom").value="";document.getElementById("txDateTo").value="";renderTransactionsView();});
document.getElementById("backToHomeTx").addEventListener("click",()=>switchView("home"));
document.getElementById("seeAllTx").addEventListener("click", ()=> {periodModes.transactions=periodModes.home;openSubView("transactions");});
document.getElementById("txPeriodBtn")?.addEventListener("click",()=>openPeriodPicker("transactions"));
document.getElementById("openRPFromHome").addEventListener("click",()=>switchView("recurring"));

function closePeriodMenu(){document.getElementById("periodMenu").hidden=true;document.getElementById("monthLabel").setAttribute("aria-expanded","false");}
document.getElementById("monthLabel").addEventListener("click",()=>{
  openPeriodPicker();
});
document.getElementById("periodX").addEventListener("click",()=>setPeriodMode("month"));
/* v1.7.0 — Selettore del periodo (Home, R&P, Tutti i movimenti):
   - tocca il titolo del mese per vedere i 12 mesi e cambiare mese/anno;
   - "Tutto il mese" mostra il mese intero;
   - tocca un giorno = solo quel giorno; tocca un secondo giorno = periodo dal primo al secondo; poi "Mostra". */
function renderMonthsGrid(container,year,currentY,currentM,onPick){
  container.innerHTML=MESI_BREVI.map((m,i)=>`<button type="button" class="pp-month${year===currentY&&i===currentM?" selected":""}${year===new Date().getFullYear()&&i===new Date().getMonth()?" today":""}" data-m="${i}">${m}</button>`).join("");
  container.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>onPick(Number(b.dataset.m))));
}
function yearsRange(){
  const now=new Date().getFullYear();
  const years=[...state.transactions.map(t=>t.date),...state.planned.map(p=>p.date),...state.recurring.map(r=>r.startDate)].filter(Boolean).map(d=>parseInt(d.slice(0,4),10)).filter(Number.isFinite);
  const min=Math.min(now-5,...years), max=Math.max(now+5,...years);
  const out=[];for(let y=min;y<=max;y++)out.push(y);return out;
}
function renderYearsGrid(container,currentY,onPick){
  const nowY=new Date().getFullYear();
  container.innerHTML=yearsRange().map(y=>`<button type="button" class="pp-month pp-year${y===currentY?" selected":""}${y===nowY?" today":""}" data-y="${y}">${y}</button>`).join("");
  container.querySelectorAll("[data-y]").forEach(b=>b.addEventListener("click",()=>onPick(Number(b.dataset.y))));
  const sel=container.querySelector(".selected"); if(sel) sel.scrollIntoView({block:"center"});
}
/* Calendario sempre di 6 settimane (42 caselle): stessa altezza per mesi di 28, 29, 30 o 31 giorni. */
function padCalendarGrid(grid,lead,days){
  // v1.9.1: completa solo l'ultima settimana (niente riga vuota in fondo).
  const total=Math.ceil((lead+days)/7)*7;
  for(let i=lead+days;i<total;i++){const b=document.createElement("div");b.className="calendar-cell empty";grid.appendChild(b);}
}
function openPeriodPicker(view=activeView,opts=null){
  const target=view;
  let pYear=viewYear,pMonth=viewMonth,level="days";
  const mode=opts?"range":(periodModes[target]||"month");
  let selStart=opts?opts.from:mode==="day"?selectedDate():mode==="range"?periodRange.from:null;
  let selEnd=opts?(opts.to!==opts.from?opts.to:null):mode==="range"?periodRange.to:null;
  if(opts && opts.to){const d=new Date(opts.to+"T00:00:00");pYear=d.getFullYear();pMonth=d.getMonth();}
  else if(mode==="range" && periodRange.from){const d=new Date(periodRange.from+"T00:00:00");pYear=d.getFullYear();pMonth=d.getMonth();}
  openSheet("tpl-period-picker",(node)=>{
    const closeBtn=node.querySelector("[data-close]");
    const title=node.querySelector("#ppTitle"), days=node.querySelector("#ppDays"), months=node.querySelector("#ppMonths");
    const hint=node.querySelector("#ppHint"), apply=node.querySelector("#ppApply"), whole=node.querySelector("#ppWholeMonth");
    function paint(){
      const showMonths=level!=="days";
      title.innerHTML=level==="days"?`${MESI[pMonth]} ${pYear} <span class="pp-caret">▾</span>`:level==="months"?`${pYear} <span class="pp-caret">▾</span>`:`Scegli l'anno`;
      days.hidden=showMonths; months.hidden=!showMonths; months.classList.toggle("is-years",level==="years");
      whole.textContent=`Tutto ${MESI[pMonth].toLowerCase()}`;
      whole.classList.toggle("active",!opts && mode==="month" && !selStart && pYear===viewYear && pMonth===viewMonth);
      if(level==="months"){
        renderMonthsGrid(months,pYear,viewYear,viewMonth,(m)=>{pMonth=m;level="days";paint();});
      }else if(level==="years"){
        renderYearsGrid(months,pYear,(y)=>{pYear=y;level="months";paint();});
      }else{
        const grid=node.querySelector("#ppGrid");grid.innerHTML="";
        const lead=(new Date(pYear,pMonth,1).getDay()+6)%7, n=new Date(pYear,pMonth+1,0).getDate();
        const info=buildCalendarDayInfo(pYear,pMonth), todayStr=todayISO();
        for(let i=0;i<lead;i++){const b=document.createElement("div");b.className="calendar-cell empty";grid.appendChild(b);}
        for(let d=1;d<=n;d++){
          const iso=`${pYear}-${pad2(pMonth+1)}-${pad2(d)}`;
          const isStart=iso===selStart, isEnd=iso===selEnd, inside=selStart&&selEnd&&iso>selStart&&iso<selEnd;
          const cell=document.createElement("button");cell.type="button";
          cell.className="calendar-cell"+(iso===todayStr?" today":"")+(isStart||isEnd?" selected":"")+(inside?" in-range":"")+(isStart&&selEnd?" range-start":"")+(isEnd?" range-end":"");
          cell.innerHTML=`<span class="cal-day-num">${d}</span><span class="cal-dots">${info[iso]?.real?'<span class="cal-dot real"></span>':""}</span>`;
          cell.setAttribute("aria-label",`${d} ${MESI[pMonth]} ${pYear}`);
          cell.addEventListener("click",()=>{
            if(!selStart || selEnd){selStart=iso;selEnd=null;}
            else if(iso===selStart){selEnd=null;}
            else if(iso<selStart){selEnd=selStart;selStart=iso;}
            else selEnd=iso;
            paint();
          });
          grid.appendChild(cell);
        }
        padCalendarGrid(grid,lead,n);
        node.style.setProperty("--pp-h",days.offsetHeight+"px");
      }
      if(!selStart){hint.textContent="Tocca un giorno, oppure due giorni per un periodo.";apply.disabled=true;apply.textContent="Mostra";}
      else if(!selEnd){hint.textContent=`${shortDate(selStart,true)} · tocca un altro giorno per scegliere un periodo`;apply.disabled=false;apply.textContent="Mostra giorno";}
      else{hint.textContent=`Dal ${shortDate(selStart)} al ${shortDate(selEnd,true)}`;apply.disabled=false;apply.textContent="Mostra periodo";}
    }
    // Tocca il titolo: giorni → mesi → anni (e dagli anni si torna ai mesi).
    title.addEventListener("click",()=>{level=level==="days"?"months":level==="months"?"years":"months";paint();});
    node.querySelector("#ppPrev").addEventListener("click",()=>{if(showMonths)pYear--;else{pMonth--;if(pMonth<0){pMonth=11;pYear--;}}paint();});
    node.querySelector("#ppNext").addEventListener("click",()=>{if(showMonths)pYear++;else{pMonth++;if(pMonth>11){pMonth=0;pYear++;}}paint();});
    whole.addEventListener("click",()=>{
      if(opts){const last=new Date(pYear,pMonth+1,0).getDate();closeBtn.click();opts.onApply({from:`${pYear}-${pad2(pMonth+1)}-01`,to:`${pYear}-${pad2(pMonth+1)}-${pad2(last)}`});return;}
      viewYear=pYear;viewMonth=pMonth;viewDay=Math.min(viewDay||1,new Date(pYear,pMonth+1,0).getDate());
      periodModes[target]="month";txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();
    });
    apply.addEventListener("click",()=>{
      if(!selStart) return;
      if(opts){const r={from:selStart,to:selEnd||selStart};closeBtn.click();opts.onApply(r);return;}
      const d=new Date(selStart+"T00:00:00");viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=d.getDate();
      if(selEnd){periodRange={from:selStart,to:selEnd};periodModes[target]="range";}
      else periodModes[target]="day";
      txVisibleLimit=TX_PAGE_SIZE;closeBtn.click();renderAll();
    });
    paint();
  });
}
function setPeriodMode(mode){
  if(mode===periodModes[activeView]) return;
  if(mode==="day"){
    const today=new Date();
    if(viewYear===today.getFullYear()&&viewMonth===today.getMonth()) viewDay=today.getDate();
    else viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
  }
  periodModes[activeView]=mode;txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();renderAll();
}
document.querySelectorAll("[data-period-set]").forEach(b=>b.addEventListener("click",()=>{
  const mode=b.dataset.periodSet;
  if(mode===periodModes[activeView]) return;
  if(mode==="day"){
    const today=new Date();
    if(viewYear===today.getFullYear()&&viewMonth===today.getMonth()) viewDay=today.getDate();
    else viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
  }
  periodModes[activeView]=mode;txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();renderAll();
}));
document.addEventListener("click",e=>{if(!e.target.closest(".period-picker"))closePeriodMenu();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePeriodMenu();});
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{
  const today=new Date();
  viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
  periodModes[activeView]="day";closeDatePicker();closePeriodMenu();renderAll();
}));
function closeDatePicker(){
  document.getElementById("dateField").hidden=true;
  document.getElementById("chooseDay").setAttribute("aria-expanded","false");
}
document.getElementById("chooseDay").addEventListener("click",()=>{
  const field=document.getElementById("dateField");field.hidden=!field.hidden;
  document.getElementById("chooseDay").setAttribute("aria-expanded",String(!field.hidden));
  if(!field.hidden){
    const input=document.getElementById("periodDate");input.focus();
    if(input.showPicker){try{input.showPicker();}catch(e){/* The visible date field remains usable. */}}
  }
});
document.getElementById("backToMonth").addEventListener("click",()=>{
  periodModes[activeView]="month";closeDatePicker();closePeriodMenu();renderAll();
});
document.getElementById("periodDate").addEventListener("change",e=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;
  const [y,m,d]=e.target.value.split("-").map(Number);viewYear=y;viewMonth=m-1;viewDay=d;
  periodModes[activeView]="day";closeDatePicker();renderAll();
});
document.getElementById("backFromPlanned").addEventListener("click",()=>switchView("home"));
function movePeriod(delta){
  txVisibleLimit=TX_PAGE_SIZE;
  if(periodModes[activeView]==="day"){
    const d=new Date(viewYear,viewMonth,viewDay+delta);viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=d.getDate();
  }else{
    const d=new Date(viewYear,viewMonth+delta,1);viewYear=d.getFullYear();viewMonth=d.getMonth();viewDay=Math.min(viewDay,new Date(viewYear,viewMonth+1,0).getDate());
  }
  closePeriodMenu();renderAll();
}
document.getElementById("prevMonth").addEventListener("click",()=>movePeriod(-1));
document.getElementById("nextMonth").addEventListener("click",()=>movePeriod(1));

/* ---------------- Tema chiaro/scuro/sistema ---------------- */
document.querySelectorAll("#themeModeToggle .type-opt").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    currentThemeMode = opt.dataset.themeMode;
    safeSetLocalStorage(THEME_KEY, currentThemeMode,{notify:false});
    applyTheme(currentThemeMode);
  });
});

/* ---------------- Statistiche: toggle categoria/macrocategoria ---------------- */
document.querySelectorAll("#statsGroupToggle .type-opt").forEach(opt=>{
  opt.addEventListener("click", ()=>{
    document.querySelectorAll("#statsGroupToggle .type-opt").forEach(o=>o.classList.remove("active"));
    opt.classList.add("active");
    statsGroupMode = opt.dataset.group;
    renderPie();
  });
});
document.querySelectorAll("#statsNatureToggle .type-opt").forEach(opt=>opt.addEventListener("click",()=>{statsNature=opt.dataset.statsNature;document.querySelectorAll("#statsNatureToggle .type-opt").forEach(x=>x.classList.toggle("active",x===opt));document.querySelector("#view-stats .section-head h2").textContent=statsNature==="income"?"Entrate per categoria":"Spese per categoria";renderPie();}));
document.querySelectorAll("[data-chart-info]").forEach(btn=>btn.addEventListener("click",()=>openChartInfo(btn.dataset.chartInfo)));

/* ---------------- Sheet / overlay system ---------------- */
const overlayRoot = document.getElementById("overlayRoot");
function canScrollLeftWithin(el,root){
  for(let n=el;n && n!==root && n!==document.body;n=n.parentElement){
    if(n.scrollWidth>n.clientWidth+2 && n.scrollLeft>0){
      const ox=getComputedStyle(n).overflowX;
      if(ox==="auto"||ox==="scroll") return true;
    }
  }
  return false;
}
function openSheet(templateId, setup){
  const tpl = document.getElementById(templateId);
  const backdrop = document.createElement("div");
  backdrop.className = "overlay-backdrop";
  const node = tpl.content.firstElementChild.cloneNode(true);
  overlayRoot.appendChild(backdrop);
  overlayRoot.appendChild(node);
  overlayRoot.style.pointerEvents = "auto";
  document.documentElement.classList.add("sheet-open");

  let closing=false;
  function finishClose(){
    backdrop.remove();
    node.remove();
    overlayRoot.style.pointerEvents = overlayRoot.querySelector(".sheet") ? "auto" : "none";
    if(!overlayRoot.querySelector(".sheet")) document.documentElement.classList.remove("sheet-open");
  }
  function close(fromSwipe=false){
    if(closing) return;
    closing=true;
    node.classList.remove("dragging");
    node.style.transition="";
    backdrop.style.transition="";
    backdrop.style.opacity="";
    if(fromSwipe==="x"){
      // v1.9.0: swipe verso destra, il pannello esce lateralmente.
      node.style.transform="translateX(105%)";
      backdrop.classList.remove("show");
    }else if(fromSwipe){
      // Mantiene il pannello sotto al dito e completa l'uscita verso il basso.
      node.style.transform="translateY(105%)";
      backdrop.classList.remove("show");
    }else{
      node.style.transform="";
      node.classList.remove("show");
      backdrop.classList.remove("show");
    }
    setTimeout(finishClose, 280);
  }
  node._close=()=>close(false);
  backdrop.addEventListener("click", ()=>close(false));
  node.querySelectorAll("[data-close]").forEach(b=> b.addEventListener("click", ()=>close(false)));

  // Bottom-sheet gesture: quando il pannello è già in cima, uno swipe verso il
  // basso può iniziare dalla maniglia, dall'intestazione o dalla parte visibile
  // del contenuto. Il foglio segue il dito e si chiude per distanza o velocità.
  let touch=null;
  const resetDrag=()=>{
    touch=null;
    node.classList.remove("dragging");
    node.style.transform="";
    backdrop.style.opacity="";
  };
  node.addEventListener("touchstart", e=>{
    if(closing || e.touches.length!==1) return;
    const t=e.touches[0];
    touch={
      x:t.clientX,
      y:t.clientY,
      lastY:t.clientY,
      lastTime:performance.now(),
      velocityY:0,
      active:false,
      cancelled:false,
      canPull:node.scrollTop<=1 || Boolean(e.target.closest(".sheet-handle, .sheet-head")),
      canX:!e.target.closest("input,textarea,select,[contenteditable='true'],.chart-wrap,.donut-wrap,svg") && !canScrollLeftWithin(e.target,node),
      axis:null,lastX:t.clientX,velocityX:0
    };
  }, {passive:true});
  node.addEventListener("touchmove", e=>{
    if(!touch || touch.cancelled || e.touches.length!==1) return;
    const t=e.touches[0];
    const dx=t.clientX-touch.x;
    const dy=t.clientY-touch.y;

    // Lascia funzionare normalmente scroll verso l'alto e gesti orizzontali.
    if(!touch.active && touch.canX && dx>12 && dx>Math.abs(dy)*1.3){
      touch.active=true; touch.axis="x";
      node.classList.add("dragging");
    }
    if(touch.axis==="x"){
      e.preventDefault();
      const nowX=performance.now();
      touch.velocityX=(t.clientX-touch.lastX)/Math.max(1,nowX-touch.lastTime);
      touch.lastX=t.clientX; touch.lastTime=nowX;
      const x=Math.max(0,dx);
      node.style.transform=`translateX(${x}px)`;
      backdrop.style.opacity=String(Math.max(0.12,1-Math.min(x,420)/520));
      return;
    }
    if(!touch.active){
      if(Math.abs(dx)>Math.abs(dy)+4){ if(dx<0||!touch.canX) touch.cancelled=true; return; }
      if(dy<0){ touch.cancelled=true; return; }
      if(dy<7) return;
      if(!(touch.canPull && node.scrollTop<=1)){ touch.cancelled=true; return; }
      touch.active=true;
      node.classList.add("dragging");
    }

    e.preventDefault();
    const distance=Math.max(0,dy);
    const now=performance.now();
    const dt=Math.max(1,now-touch.lastTime);
    touch.velocityY=(t.clientY-touch.lastY)/dt;
    touch.lastY=t.clientY;
    touch.lastTime=now;

    // Una lieve resistenza rende naturale il trascinamento oltre ~300 px.
    const translated=distance<=300 ? distance : 300+(distance-300)*0.35;
    node.style.transform=`translateY(${translated}px)`;
    backdrop.style.opacity=String(Math.max(0.12,1-Math.min(distance,420)/520));
  }, {passive:false});
  node.addEventListener("touchend", e=>{
    if(!touch) return;
    const t=e.changedTouches[0];
    if(touch.axis==="x"){
      const dxEnd=t.clientX-touch.x, flickX=touch.velocityX>0.5 && dxEnd>36;
      touch=null;
      if(dxEnd>100 || flickX){ close("x"); return; }
      node.classList.remove("dragging");
      node.style.transform="";
      backdrop.style.opacity="";
      return;
    }
    const dy=t.clientY-touch.y;
    const fastFlick=touch.velocityY>0.55 && dy>32;
    const shouldClose=touch.active && (dy>92 || fastFlick);
    const wasActive=touch.active;
    touch=null;

    if(shouldClose){
      close(true);
      return;
    }
    if(wasActive){
      node.classList.remove("dragging");
      node.style.transform="";
      backdrop.style.opacity="";
    }
  }, {passive:true});
  node.addEventListener("touchcancel", resetDrag, {passive:true});

  requestAnimationFrame(()=>{
    backdrop.classList.add("show");
    node.classList.add("show");
  });

  if(typeof setup === "function") setup(node, close);
  return { node, close };
}

/* ---------------- Noi Due — vista Coppia, rimborsi e impostazioni ---------------- */
function coupleDetailRows(t){
  if(t.isBalanceAdjustment) return "";
  if(t.type==="transfer"){
    if(!isCoupleSettle(t)) return "";
    const alloc=t.settleAlloc?Object.entries(t.settleAlloc).filter(([,v])=>Math.abs(v)>=0.005).map(([g,v])=>`${groupLabel(g)} ${fmt(Math.abs(v))}`).join(", "):groupLabel(groupOf(t));
    return `<div class="tx-detail-row"><span class="k">Rimborso</span><span class="v">${escapeHtml(personName(accOwner(t.accountId)))} → ${escapeHtml(personName(accOwner(t.toAccountId)))}</span></div>
      <div class="tx-detail-row"><span class="k">${t.settleAlloc?"Gruppi":"Gruppo"}</span><span class="v">${escapeHtml(alloc)}</span></div>`;
  }
  const owner=accOwner(t.accountId), v=txDebt(t);
  const payer=owner==="a"||owner==="b"?personName(owner):"Cassa comune";
  return `<div class="tx-detail-row"><span class="k">Gruppo</span><span class="v">${escapeHtml(groupLabel(groupOf(t)))}</span></div>
    <div class="tx-detail-row"><span class="k">${t.type==="income"?"Ricevuto da":"Pagato da"}</span><span class="v">${escapeHtml(payer)}</span></div>
    <div class="tx-detail-row"><span class="k">Divisione</span><span class="v">${escapeHtml(splitLabel(t))}</span></div>
    ${Math.abs(v)>=0.005?`<div class="tx-detail-row"><span class="k">Effetto</span><span class="v">${escapeHtml(debtSentence(v))}</span></div>`:""}`;
}
function paintAvatar(el,k){ if(!el) return; el.textContent=personInitial(k); el.style.background=personColor(k); }
function renderCoupleStrip(){
  const bal=coupleBalance();
  paintAvatar(document.getElementById("stripAvA"),"a");
  paintAvatar(document.getElementById("stripAvB"),"b");
  const who=document.getElementById("stripWho"), amt=document.getElementById("stripAmount");
  if(!who||!amt) return;
  if(Math.abs(bal)<0.005){ who.textContent="Tra voi due"; amt.textContent="Siete in pari"; amt.style.color=""; return; }
  const debtor=bal>0?"b":"a";
  who.textContent=`${personName(debtor)} deve a ${personName(otherPerson(debtor))}`;
  amt.textContent=balancesHidden?"••••":fmt(Math.abs(bal));
  amt.style.color=personColor(otherPerson(debtor));
}
function renderCouple(){
  renderCoupleStrip();
  const view=document.getElementById("view-coppia");
  if(!view) return;
  const bal=coupleBalance();
  paintAvatar(document.getElementById("coupleAvA"),"a");
  paintAvatar(document.getElementById("coupleAvB"),"b");
  view.style.setProperty("--ca",personColor("a"));
  view.style.setProperty("--cb",personColor("b"));
  document.getElementById("coupleNameA").textContent=personName("a");
  document.getElementById("coupleNameB").textContent=personName("b");
  const who=document.getElementById("coupleWho"), amount=document.getElementById("coupleAmount");
  if(Math.abs(bal)<0.005){ who.textContent="Siete in pari"; amount.textContent=balancesHidden?"••••":fmt(0); amount.style.color="var(--ink)"; }
  else{
    const debtor=bal>0?"b":"a";
    who.textContent=`${personName(debtor)} deve a ${personName(otherPerson(debtor))}`;
    amount.textContent=balancesHidden?"••••":fmt(Math.abs(bal));
    amount.style.color=personColor(otherPerson(debtor));
  }
  setEyeIcon(document.getElementById("toggleCoupleBalance"),balancesHidden);
  // Il nodo della fune si sposta verso chi deve ricevere: più è grande il debito, più si sposta.
  const spent=state.transactions.filter(t=>t.type==="expense"&&!t.isBalanceAdjustment).reduce((s,t)=>s+t.amount,0);
  const scale=Math.max(spent*0.15,50);
  const shift=Math.max(-40,Math.min(40,bal/scale*40));
  document.getElementById("coupleKnot").style.left=(50-shift)+"%";

  const today=new Date(), y=today.getFullYear(), m=today.getMonth();
  const st=coupleMonthStats(y,m);
  const show=v=>balancesHidden?"••••":fmt(v);
  document.getElementById("couplePaidALabel").textContent=`Ha pagato ${personName("a")}`;
  document.getElementById("couplePaidBLabel").textContent=`Ha pagato ${personName("b")}`;
  document.getElementById("couplePaidA").textContent=show(st.paid.a);
  document.getElementById("couplePaidB").textContent=show(st.paid.b);
  document.getElementById("couplePaidJoint").textContent=show(st.paid.joint);
  document.getElementById("coupleSharesTitle").textContent=`Quote di ${MESI[m].toLowerCase()}`;
  const max=Math.max(st.paid.a,st.paid.b,st.quota.a,st.quota.b,1);
  const bar=(label,v,color,soft)=>`<div class="cs-row"><div class="cs-lbl"><span>${escapeHtml(label)}</span><strong>${show(v)}</strong></div><div class="cs-bar"><i style="width:${(v/max*100).toFixed(1)}%;background:${soft?`color-mix(in srgb,${color} 40%,transparent)`:color}"></i></div></div>`;
  document.getElementById("coupleShares").innerHTML = (st.paid.a+st.paid.b)>0
    ? bar(`Quota di ${personName("a")}`,st.quota.a,personColor("a"))+bar(`Pagato da ${personName("a")}`,st.paid.a,personColor("a"),true)
      +bar(`Quota di ${personName("b")}`,st.quota.b,personColor("b"))+bar(`Pagato da ${personName("b")}`,st.paid.b,personColor("b"),true)
      +`<p class="field-hint cs-note">La quota è la parte di spese personali che spetta a ciascuno; le spese dalla cassa comune non sono incluse.</p>`
    : `<p class="empty-hint">Nessuna spesa con carte personali questo mese.</p>`;
  const shared=st.shared.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id))).slice(0,8);
  renderTxRows(document.getElementById("coupleSharedTx"),shared);
  document.getElementById("coupleSharedEmpty").hidden=shared.length>0;
  const settles=state.transactions.filter(isCoupleSettle).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  renderTxRows(document.getElementById("coupleSettleTx"),settles);
  document.getElementById("coupleSettleEmpty").hidden=settles.length>0;
  renderCoupleGroups();
  renderCoupleLists();
  if(groupDetailRefresh) groupDetailRefresh();
  if(listDetailRefresh) listDetailRefresh();
}
/* ---------------- Liste della spesa / cose da comprare ---------------- */
function renderHomeLists(){
  const box=document.getElementById("homeLists");
  if(!box) return;
  box.innerHTML="";
  state.lists.forEach(l=>{
    const todo=l.items.filter(i=>!i.done).length;
    const b=document.createElement("button"); b.type="button"; b.className="home-list-chip";
    b.innerHTML=`<span class="em">${escapeHtml(l.emoji)}</span><span class="hl-name">${escapeHtml(l.name)}</span><span class="list-count${todo?"":" zero"}">${todo}</span>`;
    b.setAttribute("aria-label",`${l.name}: ${todo} da comprare`);
    b.addEventListener("click",()=>openListDetail(l.id));
    box.appendChild(b);
  });
  box.hidden=!state.lists.length;
}
function renderCoupleLists(){
  renderHomeLists();
  const box=document.getElementById("coupleLists");
  if(!box) return;
  box.innerHTML="";
  if(!state.lists.length){ box.innerHTML=`<p class="empty-hint">Nessuna lista. Tocca "+ Nuova" per crearne una.</p>`; return; }
  state.lists.forEach(l=>{
    const todo=l.items.filter(i=>!i.done).length, done=l.items.length-todo;
    const g=groupsById()[l.groupId];
    const card=document.createElement("button");
    card.type="button"; card.className="group-card list-card";
    card.innerHTML=`<span class="mv-ic" style="background:${safeColor(g?.color||"#D4A83A")}22">${escapeHtml(l.emoji)}</span>
      <span class="group-card-text"><strong>${escapeHtml(l.name)}</strong><span>${todo?`${todo} da comprare`:"Niente da comprare"}${done?` · ${done} nel carrello`:""}</span><span>${g?escapeHtml(g.emoji+" "+g.name):""}</span></span>
      <span class="list-count${todo?"":" zero"}">${todo}</span>
      <span class="chev" aria-hidden="true">›</span>`;
    card.addEventListener("click",()=>openListDetail(l.id));
    box.appendChild(card);
  });
}
var listDetailRefresh=null;
function listCategoryFor(l){
  const exp=state.categories.filter(c=>c.kind==="expense");
  const byName=n=>exp.find(c=>c.name.toLowerCase()===n);
  return (byName(l.name.toLowerCase()) || (/casa/i.test(l.name)&&byName("casa")) || (/spes|super|aliment/i.test(l.name)&&byName("spesa")) || (/farmac/i.test(l.name)&&byName("farmacia")) || null)?.id || null;
}
function openListDetail(listId){
  openSheet("tpl-list-detail",(node,close)=>{
    const input=node.querySelector("#listItemInput"), priceInput=node.querySelector("#listPriceInput");
    const list=()=>state.lists.find(l=>l.id===listId);
    function save(){ persist(); renderCoupleLists(); paint(); }
    function itemRow(it){
      const row=document.createElement("div");
      row.className="list-item"+(it.done?" done":"");
      row.setAttribute("role","button"); row.tabIndex=0;
      const pic=it.photo||it.image;
      row.innerHTML=`<span class="list-check" aria-hidden="true">${it.done?"✓":""}</span>
        <span class="list-thumb">${pic?`<img src="${escapeHtml(pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}</span>
        <span class="list-text">${escapeHtml(it.text)}${it.code?`<small class="list-code">${escapeHtml(it.code)}</small>`:""}</span>
        <span class="list-price">${it.price?(balancesHidden?"••••":fmt(it.price)):""}</span>
        <button type="button" class="list-del" aria-label="Dettagli di ${escapeHtml(it.text)}">›</button>`;
      row.querySelector("img")?.addEventListener("error",e=>{ e.target.remove(); });
      row.setAttribute("aria-pressed",String(it.done));
      const toggle=()=>{ it.done=!it.done; save(); };
      row.addEventListener("click",e=>{ if(e.target.closest(".list-del")) return; toggle(); });
      activateRowFromKeyboard(row,toggle);
      row.querySelector(".list-del").addEventListener("click",e=>{ e.stopPropagation(); openListItem(listId,it.id); });
      return row;
    }
    function paint(){
      if(!node.isConnected){ listDetailRefresh=null; return; }
      const l=list();
      if(!l){ listDetailRefresh=null; close(); return; }
      node.querySelector("#listDetailTitle").textContent=`${l.emoji} ${l.name}`;
      const todo=l.items.filter(i=>!i.done), done=l.items.filter(i=>i.done);
      const todoBox=node.querySelector("#listTodo"), doneBox=node.querySelector("#listDone");
      todoBox.innerHTML=""; todo.forEach(it=>todoBox.appendChild(itemRow(it)));
      doneBox.innerHTML=""; done.forEach(it=>doneBox.appendChild(itemRow(it)));
      node.querySelector("#listEmpty").hidden=l.items.length>0;
      node.querySelector("#listDoneWrap").hidden=!done.length;
      const est=todo.reduce((s,i)=>s+(i.price||0),0), cart=done.reduce((s,i)=>s+(i.price||0),0);
      const parts=[]; if(est>0) parts.push(`Stima da comprare ${balancesHidden?"••••":fmt(est)}`); if(cart>0) parts.push(`nel carrello ${balancesHidden?"••••":fmt(cart)}`);
      node.querySelector("#listTotal").textContent=parts.join(" · ");
      const reg=node.querySelector("#listRegisterBtn");
      reg.hidden=!done.length;
      reg.textContent=`🧾 Registra come spesa (${done.length})`;
    }
    function add(){
      const text=input.value.trim();
      if(!text){ input.focus(); return; }
      const price=parseAmount(priceInput.value);
      list().items.push({id:uid(),text:text.slice(0,120),price:price>0?Math.round(price*100)/100:null,done:false,code:"",image:"",url:"",photo:""});
      input.value=""; priceInput.value="";
      save(); input.focus();
    }
    node.querySelector("#listAddBtn").addEventListener("click",add);
    node.querySelector("#listScanBtn").addEventListener("click",()=>openProductScan(item=>{
      list().items.push({id:uid(),done:false,price:null,code:"",image:"",url:"",photo:"",...item});
      save(); showToast("Aggiunto alla lista");
    }));
    [input,priceInput].forEach(el=>el.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } }));
    node.querySelector("#listClearDone").addEventListener("click",()=>{ const l=list(); markDeleted(l.items.filter(i=>i.done).map(i=>i.id)); l.items=l.items.filter(i=>!i.done); save(); showToast("Tolti gli articoli nel carrello"); });
    node.querySelector("#listEditBtn").addEventListener("click",()=>{ close(); openListForm(listId); });
    node.querySelector("#listRegisterBtn").addEventListener("click",()=>{
      const l=list(), done=l.items.filter(i=>i.done);
      if(!done.length) return;
      const amount=done.reduce((s,i)=>s+(i.price||0),0);
      const ids=new Set(done.map(i=>i.id));
      close();
      openAddTransaction(null,{name:l.name,amount,categoryId:listCategoryFor(l),groupId:l.groupId,note:done.map(i=>i.text).join(", ").slice(0,500),
        onSaved:()=>{ const cur=state.lists.find(x=>x.id===listId); markDeleted([...ids]); if(cur) cur.items=cur.items.filter(i=>!ids.has(i.id)); showToast("Spesa registrata: articoli tolti dalla lista"); }});
      if(!(amount>0)) setTimeout(()=>showToast("Inserisci l'importo dello scontrino"),400);
    });
    listDetailRefresh=paint;
    paint();
  });
}
function openListForm(listId=null){
  const l=listId?state.lists.find(x=>x.id===listId):null;
  openSheet("tpl-list-form",(node,close)=>{
    const draft={name:l?.name||"",emoji:l?.emoji||"🛒",groupId:l?.groupId||defaultGroupId()};
    node.querySelector("#listFormTitle").textContent=l?"Modifica lista":"Nuova lista";
    const nameInput=node.querySelector("#listNameInput"); nameInput.value=draft.name;
    buildEmojiField(node.querySelector("#listEmojiRow"),draft.emoji,v=>{draft.emoji=v;});
    const chips=node.querySelector("#listGroupChips");
    const paintGroups=()=>{
      chips.innerHTML=state.groups.map(g=>`<button type="button" class="chip${g.id===draft.groupId?" active":""}" data-group="${escapeHtml(g.id)}"><span class="em">${escapeHtml(g.emoji)}</span>${escapeHtml(g.name)}</button>`).join("");
      chips.querySelectorAll("[data-group]").forEach(b=>b.addEventListener("click",()=>{draft.groupId=b.dataset.group;paintGroups();}));
    };
    paintGroups();
    const del=node.querySelector("#deleteListBtn");
    if(l){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm(`Eliminare la lista "${l.name}"${l.items.length?` con ${l.items.length} articoli`:""}?`,{ok:"Elimina",danger:true})) return;
        markDeleted(l.id, l.items.map(i=>i.id));
        state.lists=state.lists.filter(x=>x.id!==l.id);
        persist(); renderAll(); close(); showToast("Lista eliminata");
      });
    }
    node.querySelector("#saveListBtn").addEventListener("click",()=>{
      const name=nameInput.value.trim();
      if(!name){ showToast("Inserisci il nome della lista"); nameInput.focus(); return; }
      if(l){ Object.assign(l,{name,emoji:draft.emoji,groupId:draft.groupId}); persist(); renderAll(); close(); showToast("Lista aggiornata"); }
      else{ const nl={id:uid(),name,emoji:draft.emoji,groupId:draft.groupId,items:[]}; state.lists.push(nl); persist(); renderAll(); close(); openListDetail(nl.id); }
    });
  });
}
function renderCoupleGroups(){
  const box=document.getElementById("coupleGroups");
  if(!box) return;
  const month=new Date();
  box.innerHTML="";
  state.groups.forEach(g=>{
    const bal=groupBalance(g.id);
    const spent=coupleMonthStats(month.getFullYear(),month.getMonth(),g.id);
    const card=document.createElement("button");
    card.type="button"; card.className="group-card";
    const debtor=bal>0?"b":"a";
    const who=Math.abs(bal)<0.005?"In pari":`${personName(debtor)} deve a ${personName(otherPerson(debtor))}`;
    card.innerHTML=`<span class="mv-ic" style="background:${safeColor(g.color)}22">${escapeHtml(g.emoji)}</span>
      <span class="group-card-text"><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(who)}</span><span>${balancesHidden?"••••":fmt(spent.paid.a+spent.paid.b+spent.paid.joint)} spesi a ${MESI[month.getMonth()].toLowerCase()}</span></span>
      <span class="group-card-amt" style="color:${Math.abs(bal)<0.005?"var(--ink-soft)":personColor(otherPerson(debtor))}">${Math.abs(bal)<0.005?"€0":(balancesHidden?"••••":fmt(Math.abs(bal)))}</span>
      <span class="chev" aria-hidden="true">›</span>`;
    card.addEventListener("click",()=>openGroupDetail(g.id));
    box.appendChild(card);
  });
}
var groupDetailRefresh=null;
function openGroupDetail(gid){
  openSheet("tpl-group-detail",(node,close)=>{
    function paint(){
      if(!node.isConnected){ groupDetailRefresh=null; return; }
      const g=groupsById()[gid];
      if(!g){ groupDetailRefresh=null; close(); return; }
      const bal=groupBalance(gid);
      node.querySelector("#groupDetailTitle").textContent=`${g.emoji} ${g.name}`;
      const hero=node.querySelector("#groupDetailHero");
      hero.style.setProperty("--ca",personColor("a")); hero.style.setProperty("--cb",personColor("b")); hero.style.setProperty("--gc",safeColor(g.color));
      const amt=node.querySelector("#groupDetailAmount");
      if(Math.abs(bal)<0.005){ node.querySelector("#groupDetailWho").textContent="Siete in pari"; amt.textContent=balancesHidden?"••••":fmt(0); amt.style.color="var(--ink)"; }
      else{ const d=bal>0?"b":"a"; node.querySelector("#groupDetailWho").textContent=`${personName(d)} deve a ${personName(otherPerson(d))}`; amt.textContent=balancesHidden?"••••":fmt(Math.abs(bal)); amt.style.color=personColor(otherPerson(d)); }
      node.querySelector("#groupDetailNameA").textContent=personName("a");
      node.querySelector("#groupDetailNameB").textContent=personName("b");
      const spentAll=state.transactions.filter(t=>t.type==="expense"&&!t.isBalanceAdjustment&&groupOf(t)===gid).reduce((s,t)=>s+t.amount,0);
      const shift=Math.max(-40,Math.min(40,bal/Math.max(spentAll*0.15,50)*40));
      node.querySelector("#groupDetailKnot").style.left=(50-shift)+"%";
      const today=new Date(), st=coupleMonthStats(today.getFullYear(),today.getMonth(),gid), show=v=>balancesHidden?"••••":fmt(v);
      node.querySelector("#gdPaidALabel").textContent=`Ha pagato ${personName("a")}`;
      node.querySelector("#gdPaidBLabel").textContent=`Ha pagato ${personName("b")}`;
      node.querySelector("#gdPaidA").textContent=show(st.paid.a);
      node.querySelector("#gdPaidB").textContent=show(st.paid.b);
      node.querySelector("#gdPaidJoint").textContent=show(st.paid.joint);
      node.querySelector("#gdMonth").textContent=`Spese di ${MESI[today.getMonth()].toLowerCase()} in questo gruppo`;
      const list=state.transactions.filter(t=>!t.isBalanceAdjustment && (t.type!=="transfer" ? groupOf(t)===gid : (isCoupleSettle(t) && Math.abs(txDebtIn(t,gid))>=0.005)))
        .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id))).slice(0,40);
      renderTxRows(node.querySelector("#groupDetailTx"),list);
      node.querySelector("#groupDetailEmpty").hidden=list.length>0;
    }
    groupDetailRefresh=paint;
    node.querySelector("#groupSettleBtn").addEventListener("click",()=>{close();openSettleForm(gid);});
    node.querySelector("#groupEditBtn").addEventListener("click",()=>{close();openGroupForm(gid);});
    paint();
  });
}
function openGroupForm(gid=null){
  const g=gid?state.groups.find(x=>x.id===gid):null;
  openSheet("tpl-group-form",(node,close)=>{
    const draft={name:g?.name||"",emoji:g?.emoji||"👥",color:g?.color||PALETTE[(state.groups.length*3)%PALETTE.length],defaultSplit:g?.defaultSplit||"half"};
    node.querySelector("#groupFormTitle").textContent=g?"Modifica gruppo":"Nuovo gruppo";
    const nameInput=node.querySelector("#groupNameInput"); nameInput.value=draft.name;
    buildEmojiField(node.querySelector("#groupEmojiRow"),draft.emoji,v=>{draft.emoji=v;});
    const colorRow=node.querySelector("#groupColorRow");
    const paintColors=()=>{ colorRow.innerHTML=""; PALETTE.forEach(c=>{ const sw=document.createElement("button"); sw.type="button"; sw.className="color-swatch"+(c.toLowerCase()===draft.color.toLowerCase()?" active":""); sw.style.background=c; sw.setAttribute("aria-label","Colore "+c); sw.addEventListener("click",()=>{draft.color=c;paintColors();}); colorRow.appendChild(sw); }); };
    paintColors();
    const toggle=node.querySelector("#groupDefaultSplit");
    const paintSplit=()=>toggle.querySelectorAll(".type-opt").forEach(b=>b.classList.toggle("active",b.dataset.split===draft.defaultSplit));
    toggle.querySelectorAll(".type-opt").forEach(b=>b.addEventListener("click",()=>{draft.defaultSplit=b.dataset.split;paintSplit();}));
    paintSplit();
    const del=node.querySelector("#deleteGroupBtn");
    if(g && state.groups.length>1){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        const target=state.groups.find(x=>x.id!==g.id);
        const used=state.transactions.some(t=>groupOf(t)===g.id||t.settleAlloc?.[g.id]!=null)||state.recurring.some(r=>r.groupId===g.id)||state.planned.some(p=>p.groupId===g.id);
        if(!await askConfirm(used?`Eliminare il gruppo "${g.name}"? I suoi movimenti passano a "${target.name}".`:`Eliminare il gruppo "${g.name}"?`,{ok:"Elimina",danger:true})) return;
        [...state.transactions,...state.recurring,...state.planned,...state.lists].forEach(t=>{ if(t.groupId===g.id) t.groupId=target.id; });
        state.transactions.forEach(t=>{ if(t.settleAlloc&&t.settleAlloc[g.id]!=null){ t.settleAlloc[target.id]=Math.round(((t.settleAlloc[target.id]||0)+t.settleAlloc[g.id])*100)/100; delete t.settleAlloc[g.id]; } });
        markDeleted(g.id);
        state.groups=state.groups.filter(x=>x.id!==g.id);
        if(state.couple.lastGroupId===g.id) state.couple.lastGroupId=null;
        persist(); renderAll(); close(); showToast("Gruppo eliminato");
      });
    }
    node.querySelector("#saveGroupBtn").addEventListener("click",()=>{
      const name=nameInput.value.trim();
      if(!name){showToast("Inserisci il nome del gruppo");nameInput.focus();return;}
      if(g) Object.assign(g,{name,emoji:draft.emoji,color:draft.color,defaultSplit:draft.defaultSplit});
      else state.groups.push({id:uid(),name,emoji:draft.emoji,color:draft.color,defaultSplit:draft.defaultSplit});
      persist(); renderAll(); close(); showToast(g?"Gruppo aggiornato":"Gruppo creato");
    });
  });
}
/* Rimborso: per un solo gruppo oppure per il totale. Il rimborso del totale viene ripartito
   tra i gruppi (settleAlloc) in modo che, se salda tutto, ogni gruppo torni in pari. */
function settleScopeBalance(scope){ return scope==="all" ? coupleBalance() : groupBalance(scope); }
function allocateTotalSettle(effect){
  const total=coupleBalance(), alloc={};
  if(Math.abs(total)<0.005) return null;
  const k=effect/total; // negativo: ogni gruppo si riduce nella stessa proporzione
  state.groups.forEach(g=>{ const v=Math.round(groupBalance(g.id)*k*100)/100; if(Math.abs(v)>=0.005) alloc[g.id]=v; });
  const t={settleAlloc:alloc}; const keys=Object.keys(alloc);
  if(!keys.length) return null;
  const diff=Math.round((effect-keys.reduce((s,x)=>s+alloc[x],0))*100)/100;
  if(diff){ const big=keys.reduce((m,x)=>Math.abs(alloc[x])>Math.abs(alloc[m])?x:m,keys[0]); alloc[big]=Math.round((alloc[big]+diff)*100)/100; }
  return t.settleAlloc;
}
function openSettleForm(scope="all"){
  if(scope!=="all" && !state.groups.some(g=>g.id===scope)) scope="all";
  let bal=settleScopeBalance(scope);
  let from=bal<0?"a":"b";
  let fromAcc=null, toAcc=null;
  openSheet("tpl-settle",(node,close)=>{
    const amountInput=node.querySelector("#settleAmountInput"), dateInput=node.querySelector("#settleDateInput"), noteInput=node.querySelector("#settleNoteInput");
    const dir=node.querySelector("#settleDirToggle"), hint=node.querySelector("#settleHint"), scopeChips=node.querySelector("#settleScopeChips");
    const fromChips=node.querySelector("#settleFromChips"), toChips=node.querySelector("#settleToChips");
    dateInput.value=todayISO(); dateInput.max=todayISO();
    const setAmount=()=>{ amountInput.value=Math.abs(bal)>=0.005?String(Math.abs(bal)).replace(".",","):""; amountInput.dispatchEvent(new Event("input")); };
    autoGrowAmountInput(amountInput); setAmount();
    function chipsFor(container,owner,getSel,setSel){
      container.innerHTML="";
      const list=state.accounts.filter(a=>a.owner===owner);
      if(!list.length){ container.innerHTML=`<p class="field-hint">Nessun conto di ${escapeHtml(personName(owner))}: aggiungilo in Conti.</p>`; setSel(null); return; }
      if(!list.some(a=>a.id===getSel())) setSel(list[0].id);
      list.forEach(a=>{
        const chip=document.createElement("button"); chip.type="button";
        chip.className="chip"+(getSel()===a.id?" active":"");
        chip.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`; chip.querySelector(".em").style.color=safeColor(a.color);
        chip.addEventListener("click",()=>{setSel(a.id);render();});
        container.appendChild(chip);
      });
    }
    function scopeLabel(k){
      const v=settleScopeBalance(k);
      const name=k==="all"?"Tutti i gruppi":groupLabel(k);
      return `${escapeHtml(name)}<span class="scope-amt">${Math.abs(v)<0.005?"in pari":fmt(Math.abs(v))}</span>`;
    }
    function render(){
      scopeChips.innerHTML=["all",...state.groups.map(g=>g.id)].map(k=>`<button type="button" class="chip${k===scope?" active":""}" data-scope="${escapeHtml(k)}">${scopeLabel(k)}</button>`).join("");
      scopeChips.querySelectorAll("[data-scope]").forEach(b=>b.addEventListener("click",()=>{scope=b.dataset.scope;bal=settleScopeBalance(scope);if(Math.abs(bal)>=0.005) from=bal<0?"a":"b";setAmount();render();}));
      // Per il totale la direzione è quella del debito complessivo.
      const forced=scope==="all" && Math.abs(bal)>=0.005;
      dir.hidden=forced;
      if(forced) from=bal<0?"a":"b";
      const to=otherPerson(from);
      dir.querySelectorAll(".type-opt").forEach(b=>{const k=b.dataset.dir;b.textContent=`${personName(k)} → ${personName(otherPerson(k))}`;b.classList.toggle("active",k===from);});
      node.querySelector("#settleFromLabel").textContent=`Dal conto di ${personName(from)}`;
      node.querySelector("#settleToLabel").textContent=`Al conto di ${personName(to)}`;
      chipsFor(fromChips,from,()=>fromAcc,v=>{fromAcc=v;});
      chipsFor(toChips,to,()=>toAcc,v=>{toAcc=v;});
      const amt=parseAmount(amountInput.value);
      if(scope==="all" && Math.abs(bal)<0.005){ hint.textContent="Il totale è in pari: se un gruppo è aperto, saldalo scegliendolo qui sopra."; return; }
      const after=Math.round((bal+(from==="a"?amt:-amt))*100)/100;
      const where=scope==="all"?"in totale":`in ${groupLabel(scope)}`;
      hint.textContent=amt>0?`Dopo il rimborso, ${where}: ${Math.abs(after)<0.005?"siete in pari":debtSentence(after)}.`:`${debtSentence(bal)} ${where}.`;
    }
    dir.querySelectorAll(".type-opt").forEach(b=>b.addEventListener("click",()=>{from=b.dataset.dir;fromAcc=null;toAcc=null;render();}));
    amountInput.addEventListener("input",()=>{ if(scopeChips.childElementCount) render(); });
    render();
    node.querySelector("#saveSettleBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const missing=[]; if(amount<=0) missing.push("importo"); if(!fromAcc) missing.push(`conto di ${personName(from)}`); if(!toAcc) missing.push(`conto di ${personName(otherPerson(from))}`);
      if(missing.length){showToast("Inserisci: "+missing.join(", "));return;}
      if(dateInput.value>todayISO()){showToast("Il rimborso non può avere una data futura");return;}
      const tx={id:uid(),date:dateInput.value||todayISO(),amount,type:"transfer",name:transferName(fromAcc,toAcc),categoryId:null,accountId:fromAcc,toAccountId:toAcc,note:noteInput.value.trim(),settle:true,split:null,groupId:null};
      if(scope==="all"){
        const alloc=allocateTotalSettle(txDebt(tx));
        if(!alloc){showToast("Il totale è in pari: scegli il gruppo da saldare");return;}
        tx.settleAlloc=alloc;
      } else tx.groupId=scope;
      state.transactions.push(tx);
      persist(); renderAll(); close();
      showToast("Rimborso registrato");
    });
  });
}
function openCoupleForm(){
  openSheet("tpl-couple-form",(node,close)=>{
    const draft={a:{...state.couple.a},b:{...state.couple.b},defaultSplit:state.couple.defaultSplit};
    const nameA=node.querySelector("#coupleNameAInput"), nameB=node.querySelector("#coupleNameBInput");
    nameA.value=/^Persona 1$/.test(draft.a.name)?"":draft.a.name;
    nameB.value=/^Persona 2$/.test(draft.b.name)?"":draft.b.name;
    function colors(rowId,k){
      const row=node.querySelector(rowId); row.innerHTML="";
      PALETTE.forEach(color=>{
        const sw=document.createElement("button"); sw.type="button";
        sw.className="color-swatch"+(color.toLowerCase()===draft[k].color.toLowerCase()?" active":"");
        sw.style.background=color; sw.setAttribute("aria-label","Colore "+color);
        sw.addEventListener("click",()=>{draft[k].color=color;colors(rowId,k);});
        row.appendChild(sw);
      });
    }
    colors("#coupleColorARow","a"); colors("#coupleColorBRow","b");
    const toggle=node.querySelector("#coupleDefaultSplit");
    const paint=()=>toggle.querySelectorAll(".type-opt").forEach(b=>b.classList.toggle("active",b.dataset.split===draft.defaultSplit));
    toggle.querySelectorAll(".type-opt").forEach(b=>b.addEventListener("click",()=>{draft.defaultSplit=b.dataset.split;paint();}));
    paint();
    node.querySelector("#saveCoupleBtn").addEventListener("click",()=>{
      const oldA=state.couple.a.name, oldB=state.couple.b.name;
      draft.a.name=nameA.value.trim()||"Persona 1";
      draft.b.name=nameB.value.trim()||"Persona 2";
      // Rinomina i conti creati di serie ("Carta Persona 1") con il nuovo nome.
      state.accounts.forEach(acc=>{
        if(acc.owner==="a" && acc.name===`Carta ${oldA}`) acc.name=`Carta ${draft.a.name}`;
        if(acc.owner==="b" && acc.name===`Carta ${oldB}`) acc.name=`Carta ${draft.b.name}`;
      });
      state.couple=draft;
      sanitizeCouple(state);
      persist(); renderAll(); close();
      showToast("Coppia aggiornata");
    });
  });
}
document.getElementById("homeCoupleStrip")?.addEventListener("click",()=>switchView("coppia"));
document.getElementById("settleBtn")?.addEventListener("click",()=>openSettleForm("all"));
document.getElementById("addGroupBtn")?.addEventListener("click",()=>openGroupForm());
document.getElementById("addListBtn")?.addEventListener("click",()=>openListForm());
document.getElementById("openCoupleSettingsBtn")?.addEventListener("click",()=>openCoupleForm());
document.getElementById("editCoupleBtn")?.addEventListener("click",openCoupleForm);
document.getElementById("toggleCoupleBalance")?.addEventListener("click",toggleBalances);

/* ---------------- Noi Due 1.3.0 — Prodotti: codice a barre, foto, ricerca online ---------------- */
function markDeleted(...ids){
  if(!state.deleted||typeof state.deleted!=="object") state.deleted={};
  const d=todayISO();
  ids.flat().forEach(id=>{ if(id) state.deleted[String(id)]=d; });
}
const PRODUCT_DBS=[
  ["world.openfoodfacts.org","Open Food Facts"],
  ["world.openbeautyfacts.org","Open Beauty Facts"],
  ["world.openproductsfacts.org","Open Products Facts"],
  ["world.openpetfoodfacts.org","Open Pet Food Facts"],
];
function cleanCode(v){ return String(v||"").replace(/[^0-9A-Za-z-]/g,"").slice(0,32); }
async function lookupProduct(code){
  code=cleanCode(code);
  if(!code) return null;
  for(const [host,label] of PRODUCT_DBS){
    try{
      const r=await fetch(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_it,generic_name_it,brands,quantity,image_front_small_url,image_front_url`);
      if(!r.ok) continue;
      const j=await r.json();
      if(j.status===1 && j.product){
        const p=j.product;
        const name=String(p.product_name_it||p.product_name||p.generic_name_it||"").trim();
        const brand=String(p.brands||"").split(",")[0].trim();
        if(!name && !brand) continue;
        return {code,name,brand,quantity:String(p.quantity||"").trim(),image:String(p.image_front_small_url||p.image_front_url||""),url:`https://${host}/product/${code}`,source:label};
      }
    }catch(e){ /* rete assente o database non raggiungibile: prova il successivo */ }
  }
  return null;
}
function productTitle(p){
  let t=p.name||"";
  if(p.brand && !t.toLowerCase().includes(p.brand.toLowerCase())) t=t?`${t} – ${p.brand}`:p.brand;
  if(p.quantity) t+=` (${p.quantity})`;
  return t.trim().slice(0,120);
}
function productLinksHtml({name="",code="",url=""}){
  const q=encodeURIComponent((name||code||"").trim());
  if(!q && !url) return "";
  const a=(href,label)=>`<a class="pill-btn item-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  return [url?a(url,"Scheda prodotto ↗"):"", q?a(`https://www.google.com/search?q=${q}`,"Cerca su Google ↗"):"", q?a(`https://www.google.com/search?tbm=shop&q=${q}`,"Confronta prezzi ↗"):"", q?a(`https://www.amazon.it/s?k=${q}`,"Amazon ↗"):""].join("");
}
function compressPhoto(file,max=480,quality=0.72){
  return new Promise((resolve,reject)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*s); c.height=Math.round(img.naturalHeight*s);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg",quality));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("immagine non leggibile")); };
    img.src=url;
  });
}
/* Lettura dei codici: BarcodeDetector se il telefono lo offre, altrimenti la libreria ZXing
   caricata solo quando serve (richiede internet, come la ricerca del prodotto). */
const BARCODE_FORMATS=["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf"];
let zxingPromise=null;
function loadZXing(){
  if(window.ZXing) return Promise.resolve(window.ZXing);
  if(!zxingPromise) zxingPromise=new Promise((resolve,reject)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
    s.async=true;
    s.onload=()=>window.ZXing?resolve(window.ZXing):reject(new Error("zxing"));
    s.onerror=()=>{ zxingPromise=null; reject(new Error("zxing")); };
    document.head.appendChild(s);
  });
  return zxingPromise;
}
async function nativeDetector(){
  try{
    if(!("BarcodeDetector" in window)) return null;
    const supported=await window.BarcodeDetector.getSupportedFormats();
    const formats=BARCODE_FORMATS.filter(f=>supported.includes(f));
    return formats.length?new window.BarcodeDetector({formats}):null;
  }catch(e){ return null; }
}
function zxingReader(Z){
  const hints=new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.CODE_39,Z.BarcodeFormat.ITF]);
  hints.set(Z.DecodeHintType.TRY_HARDER,true);
  return new Z.BrowserMultiFormatReader(hints);
}
async function decodeBarcodeFromFile(file){
  const det=await nativeDetector();
  if(det){
    try{ const bmp=await createImageBitmap(file); const res=await det.detect(bmp); if(res&&res[0]) return res[0].rawValue; }catch(e){}
  }
  try{
    const Z=await loadZXing(), url=URL.createObjectURL(file);
    try{ const r=await zxingReader(Z).decodeFromImageUrl(url); return r?.getText?.()||null; }
    catch(e){ return null; }
    finally{ URL.revokeObjectURL(url); }
  }catch(e){ throw new Error("lettore non disponibile"); }
}
function openProductScan(onAdd){
  openSheet("tpl-scan",(node,close)=>{
    const status=node.querySelector("#scanStatus"), result=node.querySelector("#scanResult");
    const wrap=node.querySelector("#scanVideoWrap"), video=node.querySelector("#scanVideo");
    const codeInput=node.querySelector("#scanCodeInput"), photoInput=node.querySelector("#scanPhotoInput");
    let stream=null, reader=null, loop=null, busy=false;
    function stopCamera(){
      clearInterval(loop); loop=null;
      try{ reader?.reset?.(); }catch(e){} reader=null;
      if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
      video.srcObject=null; wrap.hidden=true;
    }
    const watch=setInterval(()=>{ if(!node.isConnected){ stopCamera(); clearInterval(watch); } },500);
    function showProduct(p,{photo="",code=""}={}){
      const found=!!p;
      const title=found?productTitle(p):"";
      const pic=photo||(p&&p.image)||"";
      result.innerHTML=`<div class="scan-card">
        ${pic?`<img class="scan-img" src="${escapeHtml(pic)}" alt="" referrerpolicy="no-referrer">`:""}
        <p class="scan-found">${found?`Trovato su ${escapeHtml(p.source)}`:code?`Codice ${escapeHtml(code)}: non è nei database aperti`:"Foto del prodotto"}</p>
        <div class="field-row"><label>Nome nella lista</label><input type="text" class="text-input" id="scanNameInput" maxlength="120" value="${escapeHtml(title)}" placeholder="es. Detersivo lavatrice"></div>
        <div class="field-row"><label>Prezzo stimato (facoltativo)</label><input type="text" class="text-input" id="scanPriceInput" inputmode="decimal" placeholder="€" autocomplete="off"></div>
        <div class="item-links" id="scanLinks"></div>
        <button type="button" class="gd-settle" id="scanAddBtn">＋ Aggiungi alla lista</button>
      </div>`;
      result.querySelector(".scan-img")?.addEventListener("error",e=>e.target.remove());
      const nameInput=result.querySelector("#scanNameInput");
      const links=()=>{ result.querySelector("#scanLinks").innerHTML=productLinksHtml({name:nameInput.value,code,url:p?.url||""}); };
      nameInput.addEventListener("input",links); links();
      result.querySelector("#scanAddBtn").addEventListener("click",()=>{
        const text=nameInput.value.trim()||(code?`Prodotto ${code}`:"");
        if(!text){ showToast("Scrivi il nome del prodotto"); nameInput.focus(); return; }
        const price=parseAmount(result.querySelector("#scanPriceInput").value);
        onAdd({text,price:price>0?Math.round(price*100)/100:null,code:code||p?.code||"",image:p?.image||"",url:p?.url||"",photo});
        stopCamera(); close();
      });
      if(!found) nameInput.focus();
    }
    async function handleCode(raw,{photo=""}={}){
      const code=cleanCode(raw);
      if(!code||busy) return;
      busy=true; stopCamera(); codeInput.value=code;
      status.textContent=`Codice ${code}: cerco il prodotto…`;
      if(navigator.vibrate) navigator.vibrate(40);
      const p=await lookupProduct(code);
      status.textContent=p?"Prodotto trovato. Controlla il nome e aggiungilo.":navigator.onLine===false?"Sei offline: aggiungi il prodotto con il codice e cercalo più tardi.":"Non l'ho trovato: scrivi il nome e usa i link per cercarlo online.";
      showProduct(p,{code,photo});
      busy=false;
    }
    node.querySelector("#scanCodeBtn").addEventListener("click",()=>handleCode(codeInput.value));
    codeInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); handleCode(codeInput.value); } });
    node.querySelector("#scanLiveBtn").addEventListener("click",async()=>{
      if(stream||reader){ stopCamera(); status.textContent="Fotocamera chiusa."; return; }
      result.innerHTML="";
      if(!navigator.mediaDevices?.getUserMedia){ status.textContent="Questo telefono non permette di inquadrare dal vivo: usa “Scatta una foto”."; return; }
      status.textContent="Apro la fotocamera…";
      const det=await nativeDetector();
      try{
        if(det){
          stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
          video.srcObject=stream; wrap.hidden=false; await video.play();
          status.textContent="Inquadra il codice a barre nel riquadro.";
          loop=setInterval(async()=>{ if(busy||video.readyState<2) return; try{ const r=await det.detect(video); if(r&&r[0]) handleCode(r[0].rawValue); }catch(e){} },250);
        }else{
          const Z=await loadZXing();
          wrap.hidden=false;
          reader=zxingReader(Z);
          await reader.decodeFromConstraints({video:{facingMode:{ideal:"environment"}}},video,(res)=>{ if(res) handleCode(res.getText()); });
          status.textContent="Inquadra il codice a barre nel riquadro.";
        }
      }catch(e){
        stopCamera();
        status.textContent=e?.name==="NotAllowedError"?"Accesso alla fotocamera negato: consentilo nelle impostazioni o usa “Scatta una foto”.":e?.message==="zxing"?"Per leggere i codici serve internet. Puoi scrivere il codice a mano.":"Fotocamera non disponibile: usa “Scatta una foto” o scrivi il codice.";
      }
    });
    node.querySelector("#scanPhotoBtn").addEventListener("click",()=>{ stopCamera(); photoInput.click(); });
    photoInput.addEventListener("change",async()=>{
      const file=photoInput.files&&photoInput.files[0];
      photoInput.value="";
      if(!file) return;
      status.textContent="Leggo la foto…"; result.innerHTML="";
      let photo="";
      try{ photo=await compressPhoto(file); }catch(e){}
      let code=null;
      try{ code=await decodeBarcodeFromFile(file); }catch(e){ /* lettore non caricato */ }
      if(code){ handleCode(code,{photo:""}); return; }
      status.textContent="Nessun codice a barre nella foto: la tengo come foto del prodotto. Scrivi il nome e usa i link per cercarlo.";
      showProduct(null,{photo});
    });
  });
}
function openListItem(listId,itemId){
  const l=state.lists.find(x=>x.id===listId), it=l?.items.find(x=>x.id===itemId);
  if(!it) return;
  openSheet("tpl-list-item",(node,close)=>{
    const draft={photo:it.photo||"",image:it.image||"",url:it.url||""};
    const nameInput=node.querySelector("#itemNameInput"), priceInput=node.querySelector("#itemPriceInput"), codeInput=node.querySelector("#itemCodeInput");
    nameInput.value=it.text; priceInput.value=it.price?String(it.price).replace(".",","):""; codeInput.value=it.code||"";
    const photoBox=node.querySelector("#itemPhoto"), links=node.querySelector("#itemLinks"), removeBtn=node.querySelector("#itemPhotoRemove");
    function paint(){
      const pic=draft.photo||draft.image;
      photoBox.innerHTML=pic?`<img src="${escapeHtml(pic)}" alt="" referrerpolicy="no-referrer">`:"";
      photoBox.hidden=!pic;
      photoBox.querySelector("img")?.addEventListener("error",()=>{ photoBox.hidden=true; });
      removeBtn.hidden=!draft.photo;
      links.innerHTML=productLinksHtml({name:nameInput.value,code:codeInput.value,url:draft.url});
    }
    nameInput.addEventListener("input",paint); codeInput.addEventListener("input",()=>{ draft.url=""; paint(); });
    node.querySelector("#itemLookupBtn").addEventListener("click",async()=>{
      const code=cleanCode(codeInput.value);
      if(!code){ showToast("Scrivi il codice a barre"); codeInput.focus(); return; }
      showToast("Cerco il prodotto…");
      const p=await lookupProduct(code);
      if(!p){ showToast("Prodotto non trovato nei database aperti"); return; }
      nameInput.value=productTitle(p); draft.image=p.image; draft.url=p.url; paint();
      showToast(`Trovato su ${p.source}`);
    });
    const photoInput=node.querySelector("#itemPhotoInput");
    node.querySelector("#itemPhotoBtn").addEventListener("click",()=>photoInput.click());
    photoInput.addEventListener("change",async()=>{
      const file=photoInput.files&&photoInput.files[0]; photoInput.value="";
      if(!file) return;
      try{ draft.photo=await compressPhoto(file); paint(); }catch(e){ showToast("Foto non leggibile"); }
    });
    removeBtn.addEventListener("click",()=>{ draft.photo=""; paint(); });
    node.querySelector("#deleteItemBtn").addEventListener("click",()=>{
      const cur=state.lists.find(x=>x.id===listId); if(!cur) return close();
      markDeleted(it.id); cur.items=cur.items.filter(x=>x.id!==it.id);
      persist(); renderCoupleLists(); if(listDetailRefresh) listDetailRefresh(); close(); showToast("Articolo eliminato");
    });
    node.querySelector("#saveItemBtn").addEventListener("click",()=>{
      const text=nameInput.value.trim();
      if(!text){ showToast("Scrivi il nome"); nameInput.focus(); return; }
      const price=parseAmount(priceInput.value);
      Object.assign(it,{text:text.slice(0,120),price:price>0?Math.round(price*100)/100:null,code:cleanCode(codeInput.value),photo:draft.photo,image:draft.image,url:draft.url});
      if(!persist()){ showToast("Spazio pieno: togli qualche foto dalle liste"); return; }
      renderCoupleLists(); if(listDetailRefresh) listDetailRefresh(); close();
    });
    paint();
  });
}

/* ---------------- Add Transaction sheet ---------------- */
function openAddTransaction(txId,prefill=null){
  const editing=!!txId;
  const existing=editing ? state.transactions.find(t=>t.id===txId) : null;
  if(editing && !existing) return;
  // Trasferimenti e prelievi hanno il proprio pannello, anche in modifica.
  if(existing?.type==="transfer") return existing.atm ? openAtmWithdrawal(txId) : openTransferForm(txId);
  txType = existing?.type || "expense";
  selectedCategoryId = existing?.categoryId || prefill?.categoryId || null;
  selectedAccountId = existing?.accountId || defaultPayerId();
  let destinationAccountId = existing?.toAccountId || null;

  openSheet("tpl-add-transaction", (node, close)=>{
    const amountInput = node.querySelector("#amountInput");
    const nameInput=node.querySelector("#txNameInput");
    amountInput.value = existing ? String(existing.amount).replace(".",",") : (prefill?.amount>0 ? String(Math.round(prefill.amount*100)/100).replace(".",",") : "");
    nameInput.value=existing?.name || prefill?.name || "";
    autoGrowAmountInput(amountInput);
    const dateInput = node.querySelector("#dateInput");
    const noteInput = node.querySelector("#noteInput");
    const catChipsGrouped = node.querySelector("#categoryChipsGrouped");
    const accChips = node.querySelector("#accountChips");
    const destinationChips = node.querySelector("#destinationAccountChips");
    const typeToggle = node.querySelector("#typeToggle");
    const categoryRow=node.querySelector("#txCategoryRow"), destinationRow=node.querySelector("#destinationAccountRow");

    const today = new Date();
    const inViewedMonth = today.getFullYear()===viewYear && today.getMonth()===viewMonth;
    dateInput.value = existing?.date || (periodModes.home==="day" ? selectedDate() : inViewedMonth ? todayISO() : `${viewYear}-${pad2(viewMonth+1)}-01`);
    // I movimenti reali non possono avere una data futura: per quelli si usa Pianificato.
    dateInput.max = todayISO();
    noteInput.value = existing?.note || prefill?.note || "";

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, txType, ()=>selectedCategoryId, id=>{ selectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (selectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ selectedAccountId=a.id; renderAccChips(); if(txType==="transfer") renderDestinationChips(); });
        accChips.appendChild(chip);
      });
      if(!selectedAccountId) selectedAccountId = state.accounts[0]?.id || null;
    }
    function renderDestinationChips(){
      destinationChips.innerHTML="";
      state.accounts.filter(a=>a.id!==selectedAccountId).forEach(a=>{
        const chip=document.createElement("button");chip.className="chip"+(destinationAccountId===a.id?" active":"");
        chip.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;chip.querySelector(".em").style.color=safeColor(a.color);
        chip.addEventListener("click",()=>{destinationAccountId=a.id;renderDestinationChips();});destinationChips.appendChild(chip);
      });
      if(destinationAccountId===selectedAccountId) destinationAccountId=null;
    }
    function renderTypeFields(){
      const transfer=txType==="transfer";
      categoryRow.hidden=transfer; destinationRow.hidden=!transfer;
      // v1.10.5: un trasferimento non ha un nome: si chiama con i due conti coinvolti.
      const nameRow=nameInput.closest(".field-row"); if(nameRow) nameRow.hidden=transfer;
      if(!transfer) renderCatChips(); else {selectedCategoryId=null;renderDestinationChips();}
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active",opt.dataset.type===txType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        txType = opt.dataset.type;
        selectedCategoryId = null;
        catChipsGrouped._activeMacro = null;
        renderTypeFields();
      });
    });

    renderAccChips();
    renderTypeFields();
    { const tt=node.querySelector("#typeToggle"); if(tt) tt.hidden=txType!=="income"; }
    const split=mountSplitPicker(node, destinationRow, {account:()=>selectedAccountId, toAccount:()=>destinationAccountId, type:()=>txType, amount:()=>parseAmount(amountInput.value), initial:existing?.split, initialGroup:existing?.groupId || prefill?.groupId});

    node.querySelector("#saveTxBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const transfer=txType==="transfer";
      const missing=[]; if(!transfer&&!nameInput.value.trim()) missing.push("nome"); if(amount<=0) missing.push("importo"); if(!transfer&&!selectedCategoryId) missing.push("categoria"); if(!selectedAccountId) missing.push("conto"); if(transfer&&!destinationAccountId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value > todayISO()){
        showToast("Per una data futura usa un movimento Pianificato");
        dateInput.focus();
        return;
      }

      const t = existing || {id:uid()};
      t.date=dateInput.value; t.amount=amount; t.type=txType;
      t.name=transfer?transferName(selectedAccountId,destinationAccountId):nameInput.value.trim(); t.categoryId=transfer?null:selectedCategoryId; t.accountId=selectedAccountId; t.toAccountId=transfer?destinationAccountId:null; t.note=noteInput.value.trim();
      t.split=transfer?null:split.get();
      t.groupId=transfer?null:split.getGroup();
      if(!editing) state.transactions.push(t);
      if(!editing && typeof prefill?.onSaved==="function") prefill.onSaved(t);
      state.couple.lastPayer=accOwner(t.accountId);
      persist();
      const d = new Date(t.date+"T00:00:00");
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      renderAll();
      close();
    });
  });
}
function openRPAddChoice(){ openAddChoice(); }
/* v1.10.7 — Il "+" apre sempre la stessa scelta, in tutte le sezioni tranne Altro. */
function openAddChoice(){
  document.getElementById("movementActionOverlay")?.remove();
  const overlay=document.createElement("div");
  overlay.id="movementActionOverlay";
  overlay.className="movement-action-overlay";
  overlay.innerHTML=`
    <div class="movement-action-menu" role="dialog" aria-modal="true" aria-label="Scegli cosa aggiungere">
      <div class="movement-action-handle" aria-hidden="true"></div>
      <p class="movement-action-title">Cosa vuoi aggiungere?</p>
      <div class="movement-action-buttons add-choice-grid">
        <button type="button" class="movement-action-btn add-recent" data-add-kind="tx"><span class="movement-action-icon" aria-hidden="true">＋</span><span>Spesa</span></button>
        <button type="button" class="movement-action-btn add-settle-small" data-add-kind="settle"><span class="movement-action-icon" aria-hidden="true">🤝</span><span>Rimborso</span></button>
        <button type="button" class="movement-action-btn add-list" data-add-kind="list"><span class="movement-action-icon" aria-hidden="true">🛒</span><span>Da comprare</span></button>
      </div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  const go=fn=>()=>{overlay.remove();fn();};
  overlay.querySelector('[data-add-kind="tx"]').addEventListener("click",go(()=>openAddTransaction()));
  overlay.querySelector('[data-add-kind="settle"]').addEventListener("click",go(()=>openSettleForm("all")));
  overlay.querySelector('[data-add-kind="list"]').addEventListener("click",go(()=>{ if(state.lists.length===1) openListDetail(state.lists[0].id); else switchView("liste"); }));
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  bindOverlaySwipeDismiss(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
}
/* v1.10.7 — Prelievo ATM: trasferimento da una carta/conto ai contanti, con commissione facoltativa
   registrata come uscita sulla carta (categoria "Costi bancari"/"Commissioni", creata se manca). */
function feeCategoryId(){
  let c=state.categories.find(c=>c.kind==="expense"&&/costi bancari|commission/i.test(c.name));
  if(!c){c={id:uid(),name:"Commissioni bancarie",emoji:"🏧",color:"#4FA8C9",kind:"expense",budget:null,macroCategoryId:(state.macroCategories.find(m=>/abbonament|banc/i.test(m.name)&&m.kind!=="income")||{}).id||null};state.categories.push(c);}
  return c.id;
}
/* v1.10.8 — Il prelievo si può anche modificare: si apre con i dati salvati (commissione compresa). */
function openAtmWithdrawal(txId=null){
  const existing=txId?state.transactions.find(t=>t.id===txId&&t.type==="transfer"):null;
  const existingFee=existing?.atmGroup?state.transactions.find(t=>t.atmGroup===existing.atmGroup&&t.type==="expense"):null;
  const cash=state.accounts.find(a=>/contant|cash/i.test(a.name));
  let fromId=existing?.accountId||state.accounts.find(a=>a.id===state.mainAccountId&&a.id!==cash?.id)?.id||state.accounts.find(a=>a.id!==cash?.id)?.id||null;
  let toId=existing?.toAccountId||cash?.id||null;
  openSheet("tpl-atm-withdrawal",(node,close)=>{
    const amountInput=node.querySelector("#atmAmountInput"), feeInput=node.querySelector("#atmFeeInput"), dateInput=node.querySelector("#atmDateInput"), noteInput=node.querySelector("#atmNoteInput");
    const fromChips=node.querySelector("#atmFromChips"), toChips=node.querySelector("#atmToChips"), total=node.querySelector("#atmTotal");
    dateInput.value=existing?.date||todayISO();
    dateInput.max=todayISO();
    if(existing){
      
      amountInput.value=String(existing.amount).replace(".",",");
      feeInput.value=existingFee?String(existingFee.amount).replace(".",","):"";
      noteInput.value=existing.note&&existing.note!=="Prelievo ATM"?existing.note:"";
    }
    if(typeof autoGrowAmountInput==="function") autoGrowAmountInput(amountInput);
    const chips=(wrap,getSel,setSel,exclude)=>{
      wrap.innerHTML="";
      state.accounts.filter(a=>a.id!==exclude).forEach(a=>{
        const b=document.createElement("button");b.type="button";b.className="chip"+(getSel()===a.id?" active":"");
        b.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;b.querySelector(".em").style.color=safeColor(a.color);
        b.addEventListener("click",()=>{setSel(a.id);paint();});wrap.appendChild(b);
      });
    };
    const paint=()=>{
      if(toId===fromId) toId=state.accounts.find(a=>a.id!==fromId&&/contant|cash/i.test(a.name))?.id||null;
      chips(fromChips,()=>fromId,v=>{fromId=v;},null);
      chips(toChips,()=>toId,v=>{toId=v;},fromId);
      const amt=parseAmount(amountInput.value), fee=parseAmount(feeInput.value);
      total.textContent=amt>0?`Dalla carta escono ${fmt(amt+fee)}${fee>0?` (${fmt(amt)} prelievo + ${fmt(fee)} commissione)`:""}`:"";
    };
    amountInput.addEventListener("input",paint);feeInput.addEventListener("input",paint);
    node.querySelector("#saveAtmBtn").addEventListener("click",()=>{
      const amt=parseAmount(amountInput.value), fee=parseAmount(feeInput.value);
      if(!(amt>0)){showToast("Inserisci l'importo prelevato");amountInput.focus();return;}
      if(!fromId||!toId||fromId===toId){showToast("Scegli la carta e il conto contanti");return;}
      const date=dateInput.value||todayISO();
      if(date>todayISO()){showToast("Un prelievo non può avere una data futura");dateInput.focus();return;}
      const group=existing?.atmGroup||uid();
      const t=existing||{id:uid()};
      Object.assign(t,{date,amount:amt,type:"transfer",name:transferName(fromId,toId),categoryId:null,accountId:fromId,toAccountId:toId,note:noteInput.value.trim()||"Prelievo ATM",atm:true,atmGroup:group});
      if(!existing) state.transactions.push(t);
      if(fee>0){
        if(existingFee) Object.assign(existingFee,{date,amount:fee,accountId:fromId});
        else state.transactions.push({id:uid(),date,amount:fee,type:"expense",name:"Commissione prelievo ATM",categoryId:feeCategoryId(),accountId:fromId,toAccountId:null,note:"",atmGroup:group});
      } else if(existingFee){
        state.transactions=state.transactions.filter(x=>x.id!==existingFee.id);
      }
      persist();renderAll();close();
      showToast(existing?"Prelievo aggiornato":fee>0?`Prelievo di ${fmt(amt)} + commissione ${fmt(fee)} registrati`:`Prelievo di ${fmt(amt)} registrato`);
    });
    paint();
  });
}
/* v1.10.8 — Trasferimento come sezione a sé dal "+": stesso stile del Prelievo ATM.
   Resta un movimento reale di tipo "transfer" (compare nei Movimenti recenti). */
function openTransferForm(txId=null){
  const existing=txId?state.transactions.find(t=>t.id===txId&&t.type==="transfer"):null;
  let fromId=existing?.accountId||state.accounts.find(a=>a.id===state.mainAccountId)?.id||state.accounts[0]?.id||null;
  let toId=existing?.toAccountId||null;
  openSheet("tpl-transfer",(node,close)=>{
    const amountInput=node.querySelector("#transferAmountInput"), dateInput=node.querySelector("#transferDateInput"), noteInput=node.querySelector("#transferNoteInput");
    const fromChips=node.querySelector("#transferFromChips"), toChips=node.querySelector("#transferToChips"), summary=node.querySelector("#transferSummary");
    const today=new Date(), inViewedMonth=today.getFullYear()===viewYear&&today.getMonth()===viewMonth;
    dateInput.value=existing?.date||(periodModes.home==="day"?selectedDate():inViewedMonth?todayISO():`${viewYear}-${pad2(viewMonth+1)}-01`);
    dateInput.max=todayISO();
    if(existing){
      
      amountInput.value=String(existing.amount).replace(".",",");
      noteInput.value=existing.note||"";
    }
    autoGrowAmountInput(amountInput);
    const chips=(wrap,getSel,setSel,exclude)=>{
      wrap.innerHTML="";
      state.accounts.filter(a=>a.id!==exclude).forEach(a=>{
        const b=document.createElement("button");b.type="button";b.className="chip"+(getSel()===a.id?" active":"");
        b.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`;b.querySelector(".em").style.color=safeColor(a.color);
        b.addEventListener("click",()=>{setSel(a.id);paint();});wrap.appendChild(b);
      });
    };
    const paint=()=>{
      if(toId===fromId) toId=null;
      chips(fromChips,()=>fromId,v=>{fromId=v;},null);
      chips(toChips,()=>toId,v=>{toId=v;},fromId);
      const amt=parseAmount(amountInput.value);
      summary.textContent=amt>0&&fromId&&toId?`${transferName(fromId,toId)} · ${fmt(amt)}`:"";
    };
    amountInput.addEventListener("input",paint);
    const split=mountSplitPicker(node, toChips.closest(".field-row"), {account:()=>fromId, toAccount:()=>toId, type:()=>"transfer", amount:()=>parseAmount(amountInput.value), initialGroup:existing?.groupId});
    const del=node.querySelector("#deleteTransferBtn");
    if(existing){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm("Eliminare questo trasferimento?",{ok:"Elimina",danger:true})) return;
        moveToTrash("transaction",existing); const deleted=state.trash[0]?.id;
        state.transactions=state.transactions.filter(x=>x.id!==existing.id);
        persist();renderAll();close();if(deleted) showUndo("Trasferimento eliminato",deleted);
      });
    }
    node.querySelector("#saveTransferBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const missing=[]; if(amount<=0) missing.push("importo"); if(!fromId) missing.push("conto di partenza"); if(!toId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value>todayISO()){showToast("Un trasferimento non può avere una data futura");dateInput.focus();return;}
      const t=existing||{id:uid()};
      Object.assign(t,{date:dateInput.value,amount,type:"transfer",name:transferName(fromId,toId),categoryId:null,accountId:fromId,toAccountId:toId,note:noteInput.value.trim()});
      const settle=Math.abs(txDebt(t))>0;
      t.groupId=settle?split.getGroup():null;
      if(!settle) delete t.settleAlloc;
      else if(t.settleAlloc) rescaleAlloc(t);
      if(!existing) state.transactions.push(t);
      persist();
      const d=new Date(t.date+"T00:00:00"); viewYear=d.getFullYear(); viewMonth=d.getMonth();
      renderAll();close();
      showToast(existing?"Trasferimento aggiornato":"Trasferimento registrato");
    });
    paint();
  });
}
document.getElementById("fabAdd").addEventListener("click", e=>{
  e.preventDefault();e.stopPropagation();
  openAddChoice();
});
document.getElementById("toggleHomeBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleAccountsBalance").addEventListener("click",toggleBalances);
document.getElementById("toggleRPBalance")?.addEventListener("click",toggleBalances);

function openTrash(){
  openSheet("tpl-trash", (node)=>{
    const list=node.querySelector("#trashList"), empty=node.querySelector("#trashEmptyHint");
    const labels={transaction:"Movimento",recurring:"Ricorrente",planned:"Pianificata"};
    (state.trash||[]).forEach(entry=>{
      const d=entry.data, row=document.createElement("div"); row.className="template-manage-row";
      row.innerHTML=`<span class="ic">🗑️</span><span class="info"><p class="nm">${labels[entry.kind]}</p><p class="sub">${escapeHtml(d.name || categoriesById()[d.categoryId]?.name || "Elemento eliminato")}</p></span><button class="pill-btn trash-restore">Ripristina</button>`;
      row.querySelector(".trash-restore").addEventListener("click",()=>restoreTrashItem(entry.id)); list.appendChild(row);
    });
    empty.hidden=list.children.length>0;
  });
}
document.getElementById("openTrashBtn").addEventListener("click",openTrash);

/* ---------------- Transaction detail sheet ---------------- */
function openTxDetail(txId){
  const t = state.transactions.find(x=>x.id===txId);
  if(!t) return;
  openSheet("tpl-tx-detail", (node, close)=>{
    const transfer=t.type==="transfer";
    const cat = transfer ? {name:"Trasferimento",emoji:"↔"} : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️"} : (categoriesById()[t.categoryId] || { name:"Categoria eliminata", emoji:"❔" }));
    const acc = accountsById()[t.accountId] || { name:"Conto eliminato" };
    const destination=accountsById()[t.toAccountId] || {name:"Conto eliminato"};
    node.querySelector("#txDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${transfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}</span></div>
      ${transfer?`<div class="tx-detail-row"><span class="k">Da conto</span><span class="v">${escapeHtml(acc.name)}</span></div><div class="tx-detail-row"><span class="k">A conto</span><span class="v">${escapeHtml(destination.name)}</span></div>`:`<div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div>`}
      ${coupleDetailRows(t)}
      <div class="tx-detail-row"><span class="k">Data</span><span class="v">${t.date.split("-").reverse().join("/")}</span></div>
      ${t.recurringId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento ricorrente</span></div>`:t.plannedId?`<div class="tx-detail-row"><span class="k">Origine</span><span class="v">Movimento pianificato</span></div>`:""}
      ${t.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(t.note)}</span></div>`:""}
    `;
    // Il tap singolo mostra solo il riepilogo. Modifica/Duplica/Elimina restano nel menu da pressione prolungata.
    node.querySelector(".detail-actions")?.remove();
    node.querySelector("#deleteTxBtn")?.remove();
  });
}

function openScheduledDetail(kind, id, occurrenceDate){
  const item = kind==="recurring" ? state.recurring.find(x=>x.id===id) : state.planned.find(x=>x.id===id);
  if(!item) return;
  openSheet("tpl-scheduled-detail", (node, close)=>{
    const cat = categoriesById()[item.categoryId] || { name:"Categoria eliminata", emoji:"❔" };
    const acc = accountsById()[item.accountId] || { name:"Conto eliminato" };
    const date = occurrenceDate || item.nextDate || item.date;
    node.querySelector("#scheduledDetailTitle").textContent = kind==="recurring" ? "Dettaglio ricorrente" : "Dettaglio pianificata";
    node.querySelector("#scheduledDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Stato</span><span class="v"><span class="status-badge ${kind}">${kind==="recurring"?(item.active===false?"Sospesa":"Ricorrente attiva"):"Pianificata"}</span></span></div>
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${item.type}">${item.type==="income"?"+":"−"}${fmt(item.amount)}</span></div>
      <div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div>
      <div class="tx-detail-row"><span class="k">Carta destinataria</span><span class="v">${escapeHtml(acc.name)}</span></div>
      <div class="tx-detail-row"><span class="k">${kind==="recurring"?"Prossima data":"Data"}</span><span class="v">${date ? date.split("-").reverse().join("/") : "—"}</span></div>
      ${kind==="recurring"?`<div class="tx-detail-row"><span class="k">Frequenza</span><span class="v">${FREQ_LABEL[item.freq]||"—"}</span></div><div class="tx-detail-row"><span class="k">Durata</span><span class="v">${recurringDurationLabel(item)}</span></div>`:""}
      ${item.note?`<div class="tx-detail-row"><span class="k">Nota</span><span class="v">${escapeHtml(item.note)}</span></div>`:""}
    `;
    // Il tap singolo mostra solo il riepilogo. Le azioni sono disponibili con pressione prolungata.
    node.querySelector(".detail-actions")?.remove();
    node.querySelector("#deleteScheduledBtn")?.remove();
  });
}

/* ---------------- Evoluzione saldo conto ---------------- */
function buildLineSVG(data, color){
  const w=320, h=150, padL=6, padB=22, padT=14;
  const vals = data.map(d=>d.balance);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const range = (max-min) || 1;
  const stepX = data.length>1 ? (w-padL*2)/(data.length-1) : 0;
  const points = data.map((d,i)=>{
    const x = padL + i*stepX;
    const y = padT + (h-padT-padB) - ((d.balance-min)/range)*(h-padT-padB);
    return {x,y};
  });
  const path = points.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(data.length/6));
  let labels = "";
  data.forEach((d,i)=>{
    if(i%step===0 || i===data.length-1){
      labels += `<text x="${points[i].x.toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="9" fill="var(--ink-soft)" font-family="system-ui">${d.label}</text>`;
    }
  });
  const dots = points.map((p,i)=>`<circle class="chart-point" data-point-index="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.2" fill="#E8A33D" stroke="var(--paper)" stroke-width="1.5"><title>${data[i].label}: ${maskAmt(fmt(data[i].balance))}</title></circle>`).join("");
  const zeroY = (padT + (h-padT-padB) - ((0-min)/range)*(h-padT-padB)).toFixed(1);
  return `<svg class="chart money-line" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <line x1="${padL}" y1="${zeroY}" x2="${w-padL}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 5"/>
    <polyline points="${path}" fill="none" stroke="${color || "var(--ink)"}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
}

function pointDetail(d){
  const day=d.date?d.date.split("-").reverse().join("/"):d.label;
  const delta=(d.income||0)-(d.expense||0);
  if(balancesHidden) return `<strong>${day}</strong><span>Saldo: ••••</span><span>Variazione: ••••</span>`;
  return `<strong>${day}</strong><span>Saldo: ${fmt(d.balance)}</span><span class="${delta<0?"neg":"pos"}">${delta===0?"Nessuna variazione":`${delta>0?"+":"−"}${fmt(Math.abs(delta))} nel giorno`}</span>`;
}
function setupLineChart(wrap,data){
  if(!wrap) return;
  wrap._chartData=data;
  let tip=wrap.querySelector(".chart-tooltip");
  if(!tip){tip=document.createElement("div");tip.className="chart-tooltip";wrap.appendChild(tip);}
  const show=i=>{const d=data[i];if(!d)return;tip.innerHTML=pointDetail(d);tip.classList.add("show");};
  wrap.querySelectorAll(".chart-point").forEach(p=>{
    const i=Number(p.dataset.pointIndex);
    p.addEventListener("pointerdown",e=>{e.stopPropagation();show(i);p.setPointerCapture?.(e.pointerId);});
    p.addEventListener("pointerenter",()=>show(i));
  });
  wrap.onpointermove=e=>{if(!e.buttons)return;const points=[...wrap.querySelectorAll(".chart-point")];if(!points.length)return;let best=0,bestDist=Infinity;points.forEach((p,i)=>{const r=p.getBoundingClientRect(),d=Math.abs(e.clientX-(r.left+r.width/2));if(d<bestDist){best=i;bestDist=d;}});show(best);};
  wrap._chartHelp="Tieni premuto un punto: vedi saldo e variazione della giornata.";
  makeChartExpandable(wrap,"Saldo cumulato",wrap._chartHelp,data);
}
function makeChartExpandable(wrap,title,help,data){
  if(!wrap)return;
  wrap.tabIndex=0;wrap.setAttribute("role","button");wrap.setAttribute("aria-label",`Ingrandisci ${title}`);
  wrap.onclick=e=>{if(e.target.closest(".chart-point"))return;openChartFullscreen(title,help,wrap.querySelector("svg"),data);};
  wrap.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openChartFullscreen(title,help,wrap.querySelector("svg"),data);}};
}
function openChartFullscreen(title,help,svg,data){
  if(!svg)return;
  openSheet("tpl-chart-fullscreen",node=>{
    node.querySelector("#chartFullscreenTitle").textContent=title;
    node.querySelector("#chartFullscreenHelp").textContent=help||"Tocca il grafico per il dettaglio.";
    const body=node.querySelector("#chartFullscreenBody"), clone=svg.cloneNode(true);body.appendChild(clone);
    if(data) setupLineChart(body,data);
  });
}
function openChartInfo(kind){
  const text={
    ripartizione:"Mostra come entrate o uscite del periodo selezionato sono distribuite fra categorie o macrocategorie. Non considera i trasferimenti fra conti.",
    andamento:"Entrate/Uscite mostra i flussi del periodo. Saldo cumulato mostra il saldo reale, partendo dal saldo presente prima dell’inizio del periodo. Tieni premuto un punto per leggere il giorno.",
    conti:"Mostra la variazione netta di ciascun conto nel periodo scelto. I trasferimenti compaiono come uscita nel conto di origine e entrata in quello di destinazione."
  }[kind]||"";
  openSheet("tpl-chart-fullscreen",node=>{node.querySelector("#chartFullscreenTitle").textContent="Come leggere il grafico";node.querySelector("#chartFullscreenHelp").hidden=true;node.querySelector("#chartFullscreenBody").innerHTML=`<div class="chart-info-card">${escapeHtml(text)}</div>`;});
}

function isoAddDays(iso,n){const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
function isoDiffDays(a,b){return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);}
function evolutionRangeDates(range,custom){
  // v1.10.2: "ultimi N mesi" finiscono oggi; "Periodo" usa le date scelte nel calendario.
  const today=todayISO();
  if(range==="custom"&&custom) return {from:custom.from,to:custom.to};
  const n={"1m":1,"2m":2,"3m":3,"6":6,"12":12,"24":24}[range]||12;
  const d=new Date(today+"T12:00:00");d.setMonth(d.getMonth()-n);
  return {from:isoAddDays(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`,1),to:today};
}
function evolutionSeries(accountId,from,to){
  const days=Math.max(0,isoDiffDays(from,to));
  const step=days<=92?1:days<=430?7:15;
  const out=[];
  const point=iso=>{const d=new Date(iso+"T12:00:00");const m=d.getMonth();
    return {date:iso,label:days>430?`${MESI_BREVI[m]} ${String(d.getFullYear()).slice(2)}`:`${d.getDate()} ${MESI_BREVI[m].toLowerCase()}`,full:`${d.getDate()} ${MESI[m].toLowerCase()} ${d.getFullYear()}`,balance:accountBalanceAtDate(accountId,iso)};};
  for(let i=0;i<=days;i+=step) out.push(point(isoAddDays(from,i)));
  if(!out.length||out[out.length-1].date!==to) out.push(point(to));
  return out;
}
function renderAccountEvolution(node, accountId, range, custom){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  const {from,to}=evolutionRangeDates(range,custom);
  const data=evolutionSeries(accountId,from,to);
  const wrap=node.querySelector("#accountEvolutionChartWrap");
  // v1.10.1: la variazione parte da quando hai registrato il saldo reale del conto (prima rettifica manuale del saldo),
  // non dallo zero precedente. Se quella data è prima dell'inizio del periodo, si parte dall'inizio del periodo.
  const anchorDay = realBalanceDate(accountId);
  const startDay = data[0].date;
  let base = data[0].balance, sinceText = null, anchorIndex = -1;
  if(anchorDay && anchorDay > startDay){
    base = accountBalanceAtDate(accountId, anchorDay);
    anchorIndex = data.findIndex(d=>d.date>=anchorDay);
    const dt=new Date(anchorDay+"T12:00:00");
    sinceText = `dal ${dt.getDate()} ${MESI_BREVI[dt.getMonth()].toLowerCase()}${dt.getFullYear()!==new Date().getFullYear()?" "+dt.getFullYear():""}, quando hai registrato il saldo reale`;
  }
  buildAreaChart(wrap, data, {anchorIndex});
  const current = data[data.length-1].balance;
  const diff = current-base;
  const pct = base>0 ? Math.round((diff/base)*100) : null;
  const periodText = sinceText || (range==="custom" ? (evolutionRangeLabel({from,to}).includes("–")||from===to ? `dal ${shortDate(from)} al ${shortDate(to,true)}` : `in ${evolutionRangeLabel({from,to}).toLowerCase()}`) : ({"1m":"nell'ultimo mese","2m":"negli ultimi 2 mesi","3m":"negli ultimi 3 mesi","6":"negli ultimi 6 mesi","12":"nell'ultimo anno","24":"negli ultimi 2 anni"}[range]||"nel periodo"));
  node.querySelector("#accountEvolutionLegend").innerHTML = `
    <p class="evo-kicker">${to===todayISO()?"Saldo attuale":`Saldo al ${shortDate(to,true)}`}</p>
    <p class="evo-hero">${balancesHidden?"••••":fmt(current)}</p>
    <p class="evo-delta ${diff<0?"down":diff>0?"up":"flat"}"><span class="evo-delta-pill">${diff===0?"Nessuna variazione":`${diff>0?"▲":"▼"} ${balancesHidden?(pct!==null?`${pct>0?"+":""}${pct}%`:"••••"):`${fmtSigned(diff)}${pct!==null?` · ${pct>0?"+":""}${pct}%`:""}`}`}</span> ${periodText}</p>`;
}

/* v1.10.0 — Grafico ad area moderno: linea morbida, sfumatura, griglia leggera,
   mirino con fumetto al tocco. Un solo colore (il saldo), testi con i colori del tema. */
function realBalanceDate(accountId){
  const adj=state.transactions.filter(t=>t.isBalanceAdjustment && t.accountId===accountId && (t.setsRealBalance || /^Saldo aggiornato manualmente/.test(t.note||"")));
  if(!adj.length) return null;
  return adj.map(t=>t.date).sort()[0];
}
function niceStep(range,count){
  const raw=range/Math.max(1,count), mag=Math.pow(10,Math.floor(Math.log10(raw||1))), n=raw/mag;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*mag;
}
function compactEuro(v,step=1000){
  const a=Math.abs(v), s=v<0?"−":"";
  // Etichette sempre distinte: in "k" solo se il passo della griglia è di almeno 500 €.
  if(a>=1000 && step>=500){const dec=step>=1000&&(a>=10000||step%1000===0)?0:1;return `${s}€${(a/1000).toFixed(dec).replace(".",",").replace(/,0$/,"")}k`;}
  return `${s}€${Math.round(a).toLocaleString("it-IT")}`;
}
function monotonePath(pts){
  const n=pts.length; if(n<2) return n?`M${pts[0].x},${pts[0].y}`:"";
  const dx=[],dy=[],m=[],t=[];
  for(let i=0;i<n-1;i++){dx[i]=pts[i+1].x-pts[i].x;dy[i]=pts[i+1].y-pts[i].y;m[i]=dy[i]/(dx[i]||1);}
  t[0]=m[0];t[n-1]=m[n-2];
  for(let i=1;i<n-1;i++) t[i]=(m[i-1]*m[i]<=0)?0:(3*(dx[i-1]+dx[i]))/((2*dx[i]+dx[i-1])/m[i-1]+(dx[i]+2*dx[i-1])/m[i]);
  let d=`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for(let i=0;i<n-1;i++){
    const c1x=pts[i].x+dx[i]/3,c1y=pts[i].y+t[i]*dx[i]/3,c2x=pts[i+1].x-dx[i]/3,c2y=pts[i+1].y-t[i+1]*dx[i]/3;
    d+=`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i+1].x.toFixed(1)},${pts[i+1].y.toFixed(1)}`;
  }
  return d;
}
function buildAreaChart(wrap,data,opts={}){
  if(!wrap||!data.length) return;
  const w=Math.max(280,Math.round(wrap.clientWidth||320)), h=200, padL=8, padR=12, padT=22, padB=26;
  const vals=data.map(d=>d.balance);
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(lo===hi){lo-=Math.max(1,Math.abs(lo)*0.1);hi+=Math.max(1,Math.abs(hi)*0.1);}
  const step=niceStep(hi-lo,3);
  lo=Math.floor(lo/step)*step; hi=Math.ceil(hi/step)*step;
  const X=i=>padL+(data.length>1?i*(w-padL-padR)/(data.length-1):(w-padL-padR)/2);
  const Y=v=>padT+(h-padT-padB)*(1-(v-lo)/((hi-lo)||1));
  const pts=data.map((d,i)=>({x:X(i),y:Y(d.balance)}));
  const line=monotonePath(pts);
  const base=Y(lo);
  const area=`${line}L${pts[pts.length-1].x.toFixed(1)},${base.toFixed(1)}L${pts[0].x.toFixed(1)},${base.toFixed(1)}Z`;
  let grid="";
  for(let v=lo; v<=hi+step/2; v+=step){
    const y=Y(v).toFixed(1), zero=Math.abs(v)<step/1000;
    grid+=`<line x1="${padL}" x2="${w-padR}" y1="${y}" y2="${y}" class="${zero?"evo-zero":"evo-grid"}"/><text x="${padL}" y="${(Y(v)-5).toFixed(1)}" class="evo-ylab">${balancesHidden?"•••":compactEuro(v,step)}</text>`;
  }
  const k=Math.min(data.length,5); let xl="";
  const used=new Set();
  for(let j=0;j<k;j++){
    const i=k===1?0:Math.round(j*(data.length-1)/(k-1)); if(used.has(i)) continue; used.add(i);
    const anchor=j===0?"start":j===k-1?"end":"middle";
    xl+=`<text x="${pts[i].x.toFixed(1)}" y="${h-7}" text-anchor="${anchor}" class="evo-xlab">${escapeHtml(data[i].label)}</text>`;
  }
  const last=pts[pts.length-1], gid="evoGrad"+Math.random().toString(36).slice(2,7);
  wrap.innerHTML=`<svg class="evo-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Andamento del saldo">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="evo-stop-a"/><stop offset="100%" class="evo-stop-b"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" class="evo-line"/>
    ${opts.anchorIndex>=0&&pts[opts.anchorIndex]?`<line class="evo-anchor" x1="${pts[opts.anchorIndex].x.toFixed(1)}" x2="${pts[opts.anchorIndex].x.toFixed(1)}" y1="${padT-4}" y2="${h-padB}"/><text class="evo-anchor-lab" x="${(pts[opts.anchorIndex].x+(pts[opts.anchorIndex].x>w*0.7?-4:4)).toFixed(1)}" y="${padT-8}" text-anchor="${pts[opts.anchorIndex].x>w*0.7?"end":"start"}">Saldo reale</text>`:""}
    <line class="evo-cross" x1="0" x2="0" y1="${padT-6}" y2="${h-padB}" opacity="0"/>
    <circle class="evo-last" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5"/>
    <circle class="evo-hover" cx="0" cy="0" r="5" opacity="0"/>
    ${xl}
    <rect class="evo-hit" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
  </svg><div class="evo-tip" hidden></div>`;
  const svg=wrap.querySelector("svg"), tip=wrap.querySelector(".evo-tip"), cross=svg.querySelector(".evo-cross"), dot=svg.querySelector(".evo-hover");
  const show=e=>{
    const r=svg.getBoundingClientRect(), x=(e.clientX-r.left)*(w/r.width);
    let i=0,best=Infinity; pts.forEach((p,j)=>{const d=Math.abs(p.x-x); if(d<best){best=d;i=j;}});
    const p=pts[i], d=data[i], prev=data[i-1];
    cross.setAttribute("x1",p.x);cross.setAttribute("x2",p.x);cross.setAttribute("opacity","1");
    dot.setAttribute("cx",p.x);dot.setAttribute("cy",p.y);dot.setAttribute("opacity","1");
    const delta=prev?d.balance-prev.balance:null;
    tip.innerHTML=`<b>${escapeHtml(d.full||d.label)}</b><span class="evo-tip-val">${balancesHidden?"••••":fmt(d.balance)}</span>${delta!==null&&!balancesHidden?`<span class="evo-tip-delta ${delta<0?"down":delta>0?"up":""}">${delta===0?"Invariato":`${delta>0?"▲":"▼"} ${fmtSigned(delta)}`}</span>`:""}`;
    tip.hidden=false;
    const px=p.x*(r.width/w), tw=tip.offsetWidth;
    tip.style.left=Math.max(0,Math.min(r.width-tw,px-tw/2))+"px";
  };
  const hide=()=>{tip.hidden=true;cross.setAttribute("opacity","0");dot.setAttribute("opacity","0");};
  svg.addEventListener("pointerdown",e=>{show(e);});
  svg.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"||e.buttons) show(e);});
  svg.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse") hide();});
  wrap.addEventListener("pointerup",e=>{if(e.pointerType!=="mouse") setTimeout(hide,1800);});
}

function evolutionDefaultRange(){
  // Default: il mese (o il periodo) selezionato in Home / R&P. Il mese in corso arriva fino a oggi.
  const today=todayISO();
  if(periodModes.home==="range"&&periodRange.from) return {from:periodRange.from,to:periodRange.to>today?today:periodRange.to};
  const from=`${viewYear}-${pad2(viewMonth+1)}-01`, last=`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`;
  return {from, to: from<=today&&last>today?today:last};
}
function evolutionRangeLabel(r){
  const a=new Date(r.from+"T12:00:00"), b=new Date(r.to+"T12:00:00");
  const lastDay=new Date(b.getFullYear(),b.getMonth()+1,0).getDate();
  if(a.getDate()===1 && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && (b.getDate()===lastDay || r.to===todayISO())) return `${MESI[a.getMonth()]} ${a.getFullYear()}`;
  if(r.from===r.to) return shortDate(r.from,true);
  return `${shortDate(r.from,a.getFullYear()!==b.getFullYear())} – ${shortDate(r.to,true)}`;
}
function openAccountEvolution(accountId){
  const acc = state.accounts.find(a=>a.id===accountId);
  if(!acc) return;
  openSheet("tpl-account-evolution", (node)=>{
    node.querySelector("#accountEvolutionTitle").textContent = `Evoluzione — ${acc.name}`;
    let custom = evolutionDefaultRange();
    const btn=node.querySelector("#evolutionPeriodBtn");
    const paint=()=>{
      btn.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg><span>${escapeHtml(evolutionRangeLabel(custom))}</span>`;
      renderAccountEvolution(node, accountId, "custom", custom);
    };
    btn.addEventListener("click",()=>openPeriodPicker(null,{from:custom.from,to:custom.to,onApply:(r)=>{
      const today=todayISO();
      custom={from:r.from>today?today:r.from,to:r.to>today?today:r.to};
      paint();
    }}));
    paint();
  });
}

function openBalanceReconcileForm(accountId){
  const acc=state.accounts.find(a=>a.id===accountId); if(!acc) return;
  openSheet("tpl-balance-reconcile", (node, close)=>{
    let kind="income";
    const amountInput=node.querySelector("#reconcileAmountInput");
    const dateInput=node.querySelector("#reconcileDateInput");
    const noteInput=node.querySelector("#reconcileNoteInput");
    dateInput.value=todayISO();
    node.querySelectorAll("#reconcileTypeToggle .type-opt").forEach(btn=>btn.addEventListener("click",()=>{
      node.querySelectorAll("#reconcileTypeToggle .type-opt").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active"); kind=btn.dataset.type;
    }));
    node.querySelector("#saveBalanceReconcileBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value); if(amount<=0){showToast("Inserisci un importo valido");amountInput.focus();return;}
      const signed=kind==="income"?amount:-amount;
      // Sposta la variazione dal saldo-base allo storico senza cambiare il saldo attuale del conto.
      acc.balance = Math.round((acc.balance - signed)*100)/100;
      state.transactions.push({
        id:uid(), date:dateInput.value||todayISO(), amount, type:kind, name:"Rettifica saldo",
        categoryId:null, accountId:acc.id, toAccountId:null,
        note:noteInput.value.trim() || "Variazione di saldo registrata successivamente",
        isBalanceAdjustment:true
      });
      persist();renderAll();renderBalanceAdjustmentHistory();close();showToast("Rettifica registrata senza modificare il saldo attuale");
    });
  });
}

/* ---------------- Account form ---------------- */
function openAccountForm(accountId){
  const editing = !!accountId;
  const acc = editing ? state.accounts.find(a=>a.id===accountId) : null;

  openSheet("tpl-account-form", (node, close)=>{
    node.querySelector("#accountFormTitle").textContent = editing ? "Modifica conto" : "Nuovo conto";
    const nameInput = node.querySelector("#accountNameInput");
    const balInput = node.querySelector("#accountBalanceInput");
    const colorRow = node.querySelector("#accountColorRow");
    const deleteBtn = node.querySelector("#deleteAccountBtn");
    let chosenColor = acc?.color || PALETTE[0];
    let chosenOwner = acc?.owner || "joint";
    const ownerChips=node.querySelector("#accountOwnerChips");
    function renderOwnerChips(){
      ownerChips.innerHTML="";
      [["a",personName("a")],["b",personName("b")],["joint","Comune"]].forEach(([k,label])=>{
        const chip=document.createElement("button");
        chip.type="button"; chip.className="chip"+(chosenOwner===k?" active":"");
        chip.innerHTML=`<span class="em">●</span>${escapeHtml(label)}`;
        chip.querySelector(".em").style.color=safeColor(personColor(k));
        chip.addEventListener("click",()=>{chosenOwner=k;renderOwnerChips();});
        ownerChips.appendChild(chip);
      });
    }
    renderOwnerChips();

    nameInput.value = acc?.name || "";
    if(editing){
      node.querySelector("#accountBalanceLabel").textContent = "Saldo attuale";
      node.querySelector("#accountBalanceHint").textContent = "Se cambi questo valore, l’app registra automaticamente la differenza come Rettifica saldo.";
      balInput.value = String(accountBalance(acc.id)).replace(".",",");
      node.querySelector("#reconcileAccountBtn").hidden = false;
    } else {
      balInput.value = "";
    }

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      const hasTx = state.transactions.some(t=>t.accountId===accountId);
      const msg = hasTx
        ? "Questo conto ha movimenti associati. Eliminandolo verranno eliminati anche i suoi movimenti. Continuare?"
        : "Eliminare questo conto?";
      if(!await askConfirm(msg)) return;
      markDeleted(accountId, state.transactions.filter(t=>t.accountId===accountId).map(t=>t.id));
      state.accounts = state.accounts.filter(a=>a.id!==accountId);
      if(state.mainAccountId===accountId) state.mainAccountId=null;
      state.transactions = state.transactions.filter(t=>t.accountId!==accountId);
      persist(); renderAll(); close();
    });

    node.querySelector("#reconcileAccountBtn").addEventListener("click", ()=>{
      if(!editing) return;
      close();
      openBalanceReconcileForm(accountId);
    });

    node.querySelector("#saveAccountBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name) { nameInput.focus(); return; }
      const balance = parseAmount(balInput.value) * (balInput.value.trim().startsWith("-") ? -1 : 1);
      if(editing){
        const before = accountBalance(acc.id);
        const delta = Math.round((balance - before) * 100) / 100;
        acc.name = name; acc.color = chosenColor; acc.owner = chosenOwner;
        if(Math.abs(delta) >= 0.01){
          state.transactions.push({
            id:uid(), date:todayISO(), amount:Math.abs(delta),
            type:delta>0?"income":"expense", name:"Rettifica saldo",
            categoryId:null, accountId:acc.id, toAccountId:null,
            note:`Saldo aggiornato manualmente da ${fmt(before)} a ${fmt(balance)}`,
            isBalanceAdjustment:true, setsRealBalance:true
          });
        }
      } else {
        state.accounts.push({ id: uid(), name, balance, color: chosenColor, owner: chosenOwner });
      }
      persist(); renderAll(); renderBalanceAdjustmentHistory(); close();
    });
  });
}
/* ---------------- Pannelli di gestione (Altro) ---------------- */
function openAccountsPanel(){
  openSheet("tpl-accounts-panel", (node)=>{
    renderAccountsManageList();
    renderBalanceAdjustmentHistory();
    node.querySelector("#addAccountBtn").addEventListener("click", ()=> openAccountForm(null));
  });
}
document.getElementById("openAccountsPanelBtn").addEventListener("click", openAccountsPanel);

function openMacroPanel(){
  openSheet("tpl-macro-panel", (node)=>{
    renderMacroCategories();
    node.querySelector("#addMacroCategoryBtn").addEventListener("click", ()=> openMacroForm(null));
  });
}


function openCategoriesPanel(){
  openSheet("tpl-categories-panel", (node)=>{
    renderCategories();
    node.querySelector("#addCategoryBtn").addEventListener("click", ()=> openCategoryForm(null));
  });
}


function openGraphPanel(){
  openSheet("tpl-graph-panel", (node)=>{
    renderCategoryGraph();
  });
}
/* v1.4.0 — Un'unica sezione per categorie, macrocategorie e struttura. */
function openCategoriesHub(startMode){
  openSheet("tpl-categories-hub", (node)=>{
    let mode=startMode||"categories";
    const addBtn=node.querySelector("#hubAddBtn");
    const labels={categories:"Aggiungi categoria",macro:"Aggiungi macrocategoria"};
    function setMode(m){
      mode=m;
      node.querySelectorAll("[data-hub]").forEach(b=>{const on=b.dataset.hub===m;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");});
      node.querySelectorAll("[data-hub-pane]").forEach(p=>p.hidden=p.dataset.hubPane!==m);
      addBtn.hidden=(m==="graph");
      if(labels[m]) addBtn.setAttribute("aria-label",labels[m]);
      if(m==="categories") renderCategories();
      else if(m==="macro") renderMacroCategories();
      else renderCategoryGraph();
    }
    node.querySelectorAll("[data-hub]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.hub)));
    addBtn.addEventListener("click",()=>{ if(mode==="macro") openMacroForm(null); else openCategoryForm(null); });
    setMode(mode);
  });
}
document.getElementById("openCategoriesHubBtn").addEventListener("click",()=>openCategoriesHub("categories"));

/* ---------------- Category form ---------------- */
function openCategoryForm(categoryId){
  const editing = !!categoryId;
  const cat = editing ? state.categories.find(c=>c.id===categoryId) : null;

  openSheet("tpl-category-form", (node, close)=>{
    node.querySelector("#categoryFormTitle").textContent = editing ? "Modifica categoria" : "Nuova categoria";
    const nameInput = node.querySelector("#categoryNameInput");
    const budgetInput = node.querySelector("#categoryBudgetInput");
    const emojiRow = node.querySelector("#categoryEmojiRow");
    const colorRow = node.querySelector("#categoryColorRow");
    const kindToggle = node.querySelector("#categoryKindToggle");
    const macroChips = node.querySelector("#categoryMacroChips");
    const deleteBtn = node.querySelector("#deleteCategoryBtn");

    let chosenEmoji = cat?.emoji || EMOJIS[0];
    let chosenColor = cat?.color || PALETTE[0];
    let chosenKind = cat?.kind || "expense";
    let chosenMacroId = cat?.macroCategoryId || null;

    nameInput.value = cat?.name || "";
    budgetInput.value = cat?.budget ? String(cat.budget).replace(".",",") : "";

    function renderMacroChips(){
      macroChips.innerHTML = "";
      const noneChip = document.createElement("button");
      noneChip.className = "chip" + (!chosenMacroId ? " active":"");
      noneChip.textContent = "Nessuna";
      noneChip.addEventListener("click", ()=>{ chosenMacroId=null; renderMacroChips(); });
      macroChips.appendChild(noneChip);
      state.macroCategories.filter(m=>m.kind===chosenKind).forEach(m=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (chosenMacroId===m.id ? " active":"");
        chip.innerHTML = `<span class="em">${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}`;
        chip.addEventListener("click", ()=>{ chosenMacroId=m.id; renderMacroChips(); });
        macroChips.appendChild(chip);
      });
    }
    renderMacroChips();

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.kind===chosenKind);
      opt.addEventListener("click", ()=>{
        chosenKind = opt.dataset.kind;
        if(chosenMacroId && state.macroCategories.find(m=>m.id===chosenMacroId)?.kind!==chosenKind) chosenMacroId=null;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        renderMacroChips();
      });
    });

    buildEmojiField(emojiRow, chosenEmoji, v=>{ chosenEmoji=v; });

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questa categoria? I movimenti collegati resteranno ma senza categoria.")) return;
      markDeleted(categoryId);
      state.categories = state.categories.filter(c=>c.id!==categoryId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveCategoryBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      if(editing){
        cat.name=name; cat.emoji=chosenEmoji; cat.color=chosenColor; cat.kind=chosenKind; cat.budget=budget; cat.macroCategoryId=chosenMacroId;
      } else {
        state.categories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, kind: chosenKind, budget, macroCategoryId: chosenMacroId });
      }
      persist(); renderAll(); close();
    });
  });
}
/* ---------------- Macro category form ---------------- */
function openMacroForm(macroId){
  const editing = !!macroId;
  const macro = editing ? state.macroCategories.find(m=>m.id===macroId) : null;

  openSheet("tpl-macro-form", (node, close)=>{
    node.querySelector("#macroFormTitle").textContent = editing ? "Modifica macrocategoria" : "Nuova macrocategoria";
    const nameInput = node.querySelector("#macroNameInput");
    const emojiRow = node.querySelector("#macroEmojiRow");
    const colorRow = node.querySelector("#macroColorRow");
    const budgetInput = node.querySelector("#macroBudgetInput");
    const deleteBtn = node.querySelector("#deleteMacroBtn");
    const kindToggle = node.querySelector("#macroKindToggle");

    let chosenEmoji = macro?.emoji || EMOJIS[0];
    let chosenColor = macro?.color || PALETTE[0];
    let chosenKind = macro?.kind || "expense";

    nameInput.value = macro?.name || "";
    budgetInput.value = macro?.budget ? String(macro.budget).replace(".",",") : "";

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active",opt.dataset.kind===chosenKind);
      opt.addEventListener("click",()=>{
        chosenKind=opt.dataset.kind;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.toggle("active",o===opt));
      });
    });

    buildEmojiField(emojiRow, chosenEmoji, v=>{ chosenEmoji=v; });

    PALETTE.forEach(color=>{
      const sw = document.createElement("button");
      sw.className = "color-swatch" + (color===chosenColor?" active":"");
      sw.style.background = color;
      sw.addEventListener("click", ()=>{
        chosenColor = color;
        colorRow.querySelectorAll(".color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
      });
      colorRow.appendChild(sw);
    });

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      const hasCats = state.categories.some(c=>c.macroCategoryId===macroId);
      const msg = hasCats
        ? "Le categorie associate resteranno, ma senza macrocategoria. Continuare?"
        : "Eliminare questa macrocategoria?";
      if(!await askConfirm(msg)) return;
      markDeleted(macroId);
      state.macroCategories = state.macroCategories.filter(m=>m.id!==macroId);
      state.categories.forEach(c=>{ if(c.macroCategoryId===macroId) c.macroCategoryId=null; });
      persist(); renderAll(); close();
    });

    node.querySelector("#saveMacroBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      if(editing){
        macro.name=name; macro.emoji=chosenEmoji; macro.color=chosenColor; macro.budget=budget; macro.kind=chosenKind;
      } else {
        state.macroCategories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, budget, kind:chosenKind });
      }
      persist(); renderAll(); close();
    });
  });
}
/* ---------------- Recurring form ---------------- */
function openRecurringForm(recurringId,prefill=null){
  const editing = !!recurringId;
  const rec = editing ? state.recurring.find(r=>r.id===recurringId) : (prefill||null);
  let rType = rec?.type || "expense";
  let rCat = rec?.categoryId || null;
  let rAcc = rec?.accountId || null;
  let rFreq = rec?.freq || "monthly";

  openSheet("tpl-recurring-form", (node, close)=>{
    node.querySelector("#recurringFormTitle").textContent = editing ? "Modifica ricorrente" : "Nuovo ricorrente";
    const nameInput = node.querySelector("#recurringNameInput");
    const amountInput = node.querySelector("#recurringAmountInput");
    const dateInput = node.querySelector("#recurringDateInput");
    const noteInput = node.querySelector("#recurringNoteInput");
    const typeToggle = node.querySelector("#recurringTypeToggle");
    const freqSelect = node.querySelector("#recurringFreqSelect");
    const catChips = node.querySelector("#recurringCategoryChips");
    const accChips = node.querySelector("#recurringAccountChips");
    const deleteBtn = node.querySelector("#deleteRecurringBtn");
    const activeInput=node.querySelector("#recurringActiveInput"), endDateInput=node.querySelector("#recurringEndDateInput");
    const durationMode=node.querySelector("#recurringDurationMode"), occurrencesWrap=node.querySelector("#recurringOccurrencesWrap"), occurrencesInput=node.querySelector("#recurringOccurrencesInput"), endDateWrap=node.querySelector("#recurringEndDateWrap");

    nameInput.value = rec?.name || "";
    amountInput.value = rec ? String(rec.amount).replace(".",",") : "";
    autoGrowAmountInput(amountInput);
    noteInput.value = rec?.note || "";
    dateInput.value = rec?.startDate || todayISO();
    freqSelect.value = rFreq;
    activeInput.checked=rec?.active!==false;
    endDateInput.value=rec?.endDate || "";
    occurrencesInput.value=rec?.maxOccurrences ? String(rec.maxOccurrences) : "";
    durationMode.value=rec?.maxOccurrences ? "count" : (rec?.endDate ? "date" : "unlimited");
    function renderDurationFields(){
      occurrencesWrap.hidden=durationMode.value!=="count";
      endDateWrap.hidden=durationMode.value!=="date";
    }
    durationMode.addEventListener("change",renderDurationFields);
    renderDurationFields();

    function renderCatChips(){
      renderCategoryPicker(catChips, rType, ()=>rCat, id=>{ rCat=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (rAcc===a.id?" active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ rAcc=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!rAcc) rAcc = state.accounts[0]?.id || null;
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.type===rType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        rType = opt.dataset.type; rCat=null;
        catChips._activeMacro = null;
        renderCatChips();
      });
    });
    freqSelect.addEventListener("change", ()=>{ rFreq=freqSelect.value; });

    renderCatChips();
    renderAccChips();
    const split=mountSplitPicker(node, accChips.closest(".field-row"), {account:()=>rAcc, type:()=>rType, amount:()=>parseAmount(amountInput.value), initial:rec?.split, initialGroup:rec?.groupId});

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questo movimento ricorrente? Sarà rimosso anche dalle prossime pianificate.")) return;
      moveToTrash("recurring",rec); const deleted=state.trash[0]?.id; removeRecurring(recurringId);
      persist(); renderAll(); close(); if(deleted) showUndo("Ricorrente eliminato",deleted);
    });

    node.querySelector("#saveRecurringBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      const amount = parseAmount(amountInput.value);
      const startDate = dateInput.value || todayISO();
      const duration=durationMode.value;
      const parsedOccurrences=parseInt(occurrencesInput.value||"",10);
      const maxOccurrences=duration==="count" && Number.isFinite(parsedOccurrences) && parsedOccurrences>0 ? parsedOccurrences : null;
      const endDate=duration==="date" ? (endDateInput.value||"") : "";
      const missing=[];if(!name) missing.push("nome");if(amount<=0) missing.push("importo");if(!rCat) missing.push("categoria");if(!rAcc) missing.push("conto");if(!dateInput.value) missing.push("data");if(duration==="count"&&!maxOccurrences) missing.push("numero rate");if(duration==="date"&&!endDate) missing.push("data fine");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));return;}
      if(endDate && endDate<startDate){showToast("La data di fine deve essere successiva alla prima data");return;}
      if(editing){
        rec.name=name; rec.amount=amount; rec.type=rType; rec.categoryId=rCat; rec.accountId=rAcc;
        rec.freq=rFreq; rec.startDate=startDate; rec.note=noteInput.value.trim(); rec.active=activeInput.checked; rec.endDate=endDate; rec.maxOccurrences=maxOccurrences; rec.split=split.get(); rec.groupId=split.getGroup();
        refreshRecurringTransactions(rec.id);
      } else {
        state.recurring.push({
          id: uid(), name, amount, type: rType, categoryId: rCat, accountId: rAcc,
          freq: rFreq, startDate, note: noteInput.value.trim(), nextDate: startDate, active:activeInput.checked, endDate, maxOccurrences, split:split.get(), groupId:split.getGroup(),
        });
      }
      if(!editing) generateRecurringTransactions(false);
      persist(); renderAll(); close();
      if(!editing && activeInput.checked && startDate===todayISO()) showToast("Ricorrente registrato anche nei Movimenti di oggi");
    });
  });
}

/* ---------------- Spese pianificate: form una tantum ---------------- */
let plannedTxType = "expense", plannedSelectedCategoryId = null, plannedSelectedAccountId = null;
function openPlannedForm(plannedId,prefill=null){
  const editing = !!plannedId;
  const p = editing ? state.planned.find(x=>x.id===plannedId) : (prefill||null);
  plannedTxType = p?.type || "expense";
  plannedSelectedCategoryId = p?.categoryId || null;
  plannedSelectedAccountId = p?.accountId || null;

  openSheet("tpl-planned-form", (node, close)=>{
    node.querySelector("#plannedFormTitle").textContent = editing ? "Modifica pianificata" : "Nuova pianificata";
    const amountInput = node.querySelector("#plannedAmountInput");
    const nameInput = node.querySelector("#plannedNameInput");
    const dateInput = node.querySelector("#plannedDateInput");
    const noteInput = node.querySelector("#plannedNoteInput");
    const catChipsGrouped = node.querySelector("#plannedCategoryChipsGrouped");
    const accChips = node.querySelector("#plannedAccountChips");
    const typeToggle = node.querySelector("#plannedTypeToggle");
    const deleteBtn = node.querySelector("#deletePlannedBtn");

    amountInput.value = p ? String(p.amount).replace(".",",") : "";
    nameInput.value=p?.name || "";
    autoGrowAmountInput(amountInput);
    noteInput.value = p?.note || "";
    if(p?.date){
      dateInput.value = p.date;
    } else {
      dateInput.value = todayISO();
    }

    typeToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.type===plannedTxType);
      opt.addEventListener("click", ()=>{
        typeToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        plannedTxType = opt.dataset.type;
        plannedSelectedCategoryId = null;
        catChipsGrouped._activeMacro = null;
        renderCatChips();
      });
    });

    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, plannedTxType, ()=>plannedSelectedCategoryId, id=>{ plannedSelectedCategoryId=id; });
    }
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.forEach(a=>{
        const chip = document.createElement("button");
        chip.className = "chip" + (plannedSelectedAccountId===a.id ? " active":"");
        chip.innerHTML = `<span class="em">●</span>${escapeHtml(a.name)}`;
        chip.querySelector(".em").style.color = safeColor(a.color);
        chip.addEventListener("click", ()=>{ plannedSelectedAccountId=a.id; renderAccChips(); });
        accChips.appendChild(chip);
      });
      if(!plannedSelectedAccountId) plannedSelectedAccountId = state.accounts[0]?.id || null;
    }
    renderCatChips();
    renderAccChips();
    const split=mountSplitPicker(node, accChips.closest(".field-row"), {account:()=>plannedSelectedAccountId, type:()=>plannedTxType, amount:()=>parseAmount(amountInput.value), initial:p?.split, initialGroup:p?.groupId});

    if(editing) deleteBtn.hidden = false;
    deleteBtn.addEventListener("click", async ()=>{
      if(!await askConfirm("Eliminare questa spesa pianificata?")) return;
      moveToTrash("planned",p); const deleted=state.trash[0]?.id; state.planned = state.planned.filter(x=>x.id!==plannedId);
      persist(); renderAll(); close(); if(deleted) showUndo("Pianificata eliminata",deleted);
    });

    node.querySelector("#savePlannedBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const missing=[];if(!nameInput.value.trim()) missing.push("nome");if(amount<=0) missing.push("importo");if(!plannedSelectedCategoryId) missing.push("categoria");if(!plannedSelectedAccountId) missing.push("conto");if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      const date = dateInput.value;
      if(editing){
        p.name=nameInput.value.trim(); p.amount=amount; p.type=plannedTxType; p.categoryId=plannedSelectedCategoryId;
        p.accountId=plannedSelectedAccountId; p.date=date; p.note=noteInput.value.trim(); p.split=split.get(); p.groupId=split.getGroup();
      } else {
        state.planned.push({
          id: uid(), name:nameInput.value.trim(), amount, type: plannedTxType, categoryId: plannedSelectedCategoryId,
          accountId: plannedSelectedAccountId, date, note: noteInput.value.trim(), split:split.get(), groupId:split.getGroup(),
        });
      }
      generatePlannedTransactions();
      persist(); renderAll(); close();
    });
  });
}
document.getElementById("addPlannedBtn").addEventListener("click", ()=> openPlannedForm(null));

/* ---------------- Calendario spese ---------------- */
let calYear, calMonth;
function buildCalendarDayInfo(y,m){
  const daysInMonth = new Date(y,m+1,0).getDate();
  const info = {};
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${y}-${pad2(m+1)}-${pad2(d)}`;
    info[iso] = { real:false, planned:false, recurring:false };
  }
  state.transactions.forEach(t=>{
    if(info[t.date]){
      info[t.date].real = true;
    }
  });
  state.planned.forEach(p=>{
    if(info[p.date]) info[p.date].planned = true;
  });
  state.recurring.forEach(r=>{
    recurringOccurrencesInMonth(r,y,m).forEach(date=>{
      if(info[date]) info[date].recurring = true;
    });
  });
  return info;
}
function renderCalendarGrid(node){
  node.querySelector("#calMonthLabel").textContent = `${MESI[calMonth]} ${calYear}`;
  const grid = node.querySelector("#calendarGrid");
  grid.innerHTML = "";
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Dom
  const leadBlanks = (firstDay+6)%7; // Lun=0
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const info = buildCalendarDayInfo(calYear, calMonth);
  const todayStr = todayISO();

  for(let i=0;i<leadBlanks;i++){
    const blank = document.createElement("div");
    blank.className = "calendar-cell empty";
    grid.appendChild(blank);
  }
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${calYear}-${pad2(calMonth+1)}-${pad2(d)}`;
    const cell = document.createElement("button");
    const dayInfo = info[iso];
    cell.className = "calendar-cell" + (iso===todayStr ? " today" : "") + (dayInfo.real ? " has-real":"") + (dayInfo.planned ? " has-planned":"") + (dayInfo.recurring ? " has-recurring":"");
    let dots = "";
    if(dayInfo.real) dots += `<span class="cal-dot real"></span>`;
    if(dayInfo.planned) dots += `<span class="cal-dot planned"></span>`;
    if(dayInfo.recurring) dots += `<span class="cal-dot recurring"></span>`;
    cell.innerHTML = `<span class="cal-day-num">${d}</span><span class="cal-dots">${dots}</span>`;
    cell.addEventListener("click", ()=> openDayDetail(iso));
    grid.appendChild(cell);
  }
  padCalendarGrid(grid,leadBlanks,daysInMonth);
}
function openCalendar(){
  calYear = viewYear; calMonth = viewMonth;
  let level="days";
  openSheet("tpl-calendar", (node)=>{
    const label=node.querySelector("#calMonthLabel"), months=node.querySelector("#calMonths");
    const grid=node.querySelector("#calendarGrid"), weekdays=node.querySelector(".calendar-weekdays");
    // v1.7.0: toccando il mese si vedono i 12 mesi per spostarsi velocemente; toccando un giorno se ne vedono i movimenti.
    function paint(){
      if(level!=="days"){
        label.innerHTML=level==="months"?`${calYear} <span class="pp-caret">▾</span>`:`Scegli l'anno`;
        grid.hidden=true; if(weekdays) weekdays.hidden=true; months.hidden=false; months.classList.toggle("is-years",level==="years");
        if(level==="months") renderMonthsGrid(months,calYear,calYear,calMonth,(m)=>{calMonth=m;level="days";paint();});
        else renderYearsGrid(months,calYear,(y)=>{calYear=y;level="months";paint();});
      }else{
        grid.hidden=false; if(weekdays) weekdays.hidden=false; months.hidden=true;
        renderCalendarGrid(node);
        label.innerHTML=`${MESI[calMonth]} ${calYear} <span class="pp-caret">▾</span>`;
        node.style.setProperty("--pp-h",Math.round(grid.getBoundingClientRect().bottom-(weekdays||grid).getBoundingClientRect().top)+"px");
      }
    }
    label.addEventListener("click",()=>{level=level==="days"?"months":level==="months"?"years":"months";paint();});
    node.querySelector("#calPrevMonth").addEventListener("click", ()=>{
      if(showMonths) calYear--; else { calMonth--; if(calMonth<0){ calMonth=11; calYear--; } }
      paint();
    });
    node.querySelector("#calNextMonth").addEventListener("click", ()=>{
      if(showMonths) calYear++; else { calMonth++; if(calMonth>11){ calMonth=0; calYear++; } }
      paint();
    });
    paint();
  });
}
/* v1.7.0 — Il pulsante calendario sta nella barra del periodo della Home (vista generale di tutti i movimenti). */
(function moveCalendarBtn(){
  const btn=document.getElementById("openCalendarBtn"), bar=document.querySelector(".topbar");
  if(btn && bar){ bar.appendChild(btn); btn.classList.add("topbar-cal-btn"); btn.setAttribute("aria-label","Calendario dei movimenti"); btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="9" cy="14.5" r="1.2" fill="currentColor"/><circle cx="15" cy="14.5" r="1.2" fill="currentColor"/></svg>'; }
})();
document.getElementById("openCalendarBtn").addEventListener("click", openCalendar);

function openDayDetail(iso){
  const d = new Date(iso+"T00:00:00");
  openSheet("tpl-day-detail", (node)=>{
    node.querySelector("#dayDetailTitle").textContent = `Movimenti — ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
    const real = state.transactions.filter(t=>t.date===iso);
    const planned = plannedItemsForDate(iso);
    const all = [...real, ...planned].sort((a,b)=> a.date.localeCompare(b.date));
    renderTxRows(node.querySelector("#dayDetailList"), all);
    node.querySelector("#dayDetailEmptyHint").hidden = all.length>0;
  });
}

/* ---------------- Backup / export / import / reset ---------------- */
function csvCell(value){
  const text=String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text;
}
function exportTransactionsCsv(){
  const cats=categoriesById(), macros=macroCategoriesById(), accs=accountsById();
  const rows=[["Data","Tipo","Nome","Categoria","Macrocategoria","Conto","Conto destinazione","Importo","Nota","Origine"]];
  state.transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).forEach(t=>{
    const cat=cats[t.categoryId], macro=cat?macros[cat.macroCategoryId]:null;
    rows.push([
      t.date,
      t.type==="income"?"Entrata":t.type==="expense"?"Uscita":"Trasferimento",
      t.name||"",
      cat?.name||"",
      macro?.name||"",
      accs[t.accountId]?.name||"",
      accs[t.toAccountId]?.name||"",
      Number(t.amount||0).toFixed(2).replace(".",","),
      t.note||"",
      t.recurringId?"Ricorrente":t.plannedId?"Pianificata":t.isBalanceAdjustment?"Rettifica saldo":"Manuale"
    ]);
  });
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a"),d=new Date();
  a.href=url;a.download=`noidue-movimenti-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast("CSV esportato correttamente");
}
document.getElementById("exportCsvBtn")?.addEventListener("click",exportTransactionsCsv);
/* Noi Due 1.3.0 — Esporta/condividi e importa con scelta: unisci, usa il backup o tieni questo telefono. */
const PRE_IMPORT_KEY="noidue_pre_import";
function backupFileName(){ const d=new Date(); return `noidue-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.json`; }
async function exportBackup(){
  const json=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2);
  const name=backupFileName();
  const done=()=>{ safeSetLocalStorage("noidue_last_backup",new Date().toISOString(),{notify:false}); renderAll(); };
  try{
    const file=new File([json],name,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:"Backup Noi Due"});
      done(); showToast("Backup condiviso"); return;
    }
  }catch(err){ if(err?.name==="AbortError") return; }
  const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  const a=document.createElement("a"); a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  done(); showToast("Backup esportato correttamente");
}
document.getElementById("exportBtn").addEventListener("click",exportBackup);

const normName=s=>String(s||"").trim().toLowerCase();
/* Allinea il backup a questo telefono prima di confrontarlo:
   - se le due persone sono invertite (Marco è "persona 2" nel backup) le scambia;
   - conti, categorie, gruppi e liste con lo stesso nome diventano lo stesso elemento. */
function alignBackup(local,inc){
  const la=normName(local.couple?.a?.name), lb=normName(local.couple?.b?.name);
  const ia=normName(inc.couple?.a?.name), ib=normName(inc.couple?.b?.name);
  if(la&&lb&&la!==lb&&ia===lb&&ib===la){
    inc.couple={...inc.couple,a:inc.couple.b,b:inc.couple.a};
    inc.accounts.forEach(a=>{ if(a.owner==="a") a.owner="b"; else if(a.owner==="b") a.owner="a"; });
    [...inc.transactions,...inc.recurring,...inc.planned].forEach(t=>{ if(t.split&&Number.isFinite(Number(t.split.pctA))) t.split.pctA=100-Number(t.split.pctA); if(t.settleAlloc) Object.keys(t.settleAlloc).forEach(k=>{ t.settleAlloc[k]=-t.settleAlloc[k]; }); });
  }
  const map={};
  const match=(locArr,incArr,key)=>{
    const ids=new Set(locArr.map(x=>x.id));
    incArr.forEach(x=>{ if(ids.has(x.id)) return; const twin=locArr.find(y=>key(y)===key(x)); if(twin) map[x.id]=twin.id; });
  };
  match(local.accounts,inc.accounts,x=>normName(x.name));
  match(local.macroCategories,inc.macroCategories,x=>x.kind+"|"+normName(x.name));
  match(local.categories,inc.categories,x=>x.kind+"|"+normName(x.name));
  match(local.groups||[],inc.groups||[],x=>normName(x.name));
  match(local.lists||[],inc.lists||[],x=>normName(x.name));
  const m=id=>id!=null&&map[id]?map[id]:id;
  ["accounts","macroCategories","categories","groups","lists"].forEach(k=>(inc[k]||[]).forEach(x=>{ x.id=m(x.id); }));
  inc.categories.forEach(c=>{ c.macroCategoryId=m(c.macroCategoryId); });
  [...inc.transactions,...inc.recurring,...inc.planned].forEach(t=>{
    t.accountId=m(t.accountId); t.toAccountId=m(t.toAccountId); t.categoryId=m(t.categoryId); t.groupId=m(t.groupId);
    if(t.settleAlloc) t.settleAlloc=Object.fromEntries(Object.entries(t.settleAlloc).map(([k,v])=>[m(k),v]));
  });
  (inc.lists||[]).forEach(l=>{ l.groupId=m(l.groupId); });
  if(inc.mainAccountId) inc.mainAccountId=m(inc.mainAccountId);
  // Dopo l'allineamento possono esserci doppioni con lo stesso id: tiene il primo.
  ["accounts","macroCategories","categories","groups","lists"].forEach(k=>{ const seen=new Set(); inc[k]=(inc[k]||[]).filter(x=>!seen.has(x.id)&&seen.add(x.id)); });
  return inc;
}
function compareById(a,b){
  const A=new Map(a.map(x=>[x.id,JSON.stringify(x)])), B=new Map(b.map(x=>[x.id,JSON.stringify(x)]));
  let onlyA=0,onlyB=0,diff=0;
  A.forEach((v,k)=>{ if(!B.has(k)) onlyA++; else if(B.get(k)!==v) diff++; });
  B.forEach((v,k)=>{ if(!A.has(k)) onlyB++; });
  return {onlyA,onlyB,diff};
}
function mergeStates(local,inc,prefer){
  const tomb={...(local.deleted||{}),...(inc.deleted||{})};
  const trashIds=new Set([...(local.trash||[]),...(inc.trash||[])].map(e=>e?.data?.id).filter(Boolean));
  const gone=id=>!!tomb[id]||trashIds.has(id);
  const [first,second]=prefer==="local"?[inc,local]:[local,inc]; // second vince sui doppioni
  const mergeArr=(a=[],b=[],{keepGone=false}={})=>{ const mp=new Map(); a.forEach(x=>mp.set(x.id,x)); b.forEach(x=>mp.set(x.id,x)); return [...mp.values()].filter(x=>keepGone||!gone(x.id)); };
  const out={...first,...second};
  ["accounts","macroCategories","categories","groups","recurring","planned","transactions"].forEach(k=>{ out[k]=mergeArr(first[k],second[k]); });
  out.trash=mergeArr(first.trash,second.trash,{keepGone:true}).sort((x,y)=>String(y.deletedAt).localeCompare(String(x.deletedAt)));
  const lists=new Map();
  (first.lists||[]).forEach(l=>lists.set(l.id,{...l,items:[...(l.items||[])]}));
  (second.lists||[]).forEach(l=>{ const prev=lists.get(l.id); lists.set(l.id,{...(prev||{}),...l,items:mergeArr(prev?.items||[],l.items||[])}); });
  // Stessa cosa aggiunta da tutti e due (es. "Latte" ancora da comprare): resta una volta sola.
  out.lists=[...lists.values()].filter(l=>!gone(l.id)).map(l=>{ const seenText=new Set(); return {...l,items:l.items.filter(i=>!gone(i.id)).filter(i=>{ if(i.done) return true; const k=normName(i.text); if(seenText.has(k)) return false; seenText.add(k); return true; })}; });
  // Ricorrenti e pianificate generate su entrambi i telefoni: una sola per data.
  const preferIds=new Set((second.transactions||[]).map(t=>t.id)), seen=new Map();
  out.transactions.forEach(t=>{ const key=t.recurringId?`r|${t.recurringId}|${t.date}`:t.plannedId?`p|${t.plannedId}|${t.date}`:null; if(!key) return; const prev=seen.get(key); if(!prev||(!preferIds.has(prev.id)&&preferIds.has(t.id))) seen.set(key,t); });
  out.transactions=out.transactions.filter(t=>{ const key=t.recurringId?`r|${t.recurringId}|${t.date}`:t.plannedId?`p|${t.plannedId}|${t.date}`:null; return !key||seen.get(key)===t; });
  out.planned=out.planned.filter(p=>!out.transactions.some(t=>t.plannedId===p.id&&t.date===p.date));
  out.deleted=tomb;
  out.couple={...second.couple,lastGroupId:local.couple?.lastGroupId||null};
  out.mainAccountId=out.accounts.some(a=>a.id===local.mainAccountId)?local.mainAccountId:(out.accounts.some(a=>a.id===second.mainAccountId)?second.mainAccountId:null);
  delete out.exportedAt;
  return out;
}
function stateSummary(s){
  const items=(s.lists||[]).reduce((n,l)=>n+(l.items||[]).filter(i=>!i.done).length,0);
  const last=(s.transactions||[]).reduce((m,t)=>t.date>m?t.date:m,"");
  return {tx:(s.transactions||[]).length,groups:(s.groups||[]).length,lists:(s.lists||[]).length,items,last,names:`${s.couple?.a?.name||"Persona 1"} e ${s.couple?.b?.name||"Persona 2"}`};
}
function fmtStamp(iso){ if(!iso) return "data sconosciuta"; const d=new Date(iso); if(isNaN(d)) return "data sconosciuta"; return `${d.getDate()} ${MESI[d.getMonth()].toLowerCase()} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function applyImported(next,label){
  const previous=state;
  const snapshot=JSON.stringify(previous);
  try{ localStorage.setItem(PRE_IMPORT_KEY,snapshot); }catch(e){ /* spazio insufficiente: si procede senza copia */ }
  state=migrate(next);
  if(!persist()){ state=previous; showToast("Spazio locale insufficiente: importazione non riuscita"); return; }
  renderAll(); renderUndoImport();
  showToast(label);
}
function renderUndoImport(){
  const btn=document.getElementById("undoImportBtn");
  if(btn) btn.hidden=!localStorage.getItem(PRE_IMPORT_KEY);
}
document.getElementById("undoImportBtn")?.addEventListener("click",async()=>{
  const raw=localStorage.getItem(PRE_IMPORT_KEY);
  if(!raw){ renderUndoImport(); return; }
  if(!await askConfirm("Tornare ai dati che c'erano prima dell'ultima importazione? Le modifiche fatte dopo andranno perse.",{ok:"Ripristina"})) return;
  try{ state=migrate(JSON.parse(raw)); persist(); localStorage.removeItem(PRE_IMPORT_KEY); renderAll(); renderUndoImport(); showToast("Dati ripristinati"); }
  catch(e){ showToast("Copia non leggibile"); }
});
function openImportChoice(parsed,fileName){
  const local=JSON.parse(JSON.stringify(state));
  const inc=alignBackup(local,migrate(JSON.parse(JSON.stringify(parsed))));
  openSheet("tpl-import-choice",(node,close)=>{
    const L=stateSummary(local), B=stateSummary(inc);
    node.querySelector("#importFileInfo").textContent=`${fileName||"Backup"} · esportato il ${fmtStamp(parsed.exportedAt||parsed.updatedAt)}`;
    const card=(title,s,stamp)=>`<strong>${title}</strong><span>${escapeHtml(s.names)}</span><span>${s.tx} ${s.tx===1?"movimento":"movimenti"}</span><span>${s.groups} ${s.groups===1?"gruppo":"gruppi"} · ${s.lists} ${s.lists===1?"lista":"liste"}</span><span>${s.items} ${s.items===1?"cosa":"cose"} da comprare</span><span>Ultimo movimento: ${s.last?s.last.split("-").reverse().join("/"):"—"}</span><small>Modificato: ${fmtStamp(stamp)}</small>`;
    node.querySelector("#icLocal").innerHTML=card("Questo telefono",L,local.updatedAt);
    node.querySelector("#icBackup").innerHTML=card("Backup",B,inc.updatedAt||parsed.exportedAt);
    const c=compareById(local.transactions,inc.transactions);
    const parts=[];
    if(c.onlyB) parts.push(`${c.onlyB} ${c.onlyB===1?"movimento":"movimenti"} solo nel backup`);
    if(c.onlyA) parts.push(`${c.onlyA} solo su questo telefono`);
    if(c.diff) parts.push(`${c.diff} ${c.diff===1?"diverso":"diversi"} tra i due`);
    node.querySelector("#importDiff").textContent=parts.length?parts.join(" · ")+".":"I movimenti sono uguali nei due.";
    let prefer=(inc.updatedAt||parsed.exportedAt||"")>(local.updatedAt||"")?"backup":"local";
    const toggle=node.querySelector("#importPrefer");
    const paint=()=>toggle.querySelectorAll(".type-opt").forEach(b=>b.classList.toggle("active",b.dataset.prefer===prefer));
    toggle.querySelectorAll(".type-opt").forEach(b=>b.addEventListener("click",()=>{prefer=b.dataset.prefer;paint();}));
    paint();
    node.querySelectorAll("[data-import]").forEach(btn=>btn.addEventListener("click",async()=>{
      const how=btn.dataset.import;
      if(how==="keep"){ close(); showToast("Nessun dato importato"); return; }
      if(how==="replace"){
        if(!await askConfirm("Sostituire tutti i dati di questo telefono con il backup?",{ok:"Sostituisci",danger:true})) return;
        close(); applyImported(parsed,"Backup importato: dati sostituiti"); return;
      }
      close(); applyImported(mergeStates(local,inc,prefer),"Backup unito ai dati di questo telefono");
    }));
  });
}
document.getElementById("importBtn").addEventListener("click", ()=> document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.accounts || !parsed.categories || !parsed.transactions) throw new Error("formato non valido");
      openImportChoice(parsed,file.name);
    }catch(err){
      showToast("File non valido. Assicurati di selezionare un backup esportato da Noi Due.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});
renderUndoImport();

document.getElementById("resetBtn").addEventListener("click", async ()=>{
  if(!await askConfirm("Questa azione elimina definitivamente tutti i conti, categorie, movimenti e ricorrenti. Continuare?",{ok:"Continua"})) return;
  if(!await askConfirm("Sei davvero sicuro? L'operazione non è reversibile.",{ok:"Azzera tutto"})) return;
  state = seedState();
  persist(); renderAll();
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible") return;
  balancesHidden=true;
  safeSetLocalStorage("noidue_hide_balances","1",{notify:false});
  generatePlannedTransactions();
  generateRecurringTransactions(false);
  renderAll();
});

/* ---------------- Service worker / aggiornamenti PWA ---------------- */
function showAppUpdatePrompt(registration){
  let panel=document.getElementById("appUpdatePrompt");
  if(!panel){
    panel=document.createElement("div");
    panel.id="appUpdatePrompt";
    panel.className="app-update-prompt";
    panel.setAttribute("role","dialog");
    panel.setAttribute("aria-live","polite");
    panel.setAttribute("aria-label","Aggiornamento disponibile");
    panel.innerHTML=`
      <div class="app-update-icon" aria-hidden="true">↻</div>
      <div class="app-update-copy">
        <strong>Nuova versione disponibile</strong>
        <span>È disponibile un aggiornamento di Noi Due.</span>
      </div>
      <div class="app-update-actions">
        <button type="button" class="app-update-later">Più tardi</button>
        <button type="button" class="app-update-now">Aggiorna ora</button>
      </div>`;
    document.body.appendChild(panel);
  }

  panel.classList.add("show");
  panel.querySelector(".app-update-later").onclick=()=>panel.classList.remove("show");
  panel.querySelector(".app-update-now").onclick=()=>{
    const waiting=registration.waiting;
    if(!waiting) return;
    panel.querySelector(".app-update-now").disabled=true;
    panel.querySelector(".app-update-now").textContent="Aggiornamento…";
    waiting.postMessage({type:"SKIP_WAITING"});
  };
}

if("serviceWorker" in navigator){
  let reloadingForUpdate=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(reloadingForUpdate) return;
    reloadingForUpdate=true;
    window.location.reload();
  });

  window.addEventListener("load", async ()=>{
    try{
      const registration=await navigator.serviceWorker.register("sw.js", {updateViaCache:"none"});

      // Se un update era già stato scaricato mentre l'app era chiusa.
      if(registration.waiting && navigator.serviceWorker.controller){
        showAppUpdatePrompt(registration);
      }

      registration.addEventListener("updatefound",()=>{
        const worker=registration.installing;
        if(!worker) return;
        worker.addEventListener("statechange",()=>{
          if(worker.state==="installed" && navigator.serviceWorker.controller){
            showAppUpdatePrompt(registration);
          }
        });
      });

      // Controllo immediato e poi periodico mentre la PWA resta aperta.
      registration.update().catch(()=>{});
      setInterval(()=>registration.update().catch(()=>{}), 60*60*1000);

      // Al ritorno in primo piano controlliamo subito se esiste una nuova versione.
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible") registration.update().catch(()=>{});
      });
    }catch(error){
      console.warn("Service worker non disponibile", error);
    }
  });
}

/* ---------------- Init ---------------- */
const appLoader=document.createElement("div");
appLoader.className="app-loader";
appLoader.innerHTML='<div class="loader-content" role="status" aria-label="Caricamento Noi Due"><div class="loader-money" aria-hidden="true">💑</div><p>Noi Due</p><i></i></div>';
document.body.appendChild(appLoader);

document.getElementById("goSetMainAccountBtn")?.addEventListener("click",()=>switchView("accounts"));
document.getElementById("homeMainAccountCard")?.addEventListener("click",()=>{
  if(state.mainAccountId) openAccountEvolution(state.mainAccountId); else switchView("accounts");
});
activeView="home";
generatePlannedTransactions();
generateRecurringTransactions(false);
// La Home è già attiva nel markup: forziamo inoltre la sua visibilità sia
// prima sia dopo il primo frame, evitando una Home bianca al rientro dallo splash.
function ensureInitialHome(){
  activeView="home";
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.dataset.view==="home"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.view==="home"));
  updateMonthNavVisibility();
  renderHeader();
  renderHome();
}
ensureInitialHome();
requestAnimationFrame(()=>{
  ensureInitialHome();
  renderAll();
});
setTimeout(()=>{
  ensureInitialHome();
  appLoader.style.opacity="0";
  setTimeout(()=>{appLoader.remove();renderAll();},300);
},650);

/* =========================================================
   v1.6.0 — Tieni premuto su un saldo: mini popup con gli ultimi 5 movimenti
   (Home) o i prossimi 5 in arrivo (R&P e previsioni).
   ========================================================= */
function lpCategory(t){return state.categories.find(c=>c.id===t.categoryId)||null;}
function lpLastMovements(filter){
  const today=todayISO();
  return state.transactions
    .filter(t=>t.date<=today && t.type!=="transfer" && (!filter || filter(t)))
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)))
    .slice(0,5);
}
function lpNextScheduled(filter){
  const today=todayISO();
  const out=[];
  const now=new Date();
  for(let k=0;k<13 && out.length<5;k++){
    const d=new Date(now.getFullYear(),now.getMonth()+k,1);
    plannedItemsForMonth(d.getFullYear(),d.getMonth())
      .filter(t=>t.date>=today && (!filter || filter(t)))
      .sort((a,b)=>a.date.localeCompare(b.date))
      .forEach(t=>{ if(out.length<5) out.push(t); });
  }
  return out;
}
function showLongPressPopup(anchor,title,items,{emptyText="Niente da mostrare.",future=false}={}){
  closeLongPressPopup();
  const pop=document.createElement("div");
  pop.className="lp-popup";pop.id="lpPopup";pop.setAttribute("role","dialog");pop.setAttribute("aria-label",title);
  const rows=items.map(t=>{
    const c=lpCategory(t);
    const name=t.name || c?.name || (t.type==="income"?"Entrata":"Uscita");
    const d=new Date(t.date+"T00:00:00");
    const when=`${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
    const kind=t.recurringId?"Ricorrente":t.plannedId?"Pianificata":"";
    const amount=balancesHidden?"••••":(t.type==="income"?"+":"−")+fmt(t.amount);
    const lpKind=future?(t.recurringId?"recurring":"planned"):"past";
    return `<div class="lp-row lp-kind-${lpKind}"><span class="lp-ic">${escapeHtml(c?.emoji||(t.type==="income"?"↑":"↓"))}</span><span class="lp-main"><b>${escapeHtml(name)}</b><small>${when}${future&&kind?` · ${kind}`:""}</small></span><span class="lp-amt ${t.type}">${amount}</span></div>`;
  }).join("");
  pop.innerHTML=`<div class="lp-head">${escapeHtml(title)}</div>${rows||`<p class="lp-empty">${escapeHtml(emptyText)}</p>`}`;
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  const w=Math.min(330,vw-24); pop.style.width=w+"px";
  let left=Math.min(Math.max(12,r.left+r.width/2-w/2),vw-w-12);
  const ph=pop.offsetHeight;
  let top=r.bottom+8;
  if(top+ph>vh-90) top=Math.max(12,r.top-ph-8);
  pop.style.left=left+"px"; pop.style.top=top+"px";
  requestAnimationFrame(()=>pop.classList.add("show"));
  setTimeout(()=>{
    document.addEventListener("pointerdown",lpOutside,true);
    window.addEventListener("scroll",closeLongPressPopup,{once:true,capture:true});
  },0);
}
function lpOutside(e){ if(!e.target.closest("#lpPopup")) closeLongPressPopup(); }
function closeLongPressPopup(){
  document.getElementById("lpPopup")?.remove();
  document.removeEventListener("pointerdown",lpOutside,true);
}
let lpSuppressClick=false;
document.addEventListener("click",e=>{ if(lpSuppressClick){ e.preventDefault(); e.stopPropagation(); lpSuppressClick=false; } },true);
function bindLongPress(el,handler){
  if(!el || el.dataset.lpBound) return;
  el.dataset.lpBound="1"; el.classList.add("lp-target");
  let timer=null,x=0,y=0;
  const cancel=()=>{clearTimeout(timer);timer=null;el.classList.remove("lp-pressing");};
  el.addEventListener("pointerdown",e=>{
    if(e.button!==undefined && e.button!==0) return;
    x=e.clientX;y=e.clientY;el.classList.add("lp-pressing");
    timer=setTimeout(()=>{timer=null;el.classList.remove("lp-pressing");lpSuppressClick=true;setTimeout(()=>{lpSuppressClick=false;},700);try{navigator.vibrate?.(12);}catch(_){};handler(e);},480);
  });
  el.addEventListener("pointermove",e=>{if(timer && Math.hypot(e.clientX-x,e.clientY-y)>10) cancel();});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,cancel));
  el.addEventListener("contextmenu",e=>e.preventDefault());
}
function setupLongPressTargets(){
  const byId=id=>document.getElementById(id);
  // Home — ultimi 5 movimenti
  bindLongPress(byId("netAmount"),()=>showLongPressPopup(byId("netAmount"),"Ultimi 5 movimenti",lpLastMovements(),{emptyText:"Nessun movimento registrato."}));
  bindLongPress(document.querySelector("#view-home .hero-split-item.income"),e=>showLongPressPopup(e.currentTarget||document.querySelector("#view-home .hero-split-item.income"),"Ultime 5 entrate",lpLastMovements(t=>t.type==="income"),{emptyText:"Nessuna entrata registrata."}));
  bindLongPress(document.querySelector("#view-home .hero-split-item.expense"),()=>showLongPressPopup(document.querySelector("#view-home .hero-split-item.expense"),"Ultime 5 uscite",lpLastMovements(t=>t.type==="expense"),{emptyText:"Nessuna uscita registrata."}));
  bindLongPress(byId("homeMainAccountCard"),()=>{
    const acc=state.accounts.find(a=>a.id===state.mainAccountId);
    showLongPressPopup(byId("homeMainAccountCard"),acc?`Ultimi 5 · ${acc.name}`:"Ultimi 5 movimenti",lpLastMovements(acc?(t=>t.accountId===acc.id||t.toAccountId===acc.id):null));
  });
  bindLongPress(document.querySelector("#view-home .hero-liquidity-item.all"),()=>showLongPressPopup(document.querySelector("#view-home .hero-liquidity-item.all"),"Ultimi 5 movimenti",lpLastMovements()));
  const fc=document.querySelectorAll("#view-home .forecast-card");
  if(fc[0]) bindLongPress(fc[0],()=>showLongPressPopup(fc[0],"Ultimi 5 movimenti",lpLastMovements()));
  if(fc[1]) bindLongPress(fc[1],()=>showLongPressPopup(fc[1],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  if(fc[2]) bindLongPress(fc[2],()=>showLongPressPopup(fc[2],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  // R&P — prossimi 5 (mix, solo ricorrenti, solo pianificate)
  const rp=[["recurringEstimateCard","Prossimi 5 ricorrenti",t=>!!t.recurringId],["plannedEstimateCard","Prossime 5 pianificate",t=>!!t.plannedId],["rpCombinedEstimateCard","Prossimi 5 · ricorrenti e pianificate",null]];
  rp.forEach(([id,title,f])=>{
    const card=byId(id); if(!card) return;
    bindLongPress(card,e=>{
      const chip=e.target.closest?.(".rp-estimate-breakdown span, .rp-combined-breakdown span");
      let filter=f, t=title;
      if(chip){
        const income=/Entrate/.test(chip.textContent);
        filter=x=>(!f||f(x)) && x.type===(income?"income":"expense");
        t=title+(income?" · entrate":" · uscite");
      }
      showLongPressPopup(chip||card,t,lpNextScheduled(filter),{future:true,emptyText:"Nessuna voce in arrivo."});
    });
  });
}
setupLongPressTargets();

/* v1.6.1 — Il pulsante "nascondi importi" di R&P sta accanto al periodo (mese/giorno). */
(function moveRPEye(){
  // v1.6.2: l'occhio di R&P sta a destra della riga Totali / Ricorrenti / Pianificate.
  const eye=document.getElementById("toggleRPBalance"), toggle=document.getElementById("rpModeToggle");
  if(!eye || !toggle) return;
  const row=document.createElement("div"); row.className="rp-mode-row";
  toggle.parentNode.insertBefore(row,toggle); row.appendChild(toggle); row.appendChild(eye);
})();

/* v1.7.0 — Campo di ricerca in R&P (vale per Totali, Ricorrenti e Pianificate). */
(function setupRPSearch(){
  return; // v1.8.0: la ricerca è nel pannello "Vedi tutti" di R&P.
  const row=document.querySelector("#view-recurring .rp-mode-row")||document.getElementById("rpModeToggle");
  if(!row || document.getElementById("rpSearchInput")) return;
  const wrap=document.createElement("div");wrap.className="rp-search";
  wrap.innerHTML='<input id="rpSearchInput" class="text-input" type="search" placeholder="Cerca nome, categoria o conto" autocomplete="off">';
  row.after(wrap);
  let t=null;
  wrap.querySelector("input").addEventListener("input",e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>{rpSearchQuery=v;renderAll();},180);});
})();

/* =========================================================
   v1.8.0 — Pannello "Vedi tutti" di R&P (come "Vedi tutti" della Home):
   scelta Totali / Ricorrenti / Pianificate, ricerca con evidenziazione, pulsante periodo.
   ========================================================= */
function rpAllMatches(name,categoryId,accountId){
  const q=rpAllQuery.trim().toLocaleLowerCase("it"); if(!q) return true;
  const cats=categoriesById(), accs=accountsById();
  return [name,cats[categoryId]?.name,accs[accountId]?.name].filter(Boolean).join(" ").toLocaleLowerCase("it").includes(q);
}
function renderRPAllView(){
  const up=document.getElementById("rpAllUpcoming"); if(!up) return;
  document.querySelectorAll("[data-rpall-kind]").forEach(b=>b.classList.toggle("active",b.dataset.rpallKind===rpAllKind));
  const pbtn=document.getElementById("rpAllPeriodBtn");
  if(pbtn) pbtn.innerHTML=`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>${periodLabel("rpall")}</span>`;
  const wantRec=rpAllKind!=="planned", wantPl=rpAllKind!=="recurring";
  const months=monthsInPeriod("rpall");
  const recRows=wantRec?state.recurring.map(r=>({r,dates:months.flatMap(([y,m])=>recurringOccurrencesInMonth(r,y,m)).filter(iso=>inPeriod("rpall",iso))}))
    .filter(x=>x.dates.length && rpAllMatches(x.r.name,x.r.categoryId,x.r.accountId)):[];
  const plRows=wantPl?state.planned.filter(p=>p.date && inPeriod("rpall",p.date) && rpAllMatches(p.name,p.categoryId,p.accountId)):[];
  up.innerHTML="";
  const rows=withHighlight(rpAllQuery,()=>[...recRows.map(({r,dates})=>recurringRowElement(r,{dates})),...plRows.map(p=>plannedRowElement(p))])
    .sort((a,b)=>(a.dataset.sortDate||"").localeCompare(b.dataset.sortDate||""));
  rows.forEach(r=>up.appendChild(r));
  document.getElementById("rpAllUpcomingCount").textContent=rows.length||"";
  document.getElementById("rpAllUpcomingEmpty").hidden=rows.length>0;
  const paid=state.transactions.filter(t=>((wantRec&&t.recurringId)||(wantPl&&t.plannedId)) && inPeriod("rpall",t.date) && rpAllMatches(t.name,t.categoryId,t.accountId))
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const paidEl=document.getElementById("rpAllPaid");
  withHighlight(rpAllQuery,()=>renderTxRows(paidEl,paid,{paidLabel:true}));
  document.getElementById("rpAllPaidCount").textContent=paid.length||"";
  document.getElementById("rpAllPaidEmpty").hidden=paid.length>0;
}
document.querySelectorAll("[data-rpall-kind]").forEach(b=>b.addEventListener("click",()=>{rpAllKind=b.dataset.rpallKind;renderRPAllView();}));
document.getElementById("rpAllPeriodBtn")?.addEventListener("click",()=>openPeriodPicker("rpall"));
(function(){let t=null;document.getElementById("rpAllSearchInput")?.addEventListener("input",e=>{clearTimeout(t);const v=e.target.value;t=setTimeout(()=>{rpAllQuery=v;renderRPAllView();},180);});})();

// v1.9.2 — La copertura della barra di stato appare solo quando si scorre.
(function(){
  const upd=()=>document.documentElement.classList.toggle("is-scrolled",window.scrollY>4);
  window.addEventListener("scroll",upd,{passive:true}); upd();
})();
