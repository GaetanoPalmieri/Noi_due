/* =========================================================
   Bilancio — logica app
   Stato persistito in localStorage, nessuna dipendenza esterna.
   ========================================================= */

const STORAGE_KEY = "bilancio_v1";
const THEME_KEY = "bilancio_theme";
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
/* v1.10.9 — Con il saldo nascosto le cifre dei grafici diventano pallini (non spariscono). */
function maskAmt(text,dots="••••"){ return balancesHidden ? dots : text; }
function parseAmount(str){
  if(!str) return 0;
  // legge anche "1.234,56" (punto delle migliaia) senza scambiarlo per 1,234
  const v = window.SuiteFmt ? SuiteFmt.parse(str) : parseFloat(String(str).replace(/[€\s]/g,"").replace(",","."));
  return isNaN(v) ? 0 : Math.abs(v);
}
/* v1.39.0 — La casella dell'importo è larga esattamente quanto la cifra (misurata col font vero),
   così cifra e simbolo € restano uniti e centrati. */
let _amtCanvas=null;
function fitAmountInput(el){
  if(!el) return;
  try{
    const cs=getComputedStyle(el);
    _amtCanvas=_amtCanvas||document.createElement("canvas");
    const ctx=_amtCanvas.getContext("2d");
    ctx.font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const txt=el.value||el.placeholder||"0";
    const ls=parseFloat(cs.letterSpacing)||0;
    const w=Math.ceil(ctx.measureText(txt).width+ls*txt.length)+6;
    el.style.width=Math.max(w,Math.ceil(ctx.measureText("00").width))+"px";
  }catch(e){ el.style.width=Math.max(2,el.value.length+1)+"ch"; }
}
function autoGrowAmountInput(el){
  const grow = ()=>fitAmountInput(el);
  el.addEventListener("input", grow);
  grow(); requestAnimationFrame(grow);
}
document.addEventListener("input",e=>{ if(e.target?.matches?.(".amount-field input")) fitAmountInput(e.target); },true);
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
  const accId = { cash: uid(), bbva: uid(), fineco: uid(), ca: uid() };
  const macroId = { giornaliere: uid(), casa: uid(), trasporti: uid(), salute: uid(), entrate: uid() };
  const catId = { spesa: uid(), trasporti: uid(), bollette: uid(), casa: uid(), salute: uid(), svago: uid(), stipendio: uid(), altreEntrate: uid() };
  return {
    accounts: [
      { id: accId.cash, name: "Contanti", balance: 0, color: PALETTE[7] },
      { id: accId.bbva, name: "BBVA", balance: 0, color: PALETTE[0] },
      { id: accId.fineco, name: "Fineco", balance: 0, color: PALETTE[6] },
      { id: accId.ca, name: "Credit Agricole", balance: 0, color: PALETTE[3] },
    ],
    macroCategories: [
      { id: macroId.giornaliere, name: "Spese giornaliere", emoji: "🛒", color: PALETTE[1], budget: 400, kind:"expense" },
      { id: macroId.casa, name: "Casa e utenze", emoji: "🏠", color: PALETTE[4], budget: null, kind:"expense" },
      { id: macroId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], budget: null, kind:"expense" },
      { id: macroId.salute, name: "Salute e benessere", emoji: "💊", color: PALETTE[5], budget: null, kind:"expense" },
      { id: macroId.entrate, name: "Entrate", emoji: "💰", color: PALETTE[0], budget: null, kind:"income" },
    ],
    categories: [
      { id: catId.spesa, name: "Spesa", emoji: "🛒", color: PALETTE[1], kind: "expense", budget: 300, macroCategoryId: macroId.giornaliere },
      { id: catId.trasporti, name: "Trasporti", emoji: "🚗", color: PALETTE[2], kind: "expense", budget: 100, macroCategoryId: macroId.trasporti },
      { id: catId.bollette, name: "Bollette", emoji: "💡", color: PALETTE[3], kind: "expense", budget: 150, macroCategoryId: macroId.casa },
      { id: catId.casa, name: "Casa", emoji: "🏠", color: PALETTE[4], kind: "expense", budget: null, macroCategoryId: macroId.casa },
      { id: catId.salute, name: "Salute", emoji: "💊", color: PALETTE[5], kind: "expense", budget: null, macroCategoryId: macroId.salute },
      { id: catId.svago, name: "Svago", emoji: "🎬", color: PALETTE[6], kind: "expense", budget: 80, macroCategoryId: macroId.giornaliere },
      { id: catId.stipendio, name: "Stipendio", emoji: "💰", color: PALETTE[0], kind: "income", budget: null, macroCategoryId: macroId.entrate },
      { id: catId.altreEntrate, name: "Altre entrate", emoji: "➕", color: PALETTE[7], kind: "income", budget: null, macroCategoryId: macroId.entrate },
    ],
    recurring: [],
    transactions: [],
    planned: [],
    loanRates: [],
    trash: [],
    mainAccountId: null,
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
  // v1.37.0 — sottocategorie: un solo livello, e ereditano tipo e macro dalla madre.
  {
    const byId = Object.fromEntries((parsed.categories||[]).map(c=>[c.id,c]));
    (parsed.categories||[]).forEach(c=>{
      if(c.parentCategoryId===undefined) c.parentCategoryId = null;
      const p = c.parentCategoryId ? byId[c.parentCategoryId] : null;
      if(!p || p.id===c.id || p.parentCategoryId){ c.parentCategoryId = null; return; }
      c.kind = p.kind;
      c.macroCategoryId = p.macroCategoryId || null;
    });
  }
  // v1.25.1: la categoria automatica "Pagate da altri" non serve più; se non è mai stata usata la tolgo.
  { const used=new Set([...(parsed.transactions||[]),...(parsed.recurring||[]),...(parsed.planned||[]),...(parsed.trash||[]).map(x=>x&&(x.item||x.tx||x))].map(x=>x&&x.categoryId).filter(Boolean));
    parsed.categories=parsed.categories.filter(c=>!(c.otherPaidDefault&&!used.has(c.id)));
    parsed.categories.forEach(c=>{ if(c.otherPaidDefault) delete c.otherPaidDefault; }); }
  if(!Array.isArray(parsed.recurring)) parsed.recurring = [];
  parsed.recurring.forEach(r=>{
    if(r.active===undefined) r.active=true;
    if(r.endDate===undefined) r.endDate="";
    if(r.maxOccurrences===undefined) r.maxOccurrences=null;
  });
  if(!Array.isArray(parsed.planned)) parsed.planned = [];
  if(!Array.isArray(parsed.loanRates)) parsed.loanRates = [];
  if(!Array.isArray(parsed.trash)) parsed.trash = [];
  if(parsed.mainAccountId===undefined) parsed.mainAccountId = null;
  if(parsed.mainAccountId && !parsed.accounts.some(a=>String(a.id)===String(parsed.mainAccountId))) parsed.mainAccountId = null;
  parsed.trash = pruneTrashArray(parsed.trash);
  sanitizeLoadedState(parsed);
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
  data.categories=(Array.isArray(data.categories)?data.categories:[]).map(c=>({...c,id:id(c.id),name:text(c.name,120),emoji:text(c.emoji,12),color:safeColor(c.color,PALETTE[0]),kind:c.kind==="income"?"income":"expense",budget:c.budget==null?null:amount(c.budget),macroCategoryId:c.macroCategoryId==null?null:id(c.macroCategoryId),parentCategoryId:c.parentCategoryId==null?null:id(c.parentCategoryId)}));
  data.transactions=(Array.isArray(data.transactions)?data.transactions:[]).map(t=>({...t,id:id(t.id),date:date(t.date,todayISO()),amount:amount(t.amount),type:["income","expense","transfer"].includes(t.type)?t.type:"expense",name:text(t.name,160),note:text(t.note,500),categoryId:t.categoryId==null?null:id(t.categoryId),accountId:t.accountId==null?null:id(t.accountId),toAccountId:t.toAccountId==null?null:id(t.toAccountId),recurringId:t.recurringId==null?undefined:id(t.recurringId),plannedId:t.plannedId==null?undefined:id(t.plannedId)}));
  const freqs=new Set(["weekly","monthly","bimonthly","quarterly","semiannual","yearly"]);
  data.recurring=(Array.isArray(data.recurring)?data.recurring:[]).map(r=>({...r,id:id(r.id),name:text(r.name,160),note:text(r.note,500),amount:amount(r.amount),type:r.type==="income"?"income":"expense",categoryId:r.categoryId==null?null:id(r.categoryId),accountId:r.accountId==null?null:id(r.accountId),freq:freqs.has(r.freq)?r.freq:"monthly",startDate:date(r.startDate,todayISO()),nextDate:date(r.nextDate,date(r.startDate,todayISO())),endDate:date(r.endDate,""),active:r.active!==false,maxOccurrences:Number.isFinite(Number(r.maxOccurrences))&&Number(r.maxOccurrences)>0?Math.floor(Number(r.maxOccurrences)):null}));
  data.loanRates=(Array.isArray(data.loanRates)?data.loanRates:[]).filter(r=>r&&r.accId).map(r=>({id:id(r.id||uid()),accId:id(r.accId),date:date(r.date,todayISO()),amount:amount(r.amount),n:Number(r.n)||1,of:Number(r.of)||0}));
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
  state.trash = pruneTrashArray(state.trash);
  state.updatedAt = new Date().toISOString();
  const ok = safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state));
  if(ok && window.syncBilancio) syncBilancio.changed();
  return ok;
}
function toggleBalances(){balancesHidden=!balancesHidden;safeSetLocalStorage("bilancio_hide_balances",balancesHidden?"1":"0",{notify:false});renderAll();}
function moveToTrash(kind, item, companions=[]){
  if(!Array.isArray(state.trash)) state.trash=[];
  const entry={id:uid(),kind,data:JSON.parse(JSON.stringify(item)),deletedAt:todayISO()};
  if(companions.length) entry.companions=JSON.parse(JSON.stringify(companions));
  state.trash.unshift(entry);
  state.trash=pruneTrashArray(state.trash);
}
function restoreTrashItem(trashId){
  const entry=state.trash.find(x=>x.id===trashId); if(!entry) return;
  if(entry.kind==="transaction"){ state.transactions.push(entry.data); (entry.companions||[]).forEach(c=>{ if(!state.transactions.some(x=>x.id===c.id)) state.transactions.push(c); }); }
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
  // v1.12.5: rettifiche di saldo e prestiti vecchi (fuori saldo) non sono entrate né uscite del periodo.
  const real=tx.filter(t=>!t.isBalanceAdjustment&&!t.loanOld);
  const income=real.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=real.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  return {income,expense,net:income-expense};
}
/* Colore delle cifre: verde se positiva, rosso se negativa, grigio scuro sullo zero
   (le cifre neutre non azzerate restano sul grigio chiaro definito nel CSS). */
function moneyColor(value){return value>0?"var(--emerald)":value<0?"var(--rust)":"var(--num-zero)";}

let txType = "expense";
let selectedCategoryId = null;
let selectedAccountId = null;
let statsGroupMode = "category", statsNature="expense";

/* ---------------- Helpers on state ---------------- */
function accountsById(){ return Object.fromEntries(state.accounts.map(a=>[a.id,a])); }
function categoriesById(){ return Object.fromEntries(state.categories.map(c=>[c.id,c])); }
function macroCategoriesById(){ return Object.fromEntries(state.macroCategories.map(m=>[m.id,m])); }

/* ===================== v1.37.0 — Sottocategorie =====================
   Tre livelli: macrocategoria › categoria › sottocategoria.
   Esempio: Tempo libero › Viaggi › Mangiare fuori.
   Una sottocategoria è una categoria con parentCategoryId valorizzato: eredita
   tipo e macrocategoria dalla madre, e si ferma lì (niente quarto livello).
   I movimenti puntano alla sottocategoria, ma nelle somme contano nella madre. */
function isSubCategory(c){ return !!(c && c.parentCategoryId); }
function subCategoriesOf(catId){ return state.categories.filter(c=>c.parentCategoryId===catId); }
function topCategories(kind){ return state.categories.filter(c=>c.kind===kind && !c.parentCategoryId); }
/* La categoria "di conto": per una sottocategoria è la madre, per le altre è se stessa. */
function rollUpCategoryId(catId){
  const c=categoriesById()[catId];
  return c && c.parentCategoryId ? c.parentCategoryId : (catId||null);
}
/* Tutti gli id che contano in una categoria: lei più le sue sottocategorie. */
function categoryIdsWithin(catId){ return [catId, ...subCategoriesOf(catId).map(c=>c.id)]; }
/* Catena completa, dal più grande al più piccolo. */
function categoryChain(catId){
  const cats=categoriesById(), macros=macroCategoriesById();
  const c=cats[catId]; if(!c) return [];
  const parent=c.parentCategoryId?cats[c.parentCategoryId]:null;
  const macro=macros[(parent||c).macroCategoryId]||null;
  return [macro, parent, c].filter(Boolean);
}
/* Nomi che compaiono più di una volta fra macro, categorie e sottocategorie dello
   stesso tipo: solo per questi serve mostrare il percorso. */
function ambiguousCategoryNames(){
  const norm=n=>String(n||"").trim().toLocaleLowerCase("it");
  const count=new Map();
  const bump=(n,kind)=>{ const k=kind+"|"+norm(n); count.set(k,(count.get(k)||0)+1); };
  state.macroCategories.forEach(m=>bump(m.name,m.kind||"expense"));
  state.categories.forEach(c=>bump(c.name,c.kind||"expense"));
  const out=new Set();
  count.forEach((v,k)=>{ if(v>1) out.add(k); });
  return out;
}
/* Etichetta da mostrare: solo il nome, oppure "Madre › Nome" quando quel nome
   esiste anche altrove. Così chi non ha doppioni non vede mai percorsi lunghi. */
function categoryLabel(catId,opts){
  const o=opts||{};
  const cats=categoriesById(), c=cats[catId];
  if(!c) return "";
  if(!c.parentCategoryId && !o.sempre) return c.name;
  const amb=o.ambigue||ambiguousCategoryNames();
  const chiave=(c.kind||"expense")+"|"+String(c.name).trim().toLocaleLowerCase("it");
  const parent=c.parentCategoryId?cats[c.parentCategoryId]:null;
  if(!parent) return c.name;
  return (o.sempre||amb.has(chiave)) ? `${parent.name} › ${c.name}` : c.name;
}
/* Vero se questo nome, con questa madre, creerebbe un doppione poco chiaro. */
function categoryNameClash(name,kind,ignoreId){
  const norm=n=>String(n||"").trim().toLocaleLowerCase("it");
  const n=norm(name);
  if(!n) return null;
  const m=state.macroCategories.find(x=>(x.kind||"expense")===kind && norm(x.name)===n);
  if(m) return {tipo:"macro",nome:m.name};
  const c=state.categories.find(x=>x.id!==ignoreId && (x.kind||"expense")===kind && norm(x.name)===n);
  if(c) return {tipo:c.parentCategoryId?"sotto":"categoria",nome:c.name};
  return null;
}

/* Picker categoria: la macrocategoria è un filtro, ma all'apertura vengono
   mostrate tutte le categorie. Così una categoria appena creata è sempre
   disponibile subito nel nuovo movimento. */
function renderCategoryPicker(container, kind, getSelected, onSelect){
  const macros = macroCategoriesById();
  /* v1.37.0 — nella riga "Categoria" compaiono solo quelle di primo livello:
     le sottocategorie stanno nella terza riga, sotto la madre scelta. */
  const allCats = state.categories.filter(c=>c.kind===kind);
  const cats = allCats.filter(c=>!c.parentCategoryId);
  const groups = new Map();
  cats.forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  const macroOrder = state.macroCategories.filter(m=>groups.has(m.id)).map(m=>m.id);
  if(groups.has("none")) macroOrder.push("none");

  const selId = getSelected();
  const selRaw = allCats.find(c=>c.id===selId);
  /* Se hai scelto una sottocategoria, nella riga "Categoria" resta accesa la madre. */
  const selCat = selRaw && selRaw.parentCategoryId ? cats.find(c=>c.id===selRaw.parentCategoryId) : selRaw;
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
    const attiva = selCat && selCat.id===c.id;
    chip.className = "chip" + (attiva ? " active":"");
    const figlie = subCategoriesOf(c.id).length;
    chip.innerHTML = `<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}${figlie?`<span class="chip-sub-count" aria-label="${figlie} sottocategorie">${figlie}</span>`:""}`;
    chip.addEventListener("click", ()=>{
      onSelect(c.id);
      renderCategoryPicker(container, kind, getSelected, onSelect);
    });
    catRow.appendChild(chip);
  });
  catWrap.appendChild(catRow);
  container.appendChild(catWrap);

  /* Terza riga: le sottocategorie della categoria scelta. Compare solo se ce ne sono. */
  const madre = selCat;
  const figlie = madre ? subCategoriesOf(madre.id) : [];
  if(madre && figlie.length){
    const subWrap = document.createElement("div");
    subWrap.className = "chip-group";
    subWrap.innerHTML = `<p class="chip-group-title">Sottocategoria di ${escapeHtml(madre.name)}</p>`;
    const subRow = document.createElement("div");
    subRow.className = "chip-row";
    const nessuna = document.createElement("button");
    nessuna.className = "chip" + (getSelected()===madre.id ? " active" : "");
    nessuna.textContent = "Nessuna";
    nessuna.addEventListener("click", ()=>{ onSelect(madre.id); renderCategoryPicker(container, kind, getSelected, onSelect); });
    subRow.appendChild(nessuna);
    figlie.forEach(sc=>{
      const chip = document.createElement("button");
      chip.className = "chip" + (getSelected()===sc.id ? " active":"");
      chip.innerHTML = `<span class="em">${escapeHtml(sc.emoji)}</span>${escapeHtml(sc.name)}`;
      chip.addEventListener("click", ()=>{ onSelect(sc.id); renderCategoryPicker(container, kind, getSelected, onSelect); });
      subRow.appendChild(chip);
    });
    subWrap.appendChild(subRow);
    container.appendChild(subWrap);
  }

  if(!currentList.find(c=>c.id===rollUpCategoryId(getSelected()))) onSelect(currentList[0]?.id || null);
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
/* v1.11.1 — Totale attuale = soldi sui conti; crediti = conti "Da ricevere"; effettivo = attuale + crediti. */
function receivableTotal(){ return state.accounts.filter(a=>a.receivable).reduce((s,a)=>s+accountBalance(a.id),0); }
function liquidBalance(){ return state.accounts.filter(a=>!a.receivable&&!a.payable).reduce((s,a)=>s+accountBalance(a.id),0); }
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
          categoryId: r.categoryId, accountId: r.accountId, name:r.name || "", note: r.note || "", recurringId: r.id,
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
          plannedId: p.id,
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
// v1.17.0: tutte le pianificate e le ricorrenti ancora da registrare da oggi fino a endISO,
// anche se cadono in mesi diversi (serve al saldo previsto dei mesi futuri).
function pendingPlannedUntil(endISO){
  const today=todayISO();
  if(!endISO || endISO<today) return [];
  let y=Number(today.slice(0,4)), m=Number(today.slice(5,7))-1;
  const ey=Number(endISO.slice(0,4)), em=Number(endISO.slice(5,7))-1;
  const out=[]; let safety=0;
  while((y<ey || (y===ey && m<=em)) && safety<240){
    out.push(...plannedItemsForMonth(y,m));
    m++; if(m>11){m=0;y++;} safety++;
  }
  return out.filter(t=>t.date>=today && t.date<=endISO);
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
  const today=new Date();
  const isCurrentMonth=viewYear===today.getFullYear()&&viewMonth===today.getMonth();
  const showBackToCurrent=(activeView==="home"||activeView==="recurring")&&!isCurrentMonth;
  document.getElementById("backToCurrentMonth").hidden=!showBackToCurrent;
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
  /* L'occhio fisso in alto a destra segue sempre lo stesso stato. */
  const fixed=document.getElementById("toggleBalanceFixed");
  if(fixed && btn!==fixed) setEyeIcon(fixed,hidden);
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
  const allAccountsBalance=liquidBalance();
  {
    // v1.12.0: il riquadro compare solo se c'è davvero qualcosa da ricevere o da pagare.
    const card=document.getElementById("homeEffectiveCard"), recv=receivableTotal(), pay=payableTotal();
    const hasRecv=Math.abs(recv)>=0.005, hasPay=Math.abs(pay)>=0.005;
    if(card){
      card.hidden=!(hasRecv||hasPay);
      if(hasRecv||hasPay){
        const eff=allAccountsBalance+recv-pay, show=v=>balancesHidden?"••••":fmt(v);
        const effEl=document.getElementById("homeEffectiveBalance");
        effEl.textContent=show(eff); effEl.style.color=moneyColor(eff);
        document.getElementById("homeRecvChip").hidden=!hasRecv; document.getElementById("homeRecvAmount").textContent=`+${show(recv)}`;
        document.getElementById("homePayChip").hidden=!hasPay; document.getElementById("homePayAmount").textContent=`−${show(pay)}`;
        card.querySelector(".eff-label").textContent="Totale effettivo"; // v1.26.0: corto, niente "…"
      }
    }
  }
  const mainName=document.getElementById("homeMainAccountName");
  const mainAmount=document.getElementById("homeMainAccountBalance");
  const allAmount=document.getElementById("homeAllAccountsBalance");
  if(mainName) mainName.textContent=mainAccount?`Conto principale · ${mainAccount.name}`:"⚙︎ Scegli il conto principale";
  if(mainAmount){mainAmount.textContent=mainAccount?(balancesHidden?"••••":fmt(mainBalance)):"›";mainAmount.style.color=mainAccount?moneyColor(mainBalance):"";}
  // v1.23.0 — senza conto principale resta solo un avviso su una riga (prima occupava mezza scheda).
  document.getElementById("homeMainAccountCard")?.classList.toggle("mt-unset",!mainAccount);
  if(allAmount){allAmount.textContent=balancesHidden?"••••":fmt(allAccountsBalance);allAmount.style.color=moneyColor(allAccountsBalance);}
  renderMainAccountSetupNotice();

  {const c=document.getElementById("seeAllTxCount"); if(c) c.textContent=periodTx("home").filter(t=>!t.isBalanceAdjustment).length;}
  document.querySelector("#view-home .hero-label").textContent=periodModes.home==="day"?"Saldo netto del giorno":periodModes.home==="range"?"Saldo netto del periodo":"Saldo netto del mese";
  const today=todayISO();
  const lastDay=`${viewYear}-${pad2(viewMonth+1)}-${pad2(new Date(viewYear,viewMonth+1,0).getDate())}`;
  // Lista "Prossime scadenze": solo il mese visualizzato.
  const future=plannedItemsForMonth(viewYear,viewMonth).filter(t=>t.date>=today && t.date<=lastDay);
  // v1.17.0: il saldo previsto di un mese futuro tiene conto di tutto ciò che arriva da oggi
  // a fine mese visualizzato (entrate e uscite, ricorrenti e pianificate, anche dei mesi in mezzo).
  const pending=pendingPlannedUntil(lastDay);
  const parts={recIn:0,recOut:0,planIn:0,planOut:0};
  pending.forEach(t=>{
    const planned=!!t.plannedId, inc=t.type==="income";
    parts[(planned?"plan":"rec")+(inc?"In":"Out")]+=t.amount;
  });
  const futureNet=parts.recIn+parts.planIn-parts.recOut-parts.planOut;
  const current=liquidBalance(), forecast=current+futureNet;
  const show=v=>balancesHidden?"••••":fmt(v);
  const signed=v=>balancesHidden?"••••":Math.abs(v)<0.005?fmt(0):`${v>0?"+":"−"}${fmt(Math.abs(v))}`;
  document.getElementById("forecastBalanceAmount").textContent=show(forecast);
  document.getElementById("upcomingImpactAmount").textContent=signed(futureNet);
  document.getElementById("forecastTile")?.classList.toggle("neg",forecast<0);
  document.getElementById("forecastTile")?.classList.toggle("zero",Math.abs(forecast)<0.005);
  {const t=document.getElementById("upcomingTile"); if(t){ t.classList.toggle("neg",futureNet<0); t.classList.toggle("zero",Math.abs(futureNet)<0.005); }}
  {
    const isPast=lastDay<today;
    const rng=document.getElementById("upcomingRangeLabel");
    if(rng) rng.textContent=isPast?"Mese passato: nulla in arrivo":`Da oggi a fine ${MESI[viewMonth].toLowerCase()}${viewYear!==Number(today.slice(0,4))?" "+viewYear:""}`;
    const setPart=id=>v=>{
      const el=document.getElementById(id); if(!el) return;
      el.textContent=balancesHidden?"••••":fmt(v);
      el.closest(".fc-part").classList.toggle("zero",Math.abs(v)<0.005);
    };
    setPart("upRecIn")(parts.recIn); setPart("upPlanIn")(parts.planIn);
    setPart("upRecOut")(parts.recOut); setPart("upPlanOut")(parts.planOut);
    const tile=(dir,rec,plan,sign)=>{
      const tot=rec+plan, zero=tot<0.005;
      const t=document.getElementById(`up${dir}Total`);
      if(t) t.textContent=balancesHidden?"••••":zero?fmt(0):`${sign}${fmt(tot)}`;
      const r=document.getElementById(`up${dir}BarRec`), p=document.getElementById(`up${dir}BarPlan`);
      if(r) r.style.width=zero?"0%":`${(rec/tot*100).toFixed(1)}%`;
      if(p) p.style.width=zero?"0%":`${(plan/tot*100).toFixed(1)}%`;
      t?.closest(".fc-tile")?.classList.toggle("zero",zero);
    };
    tile("In",parts.recIn,parts.planIn,"+"); tile("Out",parts.recOut,parts.planOut,"−");
  }
  // v1.14.0: saldo previsto con le rate attese entro fine mese (anche quelle in ritardo).
  {
    const due=allPendingRates().filter(r=>r.date<=lastDay);
    const ratesNet=due.reduce((s,r)=>s+(loanAccount(r.accId)?.receivable?r.amount:-r.amount),0);
    const card=document.getElementById("ratesForecastCard");
    if(card){
      card.hidden=!due.length;
      document.getElementById("ratesForecastLabel").textContent=`Previsto con ${due.length===1?"la rata attesa":`le ${due.length} rate attese`} (${ratesNet>=0?"+":"−"}${balancesHidden?"••••":fmt(Math.abs(ratesNet))})`;
      const v=forecast+ratesNet, el=document.getElementById("ratesForecastAmount");
      el.textContent=show(v); el.style.color=moneyColor(v);
    }
  }
  renderUnifiedBudgets();
  renderAiMonth();

  // Recent tx
  const recent = periodTx("home").filter(t=>!t.isBalanceAdjustment).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  renderTxRows(document.getElementById("recentTx"), recent);
  document.getElementById("txEmptyHint").hidden = recent.length>0;
  document.getElementById("txEmptyHint").textContent=periodModes.home==="day"?"Nessun movimento in questo giorno.":periodModes.home==="range"?"Nessun movimento nel periodo.":"Nessun movimento questo mese.";
  const upcoming=future.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  renderTxRows(document.getElementById("upcomingHomeList"),upcoming);
  document.getElementById("upcomingHomeEmpty").hidden=upcoming.length>0;
  renderHomeLoanRates();
  renderLateRatesBadge();
}

const budgetExpanded = {};
function renderUnifiedBudgets(){
  const list=document.getElementById("budgetList");list.innerHTML="";
  const tx=periodTx("home");
  function renderKind(kind,title,icon){
    /* v1.37.0 — nel budget compaiono le categorie di primo livello; le sottocategorie
       si sommano nella madre e si vedono come righe rientrate, sotto di lei. */
    const cats=state.categories.filter(c=>c.kind===kind && !c.parentCategoryId);
    const groups=state.macroCategories
      .filter(m=>m.kind===kind || cats.some(c=>c.macroCategoryId===m.id))
      .map(m=>({...m,cats:cats.filter(c=>c.macroCategoryId===m.id)}));
    const orphan=cats.filter(c=>!state.macroCategories.some(m=>m.id===c.macroCategoryId));
    if(orphan.length) groups.push({id:`none-${kind}`,name:"Senza macrocategoria",emoji:"🏷️",cats:orphan,budget:null});
    if(!groups.some(g=>g.cats.length || g.budget>0)) return false;
    const section=document.createElement("section");section.className=`budget-kind ${kind}`;
    section.innerHTML=`<h3>${icon} ${title}</h3>`;
    /* Il totale di una categoria comprende le sue sottocategorie. */
    const spentIn=ids=>{ const set=new Set(ids); return tx.filter(t=>t.type===kind && set.has(t.categoryId)).reduce((s,t)=>s+t.amount,0); };
    const spentFor=c=>spentIn(categoryIdsWithin(c.id));
    const row=(name,emoji,total,budget,child,livello)=>{
      const limit=kind==="expense" && Number(budget)>0?Number(budget):0;
      const totalClass=kind==="income"?"budget-earned":"budget-spent";
      const word=kind==="income"?"entrate":"spesi";
      const pct=limit?Math.round(total/limit*100):0, tone=pct>=100?"var(--rust)":pct>=80?"#E8A33D":"var(--emerald)";
      return `<div class="${child?"budget-child":"budget-parent"}${livello===2?" budget-grand":""}"><div class="budget-item-top"><span class="mv-ic">${emojiIconHtml(emoji)}</span><span class="budget-item-name">${escapeHtml(name)}</span><span class="budget-item-amounts"><span class="${totalClass}">${fmt(total)}</span>${limit?` <span class="budget-limit">/ ${fmt(limit)} · ${pct}%</span>`:` <span class="budget-word">${word}</span>`}</span></div>${limit?`<div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.min(100,pct)}%;background:${tone}"></div></div>`:""}</div>`;
    };
    groups.filter(g=>g.cats.length || g.budget>0).forEach(g=>{
      const total=g.cats.reduce((s,c)=>s+spentFor(c),0), key=`${kind}-${g.id||g.name}`;
      const item=document.createElement("div");item.className="budget-item";
      item.innerHTML=`<button type="button" class="budget-macro-toggle" aria-expanded="${Boolean(budgetExpanded[key])}">${row(g.name,g.emoji,total,g.budget,false)}<span class="budget-chevron" aria-hidden="true">${budgetExpanded[key]?"▴":"▾"}</span></button><div class="budget-children" ${budgetExpanded[key]?"":"hidden"}>${g.cats.map(c=>
        row(c.name,c.emoji,spentFor(c),c.budget,true,1) +
        subCategoriesOf(c.id).map(sc=>row(sc.name,sc.emoji,spentIn([sc.id]),sc.budget,true,2)).join("")
      ).join("")}</div>`;
      const macroBtn=item.querySelector(".budget-macro-toggle");
      macroBtn.addEventListener("click",()=>{budgetExpanded[key]=!budgetExpanded[key];renderUnifiedBudgets();});
      // v1.10.5: tieni premuto su una macrocategoria o su una categoria per vedere gli ultimi 5 movimenti.
      const catIds=new Set(g.cats.flatMap(c=>categoryIdsWithin(c.id)));
      bindLongPress(macroBtn,()=>showLongPressPopup(macroBtn,`Ultimi 5 · ${g.name}`,lpLastMovements(t=>t.type===kind&&catIds.has(t.categoryId)),{emptyText:"Nessun movimento in questa macrocategoria."}));
      /* L'elenco rientrato alterna categorie e loro sottocategorie: lo ripercorriamo
         nello stesso ordine in cui è stato scritto, così il tieni-premuto resta giusto. */
      const ordine=[]; g.cats.forEach(c=>{ ordine.push({c,sotto:false}); subCategoriesOf(c.id).forEach(sc=>ordine.push({c:sc,sotto:true})); });
      item.querySelectorAll(".budget-children .budget-child").forEach((el,i)=>{
        const v=ordine[i]; if(!v) return;
        const ids=v.sotto?[v.c.id]:categoryIdsWithin(v.c.id);
        const set=new Set(ids);
        const titolo=v.sotto?`${g.name} · ${v.c.name}`:v.c.name;
        bindLongPress(el,()=>showLongPressPopup(el,`Ultimi 5 · ${titolo}`,lpLastMovements(t=>t.type===kind&&set.has(t.categoryId)),{emptyText:"Nessun movimento qui."}));
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
/* v1.40.0 — Duplica anche in R&P: la copia nasce uguale, si apre subito per cambiare
   quello che serve (nome, importo, data). "Annulla" nel messaggio la toglie. */
function duplicateRP(kind,id){
  const listName=kind==="recurring"?"recurring":"planned";
  const src=state[listName].find(x=>x.id===id); if(!src) return;
  const copy=JSON.parse(JSON.stringify(src)); copy.id=uid();
  if(kind==="planned"){ delete copy.paidTxId; delete copy.done; }
  state[listName].push(copy);
  persist(); renderAll();
  showActionToastOrUndo(`${kind==="recurring"?"Ricorrente":"Pianificata"} duplicata`,()=>{ state[listName]=state[listName].filter(x=>x.id!==copy.id); persist(); renderAll(); });
  setTimeout(()=>{ if(kind==="recurring") openRecurringForm(copy.id); else openPlannedForm(copy.id); },120);
}
function showActionToastOrUndo(message,undo){
  let toast=document.getElementById("appToast");
  if(!toast){toast=document.createElement("div");toast.id="appToast";document.body.appendChild(toast);}
  toast.innerHTML=`<span>${escapeHtml(message)}</span><button type="button">Annulla</button>`;
  toast.classList.add("show");clearTimeout(toast._timer);
  toast.querySelector("button").addEventListener("click",()=>{undo();toast.classList.remove("show");});
  toast._timer=setTimeout(()=>toast.classList.remove("show"),5000);
}
function duplicateTransaction(t){
  if(!t || t.planned || t.isBalanceAdjustment) return null;
  const copy={...t,id:uid(),date:todayISO(),planned:false};
  delete copy.recurringId;
  delete copy.plannedId;
  state.transactions.push(copy);
  if(t.splitGroup){ const group=uid(); copy.splitGroup=group; const partner=splitPartner(t); if(partner) state.transactions.push({...partner,id:uid(),date:copy.date,splitGroup:group}); }
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
function emojiIconHtml(emoji){
  const grs=emojiGraphemes(emoji).slice(0,2);
  return (grs.length?grs:[emoji]).map(g=>`<span class="mv-ic-item">${escapeHtml(g)}</span>`).join("");
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
  // v1.12.1: niente icone suggerite, solo la tastiera emoji dell'iPhone.
  const hint=document.createElement("p");hint.className="field-hint emoji-hint";hint.textContent="Tocca il campo e sulla tastiera premi 😀 (o 🌐) per scegliere l'emoji. Puoi metterne fino a 2.";
  const commit=()=>{const v=cleanEmoji(input.value);onChange(v||EMOJIS[0]);};
  input.addEventListener("input",()=>{const v=cleanEmoji(input.value);if(v!==input.value&&!input.value.endsWith("\u200D"))input.value=v;commit();});
  input.addEventListener("blur",()=>{input.value=cleanEmoji(input.value);commit();});
  clear.addEventListener("click",()=>{input.value="";input.focus();onChange(EMOJIS[0]);});
  row.append(wrap,hint);
  commit();
}
function movementRowHtml({emoji,color,title,badges="",meta="",amountHtml,type,date,relative=true,kind=null,paid=false}){
  const nEm=Math.min(2,emojiGraphemes(emoji).length||1);
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
function futureFromTx(t){
  const d=nextMonthSameDay(t.date);
  return {name:t.name||"",amount:t.amount,type:t.type,categoryId:t.categoryId,accountId:t.accountId,note:t.note||"",freq:"monthly",startDate:d,date:d,active:true};
}
function transferName(fromId,toId){
  const accs=accountsById();
  return `${accs[fromId]?.name||"Conto"} → ${accs[toId]?.name||"Conto"}`;
}
function renderTxRows(container, list, {paidLabel=false}={}){
  const cats = categoriesById(), accs = accountsById(), macros = macroCategoriesById();
  const ambigue = ambiguousCategoryNames();   /* v1.37.0: percorso solo sui nomi doppi */
  container.innerHTML = "";
  list.forEach(t=>{
    const isTransfer=t.type==="transfer";
    const loanInfo = (isTransfer||t.loanOld||t.loanWriteOff) ? loanRowInfo(t) : null;
    const cat = loanInfo ? {name:loanInfo.label,emoji:loanInfo.emoji,color:loanInfo.color,macroCategoryId:null} : isTransfer ? ({name:t.atm?"Prelievo ATM":"Trasferimento",emoji:t.atm?"🏧":"↔",color:"#E8A33D",macroCategoryId:null}) : (t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️",color:"#7BAE9D",macroCategoryId:null} : (cats[t.categoryId] ? {...cats[t.categoryId], name: categoryLabel(t.categoryId,{ambigue})} : { name:"Categoria eliminata", emoji:"❔", color:"#999" }));
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
    const sharePerson = t.splitGroup ? sharePersonOf(t) : "";
    const title = loanInfo ? loanInfo.title : isTransfer ? `${acc.name} → ${destination.name}` : (t.name || t.note || cat.name);
    const metaParts=loanInfo
      ? `<span class="mv-loan">${loanInfo.label}</span>${loanInfo.meta?`<span class="mv-sep" aria-hidden="true">·</span><span>${hlText(loanInfo.meta)}</span>`:""}`
      : isTransfer
      ? `<span>${t.atm?"Prelievo ATM":"Trasferimento"}</span>`
      : `<span>${hlText(cat.name)}</span><span class="mv-sep" aria-hidden="true">·</span><span class="mv-acc">${hlText(acc.name)}</span>${sharePerson?`<span class="mv-sep" aria-hidden="true">·</span><span class="mv-shared">divisa con ${escapeHtml(sharePerson)}</span>`:""}`;
    row.innerHTML = movementRowHtml({emoji:cat.emoji,color:cat.color,title,badges:statusBadge,meta:metaParts,
      amountHtml:`${isTransfer||t.loanOld||t.loanWriteOff?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}`,type:(t.loanOld||t.loanWriteOff)?"transfer":t.type,date:t.date,relative:!!t.planned,
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
        else {
          const linked=linkedTx(t);
          moveToTrash("transaction",t,linked);deleted=state.trash[0]?.id;
          const ids=new Set([t.id,...linked.map(x=>x.id)]);
          state.transactions=state.transactions.filter(x=>!ids.has(x.id));
        }
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
    const hay=[t.name,t.note,cats[t.categoryId]?.name,cats[cats[t.categoryId]?.parentCategoryId]?.name,accounts[t.accountId]?.name,accounts[t.toAccountId]?.name,t.type].filter(Boolean).join(" ").toLocaleLowerCase("it");
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
  setMoney("recurringEstimate",estimates.recurring.net,{signed:true});
  // v1.6.5: Entrate/Uscite = totale del mese; il numero grande e "per conto/carta" = ancora da registrare.
  setMoney("plannedEstimate",estimates.planned.net,{signed:true});
  setMoney("rpCombinedEstimate",estimates.total.net,{signed:true});
  // v1.19.0: riquadri Entrate / Uscite: totale del mese, barra di quanto è già registrato e quanto manca.
  const setTiles=(pre,summary)=>{
    [["Income","income","+"],["Expense","expense","−"]].forEach(([K,k,sign])=>{
      const tot=summary.month[k]||0, pend=Math.min(summary[k]||0,tot), done=Math.max(0,tot-pend), zero=tot<0.005;
      const amt=document.getElementById(`${pre}${K}Estimate`), bar=document.getElementById(`${pre}${K}Bar`), note=document.getElementById(`${pre}${K}Note`);
      if(amt) amt.textContent=balancesHidden?"••••":zero?fmt(0):`${sign}${fmt(tot)}`;
      if(bar) bar.style.width=zero?"0%":`${(done/tot*100).toFixed(1)}%`;
      if(note) note.textContent=zero?"Niente nel mese":pend<0.005?"Tutto registrato":`${balancesHidden?"••••":fmt(pend)} da registrare`;
      amt?.closest(".fc-tile")?.classList.toggle("zero",zero);
    });
  };
  setTiles("recurring",estimates.recurring); setTiles("planned",estimates.planned); setTiles("rpCombined",estimates.total);
  renderAccounts("recurringAccountBreakdown",estimates.recurring);
  renderAccounts("plannedAccountBreakdown",estimates.planned);
  renderAccounts("rpCombinedAccountBreakdown",estimates.total);
  const toggle=document.getElementById("toggleRPBalance");
  if(toggle){setEyeIcon(toggle,balancesHidden,"Mostra importi R&P","Nascondi importi R&P");}
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
  return [name,cats[categoryId]?.name,cats[cats[categoryId]?.parentCategoryId]?.name,accs[accountId]?.name].filter(Boolean).join(" ").toLocaleLowerCase("it").includes(q);
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
  const cat=cats[p.categoryId]?{...cats[p.categoryId],name:categoryLabel(p.categoryId)}:{};
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
  enableLongPressActions(row,{title:p.name||cat.name||"Pianificata",onEdit:()=>openPlannedForm(p.id),onDuplicate:()=>duplicateRP("planned",p.id),onDelete:()=>{const item=state.planned.find(x=>x.id===p.id);if(item)moveToTrash("planned",item);const deleted=state.trash[0]?.id;state.planned=state.planned.filter(x=>x.id!==p.id);persist();renderAll();if(deleted)showUndo("Pianificata eliminata",deleted);}});
  return row;
}
function recurringRowElement(r,{dates=null}={}){
  const cats=categoriesById(),accs=accountsById();
  const cat=cats[r.categoryId]?{...cats[r.categoryId],name:categoryLabel(r.categoryId)}:{},acc=accs[r.accountId]||{name:"Conto eliminato"};
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
  enableLongPressActions(row,{title:r.name,onEdit:()=>openRecurringForm(r.id),onDuplicate:()=>duplicateRP("recurring",r.id),onDelete:()=>{moveToTrash("recurring",r);const deleted=state.trash[0]?.id;removeRecurring(r.id);persist();renderAll();if(deleted)showUndo("Ricorrente eliminato",deleted);}});
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
function statsTransactions(withAdjustments=false){
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
  return state.transactions.filter(t=>(withAdjustments||!t.isBalanceAdjustment) && t.date>=from && t.date<=to);
}
function renderTopCategoriesChart(entries,cats){
  if(!entries.length) return `<div class="top-categories-empty">Nessuna spesa nel periodo selezionato.</div>`;
  const max=Math.max(...entries.map(([,v])=>v),1);
  return `<div class="top-categories-chart" role="img" aria-label="Top 5 categorie di spesa">${entries.map(([id,value],index)=>{
    const cat=cats[id]||{};
    const pct=Math.max(4,(value/max)*100);
    const color=PALETTE[index%PALETTE.length];
    return `<div class="top-category-row">
      <div class="top-category-meta"><span class="top-category-name"><span class="top-category-emoji">${escapeHtml(cat.emoji||"•")}</span>${escapeHtml(cat.name||"Altro")}</span><strong>${fmt(value)}</strong></div>
      <div class="top-category-track" aria-hidden="true"><span class="top-category-bar" style="width:${pct.toFixed(1)}%;background:${color}"></span></div>
    </div>`;
  }).join("")}</div>`;
}
/* v1.23.0 — Confronto con lo stesso mese dell'anno scorso: totale spese e categorie che cambiano di più. */
function renderYearOverYear(){
  const host=document.getElementById("statsInsights"); if(!host) return;
  let box=document.getElementById("statsYoY");
  if(!box){ box=document.createElement("div"); box.id="statsYoY"; box.className="stat-card wide-stat yoy-card"; host.after(box); }
  const ym=(y,m)=>`${y}-${pad2(m+1)}`, cur=ym(viewYear,viewMonth), prev=ym(viewYear-1,viewMonth);
  const sum=(pfx)=>{ const by={}; let tot=0; state.transactions.forEach(t=>{ if(t.type!=="expense"||t.isBalanceAdjustment||!String(t.date).startsWith(pfx)) return; tot+=t.amount; by[t.categoryId]=(by[t.categoryId]||0)+t.amount; }); return {tot,by}; };
  const A=sum(cur), B=sum(prev), cats=categoriesById();
  const amt=v=>balancesHidden?"••••":fmt(v);
  const title=`${MESI[viewMonth]} ${viewYear} e ${MESI[viewMonth].toLowerCase()} ${viewYear-1}`;
  if(!B.tot){ box.innerHTML=`<p class="stat-card-label">Rispetto all'anno scorso</p><p class="yoy-empty">Nessuna spesa registrata a ${MESI[viewMonth].toLowerCase()} ${viewYear-1}: il confronto comparirà quando ci saranno dati di un anno fa.</p>`; return; }
  const diff=A.tot-B.tot, pct=Math.round(diff/B.tot*100);
  const ids=[...new Set([...Object.keys(A.by),...Object.keys(B.by)])].map(id=>({id,a:A.by[id]||0,b:B.by[id]||0})).map(x=>({...x,d:x.a-x.b})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).slice(0,4);
  box.innerHTML=`<p class="stat-card-label">Rispetto all'anno scorso · ${escapeHtml(title)}</p>
    <div class="yoy-head"><div><small>${MESI_BREVI[viewMonth]} ${viewYear}</small><b>${amt(A.tot)}</b></div><div><small>${MESI_BREVI[viewMonth]} ${viewYear-1}</small><b>${amt(B.tot)}</b></div><div class="yoy-delta ${diff>0?"up":"down"}"><small>Differenza</small><b>${diff>0?"▲":"▼"} ${Math.abs(pct)}%</b></div></div>
    <div class="yoy-rows">${ids.map(x=>{ const c=cats[x.id]||{name:"Altro",emoji:"❔"}; return `<div class="yoy-row"><span>${escapeHtml(c.emoji||"")} ${escapeHtml(c.name)}</span><span class="yoy-vals">${amt(x.b)} → ${amt(x.a)}</span><b class="${x.d>0?"up":"down"}">${x.d>0?"+":"−"}${balancesHidden?"••":fmt(Math.abs(x.d))}</b></div>`; }).join("")}</div>`;
}
function renderStats(){
  const tx=statsTransactions(), income=tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense=tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const days=Math.max(1,Math.ceil((new Date(viewYear,viewMonth+1,0)-new Date(viewYear,viewMonth,1))/86400000)+1);
  const cats=categoriesById(), byCat={};tx.filter(t=>t.type==="expense").forEach(t=>{byCat[t.categoryId]=(byCat[t.categoryId]||0)+t.amount;});
  const topEntries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById("statsInsights").innerHTML=`<div class="stat-card"><p class="stat-card-label">Media spese/giorno</p><p class="stat-card-value neg">${fmt(expense/days)}</p></div><div class="stat-card"><p class="stat-card-label">Saldo periodo</p><p class="stat-card-value ${income-expense<0?"neg":"pos"}">${fmtSigned(income-expense)}</p></div><div class="stat-card wide-stat top-categories-card"><p class="stat-card-label">Top 5 categorie</p>${renderTopCategoriesChart(topEntries,cats)}</div>`;
  renderYearOverYear();
  renderPie();
  renderTrendSection();
  renderAccountBreakdown();
  renderLoanStats();
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
      key = rollUpCategoryId(t.categoryId);   /* v1.37.0: la sottocategoria conta nella madre */
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
  entries.forEach(([key,val],sliceIndex)=>{
    let info;
    if(statsGroupMode==="macro"){
      info = key==="none" ? {color:"#999",name:"Senza macrocategoria",emoji:"❔"} : macros[key];
    } else {
      info = cats[key] || {color:"#999",name:"Altro",emoji:"❔"};
    }
    const frac = val/total;
    const len = frac*circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE[sliceIndex%PALETTE.length]}" stroke-width="26"
      stroke-dasharray="${len} ${circumference-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;

    const legItem = document.createElement("div");
    legItem.className = "pie-legend-item";
    legItem.innerHTML = `<span class="sw" style="background:${PALETTE[sliceIndex%PALETTE.length]}"></span><span class="lbl">${escapeHtml(info.emoji)} ${escapeHtml(info.name)}</span><span class="val">${fmt(val)} · ${Math.round(frac*100)}%</span>`;
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
  state.accounts.filter(a=>!isLoanAccount(a)).forEach(a=>{
    const net = tx.reduce((s,t)=>s+(t.type==="transfer"?(t.accountId===a.id?-t.amount:t.toAccountId===a.id?t.amount:0):(t.accountId===a.id?(t.type==="income"?t.amount:-t.amount):0)),0);
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
  const total = liquidBalance();
  totalEl.textContent = balancesHidden ? "••••" : fmt(total);
  setEyeIcon(document.getElementById("toggleAccountsBalance"),balancesHidden);
  totalEl.style.color = moneyColor(total);
  {
    const recv=receivableTotal(), pay=payableTotal(), hasRecv=Math.abs(recv)>=0.005, hasPay=Math.abs(pay)>=0.005, rows=document.getElementById("accountsEffectiveRows");
    document.getElementById("totalBalanceLabel").textContent=(hasRecv||hasPay)?"Totale attuale sui conti":"Saldo totale su tutti i conti";
    if(rows){
      rows.hidden=!(hasRecv||hasPay);
      if(hasRecv||hasPay){
        const eff=total+recv-pay, show=v=>balancesHidden?"••••":fmt(v);
        document.getElementById("accountsReceivableRow").hidden=!hasRecv; document.getElementById("accountsReceivable").textContent=`+${show(recv)}`;
        document.getElementById("accountsPayableRow").hidden=!hasPay; document.getElementById("accountsPayable").textContent=`−${show(pay)}`;
        const e=document.getElementById("accountsEffective"); e.textContent=show(eff); e.style.color=moneyColor(eff);
      }
    }
    renderLoans();
  }
  const mainSelect=document.getElementById("mainAccountSelect");
  if(mainSelect){
    mainSelect.innerHTML=`<option value="">Seleziona il conto principale</option>`+state.accounts.filter(a=>!isLoanAccount(a)).map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join("");
    mainSelect.value=state.accounts.some(a=>a.id===state.mainAccountId)?state.mainAccountId:"";
    mainSelect.onchange=()=>{
      state.mainAccountId=mainSelect.value || null;
      persist();renderAll();
      showToast(state.mainAccountId?"Conto principale impostato":"Conto principale rimosso");
    };
  }

  const container = document.getElementById("accountsList");
  container.innerHTML = "";
  state.accounts.filter(a=>!isLoanAccount(a)).forEach(a=>{
    const bal = accountBalance(a.id);
    const card = document.createElement("button");
    card.className = "account-card";
    card.innerHTML = `
      <span class="account-info">
        <p class="account-name">${escapeHtml(a.name)}${a.id===state.mainAccountId?` <span class="main-account-badge">Principale</span>`:""}</p>
        <p class="account-type">Saldo attuale</p>
      </span>
      <span class="account-balance" style="color:${balancesHidden?"var(--num-plain)":moneyColor(bal)}">${balancesHidden?"••••":fmt(bal)}</span>
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
  const items=state.transactions.filter(t=>t.isBalanceAdjustment&&!t.loanOld&&!t.loanWriteOff).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
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

  function buildRow(c,position,total,sotto){
    const wrap=document.createElement("div");wrap.className="category-manage-row"+(sotto?" is-sub":"");
    const row = document.createElement("button");
    row.className = "category-row"+(sotto?" sub-row":"");
    const figlie = sotto?0:subCategoriesOf(c.id).length;
    const madre = sotto ? state.categories.find(x=>x.id===c.parentCategoryId) : null;
    row.innerHTML = `
      <span class="ic">${emojiIconHtml(c.emoji)}</span>
      <span class="info">
        <p class="nm">${sotto?`<span class="sub-arrow" aria-hidden="true">└</span>`:""}${escapeHtml(c.name)}</p>
        <p class="sub">${sotto?`sottocategoria di ${escapeHtml(madre?madre.name:"")}`:(c.kind==="income"?"Entrata":"Uscita")}${figlie?` · ${figlie} ${figlie===1?"sottocategoria":"sottocategorie"}`:""}${c.budget?` · budget <span class="amt">${fmt(c.budget)}</span>`:""}</p>
      </span>
      <span class="chev">›</span>`;
    row.addEventListener("click", ()=> openCategoryForm(c.id));
    wrap.appendChild(row);
    wrap.appendChild(reorderControls(`categoria ${c.name}`,()=>moveCategory(c.id,-1),()=>moveCategory(c.id,1),position>0,position<total-1));
    return wrap;
  }

  /* v1.37.0 — l'elenco mostra le categorie principali e, rientrate sotto, le loro
     sottocategorie. Le frecce di riordino restano solo sulle principali. */
  const groups = new Map();
  state.categories.filter(c=>!c.parentCategoryId).forEach(c=>{
    const key = c.macroCategoryId && macros[c.macroCategoryId] ? c.macroCategoryId : "none";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  });
  function appendCat(group,c,i,n){
    group.appendChild(buildRow(c,i,n,false));
    subCategoriesOf(c.id).forEach(sc=>group.appendChild(buildRow(sc,0,1,true)));
  }

  state.macroCategories.forEach(m=>{
    if(!groups.has(m.id)) return;
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title"><span>${escapeHtml(m.emoji)}</span>${escapeHtml(m.name)}</p>`;
    const items=groups.get(m.id);items.forEach((c,i)=> appendCat(group,c,i,items.length));
    container.appendChild(group);
  });

  if(groups.has("none")){
    const group = document.createElement("div");
    group.className = "category-group";
    group.innerHTML = `<p class="category-group-title">Senza macrocategoria</p>`;
    const items=groups.get("none");items.forEach((c,i)=> appendCat(group,c,i,items.length));
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
      <span class="ic">${emojiIconHtml(m.emoji)}</span>
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
  const last=localStorage.getItem("bilancio_last_backup");
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
  const recurringCard=document.getElementById("recurringEstimateCard"),plannedCard=document.getElementById("plannedEstimateCard"),combined=document.getElementById("rpTotalEstimateCard"),grid=document.getElementById("rpEstimatesGrid");
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
bindLongPress(document.getElementById("monthLabel"),()=>showMonthQuickPicker(document.getElementById("monthLabel")));
function showMonthQuickPicker(anchor){
  closeLongPressPopup();
  const pop=document.createElement("div");
  pop.className="lp-popup mp-popup";pop.id="lpPopup";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Scegli il mese");
  const items=[];
  for(let i=-3;i<=3;i++){
    const d=new Date(viewYear,viewMonth+i,1);
    items.push({y:d.getFullYear(),m:d.getMonth(),cur:i===0});
  }
  const rows=items.map(it=>`<button type="button" class="mp-row${it.cur?" active":""}" data-y="${it.y}" data-m="${it.m}"><b>${MESI[it.m]}</b><small>${it.y}</small></button>`).join("");
  pop.innerHTML=`<div class="lp-head">Scegli il mese</div><div class="mp-list">${rows}</div>`;
  document.body.appendChild(pop);
  pop.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>{
    viewYear=Number(b.dataset.y);viewMonth=Number(b.dataset.m);
    viewDay=Math.min(viewDay||1,new Date(viewYear,viewMonth+1,0).getDate());
    periodModes[activeView]="month";txVisibleLimit=TX_PAGE_SIZE;closeLongPressPopup();renderAll();
  }));
  const r=anchor.getBoundingClientRect(), vw=window.innerWidth, vh=window.innerHeight;
  const w=Math.min(220,vw-24); pop.style.width=w+"px";
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
          // v1.22.0 — stessi pallini del calendario: effettivo, una tantum, ricorrente.
          const di=info[iso]||{};
          cell.innerHTML=`<span class="cal-day-num">${d}</span><span class="cal-dots">${di.real?'<span class="cal-dot real"></span>':""}${di.planned?'<span class="cal-dot planned"></span>':""}${di.recurring?'<span class="cal-dot recurring"></span>':""}</span>`;
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
        if(!days.querySelector(".pp-legend")){ const lg=document.createElement("div"); lg.className="calendar-legend pp-legend"; lg.innerHTML='<span class="cal-leg-item"><span class="dot real"></span>Effettivo</span><span class="cal-leg-item"><span class="dot planned"></span>Una tantum</span><span class="cal-leg-item"><span class="dot recurring"></span>Ricorrente</span>'; days.appendChild(lg); }
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
document.getElementById("backToCurrentMonth").addEventListener("click",()=>{
  const today=new Date();
  viewYear=today.getFullYear();viewMonth=today.getMonth();viewDay=today.getDate();
  periodModes.home="month";periodModes.recurring="month";
  txVisibleLimit=TX_PAGE_SIZE;closeDatePicker();closePeriodMenu();renderAll();
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
/* Il dito è partito dentro una striscia che scorre di lato? Allora quel movimento è suo:
   niente cambio mese. */
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
  requestAnimationFrame(()=>node.querySelectorAll(".amount-field input").forEach(fitAmountInput));

  let closing=false;
  function finishClose(){
    backdrop.remove();
    node.remove();
    overlayRoot.style.pointerEvents = overlayRoot.querySelector(".sheet") ? "auto" : "none";
    if(!overlayRoot.querySelector(".sheet")) document.documentElement.classList.remove("sheet-open");
  }
  function close(fromSwipe=false,speed=0){
    if(closing) return;
    closing=true;
    node.classList.remove("dragging");
    node.style.transition="";
    backdrop.style.transition="";
    backdrop.style.opacity="";
    let wait=280;
    if(fromSwipe){
      /* v1.29.0 — Chiusura col dito: il pannello continua alla velocità del gesto e finisce
         in fretta (prima ripartiva con la curva lenta da 0,28 s e sembrava al rallentatore).
         Durante l'uscita si spegne la sfocatura, che su iPhone appesantisce l'animazione. */
      const horiz=fromSwipe==="x";
      const m=/translate[XY]\((-?[\d.]+)px\)/.exec(node.style.transform||"");
      const done=m?Math.max(0,parseFloat(m[1])):0;
      const total=horiz?node.offsetWidth:node.offsetHeight;
      const rest=Math.max(0,total+24-done);
      const v=Math.max(1.4,Math.abs(speed)||0);                 // px per millisecondo
      wait=Math.round(Math.min(240,Math.max(120,rest/v)));
      node.classList.add("sheet-leaving");
      node.style.transition=`transform ${wait}ms cubic-bezier(.3,.6,.55,1)`;
      backdrop.style.transition=`opacity ${wait}ms linear`;
      node.style.transform=horiz?`translateX(${total+24}px)`:`translateY(${total+24}px)`;
      backdrop.classList.remove("show");
      backdrop.style.opacity="0";
    }else{
      node.style.transform="";
      node.classList.remove("show");
      backdrop.classList.remove("show");
    }
    setTimeout(finishClose, wait+20);
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
      const dxEnd=t.clientX-touch.x, flickX=touch.velocityX>0.5 && dxEnd>36, touch0vx=touch.velocityX;
      touch=null;
      if(dxEnd>100 || flickX){ close("x",touch0vx); return; }
      node.classList.remove("dragging");
      node.style.transform="";
      backdrop.style.opacity="";
      return;
    }
    const dy=t.clientY-touch.y;
    const fastFlick=touch.velocityY>0.55 && dy>32;
    const shouldClose=touch.active && (dy>92 || fastFlick);
    const wasActive=touch.active, vy=touch.velocityY;
    touch=null;

    if(shouldClose){
      close(true,vy);
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

/* ---------------- v1.12.0 — Prestiti: da ricevere e da pagare, per persona ----------------
   Ogni persona (o ente) ha un conto prestito nascosto dalla lista dei conti:
   - "Da ricevere · Nome" (receivable): sale quando presto o pago la sua parte di una spesa, scende quando mi restituisce;
   - "Da pagare · Nome" (payable): scende sotto zero quando ricevo un prestito, risale quando restituisco o pago una rata.
   I movimenti sono trasferimenti: il saldo dei conti resta corretto e le spese contano solo la mia parte.
   "Spesa divisa" nel nuovo movimento: Metà, Percentuale o Tutto a lui/lei (= prestito intero). */
function isLoanAccount(a){ return !!(a && (a.receivable || a.payable)); }
function loanAccount(id){ const a=state.accounts.find(x=>x.id===id); return isLoanAccount(a)?a:null; }
// v1.25.0: una persona eliminata resta come conto "archiviato" (saldo zero, storico intatto) e non compare più.
function receivableAccounts(){ return state.accounts.filter(a=>a.receivable&&!a.archived); }
function payableAccounts(){ return state.accounts.filter(a=>a.payable&&!a.archived); }
function payableTotal(){ return -payableAccounts().reduce((s,a)=>s+accountBalance(a.id),0); } // positivo = quanto devo
function ensureLoanAccount(person,kind){
  const name=String(person||"").trim().slice(0,30);
  const flag=kind==="pay"?"payable":"receivable";
  let acc=state.accounts.find(a=>a[flag] && String(a.person||"").toLowerCase()===name.toLowerCase());
  if(acc && acc.archived) delete acc.archived; // la persona torna se la si usa di nuovo
  if(!acc){
    acc={id:uid(),name:`${kind==="pay"?"Da pagare":"Da ricevere"} · ${name}`,balance:0,color:kind==="pay"?"#C9785C":"#8E7CC3",person:name};
    acc[flag]=true;
    state.accounts.push(acc);
  }
  return acc;
}
function groupParts(gid){ const parts=state.transactions.filter(x=>x.splitGroup===gid); return {id:gid,main:parts.find(x=>x.type==="expense")||null,share:parts.find(x=>x.splitShare)||null}; }
function splitPartner(t){ return t?.splitGroup ? state.transactions.find(x=>x.splitGroup===t.splitGroup && x.id!==t.id) : null; }
function sharePersonOf(t){
  const share=t?.splitShare?t:splitPartner(t);
  return share?(loanAccount(share.toAccountId)?.person||""):"";
}
/* Titolo e descrizione delle righe che toccano un conto prestito. */
function linkedTx(t){
  return state.transactions.filter(x=>x.id!==t.id&&((t.splitGroup&&x.splitGroup===t.splitGroup)||(t.settleGroup&&x.settleGroup===t.settleGroup)));
}
function loanRowInfo(t){
  if(t.loanOffset){
    const a=loanAccount(t.accountId); if(!a) return null;
    return {title:`Compensazione con ${a.person}`,label:a.receivable?"Credito compensato":"Debito compensato",meta:"crediti e debiti si annullano",emoji:"⚖️",color:"#7BAE9D"};
  }
  if(t.loanWriteOff){
    const a=loanAccount(t.accountId); if(!a) return null;
    return a.receivable
      ? {title:`Abbuono a ${a.person}`,label:"Rimborso chiuso",meta:"differenza non restituita",emoji:"✅",color:"#3AA684"}
      : {title:`Abbuono da ${a.person}`,label:"Debito chiuso",meta:"differenza non pagata",emoji:"✅",color:"#3AA684"};
  }
  if(t.loanOld){
    const a=loanAccount(t.accountId); if(!a) return null;
    return a.receivable
      ? {title:`Prestito a ${a.person}`,label:"Prestito vecchio",meta:t.note||"fuori saldo",emoji:"🤝",color:"#8E7CC3"}
      : {title:`Debito con ${a.person}`,label:"Debito vecchio",meta:t.note||"fuori saldo",emoji:"🏦",color:"#C9785C"};
  }
  if(t.type!=="transfer") return null;
  const from=loanAccount(t.accountId), to=loanAccount(t.toAccountId);
  const accName=id=>state.accounts.find(a=>a.id===id)?.name||"conto";
  if(to?.receivable){
    const quota=t.splitShare && state.transactions.some(x=>x.splitGroup===t.splitGroup && x.type==="expense");
    return {title:`${quota?"Quota di":"Prestito a"} ${to.person}`,label:"Da ricevere",meta:t.note||accName(t.accountId),emoji:"🤝",color:"#8E7CC3"};
  }
  if(from?.receivable) return {title:`${from.person} ti ha restituito`,label:t.rateInfo?"Rata":"Restituzione",meta:t.rateInfo?`${rateInfoLabel(t.rateInfo)} · su ${accName(t.toAccountId)}`:`su ${accName(t.toAccountId)}`,emoji:"↩️",color:"#3AA684"};
  if(from?.payable) return {title:`Prestito da ${from.person}`,label:"Da pagare",meta:t.note||`su ${accName(t.toAccountId)}`,emoji:"🏦",color:"#C9785C"};
  if(to?.payable) return {title:`Restituito a ${to.person}`,label:"Rata / restituzione",meta:t.rateInfo?`${rateInfoLabel(t.rateInfo)} · da ${accName(t.accountId)}`:(t.note||`da ${accName(t.accountId)}`),emoji:"💸",color:"#C9785C"};
  return null;
}
function mountSharedExpense(node, afterRow, {type, amount, group}){
  const total=group?Number(group.main?.amount||0)+Number(group.share?.amount||0):0;
  let on=!!group?.share;
  let person=group?.share?(loanAccount(group.share.toAccountId)?.person||""):(state.lastSharePerson||receivableAccounts()[0]?.person||"");
  let mode="half", pctVal=50;
  if(group?.share){ if(!group.main) mode="all"; else { pctVal=Math.round(Number(group.main.amount)/total*100); mode=pctVal===50?"half":"pct"; } }
  const row=document.createElement("div");
  row.className="field-row shared-field";
  row.innerHTML=`<button type="button" class="shared-switch" aria-pressed="false"><span class="shared-knob" aria-hidden="true"></span><span class="shared-switch-text"><strong>Spesa divisa o prestito</strong><small>Pago io: una parte o tutto me lo devono</small></span></button>
    <div class="shared-box" hidden>
      <label>Chi ti deve i soldi</label>
      <div class="chip-row shared-people"></div>
      <input type="text" class="text-input shared-new" maxlength="30" placeholder="Nuova persona, es. Ilaria" autocomplete="off">
      <label class="shared-lbl">Quanto è tuo</label>
      <div class="type-toggle three shared-mode"><button type="button" class="type-opt" data-m="half">Metà</button><button type="button" class="type-opt" data-m="pct">Percentuale</button><button type="button" class="type-opt" data-m="all">Tutto suo</button></div>
      <div class="split-custom" hidden><span class="sc-me"></span><input type="range" min="5" max="95" step="5" aria-label="La tua quota in percentuale"><span class="sc-other"></span></div>
      <p class="field-hint shared-hint"></p>
    </div>`;
  afterRow.after(row);
  const sw=row.querySelector(".shared-switch"), box=row.querySelector(".shared-box"), people=row.querySelector(".shared-people"), newInput=row.querySelector(".shared-new");
  const range=row.querySelector("input[type=range]"), custom=row.querySelector(".split-custom"), hint=row.querySelector(".shared-hint");
  range.value=String(Math.min(95,Math.max(5,pctVal)));
  const sharePct=()=>mode==="half"?50:mode==="all"?0:Number(range.value);
  function refresh(){
    row.hidden=type()!=="expense";
    sw.classList.toggle("on",on); sw.setAttribute("aria-pressed",String(on)); box.hidden=!on;
    if(!on) return;
    const names=[...new Set(receivableAccounts().map(a=>a.person).filter(Boolean))];
    if(person && !names.some(n=>n.toLowerCase()===person.toLowerCase())) names.push(person);
    people.innerHTML=names.map(n=>`<button type="button" class="chip${n.toLowerCase()===String(person).toLowerCase()?" active":""}" data-person="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("");
    people.querySelectorAll("[data-person]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();person=b.dataset.person;newInput.value="";refresh();}));
    const other=person||"l'altra persona";
    row.querySelectorAll(".shared-mode .type-opt").forEach(b=>{ b.classList.toggle("active",b.dataset.m===mode); if(b.dataset.m==="all") b.textContent=person?`Tutto a ${person}`:"Tutto suo"; });
    custom.hidden=mode!=="pct";
    const p=sharePct();
    row.querySelector(".sc-me").textContent=`Tu ${p}%`;
    row.querySelector(".sc-other").textContent=`${100-p}% ${other}`;
    const amt=amount();
    if(!(amt>0)) hint.textContent="Inserisci l'importo totale che hai pagato.";
    else if(mode==="all") hint.textContent=`Prestito: ${fmt(amt)} da ricevere da ${other}. Non conta come tua spesa; la categoria è facoltativa.`;
    else { const mine=Math.round(amt*p)/100; hint.textContent=`Spesa tua: ${fmt(mine)} · da ricevere da ${other}: ${fmt(Math.round((amt-mine)*100)/100)}`; }
  }
  sw.addEventListener("click",e=>{ e.stopPropagation(); on=!on; refresh(); if(on&&!person) newInput.focus(); });
  newInput.addEventListener("input",()=>{ const v=newInput.value.trim(); if(v) person=v; refresh(); newInput.focus(); });
  row.querySelectorAll(".shared-mode .type-opt").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();mode=b.dataset.m;refresh();}));
  range.addEventListener("input",refresh);
  node.addEventListener("input",e=>{ if(!row.contains(e.target)) refresh(); });
  node.addEventListener("click",e=>{ if(!row.contains(e.target)) setTimeout(refresh,0); });
  refresh();
  return {get:()=>({on:on&&type()==="expense",person:String(person||"").trim(),pct:sharePct()}),refresh,setOff:()=>{ if(on){ on=false; refresh(); } }};
}
/* v1.25.0 — Spesa pagata da un'altra persona: non esce dai miei conti, la mia parte diventa un debito
   verso di lei ("Da pagare · Nome"). Conta come mia spesa (con la categoria) e pesa solo sul
   "Totale effettivo con crediti e debiti", non sul totale dei conti. */
function mountOtherPaid(node, afterRow, {type, amount, existing, preset, onChange}){
  const op=existing?.otherPaid||null;
  let on=!!op||!!preset?.otherPaid;
  let person=op?.person||preset?.person||state.lastOtherPayer||payableAccounts()[0]?.person||"";
  let mode=op?(op.pct===100?"all":op.pct===50?"half":"pct"):"all", pctVal=op?.pct||50;
  const row=document.createElement("div");
  row.className="field-row shared-field other-paid-field";
  row.innerHTML=`<button type="button" class="shared-switch" aria-pressed="false"><span class="shared-knob" aria-hidden="true"></span><span class="shared-switch-text"><strong>Pagata da un'altra persona</strong><small>Non esce dai tuoi conti: la tua parte la devi a lui/lei</small></span></button>
    <div class="shared-box" hidden>
      <label>Chi ha pagato</label>
      <div class="chip-row other-people"></div>
      <input type="text" class="text-input other-new" maxlength="30" placeholder="Nuova persona, es. Marco" autocomplete="off">
      <label class="shared-lbl">Quanto è tuo</label>
      <div class="type-toggle three other-mode"><button type="button" class="type-opt" data-m="all">Tutto mio</button><button type="button" class="type-opt" data-m="half">Metà</button><button type="button" class="type-opt" data-m="pct">Percentuale</button></div>
      <div class="split-custom" hidden><span class="sc-me"></span><input type="range" min="5" max="95" step="5" aria-label="La tua quota in percentuale"><span class="sc-other"></span></div>
      <p class="field-hint other-hint"></p>
    </div>`;
  afterRow.after(row);
  const sw=row.querySelector(".shared-switch"), box=row.querySelector(".shared-box"), people=row.querySelector(".other-people"), newInput=row.querySelector(".other-new");
  const range=row.querySelector("input[type=range]"), custom=row.querySelector(".split-custom"), hint=row.querySelector(".other-hint");
  range.value=String(Math.min(95,Math.max(5,pctVal)));
  const myPct=()=>mode==="all"?100:mode==="half"?50:Number(range.value);
  const info=()=>({on:on&&type()==="expense",person:String(person||"").trim(),pct:myPct()});
  function refresh(silent){
    row.hidden=type()!=="expense";
    sw.classList.toggle("on",on); sw.setAttribute("aria-pressed",String(on)); box.hidden=!on;
    if(on){
      const names=[...new Set([...payableAccounts(),...receivableAccounts()].map(a=>a.person).filter(Boolean))];
      if(person && !names.some(n=>n.toLowerCase()===person.toLowerCase())) names.push(person);
      people.innerHTML=names.map(n=>`<button type="button" class="chip${n.toLowerCase()===String(person).toLowerCase()?" active":""}" data-person="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join("");
      people.querySelectorAll("[data-person]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();person=b.dataset.person;newInput.value="";refresh();}));
      row.querySelectorAll(".other-mode .type-opt").forEach(b=>b.classList.toggle("active",b.dataset.m===mode));
      custom.hidden=mode!=="pct";
      const p=myPct(), other=person||"l'altra persona";
      row.querySelector(".sc-me").textContent=`Tu ${p}%`; row.querySelector(".sc-other").textContent=`${100-p}% ${other}`;
      const amt=amount();
      if(!(amt>0)) hint.textContent=`Inserisci l'importo totale pagato da ${other}.`;
      else { const mine=Math.round(amt*p)/100; hint.textContent=`Tua spesa: ${fmt(mine)} · la devi a ${other} (da pagare). I tuoi conti non cambiano.`; }
    }
    if(!silent) onChange&&onChange(info());
  }
  sw.addEventListener("click",e=>{ e.stopPropagation(); on=!on; refresh(); if(on&&!person) newInput.focus(); });
  newInput.addEventListener("input",()=>{ const v=newInput.value.trim(); if(v) person=v; refresh(); newInput.focus(); });
  row.querySelectorAll(".other-mode .type-opt").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();mode=b.dataset.m;refresh();}));
  range.addEventListener("input",()=>refresh());
  node.addEventListener("input",e=>{ if(!row.contains(e.target)) refresh(true); });
  node.addEventListener("click",e=>{ if(!row.contains(e.target)) setTimeout(()=>refresh(true),0); });
  refresh();
  return {get:info,refresh,setOff:()=>{ if(on){ on=false; refresh(); } }};
}
/* Salva una spesa divisa / prestito: crea o aggiorna la riga di spesa (mia quota) e la riga "da ricevere". */
function saveSharedGroup({group,total,shared,fields}){
  const gid=group?.id||uid();
  let main=group?.main||null, share=group?.share||null;
  const drop=x=>{ if(x) state.transactions=state.transactions.filter(y=>y.id!==x.id); };
  if(!shared.on){
    if(!main){ main={id:uid()}; state.transactions.push(main); }
    Object.assign(main,{...fields,type:"expense",amount:total,toAccountId:null}); delete main.splitGroup;
    drop(share); return main;
  }
  const acc=ensureLoanAccount(shared.person,"recv");
  const mine=Math.round(total*shared.pct)/100, theirs=Math.round((total-mine)*100)/100;
  if(mine>0){ if(!main){ main={id:uid()}; state.transactions.push(main); } Object.assign(main,{...fields,type:"expense",amount:mine,toAccountId:null,splitGroup:gid}); }
  else { drop(main); main=null; }
  if(!share){ share={id:uid()}; state.transactions.push(share); }
  Object.assign(share,{date:fields.date,amount:theirs,type:"transfer",name:`${mine>0?"Quota di":"Prestito a"} ${acc.person}`,categoryId:null,loanCategoryId:fields.categoryId||null,accountId:fields.accountId,toAccountId:acc.id,note:fields.name||"",splitGroup:gid,splitShare:true,loanKind:"lend"});
  state.lastSharePerson=acc.person;
  return main||share;
}
/* ---------------- v1.13.0 — Rimborsi a rate e rimborso che chiude il prestito ----------------
   state.loanRates: rate ancora da ricevere/pagare, una riga per rata: {id,accId,date,amount,n,of}.
   - Le rate non toccano il saldo: si confermano con "Ricevuta"/"Pagata", che apre la restituzione già compilata.
   - Ogni restituzione registrata scala le rate in ordine di data (una rata pagata in parte resta con il residuo).
   - Quando il prestito arriva a zero (anche con un abbuono) le rate rimaste spariscono da sole.
   Abbuono: rimborso parziale che vale come totale. È una riga sul conto prestito (loanWriteOff) che
   azzera il residuo; non tocca i conti veri e non conta in Entrate/Uscite. */
const round2=v=>Math.round((Number(v)||0)*100)/100;
function isoAddDays(iso,days){ const d=new Date(iso+"T00:00:00"); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function isoAddMonths(iso,months){
  const d=new Date(iso+"T00:00:00"), day=d.getDate();
  const t=new Date(d.getFullYear(),d.getMonth()+months,1);
  const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  t.setDate(Math.min(day,last));
  return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`;
}
function shortDate(iso){ const [y,m,d]=iso.split("-"); return `${d}/${m}${y!==String(new Date().getFullYear())?"/"+y.slice(2):""}`; }
function daysFromToday(iso){ return Math.round((new Date(iso+"T00:00:00")-new Date(todayISO()+"T00:00:00"))/86400000); }
function rateWhen(iso){
  const n=daysFromToday(iso);
  if(n<0) return {text:`in ritardo di ${-n} ${-n===1?"giorno":"giorni"}`,late:true};
  if(n===0) return {text:"oggi",today:true};
  if(n===1) return {text:"domani"};
  if(n<=30) return {text:`fra ${n} giorni`};
  return {text:shortDate(iso)};
}
function loanOwed(acc){ if(!acc) return 0; const b=accountBalance(acc.id); return acc.receivable?b:-b; }
function ratesOf(accId){ return (state.loanRates||[]).filter(r=>r.accId===accId).sort((a,b)=>a.date.localeCompare(b.date)||(a.n||0)-(b.n||0)); }
function allPendingRates(){ return (state.loanRates||[]).filter(r=>loanAccount(r.accId)).sort((a,b)=>a.date.localeCompare(b.date)); }
/* Scala un pagamento dalle rate: prima quella scelta, poi in ordine di data. */
function allocateToRates(accId,amount,firstRateId){
  let rest=round2(amount); const covered=[];
  const list=ratesOf(accId);
  if(firstRateId){ const i=list.findIndex(r=>r.id===firstRateId); if(i>0) list.unshift(list.splice(i,1)[0]); }
  for(const r of list){
    if(rest<=0.004) break;
    if(rest>=r.amount-0.004){ covered.push({n:r.n||1,of:r.of||0,date:r.date,full:true}); rest=round2(rest-r.amount); state.loanRates=state.loanRates.filter(x=>x.id!==r.id); }
    else { covered.push({n:r.n||1,of:r.of||0,date:r.date,full:false}); r.amount=round2(r.amount-rest); rest=0; }
  }
  return covered;
}
function rateInfoLabel(info){
  if(!Array.isArray(info)||!info.length) return "";
  const lab=x=>`${x.full?"":"parte della "}rata ${x.n}${x.of?` di ${x.of}`:""}`;
  const t=info.map(lab).join(" + ");
  return t.charAt(0).toUpperCase()+t.slice(1);
}
/* Rate di prestiti chiusi o eliminati: si tolgono da sole. */
function pruneLoanRates(){
  if(!Array.isArray(state.loanRates)) state.loanRates=[];
  state.loanRates=state.loanRates.filter(r=>{ const a=loanAccount(r.accId); return a && loanOwed(a)>0.004 && r.amount>0.004; });
}
function rateRowEl(r,{showPerson=false,onPay}={}){
  const a=loanAccount(r.accId), w=rateWhen(r.date), recv=!!a?.receivable;
  const row=document.createElement("div");
  row.className="loan-rate-row"+(w.late?" late":"")+(w.today?" today":"");
  row.innerHTML=`<span class="loan-rate-dot" aria-hidden="true">${recv?"↩️":"💸"}</span>
    <span class="loan-rate-text"><strong>${showPerson?`${escapeHtml(a?.person||"")} · `:""}Rata ${r.n||1}${r.of?` di ${r.of}`:""}</strong><span>${escapeHtml(shortDate(r.date))} · ${escapeHtml(w.text)}</span></span>
    <span class="loan-rate-amt">${balancesHidden?"••••":fmt(r.amount)}</span>
    <button type="button" class="loan-rate-pay">${recv?"Ricevuta":"Pagata"}</button>`;
  row.querySelector(".loan-rate-pay").addEventListener("click",e=>{ e.stopPropagation(); onPay?onPay(r):payRate(r); });
  return row;
}
function payRate(r){
  const a=loanAccount(r.accId); if(!a) return;
  openLoanForm(null,{mode:a.receivable?"repayIn":"repayOut",person:a.person,rateId:r.id,amount:r.amount});
}
/* Editor delle rate: numero, frequenza, date e importi; l'ultima rata assorbe le differenze. */
function mountRatesEditor(box,{total,existing=null,kind="recv"}){
  let n=existing?.length||2, freq=existing?.length?"free":"monthly";
  let rows=existing?.length?existing.map(r=>({date:r.date,amount:r.amount})):[];
  let first=rows[0]?.date||isoAddDays(todayISO(),1);
  let touched=new Set();
  box.innerHTML=`<div class="rate-head">
      <div><label>Numero di rate</label><div class="rate-count"><button type="button" data-d="-1" aria-label="Una rata in meno">−</button><strong class="rate-n-val">2</strong><button type="button" data-d="1" aria-label="Una rata in più">+</button></div></div>
    </div>
    <div class="type-toggle three rate-freq"><button type="button" class="type-opt" data-f="weekly">Ogni settimana</button><button type="button" class="type-opt" data-f="monthly">Ogni mese</button><button type="button" class="type-opt" data-f="free">Date libere</button></div>
    <div class="rate-rows"></div>
    <p class="field-hint rate-sum"></p>`;
  const rowsBox=box.querySelector(".rate-rows"), sumEl=box.querySelector(".rate-sum");
  function regenDates(){
    if(freq==="free"){ while(rows.length<n) rows.push({date:isoAddMonths(rows[rows.length-1]?.date||first,rows.length?1:0),amount:0}); rows.length=n; return; }
    rows=Array.from({length:n},(_,i)=>({date:freq==="weekly"?isoAddDays(first,7*i):isoAddMonths(first,i),amount:rows[i]?.amount||0}));
  }
  function rebalance(){
    const tot=round2(total());
    if(!touched.size){ const base=Math.floor(tot/n*100)/100; rows.forEach((r,i)=>r.amount=i<n-1?base:round2(tot-base*(n-1))); return; }
    const lastFree=[...rows.keys()].reverse().find(i=>!touched.has(i));
    if(lastFree==null) return;
    const others=rows.reduce((s,r,i)=>i===lastFree?s:s+r.amount,0);
    rows[lastFree].amount=Math.max(0,round2(tot-others));
  }
  function paintSum(){
    const tot=round2(total()), sum=round2(rows.reduce((s,r)=>s+r.amount,0));
    sumEl.classList.toggle("warn",Math.abs(sum-tot)>0.004);
    sumEl.textContent=!(tot>0)?"Inserisci l'importo.":Math.abs(sum-tot)<=0.004?`${n} rate da ${kind==="recv"?"ricevere":"pagare"} · totale ${fmt(sum)} ✓`:sum<tot?`Le rate coprono ${fmt(sum)}: mancano ${fmt(round2(tot-sum))}.`:`Le rate superano l'importo di ${fmt(round2(sum-tot))}.`;
  }
  function paint(){
    box.querySelector(".rate-n-val").textContent=String(n);
    box.querySelectorAll(".rate-freq .type-opt").forEach(b=>b.classList.toggle("active",b.dataset.f===freq));
    rowsBox.innerHTML="";
    rows.forEach((r,i)=>{
      const el=document.createElement("div"); el.className="rate-row";
      el.innerHTML=`<span class="rate-idx">${i+1}ª</span><input type="date" class="text-input" value="${r.date}" aria-label="Data rata ${i+1}"><span class="rate-cur">€</span><input type="text" inputmode="decimal" class="text-input rate-amt" value="${String(r.amount.toFixed(2)).replace(".",",")}" aria-label="Importo rata ${i+1}">`;
      const [d,a]=el.querySelectorAll("input");
      d.addEventListener("change",()=>{ if(!d.value) return; r.date=d.value; if(i===0&&freq!=="free"){ first=d.value; regenDates(); } else if(i>0) freq="free"; paint(); });
      a.addEventListener("change",()=>{ r.amount=Math.max(0,round2(parseAmount(a.value))); touched.add(i); if(touched.size>=n) touched.delete(n-1===i?n-2:n-1); rebalance(); paint(); });
      rowsBox.appendChild(el);
    });
    paintSum();
  }
  box.querySelectorAll(".rate-count [data-d]").forEach(b=>b.addEventListener("click",()=>{ n=Math.max(1,Math.min(36,n+Number(b.dataset.d))); touched=new Set([...touched].filter(i=>i<n-1)); regenDates(); rebalance(); paint(); }));
  box.querySelectorAll(".rate-freq .type-opt").forEach(b=>b.addEventListener("click",()=>{ freq=b.dataset.f; if(freq!=="free"){ first=rows[0]?.date||first; regenDates(); } paint(); }));
  if(!rows.length) regenDates();
  if(!existing?.length) rebalance();
  paint();
  return {
    refresh(){ rebalance(); paint(); },
    get(){ return rows.map((r,i)=>({date:r.date,amount:round2(r.amount),n:i+1,of:rows.length})); },
    check(){ const tot=round2(total()), sum=round2(rows.reduce((s,r)=>s+r.amount,0)); if(rows.some(r=>!r.date||!(r.amount>0))) return "Ogni rata deve avere data e importo"; if(Math.abs(sum-tot)>0.004) return "Il totale delle rate deve essere uguale all'importo"; return ""; }
  };
}
function saveRatesFor(accId,list,{replace=false}={}){
  if(!Array.isArray(state.loanRates)) state.loanRates=[];
  if(replace) state.loanRates=state.loanRates.filter(r=>r.accId!==accId);
  list.forEach(r=>state.loanRates.push({id:uid(),accId,date:r.date,amount:r.amount,n:r.n,of:r.of}));
}
function openLoanPlan(accId){
  const a=loanAccount(accId); if(!a) return;
  openSheet("tpl-loan-plan",(node,close)=>{
    const owed=round2(loanOwed(a)), existing=ratesOf(accId);
    node.querySelector("#loanPlanTitle").textContent=`📅 Rate · ${a.person}`;
    node.querySelector("#loanPlanIntro").textContent=owed>0
      ?`${a.receivable?`${a.person} ti deve`:`Devi a ${a.person}`} ${fmt(owed)}. Dividi il residuo in rate: le confermi tu quando arrivano, e il saldo si aggiorna da solo.`
      :"Il prestito è già chiuso: non ci sono rate da pianificare.";
    const ed=mountRatesEditor(node.querySelector("#loanPlanBox"),{total:()=>owed,existing,kind:a.receivable?"recv":"pay"});
    const del=node.querySelector("#deleteLoanPlanBtn");
    del.hidden=!existing.length;
    del.addEventListener("click",()=>{ state.loanRates=state.loanRates.filter(r=>r.accId!==accId); persist(); renderAll(); close(); showToast("Rate tolte"); });
    node.querySelector("#saveLoanPlanBtn").addEventListener("click",()=>{
      if(!(owed>0)){ close(); return; }
      const err=ed.check(); if(err){ showToast(err); return; }
      saveRatesFor(accId,ed.get(),{replace:true}); persist(); renderAll(); close(); showToast("Rate salvate");
    });
  });
}
/* v1.14.0 — Pallino sulla scheda Conti quando una rata è in ritardo da più di 3 giorni. */
function renderLateRatesBadge(){
  const tab=document.querySelector('.tabbar .tab[data-view="accounts"]'); if(!tab) return;
  const late=allPendingRates().filter(r=>daysFromToday(r.date)< -3).length;
  let dot=tab.querySelector(".tab-late-badge");
  if(!late){ dot?.remove(); tab.removeAttribute("data-late"); return; }
  if(!dot){ dot=document.createElement("span"); dot.className="tab-late-badge"; tab.appendChild(dot); }
  dot.textContent=String(late); tab.setAttribute("data-late",String(late));
  dot.setAttribute("aria-label",`${late} ${late===1?"rata in ritardo":"rate in ritardo"}`);
}
function renderLoanUpcoming(){
  const wrap=document.getElementById("loanUpcomingWrap"), box=document.getElementById("loanUpcomingList");
  if(!wrap||!box) return;
  const list=allPendingRates().slice(0,6);
  wrap.hidden=!list.length; box.innerHTML="";
  list.forEach(r=>{ const row=rateRowEl(r,{showPerson:true}); row.addEventListener("click",()=>openLoanPerson(r.accId)); box.appendChild(row); });
}
function renderHomeLoanRates(){
  const box=document.getElementById("upcomingHomeList"); if(!box) return;
  const limit=isoAddDays(todayISO(),30);
  const list=allPendingRates().filter(r=>r.date<=limit).slice(0,3);
  list.forEach(r=>{ const row=rateRowEl(r,{showPerson:true}); row.classList.add("home-rate"); row.addEventListener("click",()=>{ switchView("accounts"); setAccountsMode("loans"); openLoanPerson(r.accId); }); box.appendChild(row); });
  const empty=document.getElementById("upcomingHomeEmpty"); if(empty&&list.length) empty.hidden=true;
}

const LOAN_MODES={
  lend:{title:"Ho prestato",kind:"recv",person:"A chi hai prestato",account:"Dal conto"},
  repayIn:{title:"Mi hanno restituito",kind:"recv",person:"Chi ti ha restituito",account:"Sul conto"},
  borrow:{title:"Ho ricevuto un prestito",kind:"pay",person:"Da chi (persona, banca o finanziaria)",account:"Sul conto"},
  repayOut:{title:"Ho restituito / rata",kind:"pay",person:"A chi",account:"Dal conto"},
};
function loanModeOf(t){
  if(t.loanOld) return t.loanKind==="borrow"?"borrow":"lend";
  const from=loanAccount(t.accountId), to=loanAccount(t.toAccountId);
  return to?.receivable?"lend":from?.receivable?"repayIn":from?.payable?"borrow":to?.payable?"repayOut":null;
}
function openLoanForm(txId=null,preset={}){
  const existing=txId?state.transactions.find(t=>t.id===txId):null;
  if(existing?.splitGroup) return openAddTransaction(existing.id);
  let mode=existing?loanModeOf(existing):(preset.mode||"lend");
  let old=!!existing?.loanOld;
  let person=existing?(loanAccount(existing.accountId)||loanAccount(existing.toAccountId))?.person:(preset.person||"");
  let accId=existing?(loanAccount(existing.accountId)?existing.toAccountId:existing.accountId):(state.accounts.find(a=>a.id===state.mainAccountId&&!isLoanAccount(a))?.id||state.accounts.find(a=>!isLoanAccount(a))?.id||null);
  // v1.13.0: rimborso che vale come totale (abbuono) e piano a rate.
  const existingWO=existing?.settleGroup?state.transactions.find(x=>x.settleGroup===existing.settleGroup&&x.loanWriteOff):null;
  let closeOn=!!existingWO, ratesOn=false, ratesEd=null;
  const presetRate=preset.rateId?(state.loanRates||[]).find(r=>r.id===preset.rateId):null;
  openSheet("tpl-loan",(node,close)=>{
    const amountInput=node.querySelector("#loanAmountInput"), dateInput=node.querySelector("#loanDateInput"), noteInput=node.querySelector("#loanNoteInput");
    const peopleBox=node.querySelector("#loanPeople"), newPerson=node.querySelector("#loanNewPerson"), accBox=node.querySelector("#loanAccounts"), hint=node.querySelector("#loanHint");
    dateInput.value=existing?.date||todayISO(); dateInput.max=todayISO();
    if(existing){ amountInput.value=String(existing.amount).replace(".",","); noteInput.value=existing.note||""; }
    let amountTouched=!!existing;
    amountInput.addEventListener("input",()=>{ amountTouched=true; paint(); });
    autoGrowAmountInput(amountInput);
    function owedBy(p,kind){ const a=(kind==="pay"?payableAccounts():receivableAccounts()).find(x=>x.person.toLowerCase()===String(p).toLowerCase()); if(!a) return 0; const b=accountBalance(a.id); return kind==="pay"?-b:b; }
    // Quanto era dovuto prima di questo movimento (in modifica tolgo il movimento stesso e il suo abbuono).
    function owedBefore(p,kind){
      let o=owedBy(p,kind);
      if(existing&&(mode==="repayIn"||mode==="repayOut")&&!existing.loanOld){ const a=loanAccount(existing.accountId)||loanAccount(existing.toAccountId); if(a&&a.person.toLowerCase()===String(p).toLowerCase()) o+=Number(existing.amount||0)+Number(existingWO?.amount||0); }
      return round2(o);
    }
    const closeSw=node.querySelector("#loanCloseSwitch"), ratesSw=node.querySelector("#loanRatesSwitch"), ratesBox=node.querySelector("#loanRatesBox");
    closeSw.addEventListener("click",()=>{ closeOn=!closeOn; paint(); });
    // v1.26.0: cifra inferiore al dovuto → scegli se il resto resta aperto o è abbuonato
    node.querySelectorAll("#loanRest [data-r]").forEach(b=>b.addEventListener("click",()=>{ closeOn=b.dataset.r==="close"; paint(); }));
    ratesSw.addEventListener("click",()=>{ ratesOn=!ratesOn; if(ratesOn&&!ratesEd) ratesEd=mountRatesEditor(ratesBox,{total:()=>parseAmount(amountInput.value),kind:LOAN_MODES[mode].kind}); paint(); });
    amountInput.addEventListener("change",()=>{ if(ratesEd) ratesEd.refresh(); });
    function paint(){
      const m=LOAN_MODES[mode];
      node.querySelector("#loanTitle").textContent=m.kind==="pay"?"Debito":"Prestito";
      node.querySelectorAll("#loanModes [data-mode]").forEach(b=>{ b.classList.toggle("active",b.dataset.mode===mode); b.disabled=!!existing&&b.dataset.mode!==mode&&LOAN_MODES[b.dataset.mode].kind!==m.kind; });
      node.querySelector("#loanPersonLabel").textContent=m.person;
      node.querySelector("#loanAccountLabel").textContent=m.account;
      // Prestito vecchio: solo per "Ho prestato" e "Ho ricevuto un prestito"; niente conto.
      const oldSw=node.querySelector("#loanOldSwitch"), canOld=mode==="lend"||mode==="borrow";
      if(!canOld) old=false;
      oldSw.hidden=!canOld; oldSw.classList.toggle("on",old); oldSw.setAttribute("aria-pressed",String(old));
      oldSw.querySelector("strong").textContent=mode==="borrow"?"Debito vecchio, fuori saldo":"Prestito vecchio, fuori saldo";
      oldSw.querySelector("small").textContent=mode==="borrow"?"Lo segno solo come debito: non aggiunge soldi ai conti di oggi":"Lo segno solo come credito: non toglie soldi dai conti di oggi";
      accBox.closest(".field-row").hidden=old;
      const list=(m.kind==="pay"?payableAccounts():receivableAccounts()).map(a=>({p:a.person,owed:owedBy(a.person,m.kind)}));
      if(person && !list.some(x=>x.p.toLowerCase()===person.toLowerCase())) list.push({p:person,owed:0});
      peopleBox.innerHTML=list.map(x=>`<button type="button" class="chip${x.p.toLowerCase()===String(person).toLowerCase()?" active":""}" data-p="${escapeHtml(x.p)}">${escapeHtml(x.p)}${Math.abs(x.owed)>=0.005?`<span class="chip-amt">${balancesHidden?"••••":fmt(x.owed)}</span>`:""}</button>`).join("");
      peopleBox.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>{ person=b.dataset.p; newPerson.value=""; autoAmount(); paint(); }));
      accBox.innerHTML="";
      state.accounts.filter(a=>!isLoanAccount(a)).forEach(a=>{
        const c=document.createElement("button"); c.type="button"; c.className="chip"+(a.id===accId?" active":"");
        c.innerHTML=`<span class="em">●</span>${escapeHtml(a.name)}`; c.querySelector(".em").style.color=safeColor(a.color);
        c.addEventListener("click",()=>{ accId=a.id; paint(); }); accBox.appendChild(c);
      });
      const amt=parseAmount(amountInput.value), owed=person?owedBefore(person,m.kind):0;
      const isRepay=mode==="repayIn"||mode==="repayOut";
      const residual=round2(owed-amt), canClose=isRepay&&!old&&!!person&&amt>0&&residual>0.004;
      closeSw.hidden=true;
      { const rr=node.querySelector("#loanRestRow"); rr.hidden=!canClose;
        if(canClose){ const sh=fmt(Math.max(residual,0));
          node.querySelector("#loanRestLabel").textContent=m.kind==="recv"?`Hai ricevuto meno di quanto ti deve: la differenza di ${sh}`:`Paghi meno di quanto devi: la differenza di ${sh}`;
          rr.querySelector('[data-r="keep"] b').textContent=m.kind==="recv"?"Resta da ricevere":"Resta da pagare";
          rr.querySelector('[data-r="close"] b').textContent=m.kind==="recv"?"Ci rinuncio":"Me la abbuona";
          node.querySelector("#loanRestKeepAmt").textContent=m.kind==="recv"?`${person} ti dovrà ${sh}`:`dovrai ancora ${sh}`;
          node.querySelector("#loanRestCloseAmt").textContent="abbuono, si chiude";
          rr.querySelectorAll("[data-r]").forEach(b=>b.classList.toggle("active",(b.dataset.r==="close")===!!closeOn)); } }
      const closing=canClose&&closeOn;
      closeSw.classList.toggle("on",closing); closeSw.setAttribute("aria-pressed",String(closing));
      closeSw.querySelector("strong").textContent=m.kind==="recv"?"Vale come rimborso totale":"Vale come pagamento totale";
      closeSw.querySelector("small").textContent=m.kind==="recv"?`Chiude il prestito: abbuoni ${fmt(Math.max(residual,0))}`:`Chiude il debito: ti abbuonano ${fmt(Math.max(residual,0))}`;
      const canRates=(mode==="lend"||mode==="borrow")&&!existing;
      if(!canRates) ratesOn=false;
      ratesSw.hidden=!canRates; ratesSw.classList.toggle("on",ratesOn); ratesSw.setAttribute("aria-pressed",String(ratesOn));
      ratesSw.querySelector("small").textContent=m.kind==="recv"?"Pianifica quando e quanto ti restituiranno":"Pianifica quando e quanto restituirai";
      ratesBox.hidden=!ratesOn;
      const after=mode==="lend"||mode==="borrow"?owed+amt:closing?0:residual;
      const rateNote=presetRate&&isRepay?`Rata ${presetRate.n||1}${presetRate.of?` di ${presetRate.of}`:""} prevista il ${shortDate(presetRate.date)}. `:"";
      if(!person) hint.textContent="Scegli o scrivi la persona.";
      else if(closing) hint.textContent=m.kind==="recv"?`${rateNote}Ricevi ${fmt(amt)}, abbuoni ${fmt(residual)}: il prestito con ${person} si chiude.`:`${rateNote}Paghi ${fmt(amt)}, ti abbuonano ${fmt(residual)}: il debito con ${person} si chiude.`;
      else if(isRepay&&amt>0&&residual>0.004) hint.textContent=m.kind==="recv"?`${rateNote}Rimborso parziale: ${person} ti dovrà ancora ${fmt(residual)}.`:`${rateNote}Pagamento parziale: dovrai ancora ${fmt(residual)} a ${person}.`;
      else hint.textContent=m.kind==="recv"?`${rateNote}Dopo questo movimento ${person} ti deve ${fmt(Math.max(after,0))}${after<-0.004?` (ti ha dato ${fmt(-after)} in più)`:""}.`:`${rateNote}Dopo questo movimento devi a ${person} ${fmt(Math.max(after,0))}.`;
    }
    function autoAmount(){
      if(amountTouched||existing) return;
      if(presetRate&&(mode==="repayIn"||mode==="repayOut")&&person===preset.person){ amountInput.value=String(round2(presetRate.amount)).replace(".",","); return; }
      if(mode==="repayIn"||mode==="repayOut"){ const o=person?owedBy(person,LOAN_MODES[mode].kind):0; amountInput.value=o>0?String(Math.round(o*100)/100).replace(".",","):""; }
    }
    newPerson.addEventListener("input",()=>{ const v=newPerson.value.trim(); if(v){ person=v; } paint(); newPerson.focus(); });
    node.querySelectorAll("#loanModes [data-mode]").forEach(b=>b.addEventListener("click",()=>{ if(b.disabled) return; const k=LOAN_MODES[mode].kind; mode=b.dataset.mode; if(LOAN_MODES[mode].kind!==k&&!existing) person=""; autoAmount(); paint(); }));
    node.querySelector("#loanOldSwitch").addEventListener("click",()=>{ old=!old; paint(); });
    const regrow=()=>fitAmountInput(amountInput);
    const autoAmount0=autoAmount; autoAmount=function(){ autoAmount0(); regrow(); };
    autoAmount(); paint();
    const del=node.querySelector("#deleteLoanBtn");
    if(existing){
      del.hidden=false;
      del.addEventListener("click",async()=>{
        if(!await askConfirm("Eliminare questo movimento del prestito?",{ok:"Elimina",danger:true})) return;
        const linked=linkedTx(existing);
        moveToTrash("transaction",existing,linked); const trashId=state.trash[0]?.id;
        const ids=new Set([existing.id,...linked.map(x=>x.id)]);
        state.transactions=state.transactions.filter(x=>!ids.has(x.id));
        pruneLoanRates();
        persist(); renderAll(); close(); if(trashId) showUndo("Movimento eliminato",trashId);
      });
    }
    node.querySelector("#saveLoanBtn").addEventListener("click",()=>{
      const amount=parseAmount(amountInput.value);
      const missing=[]; if(!(amount>0)) missing.push("importo"); if(!person) missing.push("persona"); if(!accId&&!old) missing.push("conto");
      if(missing.length){ showToast("Inserisci: "+missing.join(", ")); return; }
      if(dateInput.value>todayISO()){ showToast("Il movimento non può avere una data futura"); return; }
      if(ratesOn&&ratesEd){ const err=ratesEd.check(); if(err){ showToast(err); return; } }
      const isRepay=mode==="repayIn"||mode==="repayOut";
      const owedPrev=person?owedBefore(person,LOAN_MODES[mode].kind):0;
      const m=LOAN_MODES[mode], la=ensureLoanAccount(person,m.kind);
      const out=mode==="lend"||mode==="repayOut";
      const t=existing||{id:uid()};
      if(old){
        // Fuori saldo: rettifica sul conto prestito, i conti veri non cambiano e non entra nelle statistiche.
        Object.assign(t,{date:dateInput.value||todayISO(),amount,type:mode==="lend"?"income":"expense",categoryId:null,accountId:la.id,toAccountId:null,note:noteInput.value.trim(),loanKind:mode,loanOld:true,isBalanceAdjustment:true,
          name:mode==="lend"?`Prestito a ${la.person} (vecchio)`:`Debito con ${la.person} (vecchio)`});
      } else {
        Object.assign(t,{date:dateInput.value||todayISO(),amount,type:"transfer",categoryId:null,accountId:out?accId:la.id,toAccountId:out?la.id:accId,note:noteInput.value.trim(),loanKind:mode});
        delete t.loanOld; delete t.isBalanceAdjustment;
        t.name=transferName(t.accountId,t.toAccountId);
      }
      if(!existing) state.transactions.push(t);
      // Abbuono: il rimborso parziale vale come totale e azzera il residuo.
      let wo=t.settleGroup?state.transactions.find(x=>x.settleGroup===t.settleGroup&&x.loanWriteOff):null;
      const residual=round2(owedPrev-amount);
      if(isRepay&&!old&&closeOn&&residual>0.004){
        const gid=t.settleGroup||uid(); t.settleGroup=gid;
        if(!wo){ wo={id:uid()}; state.transactions.push(wo); }
        Object.assign(wo,{date:t.date,amount:residual,type:m.kind==="recv"?"expense":"income",categoryId:null,accountId:la.id,toAccountId:null,note:"",
          isBalanceAdjustment:true,loanWriteOff:true,settleGroup:gid,loanKind:m.kind==="recv"?"writeOffIn":"writeOffOut",name:m.kind==="recv"?`Abbuono a ${la.person}`:`Abbuono da ${la.person}`});
      } else {
        if(wo) state.transactions=state.transactions.filter(x=>x.id!==wo.id);
        delete t.settleGroup;
      }
      balanceCache.clear();
      // Rate: un nuovo prestito con piano; una restituzione scala le rate in ordine.
      if(ratesOn&&ratesEd&&!existing) saveRatesFor(la.id,ratesEd.get());
      if(isRepay&&!existing){ const cov=allocateToRates(la.id,amount,preset.rateId); if(cov.length) t.rateInfo=cov; }
      if(isRepay&&closeOn) state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==la.id);
      pruneLoanRates();
      // v1.25.0: arrivato da "Elimina persona" → se ora il saldo è zero la persona sparisce.
      let archived=false;
      if(preset.archiveAfter){ const ax=state.accounts.find(x=>x.id===preset.archiveAfter); if(ax&&Math.abs(accountBalance(ax.id))<0.005){ archiveLoanAccount(ax); archived=true; } }
      persist(); renderAll(); close();
      showToast(archived?`Saldo registrato: ${la.person} eliminato`:existing?"Movimento aggiornato":isRepay&&closeOn&&residual>0.004?"Registrato: prestito chiuso":ratesOn?"Registrato con le rate":"Registrato");
    });
  });
}
function openLoanPerson(accId){
  openSheet("tpl-loan-person",(node,close)=>{
    function paint(){
      if(!node.isConnected) return;
      const a=state.accounts.find(x=>x.id===accId); if(!a){ close(); return; }
      const recv=!!a.receivable, bal=accountBalance(a.id), owed=recv?bal:-bal;
      node.querySelector("#loanPersonTitle").textContent=`${recv?"🤝":"🏦"} ${a.person}`;
      node.querySelector("#loanPersonWho").textContent=Math.abs(owed)<0.005?"Siete in pari":recv?(owed>0?`${a.person} ti deve`:`Hai ricevuto in più da ${a.person}`):(owed>0?`Devi a ${a.person}`:`${a.person} ti deve restituire`);
      const amt=node.querySelector("#loanPersonAmount"); amt.textContent=balancesHidden?"••••":fmt(Math.abs(owed)); amt.style.color=Math.abs(owed)<0.005?"var(--ink)":recv?"#8E7CC3":"#C9785C";
      const p=node.querySelector("#loanPersonPrimary"), s=node.querySelector("#loanPersonSecondary");
      p.textContent=recv?"↩️ Registra restituzione":"💸 Paga / restituisci"; s.textContent=recv?"＋ Prestito":"＋ Debito";
      const list=state.transactions.filter(t=>t.accountId===a.id||t.toAccountId===a.id).sort((x,y)=>y.date.localeCompare(x.date)||String(y.id).localeCompare(String(x.id)));
      renderTxRows(node.querySelector("#loanPersonTx"),list);
      const paid=list.filter(t=>Array.isArray(t.rateInfo)&&t.rateInfo.length).sort((x,y)=>x.date.localeCompare(y.date));
      const pbox=node.querySelector("#loanPersonPaid");
      node.querySelector("#loanPersonPaidWrap").hidden=!paid.length;
      pbox.innerHTML=paid.map(t=>`<div class="loan-rate-row paid"><span class="loan-rate-dot" aria-hidden="true">✅</span><span class="loan-rate-text"><strong>${escapeHtml(rateInfoLabel(t.rateInfo))}</strong><span>${recv?"ricevuta":"pagata"} il ${escapeHtml(shortDate(t.date))}${t.rateInfo[0]?.date&&t.rateInfo[0].date<t.date?` · prevista il ${escapeHtml(shortDate(t.rateInfo[0].date))}`:""}</span></span><span class="loan-rate-amt">${balancesHidden?"••••":fmt(t.amount)}</span></div>`).join("");
      const rates=ratesOf(a.id), rbox=node.querySelector("#loanPersonRates");
      node.querySelector("#loanPersonRatesWrap").hidden=!rates.length;
      rbox.innerHTML=""; rates.forEach(r=>rbox.appendChild(rateRowEl(r,{onPay:r=>{ close(); payRate(r); }})));
      const planBtn=node.querySelector("#loanPersonPlan");
      planBtn.hidden=Math.abs(owed)<0.005&&!rates.length;
      planBtn.textContent="📅 Rate"; planBtn.setAttribute("aria-label",rates.length?"Modifica rate":"Rate");
      // v1.26.0: l'altra parte (se con la stessa persona ci sono sia crediti che debiti) e il netto
      const pp=personPosition(a.person), oth=node.querySelector(".loan-person-other"), sb=node.querySelector(".loan-person-settle");
      if(sb) sb.hidden=Math.abs(pp.credit)<0.005&&Math.abs(pp.debt)<0.005;
      if(oth){
        const both=Math.abs(pp.credit)>=0.005&&Math.abs(pp.debt)>=0.005;
        oth.hidden=!both;
        if(both){ const sh=v=>balancesHidden?"••••":fmt(v);
          oth.innerHTML=`<span>${recv?"Inoltre gli devi":"Inoltre ti deve"} <b>${sh(recv?pp.debt:pp.credit)}</b></span><span>Netto: <b>${Math.abs(pp.net)<0.005?"siete in pari":pp.net>0?`ti deve ${sh(pp.net)}`:`gli devi ${sh(-pp.net)}`}</b></span>`; }
      }
    }
    node.querySelector("#loanPersonPrimary").addEventListener("click",()=>{ const a=state.accounts.find(x=>x.id===accId); close(); openLoanForm(null,{mode:a.receivable?"repayIn":"repayOut",person:a.person}); });
    node.querySelector("#loanPersonSecondary").addEventListener("click",()=>{ const a=state.accounts.find(x=>x.id===accId); close(); openLoanForm(null,{mode:a.receivable?"lend":"borrow",person:a.person}); });
    node.querySelector("#loanPersonPlan").addEventListener("click",()=>{ close(); openLoanPlan(accId); });
    // v1.25.0 — spesa pagata da questa persona ed eliminazione della persona
    {
      const a0=state.accounts.find(x=>x.id===accId);
      const row=node.querySelector(".loan-person-actions-row");
      // v1.26.0: pareggia in un colpo crediti e debiti con questa persona
      const ob=document.createElement("button"); ob.type="button"; ob.className="pill-btn loan-person-settle"; ob.textContent="⚖️ Pareggia"; ob.setAttribute("aria-label","Pareggia i conti");
      ob.addEventListener("click",()=>settlePerson(a0?.person,close));
      row?.appendChild(ob);
      const other=document.createElement("p"); other.className="loan-person-other"; other.hidden=true;
      node.querySelector("#loanPersonAmount")?.after(other);
      const del=document.createElement("button"); del.type="button"; del.className="text-danger-btn loan-person-delete"; del.textContent="Elimina persona";
      del.addEventListener("click",()=>deleteLoanPerson(accId,close));
      node.querySelector(".sheet")?.appendChild(del) || node.appendChild(del);
    }
    loanPersonRefresh=paint;
    paint();
  });
}
var loanPersonRefresh=null;
/* v1.25.0 — Eliminare una persona.
   - In pari (saldo 0): si elimina subito; i movimenti passati restano nello storico (il conto viene archiviato).
   - Con un saldo aperto si sceglie come chiuderlo prima:
       💶 "Registra il saldo": apre la restituzione già compilata; a salvataggio fatto la persona sparisce;
       ✅ "Abbuona": il residuo viene azzerato senza muovere soldi (riga "Abbuono"), poi la persona sparisce. */
function archiveLoanAccount(a){
  a.archived=true;
  state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==a.id);
}
function chooseAction(title,text,options){
  return new Promise(resolve=>{
    document.getElementById("movementActionOverlay")?.remove();
    const overlay=document.createElement("div");
    overlay.id="movementActionOverlay"; overlay.className="movement-action-overlay";
    overlay.innerHTML=`<div class="movement-action-menu choose-menu" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="movement-action-handle" aria-hidden="true"></div>
      <div class="movement-action-title">${escapeHtml(title)}</div><p class="choose-text">${escapeHtml(text)}</p>
      <div class="choose-list">${options.map((o,i)=>`<button type="button" class="choose-opt${o.danger?" danger":""}" data-i="${i}"><span class="choose-ic" aria-hidden="true">${o.icon||""}</span><span class="choose-tx"><b>${escapeHtml(o.label)}</b>${o.hint?`<small>${escapeHtml(o.hint)}</small>`:""}</span></button>`).join("")}</div>
      <button type="button" class="movement-action-cancel">Annulla</button></div>`;
    const done=v=>{ overlay.remove(); resolve(v); };
    overlay.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",()=>done(options[Number(b.dataset.i)].value)));
    overlay.querySelector(".movement-action-cancel").addEventListener("click",()=>done(null));
    overlay.addEventListener("click",e=>{ if(e.target===overlay) done(null); });
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add("show"));
  });
}
async function deleteLoanPerson(accId,closeSheet){
  const a=state.accounts.find(x=>x.id===accId); if(!a) return;
  const recv=!!a.receivable, bal=round2(accountBalance(a.id)), owed=recv?bal:-bal;
  const show=v=>balancesHidden?"••••":fmt(v);
  if(Math.abs(bal)<0.005){
    if(!await askConfirm(`Eliminare ${a.person}? Siete in pari: i movimenti passati restano nello storico.`,{ok:"Elimina",danger:true})) return;
    archiveLoanAccount(a); balanceCache.clear(); persist(); renderAll(); closeSheet&&closeSheet();
    showToast(`${a.person} eliminato`); return;
  }
  const opts=[];
  if(owed>0) opts.push({value:"settle",icon:"💶",label:recv?`Mi ha restituito ${show(owed)}`:`Gli ho dato ${show(owed)}`,hint:recv?"Registra l'entrata sul conto che scegli, poi elimina":"Registra l'uscita dal conto che scegli, poi elimina"});
  opts.push({value:"writeoff",icon:"✅",label:recv?(owed>0?`Rinuncio a ${show(owed)}`:`Tengo i ${show(-owed)} in più`):(owed>0?`Me li abbuona (${show(owed)})`:`Rinuncio ai ${show(-owed)} in più`),hint:"Azzera il saldo senza muovere soldi dai conti, poi elimina"});
  const who=recv?(owed>0?`${a.person} ti deve ${show(owed)}`:`Hai ricevuto ${show(-owed)} in più da ${a.person}`):(owed>0?`Devi ${show(owed)} a ${a.person}`:`${a.person} ti deve restituire ${show(-owed)}`);
  const choice=await chooseAction(`Eliminare ${a.person}?`,`${who}. Come vuoi chiudere il saldo prima di eliminarlo?`,opts);
  if(!choice) return;
  if(choice==="settle"){
    closeSheet&&closeSheet();
    setTimeout(()=>openLoanForm(null,{mode:recv?"repayIn":"repayOut",person:a.person,archiveAfter:a.id}),250);
    return;
  }
  // Abbuono: riga fuori saldo sul conto prestito che porta il saldo a zero.
  state.transactions.push({id:uid(),date:todayISO(),amount:Math.abs(bal),type:bal>0?"expense":"income",categoryId:null,accountId:a.id,toAccountId:null,note:"Persona eliminata",
    isBalanceAdjustment:true,loanWriteOff:true,loanKind:recv?"writeOffIn":"writeOffOut",name:recv?`Abbuono a ${a.person}`:`Abbuono da ${a.person}`});
  archiveLoanAccount(a); balanceCache.clear(); persist(); renderAll(); closeSheet&&closeSheet();
  showToast(`Saldo chiuso con un abbuono: ${a.person} eliminato`);
}
/* v1.26.0 — Pareggiare i conti con una persona, tutto insieme.
   Una persona può avere sia un credito (Da ricevere) sia un debito (Da pagare).
   - ⚖️ Compensa: crediti e debiti si annullano tra loro fino alla cifra più piccola; nessun soldo si muove
     e il totale effettivo non cambia.
   - 💶 Salda il netto: compensa e apre il movimento per la differenza sul conto che scegli
     (con una cifra inferiore scegli se il resto resta aperto o è abbuonato).
   - 🧾 Fuori dai conti: azzera tutto con un abbuono; crediti e debiti escono dal totale effettivo. */
function personPosition(name){
  const n=String(name||"").toLowerCase();
  const recv=receivableAccounts().find(a=>String(a.person).toLowerCase()===n)||null;
  const pay=payableAccounts().find(a=>String(a.person).toLowerCase()===n)||null;
  const credit=recv?round2(accountBalance(recv.id)):0, debt=pay?round2(-accountBalance(pay.id)):0;
  return {recv,pay,credit,debt,net:round2(credit-debt)};
}
function loanAdjRow(acc,amount,gid,extra){
  // amount>0 riduce quanto è dovuto su quel conto prestito
  const recv=!!acc.receivable;
  const r={id:uid(),date:todayISO(),amount:round2(Math.abs(amount)),type:(recv?amount>0:amount<0)?"expense":"income",categoryId:null,accountId:acc.id,toAccountId:null,note:"",
    isBalanceAdjustment:true,loanWriteOff:true,settleGroup:gid,loanKind:recv?"writeOffIn":"writeOffOut",name:recv?`Abbuono a ${acc.person}`:`Abbuono da ${acc.person}`,...extra};
  state.transactions.push(r); return r;
}
function compensatePerson(pp){
  const m=round2(Math.min(pp.credit,pp.debt));
  if(!(m>0.004)||!pp.recv||!pp.pay) return 0;
  const gid=uid();
  loanAdjRow(pp.recv,m,gid,{loanOffset:true,loanKind:"offset",name:`Compensazione con ${pp.recv.person}`});
  loanAdjRow(pp.pay,m,gid,{loanOffset:true,loanKind:"offset",name:`Compensazione con ${pp.pay.person}`});
  balanceCache.clear();
  return m;
}
async function settlePerson(name,closeSheet){
  const pp=personPosition(name); if(!pp.recv&&!pp.pay) return;
  const sh=v=>balancesHidden?"••••":fmt(v), person=(pp.recv||pp.pay).person;
  const both=pp.credit>0.004&&pp.debt>0.004, m=round2(Math.min(pp.credit,pp.debt));
  const netTxt=Math.abs(pp.net)<0.005?"siete in pari":pp.net>0?`${person} ti deve ${sh(pp.net)}`:`devi ${sh(-pp.net)} a ${person}`;
  const parts=[]; if(Math.abs(pp.credit)>=0.005) parts.push(`ti deve ${sh(pp.credit)}`); if(Math.abs(pp.debt)>=0.005) parts.push(`gli devi ${sh(pp.debt)}`);
  const opts=[];
  if(both) opts.push({value:"offset",icon:"⚖️",label:`Compensa ${sh(m)}`,hint:`Crediti e debiti si annullano: poi ${netTxt}. Nessun soldo si muove.`});
  if(Math.abs(pp.net)>=0.005) opts.push({value:"pay",icon:"💶",label:pp.net>0?`Mi dà la differenza (${sh(pp.net)})`:`Gli do la differenza (${sh(-pp.net)})`,hint:`${both?"Compensa e registra":"Registra"} il movimento sul conto che scegli; se è una cifra inferiore decidi se il resto resta o è abbuonato.`});
  opts.push({value:"out",icon:"🧾",label:"Chiudi tutto fuori dai conti",hint:"Azzera crediti e debiti con un abbuono, senza muovere soldi: escono dal totale effettivo."});
  const choice=await chooseAction(`Pareggia con ${person}`,`${person}: ${parts.join(" e ")||"siete in pari"}. Netto: ${netTxt}.`,opts);
  if(!choice) return;
  if(choice==="offset"){
    compensatePerson(pp); persist(); renderAll();
    const after=personPosition(person);
    showToast(Math.abs(after.net)<0.005?`Compensato: con ${person} siete in pari`:`Compensato ${fmt(m)}: ${after.net>0?`ti deve ${fmt(after.net)}`:`gli devi ${fmt(-after.net)}`}`);
    return;
  }
  if(choice==="pay"){
    if(both){ compensatePerson(pp); persist(); renderAll(); }
    closeSheet&&closeSheet();
    setTimeout(()=>openLoanForm(null,{mode:pp.net>0?"repayIn":"repayOut",person}),250);
    return;
  }
  const gid=uid();
  if(Math.abs(pp.credit)>=0.005) loanAdjRow(pp.recv,pp.credit,gid,{note:"Pareggio fuori dai conti"});
  if(Math.abs(pp.debt)>=0.005) loanAdjRow(pp.pay,pp.debt,gid,{note:"Pareggio fuori dai conti"});
  state.loanRates=(state.loanRates||[]).filter(r=>r.accId!==pp.recv?.id&&r.accId!==pp.pay?.id);
  balanceCache.clear(); persist(); renderAll();
  showToast(`Chiuso fuori dai conti: con ${person} siete in pari`);
}
async function undoLoanSettle(t){
  const what=t.loanOffset?"questa compensazione":"questo abbuono";
  if(!await askConfirm(`Annullare ${what}? Il credito o il debito torna com'era.`,{ok:"Sì, annulla",cancel:"No",danger:true})) return;
  const linked=linkedTx(t).filter(x=>x.loanWriteOff);
  moveToTrash("transaction",t,linked); const trashId=state.trash[0]?.id;
  const ids=new Set([t.id,...linked.map(x=>x.id)]);
  const accs=new Set([t.accountId,...linked.map(x=>x.accountId)]);
  state.transactions=state.transactions.filter(x=>!ids.has(x.id));
  balanceCache.clear();
  accs.forEach(id=>{ const a=state.accounts.find(x=>x.id===id); if(a?.archived&&Math.abs(accountBalance(a.id))>=0.005) delete a.archived; });
  persist(); renderAll(); if(trashId) showUndo("Annullato",trashId);
}
let accountsMode="accounts";
function setAccountsMode(mode){
  accountsMode=mode==="loans"?"loans":"accounts";
  const ap=document.getElementById("accountsPane"), lp=document.getElementById("loansPane");
  if(ap) ap.hidden=accountsMode!=="accounts";
  if(lp) lp.hidden=accountsMode!=="loans";
  document.querySelectorAll("#accountsModeToggle [data-acc-mode]").forEach(b=>b.classList.toggle("active",b.dataset.accMode===accountsMode));
  renderLoans();
}
function renderLoans(){
  pruneLoanRates();
  const show=v=>balancesHidden?"••••":fmt(v);
  const inT=receivableTotal(), outT=payableTotal();
  const el=id=>document.getElementById(id);
  if(!el("loanSumIn")) return;
  el("loanSumIn").textContent=show(inT); el("loanSumOut").textContent=show(outT);
  const net=inT-outT; el("loanSumNet").textContent=balancesHidden?"••••":`${net>=0?"+":"−"}${fmt(Math.abs(net))}`; el("loanSumNet").style.color=moneyColor(net);
  const card=a=>{
    const bal=accountBalance(a.id), owed=a.receivable?bal:-bal;
    const last=state.transactions.filter(t=>t.accountId===a.id||t.toAccountId===a.id).reduce((m,t)=>t.date>m?t.date:m,"");
    const next=ratesOf(a.id)[0], nw=next?rateWhen(next.date):null;
    const b=document.createElement("button"); b.type="button"; b.className="loan-person"+(Math.abs(owed)<0.005?" settled":"");
    b.innerHTML=`<span class="loan-av" style="background:${a.receivable?"#8E7CC3":"#C9785C"}">${escapeHtml((a.person||"?").trim()[0]||"?").toUpperCase()}</span>
      <span class="loan-person-text"><strong>${escapeHtml(a.person)}</strong><span>${Math.abs(owed)<0.005?"In pari":a.receivable?"ti deve":"devi"}${next?` · <em class="${nw.late?"late":""}">rata ${nw.late?nw.text:shortDate(next.date)}</em>`:last?` · ultimo ${last.split("-").reverse().slice(0,2).join("/")}`:""}</span></span>
      <span class="loan-person-amt">${Math.abs(owed)<0.005?fmt(0):show(Math.abs(owed))}</span><span class="chev" aria-hidden="true">›</span>`;
    b.addEventListener("click",()=>openLoanPerson(a.id));
    return b;
  };
  const sortBy=(arr,sign)=>arr.slice().sort((x,y)=>sign*accountBalance(y.id)-sign*accountBalance(x.id));
  const rl=el("loanRecvList"), pl=el("loanPayList");
  rl.innerHTML=""; sortBy(receivableAccounts(),1).forEach(a=>rl.appendChild(card(a)));
  pl.innerHTML=""; sortBy(payableAccounts(),-1).forEach(a=>pl.appendChild(card(a)));
  el("loanRecvEmpty").hidden=receivableAccounts().length>0;
  el("loanPayEmpty").hidden=payableAccounts().length>0;
  renderLoanUpcoming();
  renderLateRatesBadge();
  if(loanPersonRefresh) loanPersonRefresh();
}
function renderLoanStats(){
  const block=document.getElementById("loanStatsBlock"), box=document.getElementById("loanStats");
  if(!block||!box) return;
  const tx=statsTransactions().filter(t=>t.type==="transfer");
  const sum=mode=>tx.filter(t=>loanModeOf(t)===mode).reduce((s,t)=>s+t.amount,0);
  const lent=sum("lend"), back=sum("repayIn"), borrowed=sum("borrow"), repaid=sum("repayOut");
  const woAll=statsTransactions(true).filter(t=>t.loanWriteOff&&!t.loanOffset);
  const woIn=woAll.filter(t=>t.loanKind==="writeOffIn").reduce((s,t)=>s+t.amount,0), woOut=woAll.filter(t=>t.loanKind==="writeOffOut").reduce((s,t)=>s+t.amount,0);
  const hasAny=state.accounts.some(isLoanAccount);
  block.hidden=!hasAny;
  if(!hasAny) return;
  const show=v=>balancesHidden?"••••":fmt(v);
  const people=[...receivableAccounts().map(a=>({a,v:accountBalance(a.id),c:"#8E7CC3"})),...payableAccounts().map(a=>({a,v:-accountBalance(a.id),c:"#C9785C"}))].filter(x=>Math.abs(x.v)>=0.005);
  const max=Math.max(1,...people.map(x=>Math.abs(x.v)));
  box.innerHTML=`<div class="stat-card-grid loan-stat-grid">
      <div class="stat-card"><p class="stat-card-label">Prestato nel periodo</p><p class="stat-card-value" style="color:#8E7CC3">${show(lent)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Restituito a te</p><p class="stat-card-value pos">${show(back)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Preso in prestito</p><p class="stat-card-value" style="color:#C9785C">${show(borrowed)}</p></div>
      <div class="stat-card"><p class="stat-card-label">Rate e restituzioni</p><p class="stat-card-value neg">${show(repaid)}</p></div>
      ${woIn>0.004?`<div class="stat-card"><p class="stat-card-label">Abbuonato da te</p><p class="stat-card-value">${show(woIn)}</p></div>`:""}
      ${woOut>0.004?`<div class="stat-card"><p class="stat-card-label">Abbuonato a te</p><p class="stat-card-value pos">${show(woOut)}</p></div>`:""}
    </div>
    ${people.length?`<div class="loan-bars"><p class="stat-card-label">Situazione attuale per persona</p>${people.map(x=>`<div class="cs-row"><div class="cs-lbl"><span>${escapeHtml(x.a.person)} · ${x.a.receivable?"ti deve":"devi"}</span><strong>${show(Math.abs(x.v))}</strong></div><div class="cs-bar"><i style="width:${(Math.abs(x.v)/max*100).toFixed(1)}%;background:${x.c}"></i></div></div>`).join("")}</div>`:""}`;
}
document.querySelectorAll("#accountsModeToggle [data-acc-mode]").forEach(b=>b.addEventListener("click",()=>setAccountsMode(b.dataset.accMode)));
document.getElementById("addLendBtn")?.addEventListener("click",()=>openLoanForm(null,{mode:"lend"}));
document.getElementById("addBorrowBtn")?.addEventListener("click",()=>openLoanForm(null,{mode:"borrow"}));
document.getElementById("homeEffectiveCard")?.addEventListener("click",()=>{ switchView("accounts"); setAccountsMode("loans"); });
/* ---------------- Add Transaction sheet ---------------- */
/* v1.39.0 — Lettura "di riserva" della frase, senza modello: importo, data e nome.
   "35 euro spesa alla Coop ieri" → 35 · ieri · "Spesa alla Coop". */
function fraseMovimentoLocale(frase){
  const t=String(frase||"").trim(); if(!t) return null;
  const num="(\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  let m=t.match(new RegExp("(?:€|eur(?:o|i)?)\\s*"+num,"i"))||t.match(new RegExp(num+"\\s*(?:€|eur(?:o|i)?\\b)","i"));
  if(!m){ const all=[...t.matchAll(new RegExp(num,"g"))]; if(all.length===1) m=all[0]; }
  if(!m) return null;
  const importo=SuiteAI.numero(m[1]);
  if(!(importo>0)) return null;
  let data=todayISO(), resto=t.replace(m[0]," ");
  const giorno=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
  if(/\b(l'?altro\s*ieri|altroieri)\b/i.test(resto)){ data=giorno(2); resto=resto.replace(/\b(l'?altro\s*ieri|altroieri)\b/ig," "); }
  else if(/\bieri\b/i.test(resto)){ data=giorno(1); resto=resto.replace(/\bieri\b/ig," "); }
  else resto=resto.replace(/\boggi\b/ig," ");
  resto=resto.replace(/\b(euro|eur)\b|€/ig," ").replace(/\s+/g," ").replace(/^[\s,.;:-]+|[\s,.;:-]+$/g,"");
  const tipo=/\b(stipendio|entrata|incasso|incassato|ricevut[oi]|rimborso|bonifico in entrata)\b/i.test(t)?"income":"expense";
  return {importo,data,tipo,descrizione:resto?resto.charAt(0).toUpperCase()+resto.slice(1):"",locale:true};
}
function openAddTransaction(txId,preset=null){
  const editing=!!txId;
  const existing=editing ? state.transactions.find(t=>t.id===txId) : null;
  if(editing && !existing) return;
  // v1.10.8: trasferimenti e prelievi hanno il proprio pannello, anche in modifica.
  // v1.12.0: una spesa divisa / prestito si modifica sempre dal modulo spesa, con il totale.
  if(existing?.loanOld) return openLoanForm(txId);
  if(existing?.loanWriteOff){ const rep=linkedTx(existing).find(x=>x.type==="transfer"); return rep?openLoanForm(rep.id):undoLoanSettle(existing); }
  const group=existing?.splitGroup?groupParts(existing.splitGroup):null;
  if(!group && existing?.type==="transfer" && (loanAccount(existing.accountId)||loanAccount(existing.toAccountId))) return openLoanForm(txId);
  if(!group && existing?.type==="transfer") return existing.atm ? openAtmWithdrawal(txId) : openTransferForm(txId);
  const view=group?{type:"expense",amount:Math.round((Number(group.main?.amount||0)+Number(group.share?.amount||0))*100)/100,name:group.main?.name||group.share?.note||"",categoryId:group.main?.categoryId||group.share?.loanCategoryId||null,accountId:(group.main||group.share).accountId,toAccountId:null,date:(group.main||group.share).date,note:group.main?.note||""}:existing;
  txType = view?.type || "expense";
  selectedCategoryId = view?.categoryId || null;
  selectedAccountId = view?.accountId || null;
  let destinationAccountId = view?.toAccountId || null;

  openSheet("tpl-add-transaction", (node, close)=>{
    const amountInput = node.querySelector("#amountInput");
    const nameInput=node.querySelector("#txNameInput");
    amountInput.value = view ? String(view.amount).replace(".",",") : "";
    nameInput.value=view?.name || "";
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
    dateInput.value = view?.date || (periodModes.home==="day" ? selectedDate() : inViewedMonth ? todayISO() : `${viewYear}-${pad2(viewMonth+1)}-01`);
    // I movimenti reali non possono avere una data futura: per quelli si usa Pianificato.
    dateInput.max = todayISO();
    noteInput.value = view?.note || "";

    // v1.23.0 — categoria suggerita dal nome finché non la scegli tu.
    let catManual=!!view?.categoryId;
    function renderCatChips(){
      renderCategoryPicker(catChipsGrouped, txType, ()=>selectedCategoryId, id=>{ selectedCategoryId=id; const ev=window.event; if(!catAuto&&ev&&ev.isTrusted&&(ev.type==='click'||ev.type==='pointerup')&&ev.target&&catChipsGrouped.contains(ev.target)){ catManual=true; showCatHint(null); } });
    }
    let catAuto=false;
    let catHint=null;
    function showCatHint(cat){
      if(!catHint){ catHint=document.createElement("p"); catHint.className="field-hint mt-cat-hint"; nameInput.closest(".field-row")?.appendChild(catHint); }
      catHint.hidden=!cat; if(cat) catHint.textContent=`💡 Categoria suggerita: ${cat.emoji||""} ${cat.name} (puoi cambiarla sotto)`;
    }
    /* v1.36.0 — "Scrivilo a parole": una frase diventa il movimento gia compilato.
       Compare solo se la sincronizzazione e collegata (serve per parlare con il modello)
       e solo su un movimento nuovo: in modifica sarebbe solo un modo per sbagliare. */
    (function(){
      const row=node.querySelector("#aiPhraseRow"); if(!row) return;
      if(existing || !(window.SuiteAI && SuiteAI.disponibile())) return;
      row.hidden=false;
      const inp=node.querySelector("#aiPhraseInput"), btn=node.querySelector("#aiPhraseBtn"), hint=node.querySelector("#aiPhraseHint");
      let inCorso=false;
      async function compila(){
        const frase=inp.value.trim();
        if(!frase){ inp.focus(); return; }
        if(inCorso) return;
        inCorso=true; btn.disabled=true; hint.textContent="Sto leggendo la frase…";
        const cats=state.categories.filter(c=>!c.archived).map(c=>({chiave:c.id,nome:categoryLabel(c.id,{sempre:true}),tipo:c.kind||"expense"}));
        const conti=state.accounts.map(a=>({chiave:a.id,nome:a.name}));
        let d=await SuiteAI.movimento(frase,{contesto:{oggi:todayISO(),categorie:cats,conti:conti}});
        inCorso=false; btn.disabled=false;
        if(!node.isConnected) return;
        // v1.39.0: se il modello non risponde, importo, data e nome si leggono comunque dalla frase.
        let locale=false;
        if(!d){ const l=fraseMovimentoLocale(frase); if(l){ d=l; locale=true; } }
        if(!d){ hint.textContent=SuiteAI.messaggioErrore("Non trovo l'importo nella frase: scrivilo tu qui sotto."); return; }
        if((d.tipo==="income"||d.tipo==="expense") && d.tipo!==txType){
          const opt=typeToggle.querySelector(`.type-opt[data-type="${d.tipo}"]`);
          if(opt) opt.click();
        }
        amountInput.value=String(d.importo).replace(".",",");
        autoGrowAmountInput(amountInput);
        const desc=d.descrizione||d.nome||d.negozio||d.descrizione_breve;
        if(desc) nameInput.value=String(desc).slice(0,80);
        if(/^\d{4}-\d{2}-\d{2}$/.test(d.data||"") && d.data<=todayISO()) dateInput.value=d.data;
        if(d.conto && state.accounts.some(a=>a.id===d.conto)){ selectedAccountId=d.conto; renderAccChips(); }
        if(d.categoria && categoriesById()[d.categoria]){ selectedCategoryId=d.categoria; catManual=true; renderCatChips(); showCatHint(categoriesById()[d.categoria]); }
        else { const id=suggestCategoryFor(nameInput.value,txType); if(id){ selectedCategoryId=id; renderCatChips(); showCatHint(categoriesById()[id]); } }
        hint.textContent=locale
          ? SuiteAI.messaggioErrore("Ho preso importo e data dalla frase: scegli conto e categoria e salva.")
          : (d.sicurezza!=null&&d.sicurezza<0.6)
          ? "Ho fatto del mio meglio: controlla importo e data prima di salvare."
          : "Fatto: controlla e salva.";
        inp.value="";
      }
      btn.addEventListener("click",compila);
      inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); compila(); } });

      /* Scontrino dalla foto: negozio, data e totale finiscono nei campi qui sotto. */
      const foto=SuiteAI.pulsanteFoto({
        task:"scontrino",
        etichetta:"\ud83e\uddfe Leggi lo scontrino",
        attesa:"Sto leggendo lo scontrino\u2026",
        contesto:()=>({oggi:todayISO()}),
        opzioni:()=>state.categories.filter(c=>c.kind==="expense"&&!c.archived).map(c=>({chiave:c.id,nome:categoryLabel(c.id,{sempre:true})})),
        onDati:d=>{
          if(!d) return null;   // il messaggio con il motivo lo scrive SuiteAI
          const tot=SuiteAI.importoDa(d,["totale","total","importo","amount","totale_pagato"]);
          if(!(tot>0)) return "Non trovo il totale sullo scontrino: scrivilo a mano.";
          d.totale=tot;
          if(txType!=="expense"){ const o=typeToggle.querySelector('.type-opt[data-type="expense"]'); if(o) o.click(); }
          amountInput.value=String(d.totale).replace(".",",");
          autoGrowAmountInput(amountInput);
          if(d.negozio) nameInput.value=String(d.negozio).slice(0,80);
          if(/^\d{4}-\d{2}-\d{2}$/.test(d.data||"") && d.data<=todayISO()) dateInput.value=d.data;
          if(d.categoria && categoriesById()[d.categoria]){ selectedCategoryId=d.categoria; catManual=true; renderCatChips(); showCatHint(categoriesById()[d.categoria]); }
          const voci=Array.isArray(d.voci)?d.voci.length:0;
          const nota=voci?`${voci} ${voci===1?"voce letta":"voci lette"}`:"";
          if(voci && !noteInput.value.trim()){
            noteInput.value=d.voci.slice(0,25).map(v=>`${v.quantita>1?v.quantita+"\u00d7 ":""}${v.nome}${v.prezzo?` ${fmt(v.prezzo)}`:""}`).join("\n");
          }
          return `${d.negozio?d.negozio+" \u00b7 ":""}${fmt(d.totale)}${nota?" \u00b7 "+nota:""}. Controlla e salva.`;
        }
      });
      row.after(foto);
    })();

    let sugTimer=null;
    /* v1.36.0 — Se le parole conosciute non bastano, la categoria la sceglie il modello.
       Si chiede una sola volta per nome e solo quando la regola non ha trovato niente. */
    const aiCatProvati=new Set();
    async function aiCategoria(nome){
      if(!(window.SuiteAI && SuiteAI.disponibile())) return;
      const chiave=nome.trim().toLowerCase();
      if(chiave.length<3 || aiCatProvati.has(chiave)) return;
      aiCatProvati.add(chiave);
      const cats=state.categories.filter(c=>c.kind===txType&&!c.archived).map(c=>({chiave:c.id,nome:categoryLabel(c.id,{sempre:true})}));
      if(!cats.length) return;
      const id=await SuiteAI.scegli("categoria",nome,cats,0.6);
      if(!id||catManual||!node.isConnected) return;
      if(nameInput.value.trim().toLowerCase()!==chiave) return;
      selectedCategoryId=id; catAuto=true; try{ renderCatChips(); } finally { catAuto=false; }
      showCatHint(categoriesById()[id]);
    }
    nameInput.addEventListener("input",()=>{ clearTimeout(sugTimer); sugTimer=setTimeout(()=>{
      if(catManual||txType==="transfer"||existing) return;
      const id=suggestCategoryFor(nameInput.value,txType);
      if(!id) aiCategoria(nameInput.value);
      if(id){ if(id!==selectedCategoryId){ selectedCategoryId=id; catAuto=true; try{ renderCatChips(); } finally { catAuto=false; } } showCatHint(categoriesById()[id]); }
      else if(!id){ showCatHint(null); }
    },250); });
    function renderAccChips(){
      accChips.innerHTML = "";
      state.accounts.filter(a=>!isLoanAccount(a)||a.id===selectedAccountId).forEach(a=>{
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
    const shared=mountSharedExpense(node, accChips.closest(".field-row"), {type:()=>txType, amount:()=>parseAmount(amountInput.value), group});
    // v1.25.0 — "Pagata da un'altra persona" (esclude "Spesa divisa o prestito")
    const accRow=accChips.closest(".field-row");
    if(existing?.otherPaid){ amountInput.value=String(existing.otherPaid.total||existing.amount).replace(".",","); autoGrowAmountInput(amountInput); }
    const other=mountOtherPaid(node, shared && node.querySelector(".shared-field") || accRow, {type:()=>txType, amount:()=>parseAmount(amountInput.value), existing, preset,
      onChange:inf=>{
        accRow.hidden=inf.on;
        if(inf.on){ shared.setOff(); node.querySelector(".shared-field:not(.other-paid-field)")?.setAttribute("hidden",""); }
        else { node.querySelector(".shared-field:not(.other-paid-field)")?.removeAttribute("hidden"); shared.refresh(); }
        // v1.25.1: categoria e macrocategoria restano libere (chi ha pagato è solo contabilità)
      }});

    node.querySelector("#saveTxBtn").addEventListener("click", ()=>{
      const amount = parseAmount(amountInput.value);
      const sharedInfo=shared.get();
      if(sharedInfo.on && !sharedInfo.person){ showToast("Scrivi chi ti deve la sua parte"); return; }
      const transfer=txType==="transfer";
      const otherInfo=other.get();
      if(otherInfo.on && !otherInfo.person){ showToast("Scrivi chi ha pagato"); return; }
      const missing=[]; if(!transfer&&!nameInput.value.trim()) missing.push("nome"); if(amount<=0) missing.push("importo"); if(!transfer&&!selectedCategoryId&&!(sharedInfo.on&&sharedInfo.pct===0)) missing.push("categoria"); if((!selectedAccountId||loanAccount(selectedAccountId))&&!otherInfo.on&&!sharedInfo.on&&!group) missing.push("conto"); if(transfer&&!destinationAccountId) missing.push("conto destinazione"); if(!dateInput.value) missing.push("data");
      if(missing.length){showToast("Inserisci: "+missing.join(", "));if(amount<=0) amountInput.focus();return;}
      if(dateInput.value > todayISO()){
        showToast("Per una data futura usa un movimento Pianificato");
        dateInput.focus();
        return;
      }

      if(!transfer && txType==="expense" && otherInfo.on && !group){
        // Spesa pagata da un altro: la mia parte esce dal suo conto "Da pagare" (debito), non dai miei conti.
        const la=ensureLoanAccount(otherInfo.person,"pay");
        const mine=round2(amount*otherInfo.pct/100);
        const t=existing||{id:uid()};
        Object.assign(t,{date:dateInput.value,amount:mine,type:"expense",name:nameInput.value.trim(),categoryId:selectedCategoryId,accountId:la.id,toAccountId:null,note:noteInput.value.trim(),otherPaid:{person:la.person,total:amount,pct:otherInfo.pct}});
        if(!editing) state.transactions.push(t);
        state.lastOtherPayer=la.person;
        balanceCache.clear(); persist();
        const d=new Date(t.date+"T00:00:00"); viewYear=d.getFullYear(); viewMonth=d.getMonth();
        renderAll(); close();
        showToast(`Spesa registrata: devi ${balancesHidden?"••••":fmt(mine)} a ${la.person}`);
        setTimeout(()=>budgetAlertFor(t),1800);
        return;
      }
      if(existing?.otherPaid && !otherInfo.on){ delete existing.otherPaid; }
      if(!transfer && txType==="expense" && (group || sharedInfo.on)){
        const saved=saveSharedGroup({group,total:amount,shared:sharedInfo,fields:{date:dateInput.value,name:nameInput.value.trim(),categoryId:selectedCategoryId,accountId:selectedAccountId,note:noteInput.value.trim()}});
        persist();
        const sd=new Date(saved.date+"T00:00:00"); viewYear=sd.getFullYear(); viewMonth=sd.getMonth();
        renderAll(); close(); return;
      }
      const t = existing || {id:uid()};
      t.date=dateInput.value; t.amount=amount; t.type=txType;
      t.name=transfer?transferName(selectedAccountId,destinationAccountId):nameInput.value.trim(); t.categoryId=transfer?null:selectedCategoryId; t.accountId=selectedAccountId; t.toAccountId=transfer?destinationAccountId:null; t.note=noteInput.value.trim();
      if(!editing) state.transactions.push(t);
      persist();
      const d = new Date(t.date+"T00:00:00");
      viewYear = d.getFullYear(); viewMonth = d.getMonth();
      renderAll();
      close();
      if(t.type==="expense") setTimeout(()=>budgetAlertFor(t),350);
    });
  });
}
/* v1.23.0 — Categoria suggerita dal nome: prima i tuoi movimenti con lo stesso nome (o la stessa
   prima parola), poi parole note (Esselunga → Spesa, Enel → Bollette…) abbinate alle tue categorie. */
const CAT_KEYWORDS=[
  [/esselunga|coop\b|conad|lidl|carrefour|eurospin|pam\b|aldi|penny|supermerc|iper\b|naturasi|spesa/i,["spesa","alimentari","supermercato"]],
  [/eni\b|q8|ip\b|tamoil|esso|benzina|carburante|diesel|autostrad|telepass|atm\b|trenitalia|italo|treno|metro|taxi|uber|parcheggio|bollo auto/i,["trasporti","auto","carburante","benzina"]],
  [/enel|a2a|edison|iren|hera|luce|gas\b|acqua|bolletta|fastweb|tim\b|vodafone|iliad|windtre|internet|fibra/i,["bollette","utenze","casa"]],
  [/farmacia|medic|dentist|visita|ticket|ospedal|analisi|ottico/i,["salute","farmacia","medico"]],
  [/netflix|spotify|disney|prime video|dazn|cinema|teatro|concerto|ristorant|pizzeria|bar\b|pub\b|aperitivo|sushi|cena|pranzo/i,["svago","ristoranti","tempo libero","abbonamenti"]],
  [/affitto|condominio|mutuo|ikea|leroy|brico|arredo/i,["casa","affitto","affitto / mutuo"]],
  [/stipendio|busta paga|salario/i,["stipendio"]],
  [/zara|h&m|decathlon|scarpe|abbigliamento|vestit/i,["abbigliamento","shopping"]],
];
function suggestCategoryFor(name,kind){
  const raw=String(name||"").trim().toLowerCase(); if(raw.length<3) return null;
  const cats=state.categories.filter(c=>c.kind===kind), ok=new Set(cats.map(c=>c.id));
  const count=filter=>{ const m=new Map(); state.transactions.forEach(t=>{ if(t.type!==kind||!ok.has(t.categoryId)||!filter(String(t.name||"").trim().toLowerCase())) return; m.set(t.categoryId,(m.get(t.categoryId)||0)+1); }); let best=null,n=0; m.forEach((v,k)=>{ if(v>n){n=v;best=k;} }); return best; };
  const exact=count(n=>n===raw); if(exact) return exact;
  const first=raw.split(/\s+/)[0];
  if(first.length>=4){ const byWord=count(n=>n.split(/\s+/)[0]===first); if(byWord) return byWord; }
  for(const [re,names] of CAT_KEYWORDS){ if(!re.test(raw)) continue; for(const nm of names){ const c=cats.find(c=>c.name.toLowerCase()===nm)||cats.find(c=>c.name.toLowerCase().includes(nm)); if(c) return c.id; } }
  return null;
}
/* v1.23.0 — Avviso budget: dopo una spesa, se la sua categoria arriva all'80% o supera il budget del mese. */
function budgetAlertFor(t){
  const c=categoriesById()[t.categoryId]; if(!c||!(Number(c.budget)>0)) return;
  const ym=String(t.date).slice(0,7);
  const spent=state.transactions.filter(x=>x.type==="expense"&&x.categoryId===c.id&&String(x.date).startsWith(ym)&&!x.isBalanceAdjustment).reduce((s,x)=>s+x.amount,0);
  const before=spent-t.amount, b=Number(c.budget), pct=Math.round(spent/b*100);
  const amt=v=>balancesHidden?"••••":fmt(v);
  if(spent>b && before<=b) showToast(`⚠️ Budget ${c.emoji||""} ${c.name} superato: ${amt(spent)} su ${amt(b)} (${pct}%)`);
  else if(spent>b) showToast(`⚠️ ${c.emoji||""} ${c.name}: ${amt(spent)} su ${amt(b)} di budget (${pct}%)`);
  else if(spent>=b*0.8 && before<b*0.8) showToast(`🟡 ${c.emoji||""} ${c.name} all'${pct}% del budget: restano ${amt(b-spent)}`);
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
        <button type="button" class="movement-action-btn add-recent" data-add-kind="tx"><span class="movement-action-icon" aria-hidden="true">＋</span><span>Movimento</span></button>
        <button type="button" class="movement-action-btn edit" data-add-kind="recurring"><span class="movement-action-icon" aria-hidden="true">↻</span><span>Ricorrente</span></button>
        <button type="button" class="movement-action-btn duplicate" data-add-kind="planned"><span class="movement-action-icon" aria-hidden="true">◷</span><span>Pianificato</span></button>
        <button type="button" class="movement-action-btn add-transfer" data-add-kind="transfer"><span class="movement-action-icon" aria-hidden="true">↔</span><span>Trasferimento</span></button>
        <button type="button" class="movement-action-btn add-atm" data-add-kind="atm"><span class="movement-action-icon" aria-hidden="true">🏧</span><span>Prelievo ATM</span></button>
        <button type="button" class="movement-action-btn add-repay" data-add-kind="repay"><span class="movement-action-icon" aria-hidden="true">🤝</span><span>Prestito o restituzione</span></button>
      </div>
      <button type="button" class="movement-action-cancel">Annulla</button>
    </div>`;
  const go=fn=>()=>{overlay.remove();fn();};
  overlay.querySelector('[data-add-kind="tx"]').addEventListener("click",go(()=>openAddTransaction()));
  overlay.querySelector('[data-add-kind="recurring"]').addEventListener("click",go(()=>openRecurringForm(null)));
  overlay.querySelector('[data-add-kind="planned"]').addEventListener("click",go(()=>openPlannedForm(null)));
  overlay.querySelector('[data-add-kind="transfer"]').addEventListener("click",go(()=>openTransferForm()));
  overlay.querySelector('[data-add-kind="atm"]').addEventListener("click",go(()=>openAtmWithdrawal()));
  overlay.querySelector('[data-add-kind="repay"]').addEventListener("click",go(()=>openLoanForm(null,{mode:"lend"})));
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
      state.accounts.filter(a=>a.id!==exclude&&!isLoanAccount(a)).forEach(a=>{
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
function openTransferForm(txId=null,preset=null){
  const existing=txId?state.transactions.find(t=>t.id===txId&&t.type==="transfer"):null;
  let fromId=existing?.accountId||preset?.fromId||state.accounts.find(a=>a.id===state.mainAccountId)?.id||state.accounts[0]?.id||null;
  let toId=existing?.toAccountId||preset?.toId||null;
  openSheet("tpl-transfer",(node,close)=>{
    const amountInput=node.querySelector("#transferAmountInput"), dateInput=node.querySelector("#transferDateInput"), noteInput=node.querySelector("#transferNoteInput");
    const fromChips=node.querySelector("#transferFromChips"), toChips=node.querySelector("#transferToChips"), summary=node.querySelector("#transferSummary");
    const today=new Date(), inViewedMonth=today.getFullYear()===viewYear&&today.getMonth()===viewMonth;
    dateInput.value=existing?.date||(periodModes.home==="day"?selectedDate():inViewedMonth?todayISO():`${viewYear}-${pad2(viewMonth+1)}-01`);
    dateInput.max=todayISO();
    if(existing){
      
      amountInput.value=String(existing.amount).replace(".",",");
      noteInput.value=existing.note||"";
    } else if(preset){
      if(preset.amount>0) amountInput.value=String(Math.round(preset.amount*100)/100).replace(".",",");
      if(preset.title){ node.querySelector("#transferFormTitle").textContent=preset.title; noteInput.value=preset.title; dateInput.value=todayISO(); }
    }
    autoGrowAmountInput(amountInput);
    const chips=(wrap,getSel,setSel,exclude)=>{
      wrap.innerHTML="";
      state.accounts.filter(a=>a.id!==exclude&&!isLoanAccount(a)).forEach(a=>{
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
/* v1.29.0 — Un solo occhio, fermo in alto a destra in tutte le schede. Quelli dentro le
   schede restano nel codice (li usano altre funzioni) ma non si vedono più. */
document.getElementById("toggleBalanceFixed")?.addEventListener("click",toggleBalances);

/* ===================== v1.38.0 — "Com'è andato il mese" =====================
   Prende i numeri che l'app ha già (entrate, uscite, budget, scadenze, confronto con
   l'anno scorso) e li fa raccontare a parole. Non calcola niente di nuovo: se un dato
   non c'è, non viene inventato. */
function riepilogoContesto(){
  const tx=periodTx("home").filter(t=>!t.isBalanceAdjustment&&t.type!=="transfer");
  const somma=k=>tx.filter(t=>t.type===k).reduce((s,t)=>s+t.amount,0);
  const entrate=somma("income"), uscite=somma("expense");
  const perCat={};
  tx.filter(t=>t.type==="expense").forEach(t=>{
    const k=rollUpCategoryId(t.categoryId);
    perCat[k]=(perCat[k]||0)+t.amount;
  });
  const cats=categoriesById();
  const categorie=Object.entries(perCat).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([id,v])=>({nome:cats[id]?categoryLabel(id,{sempre:true}):"Senza categoria",speso:Math.round(v*100)/100,
      budget:cats[id]&&cats[id].budget?cats[id].budget:null}));
  /* mese precedente, stesso periodo */
  const pm=new Date(viewYear,viewMonth-1,1);
  const prefixPrec=`${pm.getFullYear()}-${pad2(pm.getMonth()+1)}`;
  const uscitePrec=state.transactions.filter(t=>t.date.startsWith(prefixPrec)&&t.type==="expense"&&!t.isBalanceAdjustment).reduce((s,t)=>s+t.amount,0);
  /* in arrivo entro fine mese */
  const inArrivo=[
    ...state.recurring.filter(r=>r.active!==false).map(r=>({r,dates:recurringDatesForMonth(r)}))
      .filter(x=>x.dates.length>0).flatMap(x=>x.dates.map(()=>x.r)),
    ...plannedForRPMonth()
  ].slice(0,10).map(x=>({nome:x.name||"",importo:x.amount,tipo:x.type}));
  return {
    mese:`${MESI[viewMonth]} ${viewYear}`,
    entrate:Math.round(entrate*100)/100,
    uscite:Math.round(uscite*100)/100,
    saldoDelPeriodo:Math.round((entrate-uscite)*100)/100,
    usciteMesePrecedente:Math.round(uscitePrec*100)/100,
    liquiditaSuiConti:Math.round(liquidBalance()*100)/100,
    categorie, inArrivo,
    numeroMovimenti:tx.length
  };
}
function renderAiMonth(){
  const box=document.getElementById("aiMonthBlock");
  if(!box) return;
  const on=!!(window.SuiteAI && SuiteAI.disponibile());
  box.hidden=!on;
  if(!on || box._bound) return;
  box._bound=true;
  const btn=document.getElementById("aiMonthBtn"), out=document.getElementById("aiMonthBox");
  btn.addEventListener("click",async()=>{
    btn.disabled=true;
    out.innerHTML=`<p class="ai-note">Sto guardando i numeri di ${MESI[viewMonth].toLowerCase()}…</p>`;
    const r=await SuiteAI.riepilogo(riepilogoContesto(),`Com'è andato ${MESI[viewMonth].toLowerCase()} ${viewYear}?`);
    btn.disabled=false;
    if(!r){ out.innerHTML=`<p class="ai-note">Non ci sono riuscito adesso. Riprova fra poco.</p>`; return; }
    out.innerHTML=`<p>${escapeHtml(r.testo)}</p>`+
      (r.punti.length?`<ul>${r.punti.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"")+
      `<p class="ai-note">Scritto leggendo i tuoi numeri di ${escapeHtml(MESI[viewMonth])} ${viewYear}. Ricontrolla sempre le cifre.</p>`;
  });
}

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
    const cat = transfer ? {name:"Trasferimento",emoji:"↔"} : (t.loanOffset ? {name:"Compensazione crediti/debiti",emoji:"⚖️"} : t.loanWriteOff ? {name:"Abbuono (prestito chiuso)",emoji:"✅"} : t.loanOld ? {name:loanAccount(t.accountId)?.receivable?"Prestito vecchio (fuori saldo)":"Debito vecchio (fuori saldo)",emoji:"🤝"} : t.isBalanceAdjustment ? {name:"Rettifica saldo",emoji:"⚖️"} : (categoriesById()[t.categoryId] || { name:"Categoria eliminata", emoji:"❔" }));
    const acc = accountsById()[t.accountId] || { name:"Conto eliminato" };
    const destination=accountsById()[t.toAccountId] || {name:"Conto eliminato"};
    node.querySelector("#txDetailBody").innerHTML = `
      <div class="tx-detail-row"><span class="k">Importo</span><span class="v ${t.type}">${transfer?"↔":t.type==="income"?"+":"−"}${fmt(t.amount)}</span></div>
      ${transfer?`<div class="tx-detail-row"><span class="k">Da conto</span><span class="v">${escapeHtml(acc.name)}</span></div><div class="tx-detail-row"><span class="k">A conto</span><span class="v">${escapeHtml(destination.name)}</span></div>`:`<div class="tx-detail-row"><span class="k">Categoria</span><span class="v">${escapeHtml(cat.emoji)} ${escapeHtml(cat.name)}</span></div><div class="tx-detail-row"><span class="k">Conto</span><span class="v">${escapeHtml(acc.name)}</span></div>`}
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
  if(a>=1000 && step>=500){const dec=step>=1000&&(a>=10000||step%1000===0)?0:1;return `${s}${(a/1000).toFixed(dec).replace(".",",").replace(/,0$/,"")}k\u00a0€`;}
  return `${s}${Math.round(a).toLocaleString("it-IT")}\u00a0€`;
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
        acc.name = name; acc.color = chosenColor;
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
        state.accounts.push({ id: uid(), name, balance, color: chosenColor });
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

    const parentChips = node.querySelector("#categoryParentChips");
    const macroRow = node.querySelector("#categoryMacroRow");
    const clashHint = node.querySelector("#categoryClashHint");

    let chosenEmoji = cat?.emoji || EMOJIS[0];
    let chosenColor = cat?.color || PALETTE[0];
    let chosenKind = cat?.kind || "expense";
    let chosenMacroId = cat?.macroCategoryId || null;
    let chosenParentId = cat?.parentCategoryId || null;

    nameInput.value = cat?.name || "";
    budgetInput.value = cat?.budget ? String(cat.budget).replace(".",",") : "";

    /* v1.37.0 — "Dentro quale categoria": scegliendo una madre questa diventa una
       sottocategoria. Una categoria che ha già figlie non può diventarlo a sua volta:
       i livelli restano tre. */
    const haFiglie = editing && subCategoriesOf(categoryId).length > 0;
    function renderParentChips(){
      parentChips.innerHTML = "";
      const none = document.createElement("button");
      none.className = "chip" + (!chosenParentId ? " active" : "");
      none.textContent = "Categoria principale";
      none.addEventListener("click", ()=>{ chosenParentId=null; renderParentChips(); renderMacroChips(); paintClash(); });
      parentChips.appendChild(none);
      if(haFiglie){
        const nota=document.createElement("p");
        nota.className="field-hint";
        nota.textContent="Questa categoria ha già delle sottocategorie, quindi resta principale.";
        parentChips.appendChild(nota);
        chosenParentId=null;
        macroRow.hidden=false;
        return;
      }
      topCategories(chosenKind).filter(c=>c.id!==categoryId).forEach(c=>{
        const chip=document.createElement("button");
        chip.className="chip"+(chosenParentId===c.id?" active":"");
        chip.innerHTML=`<span class="em">${escapeHtml(c.emoji)}</span>${escapeHtml(c.name)}`;
        chip.addEventListener("click",()=>{ chosenParentId=c.id; chosenMacroId=c.macroCategoryId||null; renderParentChips(); renderMacroChips(); paintClash(); });
        parentChips.appendChild(chip);
      });
      /* La macrocategoria la decide la madre: niente doppia scelta. */
      macroRow.hidden = !!chosenParentId;
    }
    /* Se il nome esiste già altrove, lo diciamo subito e spieghiamo come si distinguerà. */
    function paintClash(){
      const n=nameInput.value.trim();
      const clash=n?categoryNameClash(n,chosenKind,categoryId):null;
      if(!clash){ clashHint.hidden=true; return; }
      const madre=chosenParentId?state.categories.find(c=>c.id===chosenParentId):null;
      const cosa=clash.tipo==="macro"?"una macrocategoria":clash.tipo==="sotto"?"un'altra sottocategoria":"un'altra categoria";
      clashHint.hidden=false;
      clashHint.textContent=madre
        ? `Esiste già ${cosa} “${clash.nome}”: questa comparirà come “${madre.name} › ${n}”.`
        : `Esiste già ${cosa} “${clash.nome}”: scegli un nome diverso o mettila dentro una categoria madre.`;
    }
    nameInput.addEventListener("input", paintClash);

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
    renderParentChips();
    paintClash();

    kindToggle.querySelectorAll(".type-opt").forEach(opt=>{
      opt.classList.toggle("active", opt.dataset.kind===chosenKind);
      opt.addEventListener("click", ()=>{
        chosenKind = opt.dataset.kind;
        if(chosenMacroId && state.macroCategories.find(m=>m.id===chosenMacroId)?.kind!==chosenKind) chosenMacroId=null;
        if(chosenParentId && state.categories.find(c=>c.id===chosenParentId)?.kind!==chosenKind) chosenParentId=null;
        kindToggle.querySelectorAll(".type-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        renderMacroChips();
        renderParentChips();
        paintClash();
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
      const figlie=subCategoriesOf(categoryId);
      const msg=figlie.length
        ? `Eliminare questa categoria? Le sue ${figlie.length} sottocategorie diventano categorie principali e i movimenti collegati restano senza categoria.`
        : "Eliminare questa categoria? I movimenti collegati resteranno ma senza categoria.";
      if(!await askConfirm(msg)) return;
      figlie.forEach(sc=>{ sc.parentCategoryId=null; });
      state.categories = state.categories.filter(c=>c.id!==categoryId);
      persist(); renderAll(); close();
    });

    node.querySelector("#saveCategoryBtn").addEventListener("click", ()=>{
      const name = nameInput.value.trim();
      if(!name){ nameInput.focus(); return; }
      const budget = budgetInput.value.trim() ? parseAmount(budgetInput.value) : null;
      /* Una sottocategoria eredita sempre tipo e macrocategoria dalla madre. */
      const madre = chosenParentId ? state.categories.find(c=>c.id===chosenParentId) : null;
      const kindFinale = madre ? madre.kind : chosenKind;
      const macroFinale = madre ? (madre.macroCategoryId||null) : chosenMacroId;
      if(editing){
        cat.name=name; cat.emoji=chosenEmoji; cat.color=chosenColor; cat.kind=kindFinale; cat.budget=budget;
        cat.macroCategoryId=macroFinale; cat.parentCategoryId=madre?madre.id:null;
        /* Se è passata sotto una madre, le sue eventuali figlie salgono di livello. */
        if(madre) subCategoriesOf(cat.id).forEach(sc=>{ sc.parentCategoryId=null; });
      } else {
        state.categories.push({ id: uid(), name, emoji: chosenEmoji, color: chosenColor, kind: kindFinale, budget,
          macroCategoryId: macroFinale, parentCategoryId: madre?madre.id:null });
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

    /* v1.38.0 — "Scrivilo a parole" anche per i ricorrenti:
       "ogni 5 del mese 12 euro Netflix sulla carta" compila tutto il pannello. */
    if(!editing && window.SuiteAI && SuiteAI.disponibile()){
      const riga=SuiteAI.riga({
        task:"ricorrente",
        placeholder:"es. ogni 5 del mese 12 euro Netflix",
        hint:"Scrivi o detta: importo, cadenza, giorno, conto e categoria si riempiono da soli.",
        contesto:()=>({oggi:todayISO(),
          categorie:state.categories.filter(c=>!c.archived).map(c=>({chiave:c.id,nome:categoryLabel(c.id,{sempre:true}),tipo:c.kind||"expense"})),
          conti:state.accounts.map(a=>({chiave:a.id,nome:a.name}))}),
        onDati:d=>{
          if(!d) return null;   // il messaggio con il motivo lo scrive SuiteAI
          const imp=SuiteAI.importoDa(d);
          if(!(imp>0)) return "Non trovo l'importo nella frase: scrivilo tu qui sotto.";
          d.importo=imp;
          if((d.tipo==="income"||d.tipo==="expense") && d.tipo!==rType){
            const o=typeToggle.querySelector(`.type-opt[data-type="${d.tipo}"]`); if(o) o.click();
          }
          amountInput.value=String(d.importo).replace(".",",");
          autoGrowAmountInput(amountInput);
          if(d.nome) nameInput.value=String(d.nome).slice(0,80);
          if(["monthly","weekly","yearly","daily"].includes(d.frequenza)){ rFreq=d.frequenza; freqSelect.value=d.frequenza; }
          if(/^\d{4}-\d{2}-\d{2}$/.test(d.inizio||"")) dateInput.value=d.inizio;
          else if(Number(d.giorno)>=1 && Number(d.giorno)<=31){
            const g=pad2(Math.min(28,Number(d.giorno)));
            dateInput.value=`${viewYear}-${pad2(viewMonth+1)}-${g}`;
          }
          if(d.conto && state.accounts.some(a=>a.id===d.conto)){ rAcc=d.conto; renderAccChips(); }
          if(d.categoria && categoriesById()[d.categoria]){ rCat=d.categoria; renderCatChips(); }
          return (d.sicurezza!=null&&d.sicurezza<0.6)
            ? "Ho fatto del mio meglio: controlla cadenza e data prima di salvare."
            : "Fatto: controlla e salva.";
        }
      });
      node.querySelector("#recurringTypeToggle").after(riga);
    }

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
        rec.freq=rFreq; rec.startDate=startDate; rec.note=noteInput.value.trim(); rec.active=activeInput.checked; rec.endDate=endDate; rec.maxOccurrences=maxOccurrences;
        refreshRecurringTransactions(rec.id);
      } else {
        state.recurring.push({
          id: uid(), name, amount, type: rType, categoryId: rCat, accountId: rAcc,
          freq: rFreq, startDate, note: noteInput.value.trim(), nextDate: startDate, active:activeInput.checked, endDate, maxOccurrences,
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
        p.accountId=plannedSelectedAccountId; p.date=date; p.note=noteInput.value.trim();
      } else {
        state.planned.push({
          id: uid(), name:nameInput.value.trim(), amount, type: plannedTxType, categoryId: plannedSelectedCategoryId,
          accountId: plannedSelectedAccountId, date, note: noteInput.value.trim(),
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
/* v1.22.0 — Un solo calendario: quello che si apre toccando il titolo del periodo (con i pallini e la legenda).
   Il pulsante 📅 in alto a destra non c'è più. */
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
  a.href=url;a.download=`bilancio-movimenti-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.csv`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast("CSV esportato correttamente");
}
document.getElementById("exportCsvBtn")?.addEventListener("click",exportTransactionsCsv);
document.getElementById("exportBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `bilancio-backup-${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  safeSetLocalStorage("bilancio_last_backup",new Date().toISOString(),{notify:false});
  renderAll(); showToast("Backup esportato correttamente");
});

document.getElementById("importBtn").addEventListener("click", ()=> document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.accounts || !parsed.categories || !parsed.transactions) throw new Error("formato non valido");
      if(!await askConfirm("Importare questo backup sovrascriverà tutti i dati attuali. Continuare?",{ok:"Importa",danger:true})) return;
      const previousState=state;
      state = migrate(parsed);
      if(!persist()){
        state=previousState;
        showToast("Backup valido, ma non è stato possibile salvarlo: spazio locale insufficiente.");
        return;
      }
      renderAll();
      showToast("Backup importato correttamente.");
    }catch(err){
      showToast("File non valido. Assicurati di selezionare un backup esportato da Bilancio.");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

document.getElementById("resetBtn").addEventListener("click", async ()=>{
  if(!await askConfirm("Questa azione elimina definitivamente tutti i conti, categorie, movimenti e ricorrenti. Continuare?",{ok:"Continua"})) return;
  if(!await askConfirm("Sei davvero sicuro? L'operazione non è reversibile.",{ok:"Azzera tutto"})) return;
  state = seedState();
  persist(); renderAll();
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible") return;
  balancesHidden=true;
  safeSetLocalStorage("bilancio_hide_balances","1",{notify:false});
  generatePlannedTransactions();
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
        <p>Vuoi aggiornare Bilancio adesso? I tuoi dati restano salvati sul telefono.</p>
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
appLoader.innerHTML='<div class="loader-content" role="status" aria-label="Caricamento Money Tracker"><div class="loader-money" aria-hidden="true">€</div><p>Money Tracker</p><i></i></div>';
document.body.appendChild(appLoader);

document.getElementById("goSetMainAccountBtn")?.addEventListener("click",()=>switchView("accounts"));
/* v1.23.0 — Home più ordinata: il dettaglio "Da oggi a fine mese" si apre toccando Saldo previsto o
   Pagamenti in arrivo (la scelta resta ricordata su questo telefono). */
(function foldForecast(){
  const g=document.querySelector("#view-home .forecast-grid"); if(!g) return;
  let open=false; try{ open=localStorage.getItem("bilancio_fc_open")==="1"; }catch(e){}
  const tiles=["forecastTile","upcomingTile"].map(id=>document.getElementById(id)).filter(Boolean);
  const paint=()=>{ g.classList.toggle("fc-collapsed",!open); tiles.forEach(t=>t.setAttribute("aria-expanded",String(open))); };
  tiles.forEach(t=>{
    t.setAttribute("role","button"); t.tabIndex=0; t.classList.add("fc-toggle");
    const go=()=>{ open=!open; try{ localStorage.setItem("bilancio_fc_open",open?"1":"0"); }catch(e){} paint(); };
    t.addEventListener("click",go);
    t.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
  paint();
})();
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
    return `<div class="lp-row lp-kind-${lpKind}"><span class="lp-ic">${emojiIconHtml(c?.emoji||(t.type==="income"?"↑":"↓"))}</span><span class="lp-main"><b>${escapeHtml(name)}</b><small>${when}${future&&kind?` · ${kind}`:""}</small></span><span class="lp-amt ${t.type}">${amount}</span></div>`;
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
/* lpOutside, closeLongPressPopup e bindLongPress ora sono in suite.js (comuni a Bilancio e Noi Due). */
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
  const fc=document.querySelectorAll("#view-home .forecast-grid > .fc-tile.solo, #view-home .forecast-card.rates-forecast");
  if(fc[0]) bindLongPress(fc[0],()=>showLongPressPopup(fc[0],"Ultimi 5 movimenti",lpLastMovements()));
  if(fc[1]) bindLongPress(fc[1],()=>showLongPressPopup(fc[1],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  if(fc[2]) bindLongPress(fc[2],()=>showLongPressPopup(fc[2],"Prossimi 5 in arrivo",lpNextScheduled(),{future:true,emptyText:"Nessuna voce in arrivo."}));
  // R&P — prossimi 5 (mix, solo ricorrenti, solo pianificate)
  const rp=[["recurringEstimateCard","Prossimi 5 ricorrenti",t=>!!t.recurringId],["plannedEstimateCard","Prossime 5 pianificate",t=>!!t.plannedId],["rpTotalEstimateCard","Prossimi 5 · ricorrenti e pianificate",null]];
  rp.forEach(([id,title,f])=>{
    const card=byId(id); if(!card) return;
    bindLongPress(card,e=>{
      const chip=e.target.closest?.(".fc-tile");
      let filter=f, t=title;
      if(chip){
        const income=chip.classList.contains("in");
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

/* Promemoria backup comune alle 4 app (30 giorni, al massimo una volta a settimana). */
setTimeout(()=>{ if(window.SuiteBackup) SuiteBackup.maybe({app:"Bilancio",key:"bilancio",last:localStorage.getItem("bilancio_last_backup"),hasData:state.transactions.length>0,onExport:()=>document.getElementById("exportBtn").click()}); },3000);

/* v1.15.0 — Sincronizzazione online (Supabase), tabella app_data, app "bilancio". */
var syncBilancio = window.SuiteSync ? SuiteSync.register({
  app:"bilancio", name:"Bilancio", scope:"personal",
  getLocal:()=>state,
  hasLocalData:()=>state.transactions.length>0||state.recurring.length>0||state.planned.length>0,
  // Unione: conti e categorie con lo stesso nome diventano uno solo (i dati iniziali di un telefono nuovo non si duplicano).
  merge:(local,remote,remoteNewer)=>{
    const newer=JSON.parse(JSON.stringify(remoteNewer?remote:local)), older=JSON.parse(JSON.stringify(remoteNewer?local:remote));
    const norm=v=>String(v||"").trim().toLowerCase(), map={};
    [["accounts",x=>norm(x.name)],["macroCategories",x=>x.kind+"|"+norm(x.name)],["categories",x=>x.kind+"|"+norm(x.name)]].forEach(([k,key])=>{
      const ids=new Set((newer[k]||[]).map(x=>x.id));
      (older[k]||[]).forEach(x=>{ if(ids.has(x.id)) return; const twin=(newer[k]||[]).find(y=>key(y)===key(x)); if(twin) map[x.id]=twin.id; else (newer[k]=newer[k]||[]).push(x); });
    });
    const m=id=>id!=null&&map[id]?map[id]:id;
    (newer.categories||[]).forEach(c=>{ c.macroCategoryId=m(c.macroCategoryId); });
    ["transactions","recurring","planned","loanRates","trash"].forEach(k=>{
      const ids=new Set((newer[k]||[]).map(x=>x.id));
      (older[k]||[]).forEach(x=>{ if(ids.has(x.id)) return; ["accountId","toAccountId","categoryId","accId"].forEach(f=>{ if(x[f]!=null) x[f]=m(x[f]); }); (newer[k]=newer[k]||[]).push(x); });
    });
    // un elemento eliminato su un telefono (finito nel cestino) non deve tornare dall'altro
    const trashed=new Set((newer.trash||[]).map(e=>e?.data?.id).filter(Boolean));
    ["transactions","recurring","planned"].forEach(k=>{ newer[k]=(newer[k]||[]).filter(x=>!trashed.has(x.id)); });
    if(!newer.mainAccountId) newer.mainAccountId=m(older.mainAccountId)||null;
    return newer;
  },
  localUpdatedAt:()=>state.updatedAt||null,
  onStatus:()=>{ if(typeof pushOnSyncStatus==="function") pushOnSyncStatus(); },
  setLocal:(data)=>{ state=migrate(JSON.parse(JSON.stringify(data))); balanceCache.clear(); safeSetLocalStorage(STORAGE_KEY, JSON.stringify(state)); renderAll(); },
}) : null;
(function(){ const slot=document.getElementById("suiteSyncSlot"); if(slot&&window.SuiteSync) slot.innerHTML=SuiteSync.cardHtml("bilancio",{cls:"section-block suite-sync-block",h:"h2"}); })();


/* ---------------- v1.18.0 — Notifiche push "Scadenze di domani" ----------------
   Il telefono si iscrive (permesso + indirizzo push salvato in Supabase, tabella push_subscriptions).
   Ogni ora la funzione notify-scadenze su Supabase controlla a chi tocca e, all'ora scelta, invia
   le ricorrenti e le pianificate del giorno dopo. Guida completa: GUIDA_NOTIFICHE.txt */
const PUSH_VAPID_PUBLIC="BFlNut-5sgpCsMd-xNtXEczfzjT9AoOyxgyGHJSn6t8QTnT1ygdRc_OT9-GNFnoWJrP1YpuCh8yhbwEa1dBDSsY";
const PUSH_FN="/functions/v1/notify-scadenze";
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
  if(/push_subscriptions/.test(t) && /(does not exist|42P01|PGRST205|schema cache)/.test(t)) return "Su Supabase manca la tabella delle notifiche: esegui il passo 2 della guida.";
  if(/notify-scadenze|404/.test(t) && /function|not found|NOT_FOUND/i.test(t)) return "Su Supabase manca la funzione notify-scadenze: esegui il passo 4 della guida.";
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
      // select=* : se la colonna del riepilogo mensile non esiste ancora, semplicemente non arriva
      const rows=await SuiteSync.api(`/rest/v1/push_subscriptions?select=*&endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`);
      pushState.row=rows[0]||null;
    }
  }catch(e){ pushState.msg=pushErrText(e); pushState.err=true; }
  pushState.loaded=true;
  renderPushCard();
}
function pushHourOptions(sel){
  let h="";
  for(let i=6;i<=22;i++) h+=`<option value="${i}"${i===sel?" selected":""}>${pad2(i)}:00</option>`;
  return h;
}
function renderPushCard(){
  const card=document.getElementById("pushCard"); if(!card) return;
  if(card.contains(document.activeElement) && document.activeElement.tagName==="SELECT") return;
  const on=!!(pushState.sub && pushState.row && pushState.row.enabled!==false);
  let dot="off", status, inner="";
  if(!pushSupported()){
    status=pushIsIOS() && !pushStandalone()
      ? "Per ricevere le notifiche apri Bilancio dall'icona sulla schermata Home (iPhone con iOS 16.4 o successivo)."
      : "Questo browser non supporta le notifiche push.";
  } else if(!(window.SuiteSync && SuiteSync.signedIn)){
    status="Collega prima la sincronizzazione qui sopra: le notifiche partono dal server.";
  } else if(!pushState.loaded){
    status="Controllo…"; dot="busy";
  } else if(on){
    dot="on";
    const hour=Number(pushState.row.notify_hour??8);
    status=`Attive su questo telefono: ogni giorno alle ${pad2(hour)}:00 ti avviso delle ricorrenti e pianificate del giorno dopo.`;
    inner=`<div class="push-settings">
        <label class="push-line"><span>Ora dell'avviso</span><select id="pushHourSelect" class="text-input" aria-label="Ora dell'avviso">${pushHourOptions(hour)}</select></label>
        <label class="toggle-line push-line"><input type="checkbox" id="pushAmountsInput"${pushState.row.show_amounts?" checked":""}> Mostra gli importi nella notifica</label>
        ${"monthly_summary" in pushState.row
          ? `<label class="toggle-line push-line"><input type="checkbox" id="pushMonthlyInput"${pushState.row.monthly_summary!==false?" checked":""}> Riepilogo mensile (il giorno 1, alla stessa ora)</label>`
          : `<p class="push-msg">Riepilogo mensile: per attivarlo esegui su Supabase il file supabase/riepilogo_mensile.sql (vedi GUIDA_NOTIFICHE).</p>`}
      </div>
      <div class="suite-sync-actions"><button type="button" class="suite-sync-primary primary" id="pushTestBtn"${pushState.busy?" disabled":""}>Invia una prova</button>${"monthly_summary" in pushState.row?`<button type="button" id="pushTestMonthlyBtn"${pushState.busy?" disabled":""}>Prova riepilogo</button>`:""}<button type="button" id="pushOffBtn"${pushState.busy?" disabled":""}>Disattiva</button></div>`;
  } else {
    status=Notification.permission==="denied"
      ? "Notifiche bloccate per Bilancio: riattivale in Impostazioni › Notifiche › Bilancio, poi torna qui."
      : "Ricevi la sera prima un avviso con le ricorrenti e le pianificate in scadenza il giorno dopo.";
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
async function pushSaveRow(extra){
  const j=pushState.sub.toJSON();
  await SuiteSync.api("/rest/v1/push_subscriptions?on_conflict=endpoint",{method:"POST",
    headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    json:Object.assign({user_id:SuiteSync.userId,app:"bilancio",endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,
      tz:(Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Rome"),device:navigator.userAgent.slice(0,120),
      enabled:true,updated_at:new Date().toISOString()},extra||{})});
}
async function pushEnable(){
  if(pushState.busy) return;
  pushState.busy=true; pushSay("");
  try{
    // Il permesso va chiesto subito dopo il tocco (regola di iOS).
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){ pushState.busy=false; pushSay(perm==="denied"?"Permesso negato. Puoi riattivarlo in Impostazioni › Notifiche › Bilancio.":"Permesso non concesso.",true); return; }
    const reg=await pushRegistration();
    if(!reg) throw new Error("Service worker non attivo: riapri l'app e riprova.");
    pushState.sub=(await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToUint8(PUSH_VAPID_PUBLIC)}));
    await pushSaveRow({notify_hour:pushState.row?.notify_hour??20,show_amounts:pushState.row?.show_amounts??false});
    pushState.row={notify_hour:pushState.row?.notify_hour??20,show_amounts:pushState.row?.show_amounts??false,enabled:true};
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
async function pushUpdate(patch){
  if(!pushState.sub) return;
  const prev=Object.assign({},pushState.row);
  Object.assign(pushState.row,patch); pushState.msg=""; renderPushCard();
  try{
    await SuiteSync.api(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(pushState.sub.endpoint)}`,{method:"PATCH",
      headers:{Prefer:"return=minimal"},json:Object.assign({updated_at:new Date().toISOString()},patch)});
  }catch(e){ pushState.row=prev; pushSay(pushErrText(e),true); }
}
async function pushTest(kind){
  if(pushState.busy) return;
  const monthly=kind==="monthly";
  pushState.busy=true; pushSay(monthly?"Invio il riepilogo del mese scorso…":"Invio la prova…");
  try{
    if(syncBilancio) await syncBilancio.sync("push-test"); // la funzione legge i dati online: prima li aggiorno
    const r=await SuiteSync.api(PUSH_FN,{method:"POST",json:{test:monthly?"monthly":true}});
    pushState.busy=false;
    pushSay(r&&r.sent?"Prova inviata: dovrebbe arrivare tra pochi secondi.":"La prova non è partita: disattiva e riattiva le notifiche.",!(r&&r.sent));
  }catch(e){ pushState.busy=false; pushSay(pushErrText(e),true); }
}
document.getElementById("pushCard")?.addEventListener("click",e=>{
  const id=e.target.closest("button")?.id;
  if(id==="pushOnBtn") pushEnable();
  else if(id==="pushOffBtn") pushDisable();
  else if(id==="pushTestBtn") pushTest();
  else if(id==="pushTestMonthlyBtn") pushTest("monthly");
});
document.getElementById("pushCard")?.addEventListener("change",e=>{
  if(e.target.id==="pushHourSelect") pushUpdate({notify_hour:Number(e.target.value)});
  else if(e.target.id==="pushAmountsInput") pushUpdate({show_amounts:e.target.checked});
  else if(e.target.id==="pushMonthlyInput") pushUpdate({monthly_summary:e.target.checked});
});
renderPushCard();
setTimeout(refreshPushState,1500);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") refreshPushState(); });

/* Aperta da una notifica: va su R&P (?view=recurring) o sulle Statistiche di un mese
   (?view=stats&month=2026-09, dal riepilogo mensile), anche via messaggio dal service worker. */
(function(){
  const go=(v,month)=>{
    try{
      if(v==="recurring") switchView("recurring");
      else if(v==="stats"){
        const m=/^(\d{4})-(\d{2})$/.exec(month||"");
        if(m){ viewYear=Number(m[1]); viewMonth=Number(m[2])-1; statsTrendRange="1m"; }
        switchView("stats");
      }
    }catch(e){}
  };
  try{ const q=new URLSearchParams(location.search), v=q.get("view"); if(v){ go(v,q.get("month")); history.replaceState(null,"",location.pathname); } }catch(e){}
  if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message",e=>{ if(e.data&&e.data.type==="open-view") go(e.data.view,e.data.month); });
})();
