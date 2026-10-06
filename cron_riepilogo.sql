-- Noi Due 1.15.0 — giro orario per il riepilogo mensile.
-- Da eseguire DOPO riepilogo_mensile.sql e DOPO aver ripubblicato la funzione notify-noidue.
-- Non serve incollare nessuna password: la prende dal trigger delle notifiche già installato.
-- Gira ogni ora al minuto 10: la funzione manda il riepilogo solo il giorno 1, dalle 9:00.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare segreto text;
begin
  select substring(prosrc from '"x-noidue-secret":"([^"]+)"') into segreto
  from pg_proc where proname = 'noidue_notify_change';
  if segreto is null then
    raise exception 'Non trovo la password: le notifiche di Noi Due non sono installate (passo 2 della guida)';
  end if;

  perform cron.unschedule('noidue-riepilogo')
  where exists (select 1 from cron.job where jobname = 'noidue-riepilogo');

  perform cron.schedule('noidue-riepilogo', '10 * * * *', format(
    $f$ select net.http_post(
          url     := 'https://thdlzqhqdktbkpnplxdm.supabase.co/functions/v1/notify-noidue',
          headers := %L::jsonb,
          body    := '{"mode":"monthly"}'::jsonb); $f$,
    json_build_object('Content-Type','application/json','x-noidue-secret',segreto)::text));
end $$;

-- Per controllare: select jobname, schedule from cron.job where jobname = 'noidue-riepilogo';
