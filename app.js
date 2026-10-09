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
/* Formato importi unico della suite (suite.js): 1.234,56 € */
function fmt(n){
  if(window.SuiteFmt) return SuiteFmt.money(n);
  const v = Math.round((n||0)*100)/100;
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00a0€";
}
function fmtSigned(n){ return (n>=0?"+":"−") + fmt(Math.abs(n)); }
/* Con il saldo nascosto le cifre dei grafici diventano pallini (non spariscono). */
function maskAmt(text,dots="••••"){ return balancesHidden ? dots : text; }
function parseAmount(str){
  if(!str) return 0;
  // legge anche "1.234,56" (punto delle migliaia) senza scambiarlo per 1,234
  const v = window.SuiteFmt ? SuiteFmt.parse(str) : parseFloat(String(str).replace(/[€\s]/g,"").replace(",","."));
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
    macroCategories: [],
    categories: [
      C("Affitto / mutuo","🔑",PALETTE[4],"expense",null,null),
      C("Bollette","💡",PALETTE[2],"expense",null,null),
      C("Casa","🏠",PALETTE[9],"expense",null,null),
      C("Spesa","🛒",PALETTE[1],"expense",null,null),
      C("Farmacia","💊",PALETTE[3],"expense",null,null),
      C("Ristoranti","🍝",PALETTE[10],"expense",null,null),
      C("Svago","🎬",PALETTE[5],"expense",null,null),
      C("Viaggi","✈️",PALETTE[6],"expense",null,null),
      C("Regali","🎁",PALETTE[12],"expense",null,null),
      C("Trasporti","🚗",PALETTE[2],"expense",null,null),
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
let balancesHidden = true; // sempre nascosto all'apertura dell'app
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
/* v1.10.0 — Foto dei prodotti in IndexedDB.
   Prima erano dentro i dati (localStorage, ~5 MB in tutto): con molte foto lo spazio finiva e l'app
   non salvava più. Ora nei dati resta solo un riferimento "idb:<id>"; le foto stanno in IndexedDB.
   Il backup continua a contenere le foto (vengono reinserite all'esportazione). */
const PhotoStore=(()=>{
  const cache=new Map(); let dbp=null, ok=!!window.indexedDB;
  function db(){
    if(!ok) return Promise.reject(new Error("no idb"));
    if(!dbp) dbp=new Promise((res,rej)=>{ const r=indexedDB.open("noidue_photos",1); r.onupgradeneeded=()=>r.result.createObjectStore("photos"); r.onsuccess=()=>res(r.result); r.onerror=()=>{ ok=false; rej(r.error); }; });
    return dbp;
  }
  function tx(mode,fn){ return db().then(d=>new Promise((res,rej)=>{ const t=d.transaction("photos",mode), st=t.objectStore("photos"); const out=fn(st); t.oncomplete=()=>res(out&&out.result); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); })); }
  // v1.11.0: foto aggiunte dall'altro telefono: si scaricano dal database online la prima volta che servono.
  const pending=new Set(), failed=new Set();
  function fetchRemote(key){
    const S=window.syncNoiDue;
    if(!S||!S.coupleId||!window.SuiteSync?.signedIn||pending.has(key)||failed.has(key)) return;
    pending.add(key);
    S.downloadPhoto(`coppia/${S.coupleId}/${key}.jpg`).then(blob=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); }))
      .then(data=>{ cache.set(key,data); return tx("readwrite",st=>st.put(data,key)).catch(()=>{}); })
      .then(()=>{ markUploaded(key); if(typeof listDetailRefresh==="function") listDetailRefresh(); })
      .catch(()=>failed.add(key)).finally(()=>pending.delete(key));
  }
  return {
    get available(){ return ok; },
    has(key){ return cache.has(key); },
    src(ref){ if(!ref) return ""; if(String(ref).startsWith("idb:")){ const k=ref.slice(4); if(!cache.has(k)) fetchRemote(k); return cache.get(k)||""; } return ref; },
    data(ref){ return this.src(ref); },
    put(key,dataUrl){ cache.set(key,dataUrl); return tx("readwrite",st=>st.put(dataUrl,key)); },
    async loadAll(){ const keys=await tx("readonly",st=>st.getAllKeys()); const vals=await tx("readonly",st=>st.getAll()); (keys||[]).forEach((k,i)=>cache.set(k,vals[i])); return cache.size; },
    async prune(used){ const keys=await tx("readonly",st=>st.getAllKeys()); const dead=(keys||[]).filter(k=>!used.has(k)); if(dead.length) await tx("readwrite",st=>{ dead.forEach(k=>{ st.delete(k); cache.delete(k); }); }); return dead.length; }
  };
})();
function photoSrc(ref){ return PhotoStore.src(ref); }
function allListItems(s){ return (s?.lists||[]).flatMap(l=>l.items||[]); }
/* Sposta in IndexedDB le foto ancora salvate dentro i dati (nuove, importate o di versioni precedenti). */
function offloadPhotos(){
  if(!PhotoStore.available) return;
  allListItems(state).forEach(it=>{
    if(!/^data:image\//.test(String(it.photo||""))) return;
    const key=uid(), data=it.photo;
    it.photo="idb:"+key;
    PhotoStore.put(key,data).catch(()=>{ // IndexedDB non disponibile: la foto torna nei dati
      allListItems(state).forEach(x=>{ if(x.photo==="idb:"+key) x.photo=data; }); safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
    });
  });
}
/* Copia dei dati con le foto dentro (per backup e confronti). */
function stateWithPhotos(s){
  const c=JSON.parse(JSON.stringify(s));
  allListItems(c).forEach(it=>{ if(String(it.photo||"").startsWith("idb:")) it.photo=PhotoStore.data(it.photo)||""; });
  return c;
}
function persist(){
  balanceCache.clear();
  offloadPhotos();
  state.updatedAt=new Date().toISOString();
  state.trash = pruneTrashArray(state.trash);
  const ok=safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
  if(ok && window.syncNoiDue) syncNoiDue.changed();
  return ok;
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
let viewDay = now.getDate();
const periodModes = {home:"all", recurring:"month", stats:"month", transactions:"all", rpall:"month"};
function selectedDate(){return `${viewYear}-${pad2(viewMonth+1)}-${pad2(viewDay)}`;}
/* v1.7.0 — Periodo: mese intero, singolo giorno oppure intervallo di giorni (anche tra mesi diversi). */
let periodRange={from:null,to:null};
function periodBounds(view){
  const mode=periodModes[view]||"month";
  if(mode==="all") return {from:"0000-01-01",to:"9999-12-31"};
  if(mode==="day"){const d=selectedDate();return {from:d,to:d};}
  if(mode==="range" && periodRange.from && periodRange.to) return {from:periodRange.from,to:periodRange.to};
  return {from:`${viewYear}-${pad2(viewMonth+1)}-01`,to:`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`};
}
function inPeriod(view,iso){ if(!iso) return false; const b=periodBounds(view); return iso>=b.from && iso<=b.to; }
function shortDate(iso,withYear=false){const d=new Date(iso+"T00:00:00");return `${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${withYear?" "+d.getFullYear():""}`;}
function periodLabel(view){
  const mode=periodModes[view]||"month";
  if(mode==="all") return "Tutti i movimenti";
  if(mode==="day"){const d=new Date(selectedDate()+"T00:00:00");const wd=["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d.getDay()];return `${wd} ${d.getDate()} ${MESI[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;}
  if(mode==="range" && periodRange.from){
    const a=new Date(periodRange.from+"T00:00:00"), b=new Date(periodRange.to+"T00:00:00");
    if(a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MESI[a.getMonth()].toLowerCase()} ${a.getFullYear()}`;
    return `${shortDate(periodRange.from,a.getFullYear()!==b.getFullYear())} – ${shortDate(periodRange.to,true)}`;
  }
  return `${MESI[viewMonth]} ${viewYear}`;
}
function periodSubLabel(view){const m=periodModes[view]||"month";return m==="all"?"Filtra per mese o giorno":m==="day"?"Solo questo giorno":m==="range"?"Periodo scelto":"Tutto il mese";}
function periodTx(view){
  if(periodModes[view]==="all") return state.transactions.slice();
  if((periodModes[view]||"month")==="month") return monthTx();
  return state.transactions.filter(t=>inPeriod(view,t.date));
}

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
  data.couple={a:person(c.a,COUPLE_DEFAULT.a),b:person(c.b,COUPLE_DEFAULT.b),defaultSplit:c.defaultSplit==="personal"?"personal":"half",lastGroupId:c.lastGroupId?String(c.lastGroupId):null,onboarded:!!c.onboarded};
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
  // Noi Due 1.5.0: solo categorie di spesa, senza macrocategorie né budget.
  const usedCat=new Set([...(data.transactions||[]),...(data.recurring||[]),...(data.planned||[])].map(t=>t.categoryId));
  data.macroCategories=[];
  data.categories=(data.categories||[]).filter(c=>c.kind!=="income"||usedCat.has(c.id)).map(c=>({...c,macroCategoryId:null,budget:null}));
  // Liste della spesa / cose da comprare.
  if(!Array.isArray(data.lists)) data.lists=defaultLists(data.groups);
  data.lists=data.lists.filter(l=>l&&l.id).map(l=>({id:String(l.id).slice(0,120),name:String(l.name||"Lista").slice(0,40),emoji:cleanEmoji(String(l.emoji||"🛒"))||"🛒",groupId:ids.has(l.groupId)?l.groupId:fallback,
    items:(Array.isArray(l.items)?l.items:[]).filter(i=>i&&i.id).map(i=>({id:String(i.id).slice(0,120),text:String(i.text||"").slice(0,120),price:Number.isFinite(Number(i.price))&&Number(i.price)>0?Math.round(Number(i.price)*100)/100:null,done:!!i.done,
      code:String(i.code||"").replace(/[^0-9A-Za-z-]/g,"").slice(0,32),image:/^https:\/\//.test(String(i.image||""))?String(i.image).slice(0,500):"",url:/^https:\/\//.test(String(i.url||""))?String(i.url).slice(0,500):"",
      photo:/^data:image\/(jpeg|png|webp);base64,/.test(String(i.photo||""))&&String(i.photo).length<300000?String(i.photo):/^idb:[\w-]{1,120}$/.test(String(i.photo||""))?String(i.photo):"",
      qty:Math.min(99,Math.max(1,Math.round(Number(i.qty)||1))),aisle:typeof i.aisle==="string"?i.aisle.slice(0,20):"",forWhom:["a","b"].includes(i.forWhom)?i.forWhom:"both",addedBy:["a","b"].includes(i.addedBy)?i.addedBy:"",via:typeof i.via==="string"?i.via.slice(0,20):"",counted:/^\d{4}-\d{2}-\d{2}$/.test(String(i.counted||""))?String(i.counted):"",boughtAt:/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(String(i.boughtAt||""))?String(i.boughtAt):""})),
    sortMode:l.sortMode==="manual"?"manual":"aisle",
    restockOnExit:typeof l.restockOnExit==="boolean"?l.restockOnExit:/spesa|supermercat/i.test(String(l.name||"")),
    template:(Array.isArray(l.template)?l.template:[]).map(t=>String(t||"").slice(0,120)).filter(Boolean).slice(0,200),
    // v1.19.0 — Acquisti nel tempo (con data e ora automatiche) e cestino della lista.
    purchases:(Array.isArray(l.purchases)?l.purchases:[]).filter(x=>x&&x.id&&x.text&&/^\d{4}-\d{2}-\d{2}T/.test(String(x.at||""))).map(x=>({id:String(x.id).slice(0,120),itemId:String(x.itemId||"").slice(0,120),text:String(x.text).slice(0,120),qty:Math.min(99,Math.max(1,Math.round(Number(x.qty)||1))),aisle:typeof x.aisle==="string"?x.aisle.slice(0,20):"",at:String(x.at).slice(0,30),by:["a","b"].includes(x.by)?x.by:""})).sort((a,b)=>a.at.localeCompare(b.at)).slice(-400),
    trash:(Array.isArray(l.trash)?l.trash:[]).filter(x=>x&&x.id&&x.text&&/^\d{4}-\d{2}-\d{2}T/.test(String(x.deletedAt||""))).map(x=>({id:String(x.id).slice(0,120),text:String(x.text).slice(0,120),qty:Math.min(99,Math.max(1,Math.round(Number(x.qty)||1))),price:Number(x.price)>0?Math.round(Number(x.price)*100)/100:null,aisle:typeof x.aisle==="string"?x.aisle.slice(0,20):"",forWhom:["a","b"].includes(x.forWhom)?x.forWhom:"both",url:/^https:\/\//.test(String(x.url||""))?String(x.url).slice(0,500):"",image:/^https:\/\//.test(String(x.image||""))?String(x.image).slice(0,500):"",deletedAt:String(x.deletedAt).slice(0,30),by:["a","b"].includes(x.by)?x.by:""})).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)).slice(0,200),
    history:Object.fromEntries(Object.entries(l.history&&typeof l.history==="object"?l.history:{}).filter(([k,v])=>k&&v&&v.text).slice(-300).map(([k,v])=>[k.slice(0,120),{text:String(v.text).slice(0,120),count:Math.max(1,Number(v.count)||1),last:String(v.last||"").slice(0,10),aisle:typeof v.aisle==="string"?v.aisle.slice(0,20):"",dates:(Array.isArray(v.dates)?v.dates:[]).map(d=>String(d||"").slice(0,10)).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-12),qty:Math.min(99,Math.max(1,Math.round(Number(v.qty)||1)))}]))}));
  // Preferiti: prodotti da rimettere in lista con un tocco (comuni a tutte le liste).
  data.favorites=(Array.isArray(data.favorites)?data.favorites:[]).filter(f=>f&&f.text).map(f=>({id:String(f.id||uid()).slice(0,120),text:String(f.text).slice(0,120),aisle:typeof f.aisle==="string"?f.aisle.slice(0,20):""})).slice(0,300);
  // Elementi eliminati (liste, articoli, gruppi, conti, categorie): servono a unire i backup senza farli ricomparire.
  const del=data.deleted&&typeof data.deleted==="object"?data.deleted:{};
  const cut=new Date(); cut.setDate(cut.getDate()-180); const cutISO=`${cut.getFullYear()}-${pad2(cut.getMonth()+1)}-${pad2(cut.getDate())}`;
  data.deleted=Object.fromEntries(Object.entries(del).filter(([k,v])=>k&&/^\d{4}-\d{2}-\d{2}$/.test(String(v))&&v>=cutISO).slice(-5000));
}
function defaultLists(groups){
  const casa=(groups.find(g=>/casa/i.test(g.name))||groups[0])?.id, coppia=(groups.find(g=>/coppia/i.test(g.name))||groups[0])?.id;
  return [
    {id:uid(),name:"Spesa",emoji:"🛒",groupId:coppia,items:[],restockOnExit:true,sortMode:"aisle",template:[],history:{}},
    {id:uid(),name:"Per la casa",emoji:"🏠",groupId:casa,items:[],restockOnExit:false,sortMode:"aisle",template:[],history:{}},
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
/* v1.12.0 — Chi usa questo telefono (non viene sincronizzato): serve per "da Giulia" nelle liste e per gli avvisi. */
function myPerson(){ const v=localStorage.getItem("noidue_me"); return v==="a"||v==="b"?v:""; }
function askWhoAmI(){
  if(!window.SuiteSync||document.querySelector(".noidue-me-modal")) return;
  SuiteSync.modal(`<h3>Chi usa questo telefono?</h3><p class="suite-modal-text">Così nelle liste vedi cosa ha aggiunto l'altra persona e ricevi un avviso quando aggiunge qualcosa.</p><div class="app-update-actions"><button type="button" class="noidue-me-btn" data-me="a" style="border-color:${safeColor(personColor("a"))}">${escapeHtml(personName("a"))}</button><button type="button" class="noidue-me-btn" data-me="b" style="border-color:${safeColor(personColor("b"))}">${escapeHtml(personName("b"))}</button></div>`,(wrap,close)=>{
    wrap.classList.add("noidue-me-modal");
    wrap.querySelectorAll("[data-me]").forEach(b=>b.addEventListener("click",()=>{ safeSetLocalStorage("noidue_me",b.dataset.me,{notify:false}); close(); renderAll(); if(typeof listDetailRefresh==="function") listDetailRefresh(); if(typeof renderPushCard==="function") renderPushCard(); showToast(`Ok: su questo telefono sei ${personName(b.dataset.me)}`); }));
  });
}
function personName(k){ return k==="a"||k==="b" ? state.couple[k].name : "Cassa comune"; }
function personColor(k){ return k==="a"||k==="b" ? state.couple[k].color : "#D4A83A"; }
function personInitial(k){ return (personName(k).trim()[0]||(k==="a"?"1":"2")).toUpperCase(); }
function otherPerson(k){ return k==="a"?"b":"a"; }
function accOwner(id){ return state.accounts.find(a=>a.id===id)?.owner || "joint"; }
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
  const prefix=y==null?"":`${y}-${pad2(m+1)}`; // y nullo = tutti i movimenti
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
  row.innerHTML=`<label class="grp-lbl">Gruppo <button type="button" class="nd-info" data-nd-info="gruppo" aria-label="A cosa serve il gruppo">i</button></label><div class="chip-row group-chips"></div>
    <label class="split-lbl">Come dividere <button type="button" class="nd-info" data-nd-info="dividi" aria-label="Come funziona la divisione">i</button></label><div class="chip-row split-chips"></div>
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
  catWrap.innerHTML = `<p class="chip-group-title">Categoria <button type="button" class="nd-info" data-nd-info="categoria" aria-label="A cosa serve la categoria">i</button></p>`;
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

/* ---------------- Rendering: header ---------------- */
function renderHeader(){
  const daily=periodModes[activeView]==="day";
  {const lbl=document.getElementById("monthLabel");
  lbl.innerHTML=`<span class="pl-main">${periodLabel(activeView)}</span><span class="pl-sub">${periodSubLabel(activeView)} ▾</span>`;
  lbl.classList.toggle("is-day",periodModes[activeView]!=="month");}
  document.getElementById("monthLabel").setAttribute("aria-label",(daily?"Stai vedendo un solo giorno":"Stai vedendo tutto il mese")+". Tocca per cambiare");
  document.getElementById("periodDate").value=selectedDate();
  document.getElementById("periodReturn").hidden=true;
  // Noi Due: di base si vede tutto; la × toglie il filtro di mese/giorno.
  const filtered=periodModes[activeView]!=="all";
  document.getElementById("periodX").hidden=!filtered;
  document.getElementById("prevMonth").style.visibility=filtered?"":"hidden";
  document.getElementById("nextMonth").style.visibility=filtered?"":"hidden";
  document.getElementById("dayControl").hidden=!daily;
  // v1.17.0 — "Oggi": torna al mese corrente quando stai guardando un altro mese (come in Bilancio).
  {const today=new Date(), cur=viewYear===today.getFullYear()&&viewMonth===today.getMonth();
   const btn=document.getElementById("backToCurrentMonth");
   if(btn) btn.hidden=!(filtered&&!cur&&(activeView==="home"||activeView==="transactions"));}
  document.getElementById("prevMonth").setAttribute("aria-label",daily?"Giorno precedente":"Mese precedente");
  document.getElementById("nextMonth").setAttribute("aria-label",daily?"Giorno successivo":"Mese successivo");
  document.querySelectorAll("[data-period]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.period===periodModes[activeView])));
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
  // Rimborsi tra voi nel periodo (al posto del budget, tolto in 1.5.0).
  const left=el("ndBudgetLeft");
  const settles=periodTx("home").filter(t=>isCoupleSettle(t)).reduce((s,t)=>s+t.amount,0);
  left.textContent=show(settles); left.style.color="";
  return;
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
  setEyeIcon(document.getElementById("toggleHomeBalance"),balancesHidden);
  renderCoupleStrip();
  renderHomeLists();
  {const c=document.getElementById("seeAllTxCount"); if(c) c.textContent=periodTx("home").filter(t=>!t.isBalanceAdjustment).length;}
  document.querySelector("#view-home .hero-label").textContent=periodModes.home==="all"?"Spese totali":periodModes.home==="day"?"Spese del giorno":periodModes.home==="range"?"Spese del periodo":"Spese del mese";
  renderNdHome();
  const recent = periodTx("home").filter(t=>!t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  const hint=document.getElementById("txEmptyHint");
  hint.hidden = recent.length>0;
  hint.textContent=periodModes.home==="all"?"Nessun movimento. Tocca + per aggiungere una spesa.":periodModes.home==="day"?"Nessun movimento in questo giorno.":periodModes.home==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";
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
function futureFromTx(t){
  const d=nextMonthSameDay(t.date);
  return {name:t.name||"",amount:t.amount,type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",split:t.split||null,groupId:t.groupId||null,freq:"monthly",startDate:d,date:d,active:true};
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
function cleanEmoji(str,max=2){
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
  // Solo emoji dalla tastiera del telefono, niente icone suggerite.
  const hint=document.createElement("p");hint.className="field-hint emoji-hint";hint.textContent="Tocca il campo e sulla tastiera premi 😀 (o 🌐) per scegliere l'emoji. Puoi metterne fino a 2.";
  const commit=()=>{const v=cleanEmoji(input.value);onChange(v||EMOJIS[0]);};
  input.addEventListener("input",()=>{const v=cleanEmoji(input.value);if(v!==input.value&&!input.value.endsWith("\u200D"))input.value=v;commit();});
  input.addEventListener("blur",()=>{input.value=cleanEmoji(input.value);commit();});
  clear.addEventListener("click",()=>{input.value="";input.focus();onChange(EMOJIS[0]);});
  row.append(wrap,hint);
  commit();
}
function emojiIconHtml(emoji){
  const grs=emojiGraphemes(emoji).slice(0,2);
  return (grs.length?grs:[emoji]).map(g=>`<span class="mv-ic-item">${escapeHtml(g)}</span>`).join("");
}
function movementRowHtml({emoji,color,title,badges="",meta="",amountHtml,type,date,relative=true,kind=null,paid=false}){
  const nEm=Math.max(1,Math.min(2,emojiGraphemes(emoji).length||1));
  return `<span class="mv-ic${nEm>1?` mv-ic-n${nEm}`:""}">${emojiIconHtml(emoji)}</span>
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
      : `<span>${hlText(cat.name)}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc mv-payer"><i class="mv-dot" style="background:${safeColor(personColor(acc.owner||"joint"))}" aria-hidden="true"></i>${hlText(acc.name)}</span>${sLabel?`<span class="mv-sep" aria-hidden="true">·</span><span class="mv-split">${escapeHtml(sLabel)}</span>`:""}`;
    const listBadge = t.listId ? `<span class="mv-list-badge" title="Spesa registrata dalla lista ${escapeHtml(state.lists.find(x=>x.id===t.listId)?.name||"")}" aria-label="Dalla lista">🛒</span>` : "";
    row.innerHTML = movementRowHtml({emoji:cat.emoji,color:cat.color,title,badges:statusBadge,meta:listBadge+metaParts,
      amountHtml:`${isTransfer?"↔":t.type==="income"?"+":""}${fmt(t.amount)}`,type:t.type,date:t.date,relative:!!t.planned,
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
      onEdit:()=>{
        if(t.recurringId && state.recurring.some(r=>r.id===t.recurringId)) openRecurringForm(t.recurringId);
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
  document.getElementById("allTxEmptyHint").textContent=periodModes.transactions==="all"?"Nessun movimento.":periodModes.transactions==="day"?"Nessun movimento in questo giorno.":periodModes.transactions==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";

  const plannedWrap = document.getElementById("allTxPlannedWrap"); if(plannedWrap) plannedWrap.hidden=true;
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
    legItem.innerHTML = `<span class="sw" style="background:${safeColor(info.color)}"></span><span class="lbl">${escapeHtml(info.emoji)} ${escapeHtml(info.name)}</span><span class="val"><b>${maskAmt(fmt(val))}</b><small>${Math.round(frac*100)}%</small></span>`;
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
      <span class="ic">${emojiIconHtml(c.emoji)}</span>
      <span class="info">
        <p class="nm">${escapeHtml(c.name)}</p>
        <p class="sub">${(n=>`${n} ${n===1?"movimento":"movimenti"}`)(state.transactions.filter(t=>t.categoryId===c.id).length)}</p>
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
    group.innerHTML = `<p class="category-group-title">Categorie di spesa</p>`;
    const items=groups.get("none");items.forEach((c,i)=> group.appendChild(buildRow(c,i,items.length)));
    container.appendChild(group);
  }
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
  generateRecurringTransactions(false);
  renderHeader();
  renderHome();
  renderCouple();
  renderTransactionsView();
  renderStats();
  renderCategories();
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
    periodModes[view]=view==="home"?"all":"month";
    if(PAIR.includes(view)){periodModes.home="all";periodModes.recurring="month";}
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
const SUBVIEW_PARENT={transactions:"home"};
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
  monthSwipeBlocked=Boolean(target.closest("input,textarea,select,button,a,[contenteditable='true'],.chart-wrap,.sheet,.movement-action-overlay"))
    || insideHScroller(target,viewsRoot);
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
document.getElementById("periodX").addEventListener("click",()=>setPeriodMode("all"));
document.getElementById("backToCurrentMonth")?.addEventListener("click",()=>{
  const today=new Date();
  viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
  periodModes[activeView]="month";txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();closePeriodMenu();renderAll();
});
/* v1.17.0 — Tieni premuto sul titolo: menu veloce dei mesi (come in Bilancio), con "Tutti i movimenti". */
/* lpOutside, closeLongPressPopup e bindLongPress ora sono in suite.js (comuni a Bilancio e Noi Due). */
function showMonthQuickPicker(anchor){
  closeLongPressPopup();
  const pop=document.createElement("div");
  pop.className="lp-popup mp-popup";pop.id="lpPopup";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Scegli il mese");
  const all=periodModes[activeView]==="all", today=new Date();
  const baseY=all?today.getFullYear():viewYear, baseM=all?today.getMonth():viewMonth;
  const items=[];
  for(let i=-3;i<=3;i++){ const d=new Date(baseY,baseM+i,1); items.push({y:d.getFullYear(),m:d.getMonth(),cur:!all&&i===0,now:d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth()}); }
  const rows=items.map(it=>`<button type="button" class="mp-row${it.cur?" active":""}" data-y="${it.y}" data-m="${it.m}"><b>${MESI[it.m]}</b><small>${it.now?"questo mese · ":""}${it.y}</small></button>`).join("");
  pop.innerHTML=`<div class="lp-head">Scegli il mese</div><div class="mp-list"><button type="button" class="mp-row mp-all${all?" active":""}" data-all><b>Tutti i movimenti</b><small>senza filtro</small></button>${rows}</div>`;
  document.body.appendChild(pop);
  pop.querySelector("[data-all]").addEventListener("click",()=>{ periodModes[activeView]="all"; txVisibleLimit=TX_PAGE_SIZE; closeLongPressPopup(); renderAll(); });
  pop.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>{
    viewYear=Number(b.dataset.y);viewMonth=Number(b.dataset.m);
    viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
    periodModes[activeView]="month";txVisibleLimit=TX_PAGE_SIZE;closeLongPressPopup();renderAll();
  }));
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  const w=Math.min(250,vw-24); pop.style.width=w+"px";
  const left=Math.min(Math.max(12,r.left+r.width/2-w/2),vw-w-12);
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
bindLongPress(document.getElementById("monthLabel"),()=>showMonthQuickPicker(document.getElementById("monthLabel")));
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
      if(!opts && periodModes[target]==="all") whole.classList.remove("active");
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
          // v1.17.0 — come in Bilancio: un pallino sotto il giorno, qui con il colore di chi ha pagato.
          const di=info[iso];
          const dots=di?["a","b","joint"].filter(k=>di[k]).map(k=>`<span class="cal-dot" style="background:${safeColor(personColor(k))}"></span>`).join("")+(di.settle?'<span class="cal-dot settle"></span>':""):"";
          const amt=di&&di.total>0?`<span class="cal-amt">${balancesHidden?"••":Math.round(di.total)}</span>`:"";
          cell.innerHTML=`<span class="cal-day-num">${d}</span>${amt}<span class="cal-dots">${dots}</span>`;
          if(di&&di.total>0) cell.classList.add("has-real");
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
        // Legenda e totale del mese, come nel calendario spese.
        let lg=days.querySelector(".pp-legend"); if(!lg){ lg=document.createElement("div"); lg.className="calendar-legend pp-legend"; days.appendChild(lg); }
        lg.innerHTML=["a","b","joint"].map(k=>`<span class="cal-leg-item"><span class="dot" style="background:${safeColor(personColor(k))}"></span>${escapeHtml(personName(k))}</span>`).join("")+`<span class="cal-leg-item"><span class="dot" style="background:#e8a33d"></span>Rimborso</span>`;
        const monthTot=Object.values(info).reduce((t,x)=>t+(x.total||0),0);
        let mt=days.querySelector(".pp-month-total"); if(!mt){ mt=document.createElement("p"); mt.className="pp-month-total"; days.appendChild(mt); }
        mt.textContent=monthTot>0?`Spese di ${MESI[pMonth].toLowerCase()}: ${balancesHidden?"••••":fmt(monthTot)}`:`Nessuna spesa a ${MESI[pMonth].toLowerCase()}`;
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
    if(!opts && (target==="home"||target==="transactions")){
      // v1.17.0 — "Tutti i movimenti" sta in alto: in basso restano due pulsanti come in Bilancio.
      const allBtn=document.createElement("button"); allBtn.type="button"; allBtn.className="pp-all-chip"; allBtn.textContent="Tutti i movimenti";
      allBtn.classList.toggle("active",periodModes[target]==="all");
      allBtn.addEventListener("click",()=>{ periodModes[target]="all"; txVisibleLimit=TX_PAGE_SIZE; closeBtn.click(); renderAll(); });
      closeBtn.before(allBtn);
    }
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
/* v1.23.0 — Il dito è partito dentro una striscia che scorre di lato (es. le liste in Home)?
   Allora quel movimento è suo: niente cambio mese e niente ritorno indietro. */
function insideHScroller(el,root){
  for(let n=el;n && n!==root && n!==document.body;n=n.parentElement){
    if(n.scrollWidth>n.clientWidth+2){
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

  const st=coupleMonthStats(null,null);
  const show=v=>balancesHidden?"••••":fmt(v);
  document.getElementById("couplePaidALabel").textContent=`Ha pagato ${personName("a")}`;
  document.getElementById("couplePaidBLabel").textContent=`Ha pagato ${personName("b")}`;
  document.getElementById("couplePaidA").textContent=show(st.paid.a);
  document.getElementById("couplePaidB").textContent=show(st.paid.b);
  document.getElementById("couplePaidJoint").textContent=show(st.paid.joint);
  document.getElementById("coupleSharesTitle").textContent="Quote di ciascuno";
  const max=Math.max(st.paid.a,st.paid.b,st.quota.a,st.quota.b,1);
  const bar=(label,v,color,soft)=>`<div class="cs-row"><div class="cs-lbl"><span>${escapeHtml(label)}</span><strong>${show(v)}</strong></div><div class="cs-bar"><i style="width:${(v/max*100).toFixed(1)}%;background:${soft?`color-mix(in srgb,${color} 40%,transparent)`:color}"></i></div></div>`;
  document.getElementById("coupleShares").innerHTML = (st.paid.a+st.paid.b)>0
    ? bar(`Quota di ${personName("a")}`,st.quota.a,personColor("a"))+bar(`Pagato da ${personName("a")}`,st.paid.a,personColor("a"),true)
      +bar(`Quota di ${personName("b")}`,st.quota.b,personColor("b"))+bar(`Pagato da ${personName("b")}`,st.paid.b,personColor("b"),true)
      +`<p class="field-hint cs-note">La quota è la parte di spese personali che spetta a ciascuno; le spese dalla cassa comune non sono incluse.</p>`
    : `<p class="empty-hint">Nessuna spesa pagata da uno dei due.</p>`;
  const shared=st.shared.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id))).slice(0,8);
  renderTxRows(document.getElementById("coupleSharedTx"),shared);
  document.getElementById("coupleSharedEmpty").hidden=shared.length>0;
  const settles=state.transactions.filter(isCoupleSettle).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  renderTxRows(document.getElementById("coupleSettleTx"),settles);
  document.getElementById("coupleSettleEmpty").hidden=settles.length>0;
  renderCoupleGroups();
  renderFixedExpenses();
  renderCoupleLists();
  if(groupDetailRefresh) groupDetailRefresh();
  if(listDetailRefresh) listDetailRefresh();
}
/* ---------------- Liste della spesa / cose da comprare ---------------- */
/* v1.20.0 — Anello di avanzamento con il numero di cose da comprare (al posto del riquadro giallo). */
function listRingHtml(todo,total){
  const pct=total?Math.round((total-todo)/total*100):0, r=15, c=2*Math.PI*r, off=c*(1-pct/100);
  return `<span class="lr-ring${todo?"":" zero"}" aria-hidden="true"><svg viewBox="0 0 36 36"><circle class="lr-bg" cx="18" cy="18" r="${r}"/><circle class="lr-fg" cx="18" cy="18" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><b>${todo?todo:"✓"}</b></span>`;
}
/* v1.17.0 — Home: le liste in una scheda con titolo, così si capisce cosa sono. Ogni lista mostra quanto
   resta da comprare, una barra di avanzamento e i prodotti "da ricomprare". */
function renderHomeLists(){
  const box=document.getElementById("homeLists");
  if(!box) return;
  box.hidden=!state.lists.length;
  if(!state.lists.length){ box.innerHTML=""; return; }
  const totalTodo=state.lists.reduce((n,l)=>n+l.items.filter(i=>!i.done).length,0);
  box.innerHTML=`<div class="hl-head"><span class="hl-title"><span class="hl-title-ic" aria-hidden="true">🛒</span>Liste della spesa</span><span class="hl-sum">${totalTodo?`${totalTodo} da comprare`:"tutto preso"}</span><button type="button" class="hl-all" aria-label="Apri tutte le liste">Tutte ›</button></div><div class="hl-row"></div>`;
  const row=box.querySelector(".hl-row");
  state.lists.forEach(l=>{
    const todo=l.items.filter(i=>!i.done).length, done=l.items.length-todo, due=smartSuggestions(l).filter(x=>x.isDue).length;
    const pct=l.items.length?Math.round(done/l.items.length*100):0;
    const b=document.createElement("div"); b.setAttribute("role","button"); b.tabIndex=0; b.className="hl-item"+(todo?"":" empty");
    b.innerHTML=`<span class="hl-em" aria-hidden="true">${escapeHtml(l.emoji)}</span><span class="hl-txt"><b>${escapeHtml(l.name)}</b><small>${todo?`${todo} da comprare`:"Tutto preso"}${due?` · ⏰ ${due}`:""}</small></span>${listRingHtml(todo,l.items.length)}`;
    b.setAttribute("aria-label",`Lista ${l.name}: ${todo} da comprare${due?`, ${due} da ricomprare`:""}`);
    b.addEventListener("click",()=>openListDetail(l.id));
    row.appendChild(b);
  });
  box.querySelector(".hl-all").addEventListener("click",()=>switchView("liste",{animate:true}));
}
function renderCoupleLists(){
  renderHomeLists();
  const box=document.getElementById("coupleLists");
  if(!box) return;
  box.innerHTML="";
  if(!state.lists.length){ box.innerHTML=`<p class="empty-hint">Nessuna lista. Tocca "+ Nuova" per crearne una.</p>`; return; }
  // v1.19.0 — Schede compatte (una riga): emoji, nome, cosa resta, barra di avanzamento, numero.
  state.lists.forEach(l=>{
    const todo=l.items.filter(i=>!i.done).length, done=l.items.length-todo;
    const g=groupsById()[l.groupId], due=smartSuggestions(l).filter(x=>x.isDue).length;
    const pct=l.items.length?Math.round(done/l.items.length*100):0;
    const card=document.createElement("div");
    card.className="lv-card"+(todo?"":" empty"); card.setAttribute("role","button"); card.tabIndex=0;
    card.innerHTML=`<span class="lv-em" aria-hidden="true">${escapeHtml(l.emoji)}</span><span class="lv-head"><b>${escapeHtml(l.name)}</b><small>${todo?`${todo} da comprare`:"Niente da comprare"}${done?` · ${done} acquistati`:""}${due?` · ⏰ ${due}`:""}${g?` · ${escapeHtml(g.emoji+" "+g.name)}`:""}</small></span>${listRingHtml(todo,l.items.length)}<span class="lv-chev" aria-hidden="true">›</span>`;
    card.setAttribute("aria-label",`${l.name}: ${todo} da comprare`);
    card.addEventListener("click",()=>openListDetail(l.id));
    card.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openListDetail(l.id); } });
    box.appendChild(card);
  });
  renderListsMonth(box);
}
/* v1.21.0 — Resoconto del mese: chi ha preso cosa (dagli acquisti segnati nelle liste). */
function renderListsMonth(after){
  let el=document.getElementById("listsMonth");
  if(!el){ el=document.createElement("section"); el.id="listsMonth"; el.className="lm-card"; after.after(el); }
  const now=new Date(), key=`${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  const all=state.lists.flatMap(l=>(l.purchases||[]).filter(p=>String(p.at).startsWith(key)).map(p=>({...p,list:l})));
  if(!all.length){ el.hidden=true; return; }
  el.hidden=false;
  const per={a:0,b:0,"":0}; all.forEach(p=>{ per[p.by||""]=(per[p.by||""]||0)+1; });
  const byText=new Map(); all.forEach(p=>{ const k=historyKey(p.text); const v=byText.get(k)||{text:p.text,n:0,by:{a:0,b:0}}; v.n+=1; if(p.by) v.by[p.by]++; byText.set(k,v); });
  const top=[...byText.values()].sort((x,y)=>y.n-x.n).slice(0,6);
  const total=all.length;
  const bar=["a","b"].filter(k=>per[k]>0).map(k=>`<i style="width:${Math.round(per[k]/total*100)}%;background:${safeColor(personColor(k))}"></i>`).join("");
  el.innerHTML=`<div class="lm-head"><b>🛒 ${MESI[now.getMonth()]}: chi ha preso cosa</b><small>${total} ${total===1?"prodotto preso":"prodotti presi"}</small></div>
    <div class="lm-bar" aria-hidden="true">${bar}</div>
    <div class="lm-people">${["a","b"].map(k=>`<span><i style="background:${safeColor(personColor(k))}"></i>${escapeHtml(personName(k))} <b>${per[k]||0}</b></span>`).join("")}</div>
    <div class="lm-top">${top.map(t=>`<span class="lm-chip">${escapeHtml(t.text)}${t.n>1?` <b>×${t.n}</b>`:""}</span>`).join("")}</div>`;
}
var listDetailRefresh=null;
function listCategoryFor(l){
  const exp=state.categories.filter(c=>c.kind==="expense");
  const byName=n=>exp.find(c=>c.name.toLowerCase()===n);
  return (byName(l.name.toLowerCase()) || (/casa/i.test(l.name)&&byName("casa")) || (/spes|super|aliment/i.test(l.name)&&byName("spesa")) || (/farmac/i.test(l.name)&&byName("farmacia")) || null)?.id || null;
}
/* ---------------- Noi Due 1.7.0 — Liste: quantità, reparti, comprati spesso, gesti, per chi, lista base ---------------- */
const AISLES=[
  /* v1.23.0 — Reparti: [chiave, emoji, nome, parole]. La scelta non è più "vince il primo
     reparto dell'elenco" ma "vince la parola più lunga trovata nel testo": così
     "lavastoviglie" va fra gli elettrodomestici e "detersivo lavastoviglie" fra la pulizia.
     Il testo viene prima ripulito (minuscole, accenti, quantità), quindi qui si scrive
     tutto senza accenti. */
  ["frutta","🥦","Frutta e verdura",String.raw`mel[ae]\b|banan\w*|aranc\w*|mandarin\w*|clementin\w*|limon\w*|per[ae]\b|frutta|frutti di bosco|kiwi|uva\b|fragol\w*|insalat\w*|lattug\w*|songino|valeriana|pomodor\w*|pomodorin\w*|zucchin\w*|zucca|carot\w*|patat[ae]\b|patate\b|cipoll\w*|scalogno|aglio|peperon\w*|melanzan\w*|verdur\w*|ortaggi|spinac\w*|bietol\w*|broccol\w*|cavol\w*|verza|cime di rapa|fungh\w*|champignon|basilic\w*|prezzemol\w*|rosmarino|salvia|avocado|finocch\w*|sedano|rucola|radicchio|ananas|pesche\b|albicocc\w*|susine|prugne|cocomer\w*|anguria|melone|mirtill\w*|lampon\w*|more\b|ciliegi\w*|fichi|cachi|castagne|datteri|mango|papaya|lime\b|pompelmo|germogli|asparagi|piselli freschi|fave|carciof\w*|cetriol\w*|ravanelli|porri|zenzero|peperoncin\w*`],
  ["pane","🥖","Pane e forno",String.raw`pane\b|pane integrale|pancarre|pan ?carre|panin\w*|michette|rosette|baguette|focacc\w*|grissin\w*|piadin\w*|tortillas|cornett\w*|brioche|croissant|fette biscottate|tramezzin\w*|pizza bianca|pizza margherita|schiacciata|crostini|taralli|pan di spagna|pandoro|panettone|colomba`],
  ["latte","🧀","Latticini e uova",String.raw`latte\b|latte intero|latte scremato|latte di (soia|avena|mandorla|riso|cocco)|bevanda (di|alla) (soia|avena|mandorla)|yogurt\w*|yoghurt|burro|margarina|formagg\w*|mozzarell\w*|fiordilatte|parmigian\w*|grana\b|padano|ricott\w*|uov[ao]\b|uova\b|panna\b|panna da cucina|stracchin\w*|crescenza|squacquerone|scamorz\w*|provola|caciotta|asiago|fontina|emmental|edamer|cheddar|philadelphia|mascarpon\w*|gorgonzol\w*|pecorin\w*|taleggio|brie|camembert|feta|burrata|kefir|skyr|mozzarelline|sottilette`],
  ["carne","🥩","Carne, pesce e salumi",String.raw`pollo|petto di pollo|manzo|maiale|carne\w*|macinat\w*|salsicc\w*|prosciutt\w*|crudo\b|cotto\b|salame|bresaol\w*|mortadell\w*|wurstel|tacchin\w*|pesce|salmone|merluzz\w*|platessa|orata|branzino|spigola|tonno fresco|gamber\w*|affettat\w*|speck|hamburger|svizzere|bistecc\w*|fettine|arrosto|spezzatino|vitello|cotolett\w*|polpo|calamar\w*|seppie|cozze|vongole|acciughe|alici|baccala|stocc?afisso|coniglio|agnello|anatra|lardo|pancetta|guanciale|coppa\b|porchetta|nuggets|cordon bleu`],
  ["dispensa","🥫","Dispensa",String.raw`pasta\b|pasta integrale|spaghett\w*|penne\b|fusilli|rigatoni|farfalle|tagliatelle|lasagne|gnocchi|couscous|riso\b|risotto|orzo|farro|quinoa|farina\w*|semola|zucchero|dolcificante|sale\b|olio\b|olio di oliva|olio di semi|aceto\w*|caff[e]\w*|cialde|capsule|the\b|te\b|tisan\w*|camomilla|biscott\w*|cereali|muesli|fiocchi d'avena|avena|marmellat\w*|confettura|nutella|crema spalmabile|tonno\b|sgombro|passata|pelati|polpa di pomodoro|concentrato di pomodoro|legumi|ceci|fagioli|lenticchi\w*|piselli\b|mais\b|sugo\b|ragu|pesto|spezie|origano|curry|paprika|cannella|noce moscata|curcuma|miele|cioccolat\w*|cacao|snack|patatine|crackers|schiacciatine|lievito|bicarbonato|brodo|dado\b|maionese|ketchup|senape|salsa\w*|olive|capperi|sottaceti|sottoli|gallette|fette\b|pangrattato|pan grattato|noci|mandorle|nocciole|pistacchi|arachidi|anacardi|uvetta|frutta secca|merendine|wafer|caramelle|chewing ?gum|budino|preparato per`],
  ["surgelati","🧊","Surgelati",String.raw`surgelat\w*|gelat\w*|bastoncin\w*|frozen|ghiaccio|piselli surgelati|minestrone surgelato|pizza surgelata|sofficini|cubetti di ghiaccio`],
  ["bevande","🥤","Bevande",String.raw`acqua\b|acqua frizzante|acqua naturale|birr\w*|vino\b|vino rosso|vino bianco|succo\w*|coca ?cola|pepsi|fanta|sprite|aranciata|chinotto|gassosa|bibit\w*|spumante|prosecco|champagne|the freddo|te freddo|energy drink|red bull|sciroppo|amaro|liquore|grappa|gin\b|vodka|rum\b|whisky|tequila|aperol|campari|spritz|tonica|ginger`],
  ["casa","🧽","Casa e pulizia",String.raw`detersiv\w*|detergente|ammorbident\w*|candeggin\w*|sgrassat\w*|sgrassatore|spugn\w*|paglietta|carta igienica|scottex|carta (da )?cucina|sacchett\w*|sacchi (della|per) (spazzatura|immondizia)|alluminio|pellicola|carta forno|lampadin\w*|pile\b|batterie\b|tovagliol\w*|piatti di carta|bicchieri di carta|posate di plastica|scopa\b|paletta|mocio|panno\b|panni\b|panno carta|panni cattura polvere|anticalcare|brillantante|sale per lavastoviglie|pastiglie (per la )?lavastoviglie|detersivo (per i |per la )?(piatti|lavatrice|lavastoviglie)|ammoniaca|alcol\b|acido citrico|aceto bianco|insetticid\w*|deodorante per ambienti|profumatore|ricarica\w* (per )?(scopa|mocio)|guanti (di|in) lattice|sacco aspirapolvere|filtri?`],
  ["igiene","🧴","Igiene e cura",String.raw`shampoo|balsamo|bagnoschiuma|docciaschiuma|sapone\w*|dentifric\w*|spazzolin\w*|deodorant\w*|rasoi\w*|schiuma da barba|assorbent\w*|salvaslip|cotton\w*|dischetti struccanti|crema\b|crema (viso|mani|corpo|solare)|struccant\w*|salviett\w*|fazzolett\w*|cerott\w*|collutorio|lamette|profumo|filo interdentale|tampon\w*|gel doccia|lacca|schiuma per capelli|tinta per capelli|pinzette|forbicine|tagliaunghie|smalto|acetone|protezione solare|doposole`],
  ["animali","🐾","Animali",String.raw`crocchett\w*|lettiera|cibo per (cane|cani|gatto|gatti)|scatolett\w*|snack per (cane|cani|gatto|gatti)|guinzaglio|collare antipulci|antipulci|osso per cani|tiragraffi|paletta per (cane|bisogni)`],
  ["bimbi","🍼","Bambini",String.raw`pannolin\w*|omogeneizzat\w*|latte in polvere|latte di crescita|biberon|ciuccio|tettarella|salviettine|pappa\b|pastina|seggiolone|passeggino|fasciatoio|scalda ?biberon|bavaglin\w*|crema cambio|pasta all'ossido|sterilizzatore`],
  ["salute","💊","Farmacia e salute",String.raw`integrator\w*|vitamin\w*|multivitaminico|magnesio|potassio|ferro \(integratore\)|omega ?3|probiotic\w*|fermenti lattici|aspirina|tachipirina|paracetamolo|ibuprofene|oki\b|moment\b|brufen|antinfiammatori\w*|antistaminic\w*|antidolorific\w*|sciroppo per la tosse|pastiglie per la gola|spray nasale|collirio|termometro|mascherine|ffp2|siringhe|garze|bende|disinfettante|amuchina|acqua ossigenata|pomata|crema antibiotica|lassativ\w*|gastroprotettore|maalox|enterogermina|sali minerali|cuscinetti|plantari|test di gravidanza|tampone rapido`],
  ["casalinghi","🍽️","Cucina e tavola",String.raw`pentol\w*|padell\w*|tegame|casseruola|coperchio|posate\b|forchett\w*|coltell\w*|cucchia\w*|piatti\b|piatto fondo|bicchier\w*|tazz\w*|tazzine|caraff\w*|brocca|vassoio|tagliere|mestolo|schiumarola|scolapasta|colino|apribottiglie|cavatappi|apriscatole|contenitor\w*|barattol\w*|tupperware|teglia|stampo|pirofila|grattugia|frusta da cucina|matterello|guanti da forno|presine|tovaglia|tovagliette|strofinacci|canovacci|portasapone|portarotolo|set di piatti|servizio di piatti|insalatiera|zuccheriera|oliera|macinapepe|termos|borraccia|lunch box|ciotol\w*`],
  ["biancheria","🛏️","Biancheria e arredo",String.raw`lenzuol\w*|federa|federe|copripiumino|piumon\w*|trapunta|coperta|plaid|cuscin\w*|materass\w*|coprimaterasso|topper|asciugaman\w*|accappatoio da bagno|telo mare|tend\w*|tappeto|tappeti|tappetino|zerbino|tovaglia da tavola|runner|copridivano|sedia\b|sgabello|scaffale|mensola|appendiabiti|gruccia|grucce|stendibiancheria|cesto (della|per la) biancheria|specchio|cornice|quadro\b|vaso da fiori|candela|candele|portacandele|vaso\b|vasi\b|lampada da tavolo|abat ?jour|paralume`],
  ["elettro","🔌","Elettrodomestici ed elettronica",String.raw`aspirapolvere|aspira ?polvere|scopa elettrica|robot (aspira\w*|da cucina|lavapavimenti)|lavapavimenti|idropulitrice|macchin(a|etta) (da|del|per) (caff\w*|pane|cucire)|macchina caff\w*|frullator\w*|minipimer|mixer|planetaria|impastatrice|tostapane|tostiera|bollitore|microonde|friggitrice|air ?fryer|forno elettrico|fornetto|piastra elettrica|ferro da stiro|asse da stiro|ferro a vapore|phon\b|fon\b|asciugacapelli|piastra per capelli|arricciacapelli|rasoio elettrico|tagliacapelli|spazzolino elettrico|idropulsore|ventilator\w*|stufa\w*|condizionator\w*|climatizzatore|deumidificator\w*|umidificator\w*|purificator\w*|lavatrice|asciugatrice|lavastoviglie|frigorifero|frigo\b|congelator\w*|cappa\b|piano cottura|forno a incasso|televisor\w*|tv\b|smart ?tv|monitor|computer|portatile|notebook|pc\b|tablet|ipad|iphone|smartphone|telefono|cellulare|caricator\w*|caricabatterie|power ?bank|cavo\b|cavetto|adattator\w*|presa multipla|ciabatta elettrica|prolunga|cuffie|auricolari|airpods|cassa bluetooth|altoparlante|soundbar|stampante|cartucc\w*|toner|mouse|tastiera|hard disk|ssd\b|chiavetta usb|penna usb|router|modem|ripetitore wifi|telecomando|lampadina smart|faretto|striscia led|smart ?watch|bilancia pesapersone|bilancia da cucina|sveglia|proiettore|console|playstation|xbox|nintendo|fotocamera|action cam|droni?`],
  ["abbigliamento","👕","Abbigliamento e scarpe",String.raw`maglia\b|maglion\w*|maglietta|magliette|t-?shirt|canottiera|camicia|camicie|felp\w*|pantalon\w*|jeans|leggings|gonna|vestito|abito|giacca|giubbotto|cappotto|piumino da|calz[ei]\b|calzini|calze\b|collant|mutand\w*|slip\b|boxer|reggisen\w*|pigiam\w*|vestaglia|accappatoio|costume da bagno|scarp\w*|sneaker\w*|stivali|anfibi|ciabatte|infradito|sandali|mocassini|cintur\w*|cappell\w*|berretto|sciarp\w*|guant\w*|ombrello|borsa\b|borsetta|zaino|portafogl\w*|occhiali da sole|orologio da polso|bracciale|collana|orecchini`],
  ["fai-da-te","🔧","Fai da te e giardino",String.raw`vit[ei]\b|tassell\w*|chiod\w*|trapano|avvitatore|cacciavite|martello|pinz[ae]\b|chiave inglese|brugole|nastro (adesivo|isolante|biadesivo)|coll[ae]\b|attack|silicone|stucco|vernice|smalto per legno|pennell\w*|rullo\b|carta vetrata|metro\b|flessometro|livella|seghetto|sega\b|attrezzi|cassetta degli attrezzi|lucchetto|serratura|cerniera|maniglia|terriccio|concime|fertilizzante|vas[io] (da|per) (fiori|piante)|piant[ae]\b|semi\b|sementi|innaffiatoio|annaffiatoio|tubo (da|per) giardino|tosaerba|decespugliatore|cesoie|guanti da giardino|pesticid\w*|antizanzare|rete\b`],
  ["cartoleria","✏️","Cartoleria e ufficio",String.raw`quadern\w*|block ?notes|agenda|penna\b|penne (a sfera|bic|gel)|matit\w*|gomma da cancellare|temperamatite|evidenziator\w*|pennarell\w*|colori a (matita|cera|tempera)|astuccio|righello|squadra|compasso|forbici|graffett\w*|spillatrice|punti metallici|puntine|post-?it|carta (a4|da stampa|regalo)|cartoncino|buste (da lettera|imbottite)|francobolli|cartellina|raccoglitore|classificatore|etichette|scotch|plastificatrice|calcolatrice`],
  ["tempo-libero","🎁","Tempo libero e regali",String.raw`libro\b|libri\b|romanzo|rivista|giornale|fumetto|gioc[oh]\w*|giocattol\w*|puzzle|carte da gioco|gioco da tavolo|lego|pallone|palla\b|bicicletta|monopattino|casco\b|tappetino yoga|manubri|pesi\b|corda per saltare|borraccia sportiva|regal\w*|biglietto (di )?auguri|carta regalo|fiocco|candeline|palloncin\w*|addobbi|decorazioni|albero di natale|presepe|fiori\b|bouquet|mazzo di fiori|profumo regalo|buono regalo|gift card`],
];
/* Ordine di visualizzazione: prima i reparti del supermercato, poi la casa, infine il resto. */
const AISLE_ORDER=["frutta","pane","latte","carne","dispensa","surgelati","bevande","casa","igiene","bimbi","salute","animali","casalinghi","biancheria","elettro","abbigliamento","fai-da-te","cartoleria","tempo-libero"];
function aisleKeys(){
  const have=AISLES.map(a=>a[0]);
  return [...AISLE_ORDER.filter(k=>have.includes(k)),...have.filter(k=>!AISLE_ORDER.includes(k)),"altro"];
}
const AISLE_OTHER=["altro","🛍️","Altro"];
function aisleInfo(key){ const a=AISLES.find(x=>x[0]===key); return a?{key:a[0],emoji:a[1],name:a[2]}:{key:"altro",emoji:AISLE_OTHER[1],name:AISLE_OTHER[2]}; }
/* Le parole di ogni reparto diventano una sola espressione, con quelle lunghe prima:
   così in "detersivo lavastoviglie" vince "detersivo lavastoviglie" e non "detersivo". */
const AISLE_RE=(()=>{
  const splitTop=s=>{ const out=[]; let buf="",d=0,esc=false;
    for(const ch of s){
      if(esc){buf+=ch;esc=false;continue;}
      if(ch==="\\"){buf+=ch;esc=true;continue;}
      if(ch==="(")d++; else if(ch===")")d--; else if(ch==="[")d++; else if(ch==="]")d--;
      if(ch==="|"&&d===0){out.push(buf);buf="";} else buf+=ch;
    }
    out.push(buf); return out.filter(Boolean);
  };
  return AISLES.map(a=>[a[0], new RegExp("\\b(?:"+splitTop(a[3]).sort((x,y)=>y.length-x.length).join("|")+")\\b","i")]);
})();
/* Pulisce il testo prima di cercare: minuscole, via accenti, quantità, unità di misura,
   marche fra parentesi lasciate (a volte dicono di che prodotto si tratta). */
function aisleText(text){
  let t=String(text||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  t=t.replace(/[()\[\]{}]/g," ");
  t=t.replace(/[^a-z0-9'\s-]/g," ");
  t=t.replace(/\b\d+(?:[.,]\d+)?\s*(?:x|pz|pezz\w*|gr?|kg|ml|cl|lt?|litr\w*|conf\w*|bott\w*|bust\w*|rotol\w*|vasett\w*|lattin\w*)\b/g," ");
  t=t.replace(/\b\d+\s*x\b|\bx\s*\d+\b|\b\d+\b/g," ");
  return t.replace(/\s+/g," ").trim();
}
/* Sceglie il reparto: vince la parola più lunga trovata nel testo, non il primo reparto
   dell'elenco. Se non trova niente resta "altro". */
function guessAisle(text){
  const t=aisleText(text);
  if(!t) return "altro";
  let best="altro",bestLen=0;
  for(const [key,re] of AISLE_RE){
    const m=t.match(re);
    if(m && m[0].length>bestLen){ bestLen=m[0].length; best=key; }
  }
  return best;
}
/* "2 latte", "latte x2", "3 pz uova" → quantità separata dal nome (non tocca "500 g pasta"). */
function parseQty(text){
  let t=String(text||"").trim(), qty=1;
  let m=t.match(/^(\d{1,2})\s*(?:x|×|pz\.?|pezzi|conf\.?|confezioni)?\s+(?!(?:g|gr|kg|ml|cl|l|lt|litri?|grammi)\b)(.+)$/i);
  if(m){ qty=Number(m[1]); t=m[2]; }
  else if((m=t.match(/^(.+?)\s*(?:x|×)\s*(\d{1,2})$/i))){ t=m[1]; qty=Number(m[2]); }
  return {text:t.trim(),qty:Math.min(99,Math.max(1,qty||1))};
}
function newListItem(rawText,extra={}){
  const {text,qty}=parseQty(rawText);
  return {id:uid(),text:text.slice(0,120),qty,price:null,done:false,code:"",image:"",url:"",photo:"",aisle:guessAisle(text),forWhom:"both",addedBy:myPerson(),...extra};
}
/* Noi Due 1.17.0 — Acquisti tracciati per davvero.
   Un prodotto conta come "comprato" nel momento in cui lo segni nel carrello (spunta o scorri a destra),
   una sola volta: se lo togli dal carrello per errore il conteggio torna indietro. Per ogni prodotto
   l'app ricorda le ultime 12 date di acquisto, così capisce ogni quanto lo comprate e quando è ora
   di ricomprarlo ("⏰ da ricomprare"). */
function historyKey(text){ return normName(parseQty(text).text); }
function markBought(list,it){
  if(!list||!it||it.counted) return;
  if(!list.history||typeof list.history!=="object") list.history={};
  const k=historyKey(it.text); if(!k||k.startsWith("carico")) return;
  const today=todayISO();
  const h=list.history[k]||{text:it.text,count:0,last:"",aisle:it.aisle||"",dates:[],qty:1};
  h.count+=1; h.text=parseQty(it.text).text; h.aisle=it.aisle||h.aisle||guessAisle(it.text); h.qty=it.qty||1;
  h.dates=[...(Array.isArray(h.dates)?h.dates:[]).filter(d=>d!==today),today].slice(-12);
  h.last=today; list.history[k]=h; it.counted=today;
  // Acquisti nel tempo: data e ora automatiche, chi l'ha preso.
  const at=new Date().toISOString();
  if(!Array.isArray(list.purchases)) list.purchases=[];
  list.purchases.push({id:uid(),itemId:it.id,text:parseQty(it.text).text,qty:it.qty||1,aisle:it.aisle||guessAisle(it.text),at,by:myPerson()||""});
  if(list.purchases.length>400) list.purchases.splice(0,list.purchases.length-400);
  it.boughtAt=at;
}
function unmarkBought(list,it){
  if(!list||!it||!it.counted) return;
  const k=historyKey(it.text), h=list.history&&list.history[k];
  if(h){
    h.count-=1;
    if(Array.isArray(h.dates)&&h.dates[h.dates.length-1]===it.counted&&it.counted===todayISO()) h.dates.pop();
    if(h.count<=0) delete list.history[k]; else h.last=(h.dates&&h.dates[h.dates.length-1])||h.last;
  }
  // Tolto dal carrello per errore: non era un acquisto, sparisce anche dalla cronologia.
  if(Array.isArray(list.purchases)){ const drop=list.purchases.filter(p=>p.itemId===it.id&&(!it.boughtAt||p.at===it.boughtAt)); if(drop.length){ markDeleted(drop.map(p=>p.id)); list.purchases=list.purchases.filter(p=>!drop.includes(p)); } }
  it.counted=""; it.boughtAt="";
}
/* Data e ora leggibili: "oggi 14:32", "ieri 09:10", "3 ott 18:20". */
function whenLabel(iso){
  const d=new Date(iso); if(!Number.isFinite(d.getTime())) return "";
  const hm=`${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const day=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`, diff=daysBetweenISO(day,todayISO());
  if(diff===0) return `oggi ${hm}`;
  if(diff===1) return `ieri ${hm}`;
  return `${d.getDate()} ${MESI_BREVI[d.getMonth()].toLowerCase()}${d.getFullYear()!==new Date().getFullYear()?" "+d.getFullYear():""} ${hm}`;
}
function dayHeading(iso){
  const d=new Date(iso), day=`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`, diff=daysBetweenISO(day,todayISO());
  if(diff===0) return "Oggi"; if(diff===1) return "Ieri";
  return `${["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"][d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()].toLowerCase()}${d.getFullYear()!==new Date().getFullYear()?" "+d.getFullYear():""}`;
}
/* Cestino delle liste: ogni prodotto eliminato con data e ora. */
function trashListItem(list,it){
  if(!Array.isArray(list.trash)) list.trash=[];
  list.trash.unshift({id:uid(),text:it.text,qty:it.qty||1,price:it.price||null,aisle:it.aisle||"",forWhom:it.forWhom||"both",url:it.url||"",image:it.image||"",deletedAt:new Date().toISOString(),by:myPerson()||""});
  if(list.trash.length>200) list.trash.length=200;
  return list.trash[0];
}
function restoreTrashEntry(list,entryId){
  const i=(list.trash||[]).findIndex(x=>x.id===entryId); if(i<0) return null;
  const e=list.trash.splice(i,1)[0];
  markDeleted(e.id); // la voce del cestino non torna con la sincronizzazione
  const it=newListItem(e.text,{aisle:e.aisle,price:e.price,forWhom:e.forWhom,url:e.url,image:e.image}); it.qty=e.qty||1;
  list.items.push(it); return it;
}
// Compatibilità con i punti che "chiudono" la spesa: conta solo ciò che non è già stato contato.
function recordPurchased(list,items){ items.forEach(i=>markBought(list,i)); }
function daysBetweenISO(a,b){ return Math.round((Date.parse(b+"T12:00:00")-Date.parse(a+"T12:00:00"))/86400000); }
function purchaseStats(h){
  const ds=[...new Set(Array.isArray(h.dates)?h.dates:[])].sort();
  let every=null;
  if(ds.length>=2){
    const gaps=[]; for(let i=1;i<ds.length;i++){ const g=daysBetweenISO(ds[i-1],ds[i]); if(g>0) gaps.push(g); }
    if(gaps.length){ gaps.sort((a,b)=>a-b); every=gaps[Math.floor(gaps.length/2)]; }
  }
  const since=h.last?Math.max(0,daysBetweenISO(h.last,todayISO())):null;
  return {every,since,ratio:every&&since!=null?since/every:null};
}
/* Suggerimenti "smart": frequenza (quante volte), regolarità (ogni quanti giorni) e tempo dall'ultimo
   acquisto. Prima i prodotti "da ricomprare", poi i più comprati; esclusi quelli già in lista o nel carrello. */
function smartSuggestions(list,max=40){
  const inList=new Set((list.items||[]).map(i=>historyKey(i.text)));
  return Object.entries(list.history||{}).filter(([k,h])=>h&&h.text&&!inList.has(k)).map(([k,h])=>{
    const st=purchaseStats(h);
    let score=Math.log2(1+(h.count||1))*2;
    if(st.ratio!=null) score+=st.ratio>=0.85?5+Math.min(3,st.ratio):st.ratio*3;
    else if(st.since!=null) score+=Math.max(0,1.5-st.since/30);
    if(st.since===0) score-=4;
    return {...h,key:k,...st,score,isDue:st.ratio!=null&&st.ratio>=0.85&&st.since>0};
  }).sort((a,b)=>b.score-a.score||b.count-a.count).slice(0,max);
}
function suggestionMeta(s){
  const ago=s.since==null?"":s.since===0?"oggi":s.since===1?"ieri":`${s.since} gg fa`;
  if(s.isDue) return `⏰ Da ricomprare · ogni ~${s.every} gg`;
  const parts=[`${s.count} ${s.count===1?"volta":"volte"}`];
  if(s.every) parts.push(`ogni ~${s.every} gg`);
  if(ago) parts.push(`ultimo ${ago}`);
  return parts.join(" · ");
}
function listSuggestions(list,max=10){ return smartSuggestions(list,max); }
function showActionToast(message,label,fn){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">${escapeHtml(label)}</button>`;
  toast.classList.add("show"); toast.style.pointerEvents="auto";
  toast.querySelector("button").onclick=()=>{ fn(); toast.classList.remove("show"); };
  clearTimeout(toast._timer); toast._timer=setTimeout(()=>{ toast.classList.remove("show"); toast.style.pointerEvents=""; },4500);
}
function isFavorite(text){ const k=normName(parseQty(text).text); return (state.favorites||[]).some(f=>normName(f.text)===k); }
function setFavorite(text,on,aisle=""){
  if(!Array.isArray(state.favorites)) state.favorites=[];
  const clean=parseQty(text).text, k=normName(clean);
  const idx=state.favorites.findIndex(f=>normName(f.text)===k);
  if(on && idx<0) state.favorites.push({id:uid(),text:clean,aisle:aisle||guessAisle(clean)});
  if(!on && idx>=0){ markDeleted(state.favorites[idx].id); state.favorites.splice(idx,1); }
}
function openFavorites(listId,onAdded){
  openSheet("tpl-favorites",(node,close)=>{
    const box=node.querySelector("#favList"), addBtn=node.querySelector("#favAddBtn"), newInput=node.querySelector("#favNewInput");
    const picked=new Set();
    function paint(){
      const l=state.lists.find(x=>x.id===listId);
      const inList=new Set((l?.items||[]).filter(i=>!i.done).map(i=>normName(i.text)));
      const favs=(state.favorites||[]).slice().sort((a,b)=>a.text.localeCompare(b.text,"it"));
      node.querySelector("#favEmpty").hidden=favs.length>0;
      box.innerHTML="";
      favs.forEach(f=>{
        const there=inList.has(normName(f.text));
        const row=document.createElement("div"); row.className="fav-row"+(there?" in-list":"")+(picked.has(f.id)?" picked":"");
        row.innerHTML=`<button type="button" class="fav-pick" aria-pressed="${picked.has(f.id)}"><span class="list-check" aria-hidden="true">${picked.has(f.id)?"✓":""}</span><span class="fav-text">${escapeHtml(aisleInfo(f.aisle||guessAisle(f.text)).emoji)} ${escapeHtml(f.text)}${there?`<small>già in lista</small>`:""}</span></button><button type="button" class="fav-remove" aria-label="Togli ${escapeHtml(f.text)} dai preferiti">✕</button>`;
        row.querySelector(".fav-pick").addEventListener("click",()=>{ if(there) return; picked.has(f.id)?picked.delete(f.id):picked.add(f.id); paint(); });
        row.querySelector(".fav-remove").addEventListener("click",()=>{ picked.delete(f.id); setFavorite(f.text,false); persist(); paint(); });
        box.appendChild(row);
      });
      addBtn.textContent=picked.size?`Aggiungi ${picked.size}`:"Aggiungi";
    }
    const addNew=()=>{ const t=newInput.value.trim(); if(!t){ newInput.focus(); return; } setFavorite(t,true); const f=state.favorites.find(x=>normName(x.text)===normName(parseQty(t).text)); if(f) picked.add(f.id); newInput.value=""; persist(); paint(); newInput.focus(); };
    node.querySelector("#favNewBtn").addEventListener("click",addNew);
    newInput.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); addNew(); } });
    addBtn.addEventListener("click",()=>{
      const l=state.lists.find(x=>x.id===listId); if(!l) return close();
      const favs=(state.favorites||[]).filter(f=>picked.has(f.id));
      favs.forEach(f=>l.items.push(newListItem(f.text,{aisle:f.aisle||guessAisle(f.text)})));
      persist(); close(); onAdded&&onAdded(favs.length);
    });
    paint();
  });
}
let openSwipeRow=null;
function openListDetail(listId){
  // v1.19.0 — riclassifica i prodotti finiti in "Altro" con i reparti nuovi (es. aspirapolvere).
  { const l0=state.lists.find(l=>l.id===listId); let ch=false; (l0?.items||[]).forEach(i=>{ if(!i.aisle||i.aisle==="altro"){ const g=guessAisle(i.text); if(g!=="altro"&&g!==i.aisle){ i.aisle=g; ch=true; } } }); if(ch) persist(); }
  openSheet("tpl-list-detail",(node,close)=>{
    const input=node.querySelector("#listItemInput"), priceInput=node.querySelector("#listPriceInput");
    const list=()=>state.lists.find(l=>l.id===listId);
    let lastAddedId=null;
    function save(){ persist(); renderCoupleLists(); paint(); }
    function removeItem(it,{purchased=false}={}){
      const l=list(), idx=l.items.findIndex(x=>x.id===it.id); if(idx<0) return;
      l.items.splice(idx,1); if(purchased) recordPurchased(l,[it]); markDeleted(it.id);
      const entry=trashListItem(l,it); save();
      showActionToast(`🗑 “${it.text}” nel cestino`,"Annulla",()=>{ const cur=list(); if(!cur) return; if(entry){ restoreTrashEntry(cur,entry.id); } else { const back=newListItem(it.text,{aisle:it.aisle,price:it.price,forWhom:it.forWhom}); back.qty=it.qty||1; cur.items.push(back); } save(); });
    }
    function itemRow(it){
      const wrap=document.createElement("div");
      wrap.className="list-swipe-wrap";
      const fav=isFavorite(it.text);
      if(it.id===lastAddedId){ wrap.classList.add("ls-new"); lastAddedId=null; }
      wrap.innerHTML=`<span class="list-actions" aria-hidden="true"><button type="button" class="list-act-fav${fav?" on":""}" tabindex="-1" aria-label="${fav?"Togli dai preferiti":"Aggiungi ai preferiti"}"><span class="la-ico">${fav?"★":"☆"}</span><small>${fav?"Togli":"Preferito"}</small></button><button type="button" class="list-act-del" tabindex="-1" aria-label="Elimina"><span class="la-ico">🗑️</span><small>Elimina</small></button></span>`;
      const row=document.createElement("div");
      wrap.appendChild(row);
      row.className="list-item"+(it.done?" done":"");
      row.setAttribute("role","button"); row.tabIndex=0;
      const pic=photoSrc(it.photo)||it.image;
      const who=(it.forWhom==="a"||it.forWhom==="b"?`<small class="list-for" style="color:${safeColor(personColor(it.forWhom))}">solo ${escapeHtml(personName(it.forWhom))}</small>`:"")
        +(it.addedBy&&it.addedBy!==myPerson()?`<small class="list-by" style="color:${safeColor(personColor(it.addedBy))}">da ${escapeHtml(personName(it.addedBy))}</small>`:it.via?`<small class="list-by">da ${escapeHtml(it.via)}</small>`:"");
      row.innerHTML=`<span class="list-swipe-bg" aria-hidden="true"><span>${it.done?"↩︎ Da comprare":"✓ Acquistato"}</span><span></span></span>
        <span class="list-check" aria-hidden="true">${it.done?"✓":""}</span>
        <span class="list-thumb">${pic?`<img src="${escapeHtml(pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}</span>
        <span class="list-text">${it.qty>1?`<b class="list-qty">${it.qty}×</b> `:""}${escapeHtml(it.text)}${fav?` <span class="list-fav" aria-label="preferito">★</span>`:""}${who}${it.done&&it.boughtAt?`<small class="list-when">✓ ${escapeHtml(whenLabel(it.boughtAt))}</small>`:""}</span>
        <span class="list-price">${it.price?(balancesHidden?"••••":fmt(it.price*(it.qty||1))):""}</span>
        <button type="button" class="list-del" aria-label="Dettagli di ${escapeHtml(it.text)}">›</button>`;
      row.querySelector("img")?.addEventListener("error",e=>{ e.target.remove(); });
      row.setAttribute("aria-pressed",String(it.done));
      const toggle=()=>{ it.done=!it.done; if(it.done) markBought(list(),it); else unmarkBought(list(),it); save(); };
      // v1.9.0 — Gesti: scorri a destra = carrello; scorri a sinistra = compaiono ★ Preferito e Elimina
      // (uno swipe lungo elimina subito); tieni premuto = dettagli.
      const OPEN=-136;
      const setOpen=on=>{ wrap.classList.toggle("open",on); if(!on) wrap.classList.remove("swipe-left","swipe-far"); wrap.style.setProperty("--dx",on?`${OPEN}px`:"0px"); if(on){ if(openSwipeRow&&openSwipeRow!==wrap) openSwipeRow._close(); openSwipeRow=wrap; } else if(openSwipeRow===wrap) openSwipeRow=null; };
      wrap._close=()=>setOpen(false);
      let sx=0,sy=0,dx=0,base=0,moved=false,swiping=false,suppress=false,pressTimer=null;
      row.addEventListener("touchstart",e=>{ e.stopPropagation(); if(openSwipeRow&&openSwipeRow!==wrap) openSwipeRow._close();
        const t=e.touches[0]; sx=t.clientX; sy=t.clientY; dx=0; moved=false; swiping=false; base=wrap.classList.contains("open")?OPEN:0;
        pressTimer=setTimeout(()=>{ if(!moved&&!base){ suppress=true; if(navigator.vibrate) navigator.vibrate(15); openListItem(listId,it.id); } },550); },{passive:true});
      row.addEventListener("touchmove",e=>{ const t=e.touches[0]; dx=t.clientX-sx; if(swiping||Math.abs(dx)>14) e.stopPropagation(); const dy=t.clientY-sy;
        if(Math.abs(dx)>8||Math.abs(dy)>8){ moved=true; clearTimeout(pressTimer); }
        if(!swiping && Math.abs(dx)>14 && Math.abs(dx)>Math.abs(dy)*1.3) swiping=true;
        if(swiping){ const x=Math.max(-260,Math.min(base?0:140,base+dx));
          row.classList.add("swiping"); wrap.classList.toggle("swipe-right",x>0); wrap.classList.toggle("swipe-left",x<0); wrap.classList.toggle("swipe-far",x<-210);
          wrap.style.setProperty("--dx",`${x}px`); } },{passive:true});
      row.addEventListener("touchend",e=>{ clearTimeout(pressTimer);
        if(swiping){ e.stopPropagation(); suppress=true; row.classList.remove("swiping"); wrap.classList.remove("swipe-right","swipe-far");
          const x=base+dx;
          if(x>80&&!base){ setOpen(false); toggle(); }
          else if(x<-210){ setOpen(false); removeItem(it,{purchased:it.done}); }
          else if(x<-50) setOpen(true);
          else { setOpen(false); wrap.classList.remove("swipe-left"); } }
        else if(base&&!moved){ suppress=true; setOpen(false); }
        setTimeout(()=>{ suppress=false; },350); });
      row.addEventListener("touchcancel",()=>{ clearTimeout(pressTimer); row.classList.remove("swiping"); setOpen(wrap.classList.contains("open")); });
      row.addEventListener("click",e=>{ if(suppress||e.target.closest(".list-del")) return; if(wrap.classList.contains("open")){ setOpen(false); return; } toggle(); });
      activateRowFromKeyboard(row,toggle);
      row.querySelector(".list-del").addEventListener("click",e=>{ e.stopPropagation(); openListItem(listId,it.id); });
      wrap.querySelector(".list-act-fav").addEventListener("click",e=>{ e.stopPropagation(); const on=!isFavorite(it.text); setFavorite(it.text,on,it.aisle||""); setOpen(false); save(); showToast(on?`★ “${it.text}” nei preferiti`:`“${it.text}” tolto dai preferiti`); });
      wrap.querySelector(".list-act-del").addEventListener("click",e=>{ e.stopPropagation(); setOpen(false); removeItem(it,{purchased:it.done}); });
      return wrap;
    }
    function paint(){
      if(!node.isConnected){ listDetailRefresh=null; return; }
      const l=list();
      if(!l){ listDetailRefresh=null; close(); return; }
      node.querySelector("#listDetailTitle").textContent=`${l.emoji} ${l.name}`;
      const todo=l.items.filter(i=>!i.done), done=l.items.filter(i=>i.done);
      const todoBox=node.querySelector("#listTodo"), doneBox=node.querySelector("#listDone");
      todoBox.innerHTML="";
      if(l.sortMode!=="manual"){
        const order=aisleKeys();
        order.forEach(key=>{
          const its=todo.filter(i=>(i.aisle||guessAisle(i.text))===key);
          if(!its.length) return;
          const a=aisleInfo(key), h=document.createElement("p"); h.className="list-aisle"; h.textContent=`${a.emoji} ${a.name}`;
          todoBox.appendChild(h); its.forEach(it=>todoBox.appendChild(itemRow(it)));
        });
      } else todo.forEach(it=>todoBox.appendChild(itemRow(it)));
      doneBox.innerHTML=""; done.forEach(it=>doneBox.appendChild(itemRow(it)));
      node.querySelector("#listEmpty").hidden=l.items.length>0;
      node.querySelector("#listGestureHint").hidden=!l.items.length;
      node.querySelector("#listDoneWrap").hidden=!done.length;
      const sum=arr=>arr.reduce((s,i)=>s+(i.price||0)*(i.qty||1),0);
      const est=sum(todo), cart=sum(done);
      const parts=[]; if(est>0) parts.push(`Stima da comprare ${balancesHidden?"••••":fmt(est)}`); if(cart>0) parts.push(`acquistato ${balancesHidden?"••••":fmt(cart)}`);
      node.querySelector("#listTotal").textContent=parts.join(" · ");
      const reg=node.querySelector("#listRegisterBtn");
      reg.hidden=!done.length;
      reg.textContent=`🧾 Registra come spesa (${done.length})`;
      const fixed=!!l.restockOnExit;
      node.querySelector("#listDoneTitle").textContent=`✓ Acquistato · ${done.length}`;
      node.querySelector("#listDoneHint").hidden=!fixed;
      node.querySelector("#listClearDone").textContent=fixed?"↩︎ Rimetti":"Togli";
      node.querySelector("#listSortBtn").textContent=l.sortMode==="manual"?"🗂️ Per reparto":"↕︎ In ordine";
      const baseBtn=node.querySelector("#listBaseBtn"); baseBtn.hidden=!(l.template&&l.template.length);
      // v1.19.0 — niente più striscia "Comprati spesso": gli acquisti stanno nella linguetta 🕘 a destra.
      const sbox=node.querySelector("#listSuggest"); sbox.hidden=true; sbox.innerHTML="";
      const tb=node.querySelector("#listTrashBtn"), tn=(l.trash||[]).length; tb.hidden=!tn; tb.textContent=`🗑 Cestino della lista · ${tn}`;
      paintSide();
    }
    /* Noi Due 1.16.0 — Pannello di aggiunta: bozza con quantità, prezzo, reparto e per chi.
       Il reparto segue quello che scrivi finché non ne scegli uno tu. */
    const lc={qty:1,aisle:"",aisleManual:false,forWhom:"both"};
    const more=node.querySelector("#lcMore"), qtyOut=node.querySelector("#lcQty");
    const aisleBox=node.querySelector("#lcAisle"), forBox=node.querySelector("#lcFor"), aisleAuto=node.querySelector("#lcAisleAuto");
    function lcText(){ const t=input.value.trim(), url=extractUrl(t); return url?t.replace(url,"").trim():t; }
    function lcPaint(){
      const typed=input.value.trim();
      const dirty=!!typed||lc.qty>1||!!priceInput.value.trim()||lc.aisleManual||lc.forWhom!=="both";
      more.hidden=!dirty;
      node.querySelector("#listComposer").classList.toggle("open",dirty);
      if(!dirty) return;
      const parsed=parseQty(lcText());
      if(!lc.aisleManual) lc.aisle=parsed.text?guessAisle(parsed.text):"altro";
      qtyOut.textContent=String(lc.qty>1?lc.qty:parsed.qty);
      aisleAuto.hidden=lc.aisleManual||!parsed.text;
      const keys=aisleKeys();
      aisleBox.innerHTML=keys.map(k=>{ const a=aisleInfo(k); return `<button type="button" class="lc-chip${lc.aisle===k?" on":""}" data-lc-aisle="${k}" aria-pressed="${lc.aisle===k}"><span aria-hidden="true">${a.emoji}</span>${escapeHtml(a.name)}</button>`; }).join("");
      aisleBox.querySelectorAll("[data-lc-aisle]").forEach(b=>b.addEventListener("click",()=>{ lc.aisle=b.dataset.lcAisle; lc.aisleManual=true; lcPaint(); }));
      const on=aisleBox.querySelector(".on"); if(on&&!lc.aisleManual) aisleBox.scrollLeft=Math.max(0,on.offsetLeft-aisleBox.clientWidth/2+on.offsetWidth/2);
      forBox.innerHTML=[["both","Tutti e due",""],["a",personName("a"),personColor("a")],["b",personName("b"),personColor("b")]].map(([k,label,c])=>`<button type="button" class="lc-seg-btn${lc.forWhom===k?" on":""}" data-lc-for="${k}" aria-pressed="${lc.forWhom===k}">${c?`<i style="background:${safeColor(c)}" aria-hidden="true"></i>${k===lc.forWhom?"Solo ":""}`:""}${escapeHtml(label)}</button>`).join("");
      forBox.querySelectorAll("[data-lc-for]").forEach(b=>b.addEventListener("click",()=>{ lc.forWhom=b.dataset.lcFor; lcPaint(); }));
      const n=Number(qtyOut.textContent)||1;
      node.querySelector("#listAddBtn").textContent=typed?`＋ Aggiungi${n>1?` ${n}×`:""} alla lista`:"Scrivi cosa aggiungere";
      node.querySelector("#listAddBtn").disabled=!typed;
    }
    function lcStep(d){ const base=lc.qty>1?lc.qty:parseQty(lcText()).qty; lc.qty=Math.min(99,Math.max(1,base+d)); lcPaint(); }
    node.querySelector("#lcQtyMinus").addEventListener("click",()=>lcStep(-1));
    node.querySelector("#lcQtyPlus").addEventListener("click",()=>lcStep(1));
    input.addEventListener("input",lcPaint); priceInput.addEventListener("input",lcPaint);
    function add(){
      const text=input.value.trim();
      if(!text){ input.focus(); return; }
      const price=parseAmount(priceInput.value);
      const url=extractUrl(text);
      const label=url?(text.replace(url,"").trim()||"Carico il prodotto dal link…"):text;
      const extra={price:price>0?Math.round(price*100)/100:null,url:url||"",forWhom:lc.forWhom};
      if(lc.aisleManual||(!url&&lc.aisle)) extra.aisle=lc.aisleManual?lc.aisle:guessAisle(parseQty(label).text);
      const it=newListItem(label,extra);
      if(lc.qty>1) it.qty=lc.qty;
      list().items.push(it);
      input.value=""; priceInput.value="";
      Object.assign(lc,{qty:1,aisle:"",aisleManual:false,forWhom:"both"});
      save(); lcPaint(); input.focus();
      showToast(`Aggiunto: ${it.qty>1?it.qty+"× ":""}${it.text}`);
      if(url) enrichListItem(listId,it.id,url);
    }
    lcPaint();
    /* ---- v1.17.0 — Cassetto laterale "Spesso / Preferiti" (linguette sul bordo destro, come in RecompApp).
       Tocca un prodotto per aggiungerlo, oppure trascinalo verso sinistra e lascialo sulla lista. ---- */
    function quickAdd(text,{aisle="",qty=1}={}){
      const l=list(); if(!l) return false;
      const k=historyKey(text), there=l.items.find(i=>historyKey(i.text)===k);
      if(there&&!there.done){ showToast(`“${there.text}” è già in lista`); return false; }
      if(there&&there.done){ there.done=false; unmarkBought(l,there); lastAddedId=there.id; save(); showToast(`↩︎ “${there.text}” di nuovo da comprare`); return true; }
      const it=newListItem(text,{aisle:aisle||guessAisle(text)}); if(qty>1) it.qty=qty;
      l.items.push(it); lastAddedId=it.id; save();
      if(navigator.vibrate) navigator.vibrate(10);
      showToast(`＋ ${it.qty>1?it.qty+"× ":""}${it.text}`);
      return true;
    }
    const side=document.createElement("div"); side.className="ls-tabs"; side.setAttribute("aria-label","Aggiunta rapida");
    side.innerHTML=`<button type="button" class="ls-tab acq" data-ls-tab="acq" aria-label="Acquisti nel tempo"><span class="ls-ic" aria-hidden="true">🕘</span><i class="ls-badge" hidden></i></button><button type="button" class="ls-tab fav" data-ls-tab="fav" aria-label="Preferiti"><span class="ls-ic" aria-hidden="true">★</span></button>`;
    const scrim=document.createElement("div"); scrim.className="ls-scrim"; scrim.hidden=true;
    const drawer=document.createElement("aside"); drawer.className="ls-drawer"; drawer.setAttribute("aria-label","Aggiunta rapida"); drawer.hidden=true;
    drawer.innerHTML=`<div class="ls-dr-head"><div class="ls-seg" role="tablist"><button type="button" data-dr-tab="acq">🕘 Acquisti</button><button type="button" data-dr-tab="fav">★ Preferiti</button></div><button type="button" class="ls-dr-close" aria-label="Chiudi">✕</button></div><p class="ls-dr-hint">Tocca per rimetterlo in lista, oppure trascinalo ← sulla lista</p><div class="ls-dr-list"></div><div class="ls-dr-foot"></div>`;
    document.body.append(scrim,drawer,side);
    let drTab="acq";
    function paintSide(){
      const l=list(); if(!l) return;
      const due=smartSuggestions(l).filter(x=>x.isDue).length, b=side.querySelector(".ls-badge");
      b.hidden=!due; b.textContent=String(due);
      if(!drawer.hidden) paintDrawer();
    }
    function drawerItems(){
      const l=list(); if(!l) return [];
      const inList=new Set(l.items.filter(i=>!i.done).map(i=>historyKey(i.text)));
      if(drTab==="fav") return (state.favorites||[]).slice().sort((a,b)=>a.text.localeCompare(b.text,"it")).map(f=>{ const h=l.history&&l.history[historyKey(f.text)]; const st=h?purchaseStats(h):null;
        return {text:f.text,aisle:f.aisle||guessAisle(f.text),qty:h?.qty||1,meta:h?suggestionMeta({...h,...st,isDue:st.ratio!=null&&st.ratio>=0.85&&st.since>0}):"Preferito",inList:inList.has(historyKey(f.text)),fav:true}; });
      // Acquisti nel tempo: solo ciò che avete davvero preso (tolto dal carrello = non conta), dal più recente.
      const out=[];
      const due=smartSuggestions(l).filter(x=>x.isDue);
      if(due.length){ out.push({head:`⏰ Da ricomprare · ${due.length}`}); due.forEach(x=>out.push({text:x.text,aisle:x.aisle||guessAisle(x.text),qty:x.qty||1,meta:suggestionMeta(x),due:true,inList:inList.has(historyKey(x.text))})); }
      let last="";
      (l.purchases||[]).slice().reverse().forEach(pu=>{
        const h=dayHeading(pu.at); if(h!==last){ out.push({head:h}); last=h; }
        const d=new Date(pu.at);
        out.push({text:pu.text,aisle:pu.aisle||guessAisle(pu.text),qty:pu.qty||1,label:`${pu.qty>1?pu.qty+"× ":""}${pu.text}`,meta:`${pad2(d.getHours())}:${pad2(d.getMinutes())}${pu.by?` · ${personName(pu.by)}`:""}`,inList:inList.has(historyKey(pu.text))});
      });
      return out;
    }
    function paintDrawer(){
      drawer.querySelectorAll("[data-dr-tab]").forEach(b=>{ const on=b.dataset.drTab===drTab; b.classList.toggle("on",on); b.setAttribute("aria-selected",String(on)); });
      const items=drawerItems(), box=drawer.querySelector(".ls-dr-list"), foot=drawer.querySelector(".ls-dr-foot");
      box.innerHTML=items.length?items.map((x,i)=>x.head?`<p class="ls-day">${escapeHtml(x.head)}</p>`:`<div class="ls-card${x.due?" due":""}${x.inList?" in":""}" data-i="${i}" role="button" tabindex="0" aria-label="${x.inList?"Già in lista":"Aggiungi"} ${escapeHtml(x.text)}"><span class="ls-em" aria-hidden="true">${escapeHtml(aisleInfo(x.aisle).emoji)}</span><span class="ls-tx"><b>${escapeHtml(x.label||x.text)}</b><small>${escapeHtml(x.meta)}</small></span><span class="ls-add" aria-hidden="true">${x.inList?"✓":"＋"}</span></div>`).join("")
        :`<p class="ls-empty">${drTab==="fav"?"Nessun preferito. Scorri su un prodotto della lista e tocca ☆, oppure aggiungili da “Gestisci preferiti”.":"Ancora nessun acquisto. Tocca un prodotto della lista quando lo prendete: finisce in “Acquistato” e qui, con data e ora."}</p>`;
      const due=items.filter(x=>!x.head&&x.due&&!x.inList);
      foot.innerHTML=drTab==="fav"?`<button type="button" class="ls-foot-btn" data-manage>★ Gestisci preferiti</button>`:due.length>1?`<button type="button" class="ls-foot-btn primary" data-add-due>＋ Aggiungi i ${due.length} da ricomprare</button>`:"";
      foot.querySelector("[data-manage]")?.addEventListener("click",()=>{ closeDrawer(); openFavorites(listId,n=>{ save(); if(n) showToast(`${n} ${n===1?"preferito aggiunto":"preferiti aggiunti"}`); }); });
      foot.querySelector("[data-add-due]")?.addEventListener("click",()=>{ let n=0; due.forEach(x=>{ if(quickAdd(x.text,{aisle:x.aisle,qty:x.qty})) n++; }); if(n) showToast(`${n} prodotti da ricomprare aggiunti`); });
      box.querySelectorAll(".ls-card").forEach(card=>bindDrawerCard(card,items[Number(card.dataset.i)]));
    }
    function bindDrawerCard(card,x){
      let sx=0,sy=0,dragging=false,moved=false,ghost=null,pid=null;
      const zone=()=>node.querySelector("#listTodo");
      const overList=(cx)=>cx<drawer.getBoundingClientRect().left-8;
      card.addEventListener("pointerdown",e=>{ if(e.button>0) return; sx=e.clientX; sy=e.clientY; dragging=false; moved=false; pid=e.pointerId; });
      card.addEventListener("pointermove",e=>{
        if(pid!==e.pointerId) return;
        const dx=e.clientX-sx, dy=e.clientY-sy;
        if(!dragging){
          if(Math.abs(dx)>8||Math.abs(dy)>8) moved=true;
          if(x.inList||!(dx<-12&&Math.abs(dx)>Math.abs(dy)*1.2)) return;
          dragging=true; try{card.setPointerCapture(e.pointerId);}catch(_){}
          ghost=document.createElement("div"); ghost.className="ls-ghost"; ghost.innerHTML=`<span aria-hidden="true">${escapeHtml(aisleInfo(x.aisle).emoji)}</span><b>${escapeHtml(x.text)}</b><i aria-hidden="true">＋</i>`; document.body.appendChild(ghost);
          document.body.classList.add("ls-dragging"); card.classList.add("lifted");
          if(navigator.vibrate) navigator.vibrate(8);
        }
        ghost.style.transform=`translate(${Math.max(6,e.clientX-ghost.offsetWidth*0.5)}px,${e.clientY-ghost.offsetHeight-14}px) rotate(-3deg) scale(${overList(e.clientX)?1.04:1})`;
        document.body.classList.toggle("ls-over",overList(e.clientX));
      });
      const end=e=>{
        if(pid!==e.pointerId) return; pid=null;
        if(dragging){
          const ok=overList(e.clientX);
          document.body.classList.remove("ls-dragging","ls-over"); card.classList.remove("lifted");
          if(ok){ ghost.classList.add("drop"); setTimeout(()=>ghost.remove(),220); quickAdd(x.text,{aisle:x.aisle,qty:x.qty}); zone()?.classList.add("ls-dropped"); setTimeout(()=>zone()?.classList.remove("ls-dropped"),600); }
          else { ghost.classList.add("back"); setTimeout(()=>ghost.remove(),200); }
          dragging=false; return;
        }
        if(e.type==="pointerup"&&!moved&&!x.inList){ card.classList.add("tapped"); quickAdd(x.text,{aisle:x.aisle,qty:x.qty}); }
        else if(e.type==="pointerup"&&!moved&&x.inList) showToast(`“${x.text}” è già in lista`);
      };
      card.addEventListener("pointerup",end); card.addEventListener("pointercancel",end);
      card.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); if(!x.inList) quickAdd(x.text,{aisle:x.aisle,qty:x.qty}); } });
    }
    function openDrawer(tab){ drTab=tab||drTab; drawer.hidden=false; scrim.hidden=false; requestAnimationFrame(()=>{ drawer.classList.add("open"); scrim.classList.add("open"); }); paintDrawer(); }
    function closeDrawer(){ drawer.classList.remove("open"); scrim.classList.remove("open"); setTimeout(()=>{ if(!drawer.classList.contains("open")){ drawer.hidden=true; scrim.hidden=true; } },220); }
    side.querySelectorAll("[data-ls-tab]").forEach(b=>b.addEventListener("click",()=>{ const t=b.dataset.lsTab; if(!drawer.hidden&&drTab===t) closeDrawer(); else openDrawer(t); }));
    drawer.querySelectorAll("[data-dr-tab]").forEach(b=>b.addEventListener("click",()=>{ drTab=b.dataset.drTab; paintDrawer(); }));
    drawer.querySelector(".ls-dr-close").addEventListener("click",closeDrawer);
    scrim.addEventListener("click",closeDrawer);
    // Linguette visibili solo quando questa lista è il pannello in primo piano; via tutto quando si chiude.
    const sideObs=new MutationObserver(()=>{
      if(!node.isConnected){ sideObs.disconnect(); side.remove(); drawer.remove(); scrim.remove(); document.body.classList.remove("ls-dragging","ls-over"); return; }
      const sheets=[...document.querySelectorAll("#overlayRoot .sheet")], top=sheets[sheets.length-1]===node;
      side.hidden=!top; if(!top&&!drawer.hidden) closeDrawer();
    });
    sideObs.observe(document.getElementById("overlayRoot"),{childList:true,subtree:true});
    node.querySelector("#listAddBtn").addEventListener("click",add);
    function addMany(lines){
      const l=list(); if(!l||!lines.length) return 0;
      const existing=new Set(l.items.filter(i=>!i.done).map(i=>normName(parseQty(i.text).text)));
      let n=0; const toEnrich=[];
      lines.forEach(text=>{ const url=extractUrl(text); const label=url?(text.replace(url,"").trim()||"Carico il prodotto dal link…"):text;
        const it=newListItem(label,{url:url||""}); const k=normName(url||it.text); if(!k||existing.has(k)) return; existing.add(k);
        l.items.push(it); if(url) toEnrich.push([it.id,url]); n++; });
      if(n) save();
      toEnrich.forEach(([id,url],i)=>setTimeout(()=>enrichListItem(listId,id,url),i*400));
      return n;
    }
    input.addEventListener("paste",e=>{
      const txt=(e.clipboardData||window.clipboardData)?.getData("text")||"";
      const lines=parseShoppingLines(txt);
      if(lines.length===1 && extractUrl(txt)){ e.preventDefault(); input.value=txt.trim(); add(); return; }
      if(lines.length>1){ e.preventDefault(); const n=addMany(lines); showToast(n?`${n} articoli aggiunti`:"Erano già tutti nella lista"); input.value=""; }
    });
    node.querySelector("#listPasteBtn").addEventListener("click",()=>openListPaste(lines=>{ const n=addMany(lines); showToast(n?`${n} ${n===1?"articolo aggiunto":"articoli aggiunti"}`:"Erano già tutti nella lista"); }));
    node.querySelector("#listSortBtn").addEventListener("click",()=>{ const l=list(); l.sortMode=l.sortMode==="manual"?"aisle":"manual"; save(); });
    node.querySelector("#listBaseBtn").addEventListener("click",()=>{ const n=addMany(list().template||[]); showToast(n?`Lista base: ${n} ${n===1?"articolo aggiunto":"articoli aggiunti"}`:"La lista base è già tutta in lista"); });
    node.querySelector("#listScanBtn").addEventListener("click",()=>openProductScan(item=>{
      list().items.push({...newListItem(item.text||""),...item,qty:1,aisle:guessAisle(item.text),forWhom:"both"});
      save(); showToast("Aggiunto alla lista");
    }));
    [input,priceInput].forEach(el=>el.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } }));
    node.querySelector("#listClearDone").addEventListener("click",()=>{ const l=list(), done=l.items.filter(i=>i.done);
      if(l.restockOnExit){ recordPurchased(l,done); done.forEach(i=>{ i.done=false; i.counted=""; }); save(); showToast("Rimessi tutti da comprare"); return; }
      recordPurchased(l,done); markDeleted(done.map(i=>i.id)); l.items=l.items.filter(i=>!i.done); save(); showToast("Tolti gli acquistati dalla lista (restano in 🕘 Acquisti)"); });
    node.querySelector("#listFavBtn").addEventListener("click",()=>openDrawer("fav"));
    node.querySelector("#listTrashBtn").addEventListener("click",()=>openListTrash(listId,()=>{ if(node.isConnected) paint(); }));
    // Lista della spesa fissa: uscendo dalla lista i prodotti presi tornano "da comprare".
    const restockWatch=setInterval(()=>{
      if(node.isConnected) return;
      clearInterval(restockWatch);
      const l=state.lists.find(x=>x.id===listId);
      if(!l||!l.restockOnExit) return;
      const done=l.items.filter(i=>i.done); if(!done.length) return;
      recordPurchased(l,done); done.forEach(i=>{ i.done=false; i.counted=""; });
      persist(); renderCoupleLists();
    },400);
    node.querySelector("#listEditBtn").addEventListener("click",()=>{ close(); openListForm(listId); });
    node.querySelector("#listRegisterBtn").addEventListener("click",()=>{
      const l=list(), done=l.items.filter(i=>i.done);
      if(!done.length) return;
      // Gli articoli "solo Marco / solo Giulia" vengono registrati a parte, come spesa di quella persona.
      const shared=done.filter(i=>i.forWhom!=="a"&&i.forWhom!=="b"), personal=done.filter(i=>i.forWhom==="a"||i.forWhom==="b");
      const sum=arr=>Math.round(arr.reduce((s,i)=>s+(i.price||0)*(i.qty||1),0)*100)/100;
      const ids=new Set(done.map(i=>i.id));
      const label=i=>`${i.qty>1?i.qty+"× ":""}${i.text}`;
      const finish=(payerAcc,date)=>{
        const cur=state.lists.find(x=>x.id===listId);
        const missingPrice=[];
        ["a","b"].forEach(who=>{
          const its=personal.filter(i=>i.forWhom===who); if(!its.length) return;
          const amount=sum(its); if(!(amount>0)){ missingPrice.push(personName(who)); return; }
          const payer=accOwner(payerAcc);
          const mode=payer===who?"personal":(payer==="joint"?"personal":"other");
          state.transactions.push({id:uid(),date:date||todayISO(),amount,type:"expense",name:`${l.name} – solo ${personName(who)}`,categoryId:listCategoryFor(l),
            accountId:payer==="joint"?payerAcc:payerAcc,toAccountId:null,note:its.map(label).join(", ").slice(0,500),split:{mode,pctA:50},groupId:l.groupId,listId:l.id});
        });
        if(cur){ recordPurchased(cur,done); if(cur.restockOnExit) cur.items.forEach(i=>{ if(ids.has(i.id)){ i.done=false; i.counted=""; } }); else { markDeleted([...ids]); cur.items=cur.items.filter(i=>!ids.has(i.id)); } }
        persist(); renderAll();
        showToast(missingPrice.length?`Registrata. Gli articoli solo di ${missingPrice.join(" e ")} non avevano prezzo: aggiungili a mano`:"Spesa registrata: articoli tolti dalla lista");
      };
      close();
      if(!shared.length){
        // Solo articoli personali: si chiede solo chi ha pagato tramite il modulo, con importo personale.
        const who=personal[0].forWhom, amount=sum(personal);
        openAddTransaction(null,{split:{mode:"personal",pctA:50},name:`${l.name} – solo ${personName(who)}`,amount,categoryId:listCategoryFor(l),groupId:l.groupId,note:personal.map(label).join(", ").slice(0,500),
          onSaved:t=>{ t.listId=listId; const cur=state.lists.find(x=>x.id===listId); if(cur){ recordPurchased(cur,done); if(cur.restockOnExit) cur.items.forEach(i=>{ if(ids.has(i.id)){ i.done=false; i.counted=""; } }); else { markDeleted([...ids]); cur.items=cur.items.filter(i=>!ids.has(i.id)); } } }});
        return;
      }
      const amount=sum(shared);
      openAddTransaction(null,{name:l.name,amount,categoryId:listCategoryFor(l),groupId:l.groupId,note:shared.map(label).join(", ").slice(0,500),
        onSaved:t=>{ t.listId=listId; finish(t.accountId,t.date); }});
      if(!(amount>0)) setTimeout(()=>showToast(personal.length?"Inserisci l'importo degli articoli condivisi (senza quelli personali)":"Inserisci l'importo dello scontrino"),400);
    });
    listDetailRefresh=paint;
    paint();
  });
}
/* Noi Due 1.5.2 — Dati del prodotto da un link (nome, foto, prezzo se il sito lo indica).
   Il browser non può leggere direttamente le pagine di altri siti, quindi passa da Microlink (gratuito, senza chiave). */
const URL_RE=/https?:\/\/[^\s<>"]+/i;
function extractUrl(text){ const m=String(text||"").match(URL_RE); return m?m[0].replace(/[),.;!?]+$/,""):""; }
/* La lettura vera e propria del link sta in suite.js (SuiteLink), condivisa con Style Wishlist:
   una sola copia da correggere se un giorno cambia il servizio. */
function cleanProductTitle(title,publisher){ return window.SuiteLink ? SuiteLink.cleanTitle(title,publisher) : String(title||"").slice(0,120); }
async function fetchLinkPreview(url){ return window.SuiteLink ? SuiteLink.preview(url) : null; }
/* Arricchisce un articolo già in lista con i dati presi dal link. */
async function enrichListItem(listId,itemId,url){
  const p=await fetchLinkPreview(url);
  const l=state.lists.find(x=>x.id===listId), it=l?.items.find(x=>x.id===itemId);
  if(!it) return;
  if(p){
    if(p.title && (!it.text || it.text===url || it.text.startsWith("Carico"))){ it.text=p.title; if(!it.aisle||it.aisle==="altro") it.aisle=guessAisle(p.title); }
    if(p.image && !it.photo) it.image=p.image;
    if(p.price && !it.price) it.price=p.price;
    it.url=p.url||url;
    showToast(p.price?"Dati del prodotto presi dal sito, prezzo compreso":"Dati del prodotto presi dal sito");
  } else {
    if(it.text.startsWith("Carico")) it.text=(()=>{ try{ return new URL(url).hostname.replace(/^www\./,""); }catch(e){ return "Prodotto dal link"; } })();
    it.url=url;
    showToast("Non riesco a leggere il sito: ho salvato il link, scrivi tu il nome");
  }
  persist(); renderCoupleLists(); if(listDetailRefresh) listDetailRefresh();
}
function parseShoppingLines(text){
  let parts=String(text||"").replace(/\r/g,"").split("\n");
  if(parts.filter(p=>p.trim()).length<=1) parts=String(text||"").split(/[,;]/);
  return parts.map(p=>p.replace(/^\s*(?:[-*•·◦▪▫–—]|\d+[.)]|\[[ xX✓]?\]|☐|☑|✅)\s*/,"").replace(/\s+/g," ").trim()).filter(Boolean).slice(0,200);
}
function openListPaste(onAdd){
  openSheet("tpl-list-paste",(node,close)=>{
    const area=node.querySelector("#pasteText"), hint=node.querySelector("#pasteHint"), btn=node.querySelector("#pasteAddBtn");
    const paint=()=>{ const n=parseShoppingLines(area.value).length; btn.textContent=n?`Aggiungi ${n}`:"Aggiungi"; hint.textContent=n?`${n} ${n===1?"articolo":"articoli"} pronti. Ogni riga diventa un articolo.`:"Scrivi o incolla: ogni riga diventa un articolo. Puoi separare anche con la virgola."; };
    area.addEventListener("input",paint);
    // Prova a leggere subito gli appunti (l'iPhone può chiedere conferma con "Incolla").
    if(navigator.clipboard?.readText){ navigator.clipboard.readText().then(t=>{ if(t && !area.value){ area.value=t; paint(); } }).catch(()=>{}); }
    setTimeout(()=>area.focus(),300);
    btn.addEventListener("click",()=>{
      const lines=parseShoppingLines(area.value);
      if(!lines.length){ showToast("Scrivi almeno una cosa da comprare"); area.focus(); return; }
      onAdd(lines); close();
    });
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
    draft.restock=l?!!l.restockOnExit:false;
    { const sw=node.querySelector("#listRestockSwitch"); const p=()=>{ sw.classList.toggle("on",draft.restock); sw.setAttribute("aria-pressed",String(draft.restock)); }; sw.addEventListener("click",()=>{ draft.restock=!draft.restock; p(); }); p(); }
    if(l){
      const row=node.querySelector("#listBaseRow"), info=node.querySelector("#listBaseInfo"), clr=node.querySelector("#listBaseClear");
      row.hidden=false;
      const paintBase=()=>{ const n=(l.template||[]).length; info.textContent=n?`Contiene ${n} ${n===1?"articolo":"articoli"}: nella lista tocca “⭐ Lista base” per rimettere quelli che mancano.`:"Salva gli articoli che compri sempre (es. la spesa della settimana) per rimetterli in lista con un tocco."; clr.hidden=!n; };
      node.querySelector("#listBaseSave").addEventListener("click",()=>{ const t=[...new Set(l.items.map(i=>`${i.qty>1?i.qty+" ":""}${i.text}`))]; if(!t.length){ showToast("La lista è vuota: aggiungi prima gli articoli"); return; } l.template=t; persist(); paintBase(); showToast("Lista base salvata"); });
      clr.addEventListener("click",()=>{ l.template=[]; persist(); paintBase(); });
      paintBase();
    }
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
      if(l){ Object.assign(l,{name,emoji:draft.emoji,groupId:draft.groupId,restockOnExit:draft.restock}); persist(); renderAll(); close(); showToast("Lista aggiornata"); }
      else{ const nl={id:uid(),name,emoji:draft.emoji,groupId:draft.groupId,items:[],restockOnExit:draft.restock,sortMode:"aisle",template:[],history:{}}; state.lists.push(nl); persist(); renderAll(); close(); openListDetail(nl.id); }
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
    const spent=coupleMonthStats(null,null,g.id);
    const card=document.createElement("button");
    card.type="button"; card.className="group-card";
    const debtor=bal>0?"b":"a";
    const who=Math.abs(bal)<0.005?"In pari":`${personName(debtor)} deve a ${personName(otherPerson(debtor))}`;
    card.innerHTML=`<span class="mv-ic">${emojiIconHtml(g.emoji)}</span>
      <span class="group-card-text"><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(who)}</span><span>${balancesHidden?"••••":fmt(spent.paid.a+spent.paid.b+spent.paid.joint)} spesi in tutto</span></span>
      <span class="group-card-amt" style="color:${Math.abs(bal)<0.005?"var(--ink-soft)":personColor(otherPerson(debtor))}">${Math.abs(bal)<0.005?fmt(0):(balancesHidden?"••••":fmt(Math.abs(bal)))}</span>
      <span class="chev" aria-hidden="true">›</span>`;
    card.addEventListener("click",()=>openGroupDetail(g.id));
    box.appendChild(card);
  });
}
/* ---------------- Noi Due 1.6.0 — Spese fisse (le ricorrenti di Bilancio, per la coppia) ---------------- */
const FREQ_PER_MONTH={weekly:52/12,monthly:1,bimonthly:1/2,quarterly:1/3,semiannual:1/6,yearly:1/12};
function fixedNextDate(r){
  const today=todayISO();
  let d=r.nextDate||r.startDate||today;
  return d;
}
function renderFixedExpenses(){
  const box=document.getElementById("fixedList");
  if(!box) return;
  const list=state.recurring.filter(r=>r.type!=="income").slice().sort((a,b)=>(a.active===false)-(b.active===false)||fixedNextDate(a).localeCompare(fixedNextDate(b)));
  box.innerHTML="";
  document.getElementById("fixedEmpty").hidden=list.length>0;
  const monthly=list.filter(r=>r.active!==false).reduce((s,r)=>s+r.amount*(FREQ_PER_MONTH[r.freq]||1),0);
  const tot=document.getElementById("fixedTotal");
  tot.textContent=list.length?`Circa ${balancesHidden?"••••":fmt(monthly)} al mese in tutto`:"";
  tot.hidden=!list.length;
  const cats=categoriesById(), mesiBrevi=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
  list.forEach(r=>{
    const c=cats[r.categoryId]||{emoji:"🔁"};
    const owner=accOwner(r.accountId);
    const next=fixedNextDate(r), [y,m,d]=next.split("-").map(Number);
    const g=groupsById()[r.groupId];
    const split=splitLabel({...r,type:"expense"});
    const card=document.createElement("button");
    card.type="button"; card.className="group-card fixed-card"+(r.active===false?" paused":"");
    card.innerHTML=`<span class="mv-ic">${emojiIconHtml(c.emoji||"🔁")}</span>
      <span class="group-card-text"><strong>${escapeHtml(r.name||c.name||"Spesa fissa")}</strong>
        <span>${r.active===false?"In pausa":`${FREQ_LABEL[r.freq]||"Ogni mese"} · prossima ${d} ${mesiBrevi[m-1]}`}</span>
        <span>Paga ${escapeHtml(owner==="joint"?"la cassa comune":personName(owner))}${g?` · ${escapeHtml(g.emoji)} ${escapeHtml(split)}`:""}</span></span>
      <span class="group-card-amt">${balancesHidden?"••••":fmt(r.amount)}</span><span class="chev" aria-hidden="true">›</span>`;
    card.addEventListener("click",()=>openRecurringForm(r.id));
    box.appendChild(card);
  });
}
document.getElementById("addFixedBtn")?.addEventListener("click",()=>openRecurringForm());
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
      const st=coupleMonthStats(null,null,gid), show=v=>balancesHidden?"••••":fmt(v);
      node.querySelector("#gdPaidALabel").textContent=`Ha pagato ${personName("a")}`;
      node.querySelector("#gdPaidBLabel").textContent=`Ha pagato ${personName("b")}`;
      node.querySelector("#gdPaidA").textContent=show(st.paid.a);
      node.querySelector("#gdPaidB").textContent=show(st.paid.b);
      node.querySelector("#gdPaidJoint").textContent=show(st.paid.joint);
      node.querySelector("#gdMonth").textContent="Totale delle spese di questo gruppo";
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
function openCoupleForm(welcome=false){
  openSheet("tpl-couple-form",(node,close)=>{
    if(welcome){
      node.querySelector(".sheet-head h3").textContent="Benvenuti in Noi Due 👋";
      const note=document.createElement("p"); note.className="sheet-note nd-welcome";
      note.textContent="Scrivete i vostri nomi e scegliete un colore: li userò per chi paga, i saldi e il calendario. Potete cambiarli quando volete da Altro › La coppia.";
      node.querySelector(".sheet-head").after(note);
    }
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
      state.couple={...state.couple,...draft,onboarded:true};
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
document.getElementById("listsTrashBtn")?.addEventListener("click",()=>openListTrash(null));
/* v1.19.0 — Cestino: di una lista (dal dettaglio) o comune a tutte (dalla pagina Liste). Ogni voce ha data e
   ora di eliminazione; ↩︎ la rimette nella sua lista. */
function openListTrash(listId,onChange){
  openSheet("tpl-list-trash",(node,close)=>{
    const box=node.querySelector("#listTrashBox"), emptyBtn=node.querySelector("#listTrashEmpty");
    function entries(){
      const ls=listId?state.lists.filter(l=>l.id===listId):state.lists;
      return ls.flatMap(l=>(l.trash||[]).map(e=>({e,l}))).sort((a,b)=>b.e.deletedAt.localeCompare(a.e.deletedAt));
    }
    function paint(){
      const l=listId&&state.lists.find(x=>x.id===listId);
      node.querySelector("#listTrashTitle").textContent=l?`🗑 Cestino · ${l.emoji} ${l.name}`:"🗑 Cestino delle liste";
      const all=entries();
      emptyBtn.hidden=!all.length;
      if(!all.length){ box.innerHTML=`<p class="empty-hint">Il cestino è vuoto.</p>`; return; }
      let last="", html="";
      all.forEach(({e,l},i)=>{
        const h=dayHeading(e.deletedAt); if(h!==last){ html+=`<p class="lt-day">${escapeHtml(h)}</p>`; last=h; }
        html+=`<div class="lt-row"><span class="lt-em" aria-hidden="true">${escapeHtml(aisleInfo(e.aisle||guessAisle(e.text)).emoji)}</span><span class="lt-tx"><b>${e.qty>1?e.qty+"× ":""}${escapeHtml(e.text)}</b><small>🗑 ${escapeHtml(whenLabel(e.deletedAt))}${listId?"":` · ${escapeHtml(l.emoji+" "+l.name)}`}${e.by?` · ${escapeHtml(personName(e.by))}`:""}</small></span><button type="button" class="lt-restore" data-i="${i}" aria-label="Rimetti ${escapeHtml(e.text)} nella lista">↩︎</button></div>`;
      });
      box.innerHTML=html;
      box.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",()=>{ const {e,l}=all[Number(b.dataset.i)]; restoreTrashEntry(l,e.id); persist(); renderAll(); paint(); onChange&&onChange(); showToast(`↩︎ “${e.text}” di nuovo in ${l.name}`); }));
    }
    emptyBtn.addEventListener("click",()=>{
      const n=entries().length; if(!n) return;
      if(!confirm(`Eliminare definitivamente ${n} ${n===1?"prodotto":"prodotti"} dal cestino?`)) return;
      (listId?state.lists.filter(l=>l.id===listId):state.lists).forEach(l=>{ markDeleted((l.trash||[]).map(e=>e.id)); l.trash=[]; });
      persist(); renderAll(); paint(); onChange&&onChange();
    });
    paint();
  });
}
document.getElementById("openCoupleSettingsBtn")?.addEventListener("click",()=>openCoupleForm());
// Pulsanti "i": spiegazioni a richiesta invece di testi sempre visibili.
document.addEventListener("click",e=>{ const b=e.target.closest("[data-nd-info]"); if(!b) return; e.preventDefault(); e.stopPropagation(); openChartInfo(b.dataset.ndInfo); },true);
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
      status.textContent=p?"Ho letto il codice a barre e trovato il prodotto. Controlla il nome e aggiungilo.":"Scrivi il nome del prodotto e aggiungilo.";
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
    // Dalla galleria: stessa lettura della foto (codice a barre se c'è, altrimenti foto del prodotto).
    const galleryInput=node.querySelector("#scanGalleryInput");
    node.querySelector("#scanGalleryBtn").addEventListener("click",()=>{ stopCamera(); galleryInput.click(); });
    galleryInput.addEventListener("change",()=>{ const f=galleryInput.files&&galleryInput.files[0]; galleryInput.value=""; if(f) handleImageFile(f); });
    photoInput.addEventListener("change",()=>{ const f=photoInput.files&&photoInput.files[0]; photoInput.value=""; if(f) handleImageFile(f); });
    async function handleImageFile(file){
      if(!file) return;
      status.textContent="Leggo la foto…"; result.innerHTML="";
      let photo="";
      try{ photo=await compressPhoto(file); }catch(e){}
      let code=null;
      try{ code=await decodeBarcodeFromFile(file); }catch(e){ /* lettore non caricato */ }
      if(code){ handleCode(code,{photo:""}); return; }
      status.textContent="Scrivi il nome del prodotto: la foto resta sull'articolo.";
      showProduct(null,{photo});
    }
  });
}
function openListItem(listId,itemId){
  const l=state.lists.find(x=>x.id===listId), it=l?.items.find(x=>x.id===itemId);
  if(!it) return;
  openSheet("tpl-list-item",(node,close)=>{
    const draft={photo:it.photo||"",image:it.image||"",url:it.url||""};
    const nameInput=node.querySelector("#itemNameInput"), priceInput=node.querySelector("#itemPriceInput"), codeInput=node.querySelector("#itemCodeInput");
    nameInput.value=it.text; priceInput.value=it.price?String(it.price).replace(".",","):""; codeInput.value=it.code||"";
    draft.qty=it.qty||1; draft.aisle=it.aisle||guessAisle(it.text); draft.forWhom=it.forWhom||"both";
    const qtyEl=node.querySelector("#itemQty");
    const paintQty=()=>{ qtyEl.textContent=String(draft.qty); };
    node.querySelector("#itemQtyMinus").addEventListener("click",()=>{ draft.qty=Math.max(1,draft.qty-1); paintQty(); });
    node.querySelector("#itemQtyPlus").addEventListener("click",()=>{ draft.qty=Math.min(99,draft.qty+1); paintQty(); });
    paintQty();
    const forBox=node.querySelector("#itemForChips"), aisleBox=node.querySelector("#itemAisleChips");
    const paintFor=()=>{ forBox.innerHTML=[["both","Tutti e due"],["a",`Solo ${personName("a")}`],["b",`Solo ${personName("b")}`]].map(([k,l])=>`<button type="button" class="chip${draft.forWhom===k?" active":""}" data-for="${k}">${escapeHtml(l)}</button>`).join("");
      forBox.querySelectorAll("[data-for]").forEach(b=>b.addEventListener("click",()=>{ draft.forWhom=b.dataset.for; paintFor(); })); };
    const paintAisle=()=>{ aisleBox.innerHTML=aisleKeys().map(k=>{ const a=aisleInfo(k); return `<button type="button" class="chip${draft.aisle===k?" active":""}" data-aisle="${k}"><span class="em">${a.emoji}</span>${escapeHtml(a.name)}</button>`; }).join("");
      aisleBox.querySelectorAll("[data-aisle]").forEach(b=>b.addEventListener("click",()=>{ draft.aisle=b.dataset.aisle; paintAisle(); })); };
    paintFor(); paintAisle();
    draft.fav=isFavorite(it.text);
    const favSw=node.querySelector("#itemFavSwitch");
    const paintFav=()=>{ favSw.classList.toggle("on",draft.fav); favSw.setAttribute("aria-pressed",String(draft.fav)); };
    favSw.addEventListener("click",()=>{ draft.fav=!draft.fav; paintFav(); });
    paintFav();
    const urlInput=node.querySelector("#itemUrlInput"), urlHint=node.querySelector("#itemUrlHint");
    urlInput.value=it.url||"";
    async function fetchFromUrl(){
      const url=extractUrl(urlInput.value);
      if(!url){ urlHint.textContent="Incolla un link che inizi con https://"; return; }
      urlHint.textContent="Leggo il sito…";
      const p=await fetchLinkPreview(url);
      if(!node.isConnected) return;
      if(!p){ draft.url=url; urlHint.textContent="Non riesco a leggere questo sito: il link resta salvato, scrivi tu il nome."; paint(); return; }
      if(p.title) nameInput.value=p.title;
      if(p.image) draft.image=p.image;
      if(p.price && !parseAmount(priceInput.value)) priceInput.value=String(p.price).replace(".",",");
      draft.url=p.url||url;
      urlHint.textContent=`Dati presi da ${p.publisher||"sito"}${p.price?"":" (prezzo non indicato dal sito)"}.`;
      paint();
    }
    node.querySelector("#itemUrlFetchBtn").addEventListener("click",fetchFromUrl);
    urlInput.addEventListener("paste",()=>setTimeout(fetchFromUrl,50));
    urlInput.addEventListener("change",()=>{ draft.url=extractUrl(urlInput.value)||""; paint(); });
    const photoBox=node.querySelector("#itemPhoto"), links=node.querySelector("#itemLinks"), removeBtn=node.querySelector("#itemPhotoRemove");
    function paint(){
      const pic=photoSrc(draft.photo)||draft.image;
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
    const galleryInput=node.querySelector("#itemGalleryInput");
    node.querySelector("#itemGalleryBtn").addEventListener("click",()=>galleryInput.click());
    const takePhoto=async input=>{
      const file=input.files&&input.files[0]; input.value="";
      if(!file) return;
      try{ draft.photo=await compressPhoto(file); paint(); }catch(e){ showToast("Foto non leggibile"); return; }
      // Se nella foto c'è un codice a barre e il campo è vuoto, lo legge e cerca il prodotto.
      if(!codeInput.value.trim()){ try{ const code=await decodeBarcodeFromFile(file); if(code){ codeInput.value=cleanCode(code); node.querySelector("#itemLookupBtn").click(); } }catch(e){} }
    };
    photoInput.addEventListener("change",()=>takePhoto(photoInput));
    galleryInput.addEventListener("change",()=>takePhoto(galleryInput));
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
      Object.assign(it,{text:text.slice(0,120),price:price>0?Math.round(price*100)/100:null,code:cleanCode(codeInput.value),photo:draft.photo,image:draft.image,url:draft.url,qty:draft.qty,aisle:draft.aisle,forWhom:draft.forWhom});
      if(draft.fav!==isFavorite(it.text)) setFavorite(it.text,draft.fav,draft.aisle);
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
  if(existing?.type==="transfer") return openTransferForm(txId);
  txType = existing?.type || "expense";
  selectedCategoryId = existing?.categoryId || prefill?.categoryId || null;
  selectedAccountId = existing?.accountId || defaultPayerId();
  let destinationAccountId = existing?.toAccountId || null;

  openSheet("tpl-add-transaction", (node, close)=>{
    // v1.21.0 — spesa registrata da una lista: si vede da quale lista e cosa c'era, con il link alla lista.
    if(existing?.listId){
      const ll=state.lists.find(x=>x.id===existing.listId);
      const box=document.createElement("div"); box.className="tx-list-link";
      box.innerHTML=`<span class="tx-list-ic" aria-hidden="true">🛒</span><span class="tx-list-tx"><b>Dalla lista ${escapeHtml(ll?`${ll.emoji} ${ll.name}`:"(lista eliminata)")}</b>${existing.note?`<small>${escapeHtml(existing.note)}</small>`:""}</span>${ll?`<button type="button" class="pill-btn mini-btn">Apri ›</button>`:""}`;
      box.querySelector("button")?.addEventListener("click",()=>{ close(); setTimeout(()=>openListDetail(ll.id),250); });
      const head=node.querySelector(".sheet-head"); (head||node.firstElementChild).after(box);
    }
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
    const split=mountSplitPicker(node, destinationRow, {account:()=>selectedAccountId, toAccount:()=>destinationAccountId, type:()=>txType, amount:()=>parseAmount(amountInput.value), initial:existing?.split || prefill?.split, initialGroup:existing?.groupId || prefill?.groupId});

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
        <button type="button" class="movement-action-btn add-fixed" data-add-kind="fixed"><span class="movement-action-icon" aria-hidden="true">🔁</span><span>Spesa fissa</span></button>
        <button type="button" class="movement-action-btn add-list" data-add-kind="list"><span class="movement-action-icon" aria-hidden="true">🛒</span><span>Da comprare</span></button>
      </div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  const go=fn=>()=>{overlay.remove();fn();};
  overlay.querySelector('[data-add-kind="tx"]').addEventListener("click",go(()=>openAddTransaction()));
  overlay.querySelector('[data-add-kind="settle"]').addEventListener("click",go(()=>openSettleForm("all")));
  overlay.querySelector('[data-add-kind="fixed"]').addEventListener("click",go(()=>openRecurringForm()));
  overlay.querySelector('[data-add-kind="list"]').addEventListener("click",go(()=>{ if(state.lists.length===1) openListDetail(state.lists[0].id); else switchView("liste"); }));
  overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>overlay.remove());
  overlay.addEventListener("click",e=>{if(e.target===overlay) overlay.remove();});
  document.body.appendChild(overlay);
  bindOverlaySwipeDismiss(overlay);
  requestAnimationFrame(()=>overlay.classList.add("show"));
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
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${transfer?"↔":t.type==="income"?"+":""}${fmt(t.amount)}</span></div>
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
  const ndTitle={fisse:"Spese fisse",categoria:"Categoria",gruppo:"Gruppo",dividi:"Come dividere",gruppi:"Gruppi",liste:"Liste"}[kind];
  const text={
    categoria:"Dice cosa avete comprato (Spesa, Ristoranti, Bollette…). Serve per i grafici e per cercare i movimenti; non cambia chi deve soldi a chi.",
    gruppo:"Dice in quale conto tra voi finisce la spesa (es. Casa, Spese di coppia, Viaggi). Ogni gruppo ha il suo saldo; in Saldi vedi il totale e il saldo di ciascun gruppo.",
    dividi:"Quanto della spesa spetta a ciascuno. A metà, con una percentuale, tutta all'altra persona oppure solo a chi ha pagato (spesa personale). Dalla cassa comune non si crea nessun debito.",
    fisse:"Spese che si ripetono, come affitto, bollette o abbonamenti. Scegli quanto, ogni quanto, chi paga, il gruppo e come dividere: alla data giusta la spesa viene registrata da sola nei movimenti e aggiorna il saldo tra voi. Tocca una spesa fissa per modificarla, metterla in pausa o eliminarla.",
    gruppi:"Ogni gruppo è un conto separato tra voi, con il suo saldo (es. Casa, Viaggio a Lisbona). Il numero grande in alto è la somma di tutti i gruppi. Tocca un gruppo per vederne i movimenti o saldarlo.",
    liste:"Tocca una lista per aggiungere articoli: scrivendoli, incollando una lista (ogni riga diventa un articolo) o con una foto. Tocca un prodotto quando lo prendi: finisce in “Acquistato” con data e ora e nella cronologia 🕘 (linguetta a destra). Scorrendo puoi metterlo nei ★ preferiti o eliminarlo: va nel cestino della lista (🗑 in fondo); dalla pagina Liste trovi il cestino di tutte le liste. Gli acquistati si possono registrare come spesa.",
    ripartizione:"Mostra come entrate o uscite del periodo selezionato sono distribuite fra categorie o macrocategorie. Non considera i trasferimenti fra conti.",
    andamento:"Entrate/Uscite mostra i flussi del periodo. Saldo cumulato mostra il saldo reale, partendo dal saldo presente prima dell’inizio del periodo. Tieni premuto un punto per leggere il giorno.",
    conti:"Mostra la variazione netta di ciascun conto nel periodo scelto. I trasferimenti compaiono come uscita nel conto di origine e entrata in quello di destinazione."
  }[kind]||"";
  openSheet("tpl-chart-fullscreen",node=>{node.querySelector("#chartFullscreenTitle").textContent=ndTitle||"Come leggere il grafico";if(ndTitle)node.classList.add("nd-info-sheet");node.querySelector("#chartFullscreenHelp").hidden=true;node.querySelector("#chartFullscreenBody").innerHTML=`<div class="chart-info-card">${escapeHtml(text)}</div>`;});
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
      else renderCategoryGraph();
    }
    node.querySelectorAll("[data-hub]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.hub)));
    addBtn.addEventListener("click",()=>openCategoryForm(null));
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
/* ---------------- Recurring form ---------------- */
function openRecurringForm(recurringId,prefill=null){
  const editing = !!recurringId;
  const rec = editing ? state.recurring.find(r=>r.id===recurringId) : (prefill||null);
  let rType = rec?.type || "expense";
  let rCat = rec?.categoryId || null;
  let rAcc = rec?.accountId || defaultPayerId();
  let rFreq = rec?.freq || "monthly";

  openSheet("tpl-recurring-form", (node, close)=>{
    node.querySelector("#recurringFormTitle").textContent = editing ? "Modifica spesa fissa" : "Nuova spesa fissa";
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


/* ---------------- Calendario spese ---------------- */
let calYear, calMonth;
/* Noi Due: il calendario mostra chi ha pagato ogni giorno (pallini nei colori delle persone)
   e il totale speso; niente ricorrenti o pianificate. */
function buildCalendarDayInfo(y,m){
  const prefix=`${y}-${pad2(m+1)}`, info={};
  state.transactions.forEach(t=>{
    if(!t.date.startsWith(prefix) || t.isBalanceAdjustment) return;
    const d=info[t.date]||(info[t.date]={a:false,b:false,joint:false,settle:false,total:0});
    if(t.type==="transfer"){ if(isCoupleSettle(t)) d.settle=true; return; }
    const o=accOwner(t.accountId); d[o==="a"||o==="b"?o:"joint"]=true;
    if(t.type==="expense") d.total+=t.amount;
  });
  return info;
}
function renderCalendarGrid(node){
  node.querySelector("#calMonthLabel").textContent = `${MESI[calMonth]} ${calYear}`;
  const grid = node.querySelector("#calendarGrid");
  grid.innerHTML = "";
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const leadBlanks = (firstDay+6)%7;
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const info = buildCalendarDayInfo(calYear, calMonth);
  const todayStr = todayISO();
  for(let i=0;i<leadBlanks;i++){ const blank=document.createElement("div"); blank.className="calendar-cell empty"; grid.appendChild(blank); }
  let monthTotal=0;
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${calYear}-${pad2(calMonth+1)}-${pad2(d)}`;
    const di = info[iso];
    const cell = document.createElement("button");
    cell.className = "calendar-cell nd-cal" + (iso===todayStr ? " today" : "") + (di ? " has-real":"");
    let dots="";
    if(di){
      monthTotal+=di.total;
      if(di.a) dots+=`<span class="cal-dot" style="background:${safeColor(personColor("a"))}"></span>`;
      if(di.b) dots+=`<span class="cal-dot" style="background:${safeColor(personColor("b"))}"></span>`;
      if(di.joint) dots+=`<span class="cal-dot" style="background:${safeColor(personColor("joint"))}"></span>`;
      if(di.settle) dots+=`<span class="cal-dot settle">🤝</span>`;
    }
    const amt=di&&di.total>0?`<span class="cal-amt">${balancesHidden?"••":Math.round(di.total)}</span>`:"";
    cell.innerHTML = `<span class="cal-day-num">${d}</span>${amt}<span class="cal-dots">${dots}</span>`;
    cell.setAttribute("aria-label",`${d} ${MESI[calMonth]}${di?`: spesi ${fmt(di.total)}`:""}`);
    cell.addEventListener("click", ()=> openDayDetail(iso));
    grid.appendChild(cell);
  }
  padCalendarGrid(grid,leadBlanks,daysInMonth);
  const leg=node.querySelector("#calLegend");
  if(leg) leg.innerHTML=["a","b","joint"].map(k=>`<span class="cal-leg-item"><span class="dot" style="background:${safeColor(personColor(k))}"></span>${escapeHtml(personName(k))}</span>`).join("")+`<span class="cal-leg-item">🤝 Rimborso</span>`;
  const tot=node.querySelector("#calMonthTotal");
  if(tot) tot.textContent=monthTotal>0?`Spese di ${MESI[calMonth].toLowerCase()}: ${balancesHidden?"••••":fmt(monthTotal)} · tocca un giorno per i dettagli`:"Nessuna spesa in questo mese.";
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
      if(level!=="days") calYear--; else { calMonth--; if(calMonth<0){ calMonth=11; calYear--; } }
      paint();
    });
    node.querySelector("#calNextMonth").addEventListener("click", ()=>{
      if(level!=="days") calYear++; else { calMonth++; if(calMonth>11){ calMonth=0; calYear++; } }
      paint();
    });
    paint();
  });
}
/* v1.7.0 — Il pulsante calendario sta nella barra del periodo della Home (vista generale di tutti i movimenti). */
/* v1.19.0 — Un solo calendario: quello che si apre toccando il titolo (colori per persona, cassa comune,
   rimborsi e spesa del giorno). Il pulsante 📅 in alto a destra non c'è più. */
(function hideCalendarBtn(){ const b=document.getElementById("openCalendarBtn"); if(b){ b.hidden=true; b.style.setProperty("display","none","important"); } })();
(function moveCalendarBtn(){
  return;
  const btn=document.getElementById("openCalendarBtn"), bar=document.querySelector(".topbar");
  if(btn && bar){ bar.appendChild(btn); btn.classList.add("topbar-cal-btn"); btn.setAttribute("aria-label","Calendario dei movimenti"); btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M9 3v4M15 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="9" cy="14.5" r="1.2" fill="currentColor"/><circle cx="15" cy="14.5" r="1.2" fill="currentColor"/></svg>'; }
})();
document.getElementById("openCalendarBtn").addEventListener("click", openCalendar);

function openDayDetail(iso){
  const d = new Date(iso+"T00:00:00");
  openSheet("tpl-day-detail", (node)=>{
    node.querySelector("#dayDetailTitle").textContent = `Movimenti — ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
    const all = state.transactions.filter(t=>t.date===iso).sort((a,b)=> a.date.localeCompare(b.date));
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
  const json=JSON.stringify({...stateWithPhotos(state),exportedAt:new Date().toISOString()},null,2);
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
    (inc.lists||[]).forEach(l=>(l.items||[]).forEach(i=>{ if(i.addedBy==="a") i.addedBy="b"; else if(i.addedBy==="b") i.addedBy="a"; if(i.forWhom==="a") i.forWhom="b"; else if(i.forWhom==="b") i.forWhom="a"; }));
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
  (second.lists||[]).forEach(l=>{ const prev=lists.get(l.id); lists.set(l.id,{...(prev||{}),...l,items:mergeArr(prev?.items||[],l.items||[]),
    // v1.19.0 — acquisti e cestino delle liste: si sommano quelli dei due telefoni.
    purchases:mergeArr(prev?.purchases||[],l.purchases||[]).sort((a,b)=>String(a.at).localeCompare(String(b.at))).slice(-400),
    trash:mergeArr(prev?.trash||[],l.trash||[]).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt))).slice(0,200)}); });
  // Stessa cosa aggiunta da tutti e due (es. "Latte" ancora da comprare): resta una volta sola.
  out.lists=[...lists.values()].filter(l=>!gone(l.id)).map(l=>{ const seenText=new Set(); return {...l,items:l.items.filter(i=>!gone(i.id)).filter(i=>{ if(i.done) return true; const k=normName(i.text); if(seenText.has(k)) return false; seenText.add(k); return true; })}; });
  // Ricorrenti e pianificate generate su entrambi i telefoni: una sola per data.
  const preferIds=new Set((second.transactions||[]).map(t=>t.id)), seen=new Map();
  out.transactions.forEach(t=>{ const key=t.recurringId?`r|${t.recurringId}|${t.date}`:t.plannedId?`p|${t.plannedId}|${t.date}`:null; if(!key) return; const prev=seen.get(key); if(!prev||(!preferIds.has(prev.id)&&preferIds.has(t.id))) seen.set(key,t); });
  out.transactions=out.transactions.filter(t=>{ const key=t.recurringId?`r|${t.recurringId}|${t.date}`:t.plannedId?`p|${t.plannedId}|${t.date}`:null; return !key||seen.get(key)===t; });
  out.planned=out.planned.filter(p=>!out.transactions.some(t=>t.plannedId===p.id&&t.date===p.date));
  { const seenF=new Set(); out.favorites=[...(second.favorites||[]),...(first.favorites||[])].filter(f=>{ const k=normName(f.text); if(!k||seenF.has(k)||gone(f.id)) return false; seenF.add(k); return true; }); }
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
  const local=stateWithPhotos(state);
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
  generateRecurringTransactions(false);
  renderAll();
});

/* ---------------- Service worker / aggiornamenti PWA ---------------- */
function showAppUpdatePrompt(registration){
  // Popup al centro: chiede se aggiornare subito. "Più tardi" lo ripropone alla prossima apertura.
  let panel=document.getElementById("appUpdatePrompt");
  if(!panel){
    panel=document.createElement("div");
    panel.id="appUpdatePrompt";
    panel.className="app-update-modal";
    panel.setAttribute("role","dialog");
    panel.setAttribute("aria-modal","true");
    panel.setAttribute("aria-labelledby","appUpdateTitle");
    panel.innerHTML=`
      <div class="app-update-card">
        <div class="app-update-icon" aria-hidden="true">↻</div>
        <h3 id="appUpdateTitle">Nuova versione disponibile</h3>
        <p>Vuoi aggiornare Noi Due adesso? I tuoi dati restano salvati sul telefono.</p>
        <div class="app-update-actions">
          <button type="button" class="app-update-later">Più tardi</button>
          <button type="button" class="app-update-now">Aggiorna</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
  }
  requestAnimationFrame(()=>panel.classList.add("show"));
  const later=panel.querySelector(".app-update-later"), now=panel.querySelector(".app-update-now");
  later.onclick=()=>panel.classList.remove("show");
  now.disabled=false; now.textContent="Aggiorna";
  now.onclick=()=>{
    const waiting=registration.waiting;
    if(!waiting){ window.location.reload(); return; }
    now.disabled=true; now.textContent="Aggiorno…";
    waiting.postMessage({type:"SKIP_WAITING"});
    setTimeout(()=>window.location.reload(),4000);
  };
  setTimeout(()=>now.focus(),200);
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

activeView="home";
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
// Foto: carica quelle in IndexedDB, sposta lì quelle ancora nei dati, elimina quelle non più usate.
PhotoStore.loadAll().then(()=>{
  const before=JSON.stringify(state).length;
  offloadPhotos();
  if(JSON.stringify(state).length!==before) safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
  const used=new Set();
  const collect=s=>allListItems(s).forEach(it=>{ const p=String(it.photo||""); if(p.startsWith("idb:")) used.add(p.slice(4)); });
  collect(state);
  try{ const pre=localStorage.getItem(PRE_IMPORT_KEY); if(pre) collect(JSON.parse(pre)); }catch(e){}
  PhotoStore.prune(used).catch(()=>{});
  if(typeof listDetailRefresh==="function") listDetailRefresh();
  renderAll();
}).catch(()=>{});
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





// v1.9.2 — La copertura della barra di stato appare solo quando si scorre.
(function(){
  const upd=()=>document.documentElement.classList.toggle("is-scrolled",window.scrollY>4);
  window.addEventListener("scroll",upd,{passive:true}); upd();
})();

// Primo avvio: chiede i nomi della coppia una volta sola.
setTimeout(()=>{ if(!state.couple.onboarded && /^Persona 1$/.test(state.couple.a.name) && /^Persona 2$/.test(state.couple.b.name) && !state.transactions.length){ state.couple.onboarded=true; persist(); openCoupleForm(true); } },900);

/* Promemoria backup comune alle 4 app (30 giorni, al massimo una volta a settimana). */
setTimeout(()=>{ if(window.SuiteBackup) SuiteBackup.maybe({app:"Noi Due",key:"noidue",last:localStorage.getItem("noidue_last_backup"),hasData:state.transactions.length>0||allListItems(state).length>0,onExport:exportBackup}); },3000);

/* v1.11.0 — Sincronizzazione online (Supabase): una sola copia per la coppia, tabella noidue_data.
   Le modifiche dei due telefoni vengono unite con la stessa logica dell'importazione con unione. */
const UPLOADED_KEY="noidue_uploaded_photos";
function uploadedSet(){ try{ return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY)||"[]")); }catch(e){ return new Set(); } }
function markUploaded(key){ const s=uploadedSet(); s.add(key); safeSetLocalStorage(UPLOADED_KEY,JSON.stringify([...s].slice(-2000)),{notify:false}); }
var syncNoiDue = window.SuiteSync ? SuiteSync.register({
  app:"noidue", name:"Noi Due", scope:"couple",
  editorTag:()=>myPerson(),
  getLocal:()=>state,
  hasLocalData:()=>state.transactions.length>0||allListItems(state).length>0,
  localUpdatedAt:()=>state.updatedAt||null,
  merge:(local,remote,remoteNewer)=>{
    const inc=alignBackup(JSON.parse(JSON.stringify(local)),migrate(JSON.parse(JSON.stringify(remote))));
    return mergeStates(JSON.parse(JSON.stringify(local)),inc,remoteNewer?"backup":"local");
  },
  toast:(m)=>showToast(m),
  noPrune:true,
  setLocal:(data,info)=>{
    const inc=info&&info.merged?data:alignBackup(JSON.parse(JSON.stringify(state)),migrate(JSON.parse(JSON.stringify(data))));
    const beforeItems=new Set(allListItems(state).map(i=>i.id)), beforeTx=new Set(state.transactions.map(t=>t.id));
    state=migrate(inc); balanceCache.clear(); offloadPhotos();
    if(!(info&&info.restored)) notifyPartnerChanges(beforeItems,beforeTx);
    safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
    renderAll(); if(typeof listDetailRefresh==="function") listDetailRefresh();
  },
  afterPush:async(S)=>{
    const done=uploadedSet();
    for(const it of allListItems(state)){
      const p=String(it.photo||""); if(!p.startsWith("idb:")) continue;
      const key=p.slice(4); if(done.has(key)||!PhotoStore.has(key)) continue;
      const blob=await (await fetch(PhotoStore.data(p))).blob();
      await S.uploadPhoto(`coppia/${S.coupleId}/${key}.jpg`,blob);
      markUploaded(key);
    }
  },
  onStatus:()=>{ if(typeof pushOnSyncStatus==="function") pushOnSyncStatus(); },
}) : null;
(function(){ const slot=document.getElementById("suiteSyncSlot"); if(slot&&window.SuiteSync) slot.innerHTML=SuiteSync.cardHtml("noidue",{cls:"section-block suite-sync-block",h:"h2"}); })();

/* ---------------- v1.13.0 — Notifiche push "Il tuo partner ha aggiunto/rimosso qualcosa" ----------------
   Il telefono si iscrive (permesso + indirizzo push salvato in Supabase, tabella push_subscriptions,
   con couple_id e la persona "a"/"b" di questo telefono). Ogni volta che un telefono salva, la funzione
   notify-noidue su Supabase confronta i dati prima/dopo e avvisa SOLO i telefoni dell'altra persona.
   Guida completa: GUIDA_NOTIFICHE.txt */
const PUSH_VAPID_PUBLIC="BKczfpgprh7HLU-bzY9QFsHNGZTjh624LyPo3CvI97dn0F_TjlQjKR3tJbzQuEtBLkapU54HFEOpozXVfNIePNk";
const PUSH_FN="/functions/v1/notify-noidue";
let pushState={sub:null,row:null,busy:false,msg:"",err:false,loaded:false};
function pushSupported(){ return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function pushIsIOS(){ return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); }
function pushStandalone(){ return window.navigator.standalone===true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches); }
function b64uToUint8(str){
  const pad="=".repeat((4-str.length%4)%4), b=atob((str+pad).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from(b,c=>c.charCodeAt(0));
}
function pushErrText(e){
  const t=String(e&&e.message||e||"");
  if(/monthly_summary|last_monthly_sent/.test(t)) return "Su Supabase manca il riepilogo mensile: esegui supabase/riepilogo_mensile.sql (vedi GUIDA_NOTIFICHE).";
  if(/push_subscriptions/.test(t) && /(does not exist|42P01|PGRST205|schema cache)/.test(t)) return "Su Supabase manca la colonna/tabella delle notifiche: esegui il passo 2 della guida.";
  if(/notify-noidue|404/.test(t) && /function|not found|NOT_FOUND/i.test(t)) return "Su Supabase manca la funzione notify-noidue: esegui il passo 4 della guida.";
  if(e&&e.auth) return "Rifai l'accesso alla sincronizzazione qui sopra.";
  return t.replace(/^Errore \d+:\s*/,"").slice(0,160) || "Qualcosa non ha funzionato.";
}
async function pushRegistration(){
  if(!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}
async function refreshPushState(){
  if(!pushSupported()){ pushState.loaded=true; renderPushCard(); return; }
  try{
    const reg=await pushRegistration();
    pushState.sub=reg?await reg.pushManager.getSubscription():null;
    pushState.row=null;
    if(pushState.sub && window.SuiteSync && SuiteSync.signedIn){
      // select=* : se le colonne del riepilogo mensile non esistono ancora, semplicemente non arrivano
      const rows=await SuiteSync.api(`/rest/v1/push_subscriptions?select=*&app=eq.noidue&endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`);
      pushState.row=rows[0]||null;
    }
  }catch(e){ pushState.msg=pushErrText(e); pushState.err=true; }
  pushState.loaded=true;
  renderPushCard();
}
function renderPushCard(){
  const card=document.getElementById("pushCard"); if(!card) return;
  const on=!!(pushState.sub && pushState.row && pushState.row.enabled!==false);
  let dot="off", status, inner="";
  if(!pushSupported()){
    status=pushIsIOS() && !pushStandalone()
      ? "Per ricevere le notifiche apri Noi Due dall'icona sulla schermata Home (iPhone con iOS 16.4 o successivo)."
      : "Questo browser non supporta le notifiche push.";
  } else if(!(window.SuiteSync && SuiteSync.signedIn)){
    status="Collega prima la sincronizzazione qui sopra: le notifiche partono dal server.";
  } else if(!myPerson()){
    status="Tocca prima \"Chi usa questo telefono\" qui sotto: serve per sapere a chi mandare gli avvisi.";
  } else if(!pushState.loaded){
    status="Controllo…"; dot="busy";
  } else if(on){
    dot="on";
    status="Attive su questo telefono: ti avviso quando il tuo partner aggiunge o rimuove un movimento o un articolo da una lista.";
    const hasMonthly="monthly_summary" in pushState.row;
    inner=`<div class="push-settings">${hasMonthly
        ? `<label class="toggle-line push-line"><input type="checkbox" id="pushMonthlyInput"${pushState.row.monthly_summary!==false?" checked":""}> Riepilogo mensile (il giorno 1 alle 9:00)</label>
           <label class="toggle-line push-line"><input type="checkbox" id="pushAmountsInput"${pushState.row.show_amounts?" checked":""}> Mostra gli importi nel riepilogo</label>`
        : `<p class="push-msg">Riepilogo mensile: per attivarlo esegui su Supabase i file supabase/riepilogo_mensile.sql e cron_riepilogo.sql (vedi GUIDA_NOTIFICHE).</p>`}</div>
      <div class="suite-sync-actions"><button type="button" class="suite-sync-primary primary" id="pushTestBtn"${pushState.busy?" disabled":""}>Invia una prova</button>${hasMonthly?`<button type="button" id="pushTestMonthlyBtn"${pushState.busy?" disabled":""}>Prova riepilogo</button>`:""}<button type="button" id="pushOffBtn"${pushState.busy?" disabled":""}>Disattiva</button></div>`;
  } else {
    status=Notification.permission==="denied"
      ? "Notifiche bloccate per Noi Due: riattivale in Impostazioni › Notifiche › Noi Due, poi torna qui."
      : "Ricevi un avviso quando il tuo partner aggiunge o rimuove un movimento o un articolo da una lista.";
    inner=`<button type="button" class="suite-sync-primary primary push-on-btn" id="pushOnBtn"${pushState.busy||Notification.permission==="denied"?" disabled":""}>🔔 Attiva notifiche</button>`;
  }
  const msg=pushState.msg?`<p class="push-msg${pushState.err?" err":""}">${escapeHtml(pushState.msg)}</p>`:"";
  card.innerHTML=`<h2>Notifiche</h2><p class="suite-sync-status"><span class="suite-sync-dot ${dot}" aria-hidden="true"></span>${escapeHtml(status)}</p>${inner}${msg}`;
}
let pushLastSigned=null;
function pushOnSyncStatus(){
  const signed=!!(window.SuiteSync && SuiteSync.signedIn);
  if(signed!==pushLastSigned){ pushLastSigned=signed; refreshPushState(); } else renderPushCard();
}
function pushSay(text,err=false){ pushState.msg=text; pushState.err=err; renderPushCard(); }
async function pushSaveRow(){
  if(syncNoiDue) await syncNoiDue.rowRef(); // assicura che coupleId sia risolto
  const j=pushState.sub.toJSON();
  await SuiteSync.api("/rest/v1/push_subscriptions?on_conflict=endpoint",{method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    json:{user_id:SuiteSync.userId,app:"noidue",couple_id:syncNoiDue?syncNoiDue.coupleId:null,person:myPerson()||null,
      endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,
      tz:(Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Rome"),device:navigator.userAgent.slice(0,120),
      enabled:true,updated_at:new Date().toISOString()}});
}
async function pushEnable(){
  if(pushState.busy) return;
  pushState.busy=true; pushSay("");
  try{
    // Il permesso va chiesto subito dopo il tocco (regola di iOS).
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ pushState.busy=false; pushSay(perm==="denied"?"Permesso negato. Puoi riattivarlo in Impostazioni › Notifiche › Noi Due.":"Permesso non concesso.",true); return; }
    const reg=await pushRegistration();
    if(!reg) throw new Error("Service worker non attivo: riapri l'app e riprova.");
    pushState.sub=(await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToUint8(PUSH_VAPID_PUBLIC)}));
    await pushSaveRow();
    pushState.row={enabled:true};
    setTimeout(refreshPushState,300);
    pushState.busy=false; pushSay("Fatto. Tocca \"Invia una prova\" per controllare che arrivino.");
  }catch(e){ pushState.busy=false; pushSay(pushErrText(e),true); }
}
async function pushDisable(){
  if(pushState.busy||!pushState.sub) return;
  pushState.busy=true; renderPushCard();
  const endpoint=pushState.sub.endpoint;
  try{ await SuiteSync.api(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,{method:"DELETE"}); }catch(e){}
  try{ await pushState.sub.unsubscribe(); }catch(e){}
  pushState.sub=null; pushState.row=null; pushState.busy=false;
  pushSay("Notifiche disattivate su questo telefono.");
}
async function pushTest(kind){
  if(pushState.busy) return;
  const monthly=kind==="monthly";
  pushState.busy=true; pushSay(monthly?"Invio il riepilogo del mese scorso…":"Invio la prova…");
  try{
    if(monthly && syncNoiDue && syncNoiDue.sync) { try{ await syncNoiDue.sync("push-test"); }catch(e){} } // la funzione legge i dati online
    const r=await SuiteSync.api(PUSH_FN,{method:"POST",json:monthly?{test:"monthly",endpoint:pushState.sub.endpoint}:{test:true}});
    pushState.busy=false;
    pushSay(r&&r.sent?(monthly?"Riepilogo inviato a questo telefono: dovrebbe arrivare tra pochi secondi.":"Prova inviata: dovrebbe arrivare tra pochi secondi su tutti i telefoni della coppia."):"La prova non è partita: disattiva e riattiva le notifiche.",!(r&&r.sent));
  }catch(e){ pushState.busy=false; pushSay(pushErrText(e),true); }
}
async function pushUpdate(patch){
  if(!pushState.sub||!pushState.row) return;
  const prev=Object.assign({},pushState.row);
  Object.assign(pushState.row,patch); pushState.msg=""; renderPushCard();
  try{
    await SuiteSync.api(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`,{method:"PATCH",
      headers:{Prefer:"return=minimal"},json:Object.assign({updated_at:new Date().toISOString()},patch)});
  }catch(e){ pushState.row=prev; pushSay(pushErrText(e),true); }
}
document.getElementById("pushCard")?.addEventListener("click",e=>{
  const id=e.target.closest("button")?.id;
  if(id==="pushOnBtn") pushEnable();
  else if(id==="pushOffBtn") pushDisable();
  else if(id==="pushTestBtn") pushTest();
  else if(id==="pushTestMonthlyBtn") pushTest("monthly");
});
document.getElementById("pushCard")?.addEventListener("change",e=>{
  if(e.target.id==="pushMonthlyInput") pushUpdate({monthly_summary:e.target.checked});
  else if(e.target.id==="pushAmountsInput") pushUpdate({show_amounts:e.target.checked});
});
setTimeout(refreshPushState,1500);

/* v1.12.0 — Avviso quando l'altra persona aggiunge qualcosa (dopo la sincronizzazione). */
function notifyPartnerChanges(beforeItems,beforeTx){
  const me=myPerson(); if(!me) return;
  const other=me==="a"?"b":"a", parts=[];
  const via=[];
  state.lists.forEach(l=>{
    const fresh=(l.items||[]).filter(i=>!beforeItems.has(i.id));
    const n=fresh.filter(i=>i.addedBy===other).length, v=fresh.filter(i=>i.via).length;
    if(n) parts.push(`${n} ${n===1?"cosa":"cose"} a ${l.name}`);
    if(v) via.push(`${v} ${v===1?"prodotto":"prodotti"} a ${l.name}`);
  });
  const tx=state.transactions.filter(t=>!beforeTx.has(t.id)).length;
  if(tx) parts.push(`${tx} ${tx===1?"movimento":"movimenti"}`);
  if(!parts.length&&!via.length) return;
  showToast(parts.length?`${personName(other)} ha aggiunto ${parts.join(" e ")}`:`Da RecompApp: ${via.join(", ")}`);
  if(navigator.vibrate) navigator.vibrate(20);
}
setTimeout(()=>{ if(window.SuiteSync&&SuiteSync.signedIn&&!myPerson()&&state.couple.onboarded) askWhoAmI(); },3500);
document.addEventListener("submit",e=>{ if(e.target.closest&&e.target.closest("[data-suite-sync-login]")) setTimeout(()=>{ if(SuiteSync.signedIn&&!myPerson()) askWhoAmI(); },2500); });
document.getElementById("noidueMeBtn")?.addEventListener("click",askWhoAmI);
