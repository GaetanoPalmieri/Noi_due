-- Riepilogo mensile (Bilancio 1.21.0 / Noi Due 1.15.0)
-- Da incollare in Supabase › SQL Editor › New query › Run (una volta sola).
-- È lo stesso file in Bilancio e in Noi Due: se lo esegui due volte non succede nulla.

-- Interruttore "Riepilogo mensile" per ogni telefono (acceso di default)
alter table public.push_subscriptions add column if not exists monthly_summary boolean not null default true;

-- Ultimo mese di cui è stato mandato il riepilogo (es. '2026-09'): evita doppioni
alter table public.push_subscriptions add column if not exists last_monthly_sent text;
