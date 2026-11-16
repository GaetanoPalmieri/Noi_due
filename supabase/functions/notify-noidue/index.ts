// Noi Due — notifiche push "Il tuo partner ha aggiunto/rimosso qualcosa" + "Riepilogo mensile".
//
// v1.21.0: nelle liste la notifica dice quali prodotti sono stati aggiunti ("➕ Spesa: latte, pane, mele")
// e quali sono stati presi ("✓ Preso da Spesa: …").
//
// v1.15.0: un cron chiama la funzione ogni ora con {"mode":"monthly"} (stessa intestazione
// x-noidue-secret del trigger). Il giorno 1 di ogni mese, dalle 9:00 nel fuso del telefono,
// ogni telefono della coppia riceve il riepilogo del mese appena chiuso: spese di coppia,
// chi ha pagato, categorie principali e chi deve quanto a chi.
//
// Chi la chiama:
//  - il trigger SQL su noidue_data (intestazione x-noidue-secret), ogni volta che un telefono salva:
//    confronta i dati prima/dopo, calcola movimenti e articoli delle liste aggiunti o rimossi,
//    e avvisa SOLO i telefoni dell'altra persona della coppia (non quelli di chi ha appena scritto);
//  - l'app, con il pulsante "Invia una prova" (token dell'utente collegato): invia subito una prova
//    a tutti i telefoni della coppia.
//
// Segreti da impostare in Supabase (Edge Functions › Secrets):
//   NOIDUE_VAPID_PUBLIC_KEY, NOIDUE_VAPID_PRIVATE_KEY, NOIDUE_VAPID_SUBJECT (mailto:tua@email), NOIDUE_TRIGGER_SECRET
// (nomi diversi da quelli di Bilancio: nello stesso progetto Supabase i Secrets sono condivisi tra le funzioni.)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
// In Supabase la funzione va pubblicata con "Verify JWT" disattivato: i controlli sono qui sotto.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const APP = "noidue";
const env = (k: string) => Deno.env.get(k) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
webpush.setVapidDetails(
  env("NOIDUE_VAPID_SUBJECT") || "mailto:noidue@example.com",
  env("NOIDUE_VAPID_PUBLIC_KEY"),
  env("NOIDUE_VAPID_PRIVATE_KEY"),
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-noidue-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ---------- Differenze fra prima e dopo ---------- */
function byId(arr: any[]) {
  const m = new Map<string, any>();
  (Array.isArray(arr) ? arr : []).forEach((x) => { if (x && x.id != null) m.set(String(x.id), x); });
  return m;
}
function diffIds(oldArr: any[], newArr: any[]) {
  const o = byId(oldArr), n = byId(newArr);
  const added: any[] = [], removed: any[] = [];
  n.forEach((v, k) => { if (!o.has(k)) added.push(v); });
  o.forEach((v, k) => { if (!n.has(k)) removed.push(v); });
  return { added, removed };
}

function buildMessage(oldData: any, newData: any) {
  const txDiff = diffIds(oldData?.transactions, newData?.transactions);
  const oldLists = byId(oldData?.lists), newLists = byId(newData?.lists);
  let itemsAdded = 0, itemsRemoved = 0;
  const addedByList: string[] = [], removedByList: string[] = [], doneByList: string[] = [];
  const lines: string[] = [];
  newLists.forEach((l, id) => {
    const old = oldLists.get(id);
    const d = diffIds(old?.items, l.items);
    // v1.48.0 — liste To-do: notifica le cose segnate come fatte
    if (l?.kind === "todo") {
      const was = byId(old?.items);
      // v1.49.0 — anche le cose che si ripetono (registro doneLog): non diventano "fatte", passano alla scadenza dopo
      const fromLog = diffIds(old?.doneLog, l.doneLog).added.map((e: any) => ({ id: e.itemId, text: e.text }));
      const seen = new Set(fromLog.map((x: any) => x.id));
      const doneNow = [...fromLog, ...(Array.isArray(l.items) ? l.items : []).filter((i: any) => i?.done && was.has(i.id) && !was.get(i.id)?.done && !seen.has(i.id))];
      if (doneNow.length) {
        doneByList.push(`${doneNow.length} in ${l.name || "una lista"}`);
        const names = doneNow.map((i: any) => String(i.text || "").slice(0, 30)).filter(Boolean);
        lines.push(`✅ Fatto · ${l.name || "Lista"}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` e altri ${names.length - 3}` : ""}`);
      }
    }
    // v1.21.0 — nella notifica anche i nomi dei prodotti aggiunti (i primi 3)
    if (d.added.length) {
      itemsAdded += d.added.length; addedByList.push(`${d.added.length} a ${l.name || "una lista"}`);
      const names = d.added.map((i: any) => `${Number(i.qty) > 1 ? i.qty + "× " : ""}${String(i.text || "").slice(0, 30)}`).filter(Boolean);
      lines.push(`➕ ${l.name || "Lista"}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` e altri ${names.length - 3}` : ""}`);
    }
    // prodotti presi (segnati come acquistati)
    const pd = diffIds(old?.purchases, l.purchases);
    if (pd.added.length) {
      itemsAdded += pd.added.length;
      const names = pd.added.map((x: any) => String(x.text || "").slice(0, 30)).filter(Boolean);
      lines.push(`✓ Preso da ${l.name || "Lista"}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` e altri ${names.length - 3}` : ""}`);
    }
    if (d.removed.length) { itemsRemoved += d.removed.length; removedByList.push(`${d.removed.length} da ${l.name || "una lista"}`); lines.push(`➖ ${d.removed.length} · 📝 ${l.name || "Lista"}`); }
  });
  // liste cancellate del tutto: i loro articoli contano come rimossi
  oldLists.forEach((l, id) => {
    if (newLists.has(id)) return;
    const n = (l.items || []).length;
    if (n) { itemsRemoved += n; removedByList.push(`${n} da ${l.name || "una lista"}`); lines.push(`➖ ${n} · 📝 ${l.name || "Lista"} (eliminata)`); }
  });

  const addedParts: string[] = [];
  if (txDiff.added.length) addedParts.push(`${txDiff.added.length} ${txDiff.added.length === 1 ? "movimento" : "movimenti"}`);
  if (addedByList.length) addedParts.push(addedByList.join(", "));
  const removedParts: string[] = [];
  if (txDiff.removed.length) removedParts.push(`${txDiff.removed.length} ${txDiff.removed.length === 1 ? "movimento" : "movimenti"}`);
  if (removedByList.length) removedParts.push(removedByList.join(", "));

  if (!addedParts.length && !removedParts.length && !doneByList.length) return null;
  const bits: string[] = [];
  if (addedParts.length) bits.push(`ha aggiunto ${addedParts.join(" e ")}`);
  if (doneByList.length) bits.push(`ha completato ${doneByList.join(", ")}`);
  if (removedParts.length) bits.push(`ha rimosso ${removedParts.join(" e ")}`);
  const mov = (n: number) => `${n} ${n === 1 ? "movimento" : "movimenti"}`;
  if (txDiff.removed.length) lines.unshift(`➖ ${mov(txDiff.removed.length)}`);
  if (txDiff.added.length) lines.unshift(`➕ ${mov(txDiff.added.length)}`);
  const doneCount = doneByList.reduce((n, x) => n + (parseInt(x, 10) || 0), 0);
  return { addedCount: txDiff.added.length + itemsAdded, removedCount: txDiff.removed.length + itemsRemoved, doneCount, text: bits.join(" · "), lines };
}

/* ---------- Riepilogo mensile (stessa logica dell'app: coupleMonthStats e coupleBalance) ---------- */
const MONTHLY_HOUR = 9;
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => {
  const v = Math.round((n || 0) * 100) / 100;
  // formato unico della suite: 1.234,56 € (come nelle app)
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  return (v <= -0.005 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d + "\u00a0€";
};
function monthBefore(key: string) {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}
const monthName = (key: string) => MESI[Number(key.slice(5, 7)) - 1] || key;
// "a settembre" ma "ad agosto / ad aprile / ad ottobre"
const aMese = (key: string) => (/^[aeiou]/.test(monthName(key)) ? "ad " : "a ") + monthName(key);

function localNow(tz: string) {
  let zone = tz || "Europe/Rome";
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Europe/Rome"; }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { today: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function makeCouple(data: any) {
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const couple = data?.couple || {};
  const accOwner = (id: any) => accounts.find((a: any) => a.id === id)?.owner || "joint";
  const groupById = (id: any) => groups.find((g: any) => g.id === id);
  const defaultSplitFor = (type: string, gid: any) => type === "income" ? "personal" : (groupById(gid)?.defaultSplit || couple.defaultSplit || "half");
  const splitShareA = (split: any, owner: string, type: string, gid: any) => {
    const mode = split?.mode || defaultSplitFor(type, gid);
    if (mode === "pct") return Math.min(100, Math.max(0, Number(split?.pctA ?? 50))) / 100;
    if (mode === "other") return owner === "a" ? 0 : 1;
    if (mode === "personal") return owner === "a" ? 1 : 0;
    return 0.5;
  };
  const txDebt = (t: any) => {
    if (!t || t.isBalanceAdjustment) return 0;
    const amount = Number(t.amount) || 0;
    if (t.type === "transfer") {
      const from = accOwner(t.accountId), to = accOwner(t.toAccountId);
      if (from === "a" && to === "b") return amount;
      if (from === "b" && to === "a") return -amount;
      return 0;
    }
    const owner = accOwner(t.accountId);
    if (owner !== "a" && owner !== "b") return 0;
    const shareA = splitShareA(t.split, owner, t.type, t.groupId);
    const v = owner === "a" ? amount * (1 - shareA) : -amount * shareA;
    return t.type === "income" ? -v : v;
  };
  const name = (k: string) => (k === "a" || k === "b") ? (couple?.[k]?.name || (k === "a" ? "Persona 1" : "Persona 2")) : "Cassa comune";
  return { accOwner, txDebt, name };
}

function monthlyMessage(data: any, key: string, today: string, showAmounts: boolean) {
  const C = makeCouple(data);
  const all = Array.isArray(data?.transactions) ? data.transactions : [];
  const exp = (k: string) => all.filter((t: any) => t && typeof t.date === "string" && t.date.startsWith(k) && t.type === "expense" && !t.isBalanceAdjustment);
  const tx = exp(key);
  if (!tx.length) return null;
  const paid: Record<string, number> = { a: 0, b: 0, joint: 0 };
  const byCat = new Map<string, number>();
  let total = 0;
  tx.forEach((t: any) => {
    const a = Number(t.amount) || 0, o = C.accOwner(t.accountId);
    total += a;
    paid[o === "a" || o === "b" ? o : "joint"] += a;
    byCat.set(String(t.categoryId ?? ""), (byCat.get(String(t.categoryId ?? "")) || 0) + a);
  });
  const cats = new Map((data?.categories || []).map((c: any) => [String(c.id), c]));
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => {
    const c: any = cats.get(id) || {};
    return { emoji: c.emoji || "", name: c.name || "Altro", amount: v };
  });
  // Saldo di coppia come nell'app (movimenti fino a oggi)
  const bal = Math.round(all.filter((t: any) => t && typeof t.date === "string" && t.date <= today).reduce((s: number, t: any) => s + C.txDebt(t), 0) * 100) / 100;
  let balance = "⚖️ In pari";
  if (Math.abs(bal) >= 0.005) {
    const debtor = bal > 0 ? "b" : "a", creditor = debtor === "a" ? "b" : "a";
    balance = `⚖️ ${C.name(debtor)} → ${C.name(creditor)}${showAmounts ? " " + fmt(Math.abs(bal)) : ""}`;
  }
  const euro0 = (n: number) => Math.round(n).toLocaleString("it-IT") + "\u00a0€";
  const lines: string[] = [];
  if (showAmounts) {
    lines.push(`💶 Spese ${fmt(total)}`);
    const who = (["a", "b", "joint"] as const).filter((k) => paid[k] > 0).map((k) => `${k === "joint" ? "Comune" : C.name(k)} ${euro0(paid[k])}`);
    if (who.length > 1) lines.push("💳 " + who.join(" · "));
    if (top.length) lines.push(top.map((t) => `${t.emoji || "•"} ${euro0(t.amount)}`).join(" · "));
  } else {
    lines.push(`🧾 ${tx.length} ${tx.length === 1 ? "spesa" : "spese"}`);
    if (top.length) lines.push(top.map((t) => `${t.emoji || "•"} ${t.name}`).join(" · "));
  }
  const prevKey = monthBefore(key);
  const prevTotal = exp(prevKey).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
  if (prevTotal > 0 && total > 0) {
    const pct = Math.round(((total - prevTotal) / prevTotal) * 100);
    lines.push(pct === 0 ? `➖ Spese stabili vs ${monthName(prevKey)}` : `${pct > 0 ? "📈 +" : "📉 −"}${Math.abs(pct)}% spese vs ${monthName(prevKey)}`);
  }
  // v1.21.0 — chi ha preso cosa dalle liste nel mese
  const bought: Record<string, number> = { a: 0, b: 0 };
  (Array.isArray(data?.lists) ? data.lists : []).filter((l: any) => l?.kind !== "todo").forEach((l: any) => (Array.isArray(l?.purchases) ? l.purchases : []).forEach((p: any) => {
    if (p && typeof p.at === "string" && p.at.startsWith(key) && (p.by === "a" || p.by === "b")) bought[p.by]++;
  }));
  if (bought.a + bought.b > 0) lines.push("🛒 Presi " + (["a", "b"] as const).filter((k) => bought[k] > 0).map((k) => `${C.name(k)} ${bought[k]}`).join(" · "));
  lines.push(balance);
  const m = monthName(key);
  return { title: `📊 ${m.charAt(0).toUpperCase() + m.slice(1)}`, body: lines.join("\n"), tag: `noidue-riepilogo-${key}`, url: "./" };
}

/* ---------- v1.49.0 — Promemoria delle cose da fare (liste To-do) ---------- */
const TODO_FROM = 9, TODO_TO = 21;
function todoMessage(data: any, person: string | null, today: string) {
  const late: string[] = [], now: string[] = [];
  (Array.isArray(data?.lists) ? data.lists : []).filter((l: any) => l?.kind === "todo").forEach((l: any) => (Array.isArray(l.items) ? l.items : []).forEach((i: any) => {
    if (!i || i.done || typeof i.due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(i.due) || i.due > today) return;
    if (person && (i.forWhom === "a" || i.forWhom === "b") && i.forWhom !== person) return;
    (i.due < today ? late : now).push(String(i.text || "").slice(0, 40));
  }));
  if (!late.length && !now.length) return null;
  const more = (arr: string[]) => `${arr.slice(0, 4).join(", ")}${arr.length > 4 ? ` e altre ${arr.length - 4}` : ""}`;
  const lines: string[] = [];
  if (now.length) lines.push(`📌 Oggi: ${more(now)}`);
  if (late.length) lines.push(`⚠️ In ritardo: ${more(late)}`);
  const n = late.length + now.length;
  return { title: `✅ ${n} ${n === 1 ? "cosa da fare" : "cose da fare"}`, body: lines.join("\n"), tag: `noidue-todo-${today}`, url: "./" };
}
/* ---------- v1.49.0 — Avviso quando il debito supera la soglia scelta nell'app ---------- */
function coupleBal(data: any, today: string) {
  const C = makeCouple(data);
  return Math.round((Array.isArray(data?.transactions) ? data.transactions : []).filter((t: any) => t && typeof t.date === "string" && t.date <= today).reduce((s: number, t: any) => s + C.txDebt(t), 0) * 100) / 100;
}
function settleAlert(oldData: any, newData: any) {
  const T = Number(newData?.couple?.settleAlert) || 0;
  if (!(T > 0) || !oldData) return null;
  const today = localNow("Europe/Rome").today;
  const before = Math.abs(coupleBal(oldData, today)), after = coupleBal(newData, today);
  if (Math.abs(after) < T || before >= T) return null;
  const C = makeCouple(newData), debtor = after > 0 ? "b" : "a", creditor = debtor === "a" ? "b" : "a";
  return { debtor, creditor, amount: Math.abs(after), T, name: C.name };
}

async function loadCouple(coupleId: string) {
  const { data } = await admin.from("noidue_data").select("data").eq("couple_id", coupleId).maybeSingle();
  return data?.data ?? null;
}

async function send(sub: any, payload: unknown) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 6, urgency: "normal" },
    );
    return "ok";
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
      return "gone";
    }
    console.error("push", e?.statusCode, e?.body || e?.message);
    return "error";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usa POST" }, 405);

  const triggerSecret = req.headers.get("x-noidue-secret");
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  const reqBody: any = await req.json().catch(() => ({}));

  /* ---- Giro dal trigger su noidue_data (o dal cron del riepilogo mensile) ---- */
  if (triggerSecret) {
    if (!env("NOIDUE_TRIGGER_SECRET") || triggerSecret !== env("NOIDUE_TRIGGER_SECRET")) return json({ error: "Segreto non valido" }, 401);

    if (reqBody?.mode === "monthly") {
      const { data: subs, error } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("enabled", true).not("couple_id", "is", null);
      if (error) return json({ error: error.message }, 500);
      const cache = new Map<string, any>();
      let sent = 0, skipped = 0, todoSent = 0;
      // Promemoria delle cose da fare: una volta al giorno per telefono, dalle 9 (se la colonna esiste e l'opzione è attiva)
      for (const s of subs || []) {
        if (!("last_todo_sent" in s) || s.todo_remind === false) continue;
        const { today, hour } = localNow(s.tz);
        if (hour < TODO_FROM || hour > TODO_TO || s.last_todo_sent === today) continue;
        if (!cache.has(s.couple_id)) cache.set(s.couple_id, await loadCouple(s.couple_id));
        const msg = todoMessage(cache.get(s.couple_id), s.person === "a" || s.person === "b" ? s.person : null, today);
        if (!msg) continue; // niente in scadenza: si riprova all'ora dopo (se ne aggiungete una per oggi arriva lo stesso)
        const r = await send(s, msg);
        if (r === "ok") { todoSent++; await admin.from("push_subscriptions").update({ last_todo_sent: today }).eq("id", s.id); }
      }
      for (const s of subs || []) {
        const { today, hour } = localNow(s.tz);
        // Solo il giorno 1 dalle 9, una volta per mese, e solo se la colonna esiste (riepilogo_mensile.sql eseguito)
        if (!today.endsWith("-01") || hour < MONTHLY_HOUR || !("last_monthly_sent" in s) || s.monthly_summary === false) { skipped++; continue; }
        const key = monthBefore(today.slice(0, 7));
        if (s.last_monthly_sent === key) { skipped++; continue; }
        if (!cache.has(s.couple_id)) cache.set(s.couple_id, await loadCouple(s.couple_id));
        const msg = monthlyMessage(cache.get(s.couple_id), key, today, s.show_amounts);
        const r = msg ? await send(s, msg) : "nothing";
        if (r === "ok") sent++;
        if (r === "ok" || r === "nothing") await admin.from("push_subscriptions").update({ last_monthly_sent: key }).eq("id", s.id);
      }
      return json({ monthly: sent, todo: todoSent, skipped, total: subs?.length || 0 });
    }

    const { couple_id, editor, old, new: fresh } = reqBody || {};
    if (!couple_id) return json({ error: "couple_id mancante" }, 400);
    // v1.49.0 — soglia del rimborso superata: avviso a tutti e due
    const sa = settleAlert(old, fresh);
    if (sa) {
      const { data: all } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("couple_id", couple_id).eq("enabled", true);
      for (const s of all || []) await send(s, { title: "⚖️ Ora di un rimborso?", body: s.show_amounts === false
        ? `${sa.name(sa.debtor)} ha superato la soglia scelta: conviene registrare un rimborso a ${sa.name(sa.creditor)}.`
        : `${sa.name(sa.debtor)} deve ${fmt(sa.amount)} a ${sa.name(sa.creditor)} (soglia ${fmt(sa.T)}).`, tag: "noidue-soglia", url: "./" });
    }
    const msg = buildMessage(old, fresh);
    if (!msg) return json({ sent: 0, reason: "nessuna aggiunta/rimozione", alert: !!sa });
    const who = editor === "a" || editor === "b" ? (fresh?.couple?.[editor]?.name || "Il tuo partner") : "Il tuo partner";
    const tot = msg.addedCount + msg.removedCount + (msg.doneCount || 0);
    const payload = { title: `👤 ${who} · ${tot} ${tot === 1 ? "modifica" : "modifiche"}`, body: msg.lines.slice(0, 5).join("\n"), tag: "noidue-sync", url: "./" };
    let q = admin.from("push_subscriptions").select("*").eq("app", APP).eq("couple_id", couple_id).eq("enabled", true);
    const { data: subs } = await q;
    const targets = (subs || []).filter((s: any) => !editor || !s.person || s.person !== editor);
    const results: string[] = [];
    for (const s of targets) results.push(await send(s, payload));
    return json({ sent: results.filter((r) => r === "ok").length, results });
  }

  /* ---- Prova dall'app ---- */
  const { data: u, error } = await admin.auth.getUser(bearer);
  if (error || !u?.user) return json({ error: "Accesso non valido: rifai l'accesso alla sincronizzazione." }, 401);
  const { data: members } = await admin.from("couple_members").select("couple_id").eq("user_id", u.user.id);
  const coupleId = members?.[0]?.couple_id;
  if (!coupleId) return json({ error: "Questo account non è collegato a una coppia." }, 404);
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("app", APP).eq("couple_id", coupleId).eq("enabled", true);
  if (!subs?.length) return json({ error: "Nessun telefono iscritto: attiva prima le notifiche." }, 404);
  if (reqBody?.test === "monthly") {
    // Prova del riepilogo: solo ai telefoni di chi l'ha chiesta (stesso utente), mese appena chiuso
    const coupleData = await loadCouple(coupleId);
    const mine = subs.filter((s: any) => s.user_id === u.user.id && (!reqBody.endpoint || s.endpoint === reqBody.endpoint));
    const results: string[] = [];
    for (const s of (mine.length ? mine : subs)) {
      const { today } = localNow(s.tz);
      const key = monthBefore(today.slice(0, 7));
      const msg = monthlyMessage(coupleData, key, today, s.show_amounts)
        || { title: `📊 ${monthName(key).charAt(0).toUpperCase() + monthName(key).slice(1)}`, body: "🧾 Nessuna spesa\n📅 Il riepilogo arriva il giorno 1 di ogni mese", tag: "noidue-riepilogo-prova", url: "./" };
      results.push(await send(s, msg));
    }
    return json({ sent: results.filter((r) => r === "ok").length, results });
  }
  const payload = { title: "✅ Notifiche attive", body: "➕ Aggiunte del partner\n➖ Rimozioni del partner\n📊 Riepilogo il giorno 1", tag: "noidue-prova", url: "./" };
  const results: string[] = [];
  for (const s of subs) results.push(await send(s, payload));
  return json({ sent: results.filter((r) => r === "ok").length, results });
});
