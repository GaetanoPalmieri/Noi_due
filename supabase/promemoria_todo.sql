-- Noi Due 1.49.0 — Promemoria delle cose da fare (liste To-do)
-- Esegui una volta in Supabase › SQL Editor. Il cron orario del riepilogo mensile (cron_riepilogo.sql)
-- chiama già la funzione ogni ora: dalle 9 alle 21 manda a ogni telefono, una volta al giorno,
-- le cose da fare in scadenza oggi o in ritardo (solo le sue e quelle "Tutti e due").
alter table public.push_subscriptions add column if not exists last_todo_sent text;
alter table public.push_subscriptions add column if not exists todo_remind boolean default true;
