// Noi Due — notifiche push "Il tuo partner ha aggiunto/rimosso qualcosa" (Supabase Edge Function).
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
  const addedByList: string[] = [], removedByList: string[] = [];
  newLists.forEach((l, id) => {
    const old = oldLists.get(id);
    const d = diffIds(old?.items, l.items);
    if (d.added.length) { itemsAdded += d.added.length; addedByList.push(`${d.added.length} a ${l.name || "una lista"}`); }
    if (d.removed.length) { itemsRemoved += d.removed.length; removedByList.push(`${d.removed.length} da ${l.name || "una lista"}`); }
  });
  // liste cancellate del tutto: i loro articoli contano come rimossi
  oldLists.forEach((l, id) => {
    if (newLists.has(id)) return;
    const n = (l.items || []).length;
    if (n) { itemsRemoved += n; removedByList.push(`${n} da ${l.name || "una lista"}`); }
  });

  const addedParts: string[] = [];
  if (txDiff.added.length) addedParts.push(`${txDiff.added.length} ${txDiff.added.length === 1 ? "movimento" : "movimenti"}`);
  if (addedByList.length) addedParts.push(addedByList.join(", "));
  const removedParts: string[] = [];
  if (txDiff.removed.length) removedParts.push(`${txDiff.removed.length} ${txDiff.removed.length === 1 ? "movimento" : "movimenti"}`);
  if (removedByList.length) removedParts.push(removedByList.join(", "));

  if (!addedParts.length && !removedParts.length) return null;
  const bits: string[] = [];
  if (addedParts.length) bits.push(`ha aggiunto ${addedParts.join(" e ")}`);
  if (removedParts.length) bits.push(`ha rimosso ${removedParts.join(" e ")}`);
  return { addedCount: txDiff.added.length + itemsAdded, removedCount: txDiff.removed.length + itemsRemoved, text: bits.join(" · ") };
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

  /* ---- Giro dal trigger su noidue_data: qualcuno ha appena salvato ---- */
  if (triggerSecret) {
    if (!env("NOIDUE_TRIGGER_SECRET") || triggerSecret !== env("NOIDUE_TRIGGER_SECRET")) return json({ error: "Segreto non valido" }, 401);
    const { couple_id, editor, old, new: fresh } = await req.json().catch(() => ({}));
    if (!couple_id) return json({ error: "couple_id mancante" }, 400);
    const msg = buildMessage(old, fresh);
    if (!msg) return json({ sent: 0, reason: "nessuna aggiunta/rimozione" });
    const who = editor === "a" || editor === "b" ? (fresh?.couple?.[editor]?.name || "Il tuo partner") : "Il tuo partner";
    const payload = { title: "Noi Due", body: `${who} ${msg.text}`, tag: "noidue-sync", url: "./" };
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
  const payload = { title: "Noi Due", body: "Notifiche attive: ti avviso quando viene aggiunto o rimosso qualcosa.", tag: "noidue-prova", url: "./" };
  const results: string[] = [];
  for (const s of subs) results.push(await send(s, payload));
  return json({ sent: results.filter((r) => r === "ok").length, results });
});
