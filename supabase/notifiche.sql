-- Bilancio 1.18.0 — notifiche push "Scadenze di domani"
-- Da incollare in Supabase › SQL Editor › New query › Run (una volta sola).

-- 1) Telefoni iscritti alle notifiche (uno per telefono)
create table if not exists public.push_subscriptions (
  id            bigserial primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app           text not null default 'bilancio',
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  tz            text not null default 'Europe/Rome',
  notify_hour   int  not null default 20 check (notify_hour between 0 and 23),
  show_amounts  boolean not null default false,
  enabled       boolean not null default true,
  last_sent_day date,
  device        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: solo le mie" on public.push_subscriptions;
create policy "push: solo le mie" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) Estensioni per il giro orario
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
