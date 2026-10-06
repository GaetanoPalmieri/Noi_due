-- Noi Due 1.15.0 — giro orario per il riepilogo mensile.
-- Da eseguire DOPO riepilogo_mensile.sql e DOPO aver ripubblicato la funzione notify-noidue.
-- Sostituisci INCOLLA_QUI_NOIDUE_TRIGGER_SECRET con lo stesso valore di NOIDUE_TRIGGER_SECRET
-- (la password inventata quando hai attivato le notifiche di Noi Due).
-- Gira ogni ora al minuto 10: la funzione manda il riepilogo solo il giorno 1, dalle 9:00.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('noidue-riepilogo')
where exists (select 1 from cron.job where jobname = 'noidue-riepilogo');

select cron.schedule(
  'noidue-riepilogo',
  '10 * * * *',
  $$
  select net.http_post(
    url     := 'https://thdlzqhqdktbkpnplxdm.supabase.co/functions/v1/notify-noidue',
    headers := '{"Content-Type":"application/json","x-noidue-secret":"INCOLLA_QUI_NOIDUE_TRIGGER_SECRET"}'::jsonb,
    body    := '{"mode":"monthly"}'::jsonb
  );
  $$
);

-- Per controllare che giri: select * from cron.job_run_details order by start_time desc limit 5;
