-- Noi Due 1.13.0 — notifiche push "Il tuo partner ha aggiunto/rimosso qualcosa"
-- Da incollare in Supabase › SQL Editor › New query › Run (una volta sola).
-- Usa lo stesso progetto Supabase di Bilancio: la tabella push_subscriptions esiste già,
-- qui la estendiamo con due colonne in più (non toccano le righe di Bilancio).

-- 1) Colonne in più su push_subscriptions, per sapere di quale coppia/persona è ogni telefono
alter table public.push_subscriptions add column if not exists couple_id uuid;
alter table public.push_subscriptions add column if not exists person text check (person in ('a','b') or person is null);

-- 2) Chi ha salvato per ultimo i dati della coppia (serve per non avvisare chi ha appena scritto)
--    NB: la tabella aveva già una colonna "updated_by" di tipo uuid usata per altro: qui ne usiamo
--    una con nome diverso per non toccarla.
alter table public.noidue_data add column if not exists updated_by_person text check (updated_by_person in ('a','b') or updated_by_person is null);

-- 3) Estensioni necessarie (se non già presenti da Bilancio)
create extension if not exists pg_net with schema extensions;

-- 4) Funzione che avvisa l'altra persona ogni volta che i dati della coppia cambiano
--    Sostituisci INCOLLA_QUI_NOIDUE_TRIGGER_SECRET con il valore di NOIDUE_TRIGGER_SECRET
--    (lo stesso che metterai nei Secrets della funzione, passo 3 della guida).
create or replace function public.noidue_notify_change() returns trigger as $$
begin
  if (new.data is distinct from old.data) then
    perform net.http_post(
      url     := 'https://thdlzqhqdktbkpnplxdm.supabase.co/functions/v1/notify-noidue',
      headers := '{"Content-Type":"application/json","x-noidue-secret":"INCOLLA_QUI_NOIDUE_TRIGGER_SECRET"}'::jsonb,
      body    := jsonb_build_object('couple_id', new.couple_id, 'editor', new.updated_by_person, 'old', old.data, 'new', new.data)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists noidue_data_notify on public.noidue_data;
create trigger noidue_data_notify
  after update on public.noidue_data
  for each row execute function public.noidue_notify_change();

-- Per controllare che parta: select * from net._http_response order by created desc limit 5;
