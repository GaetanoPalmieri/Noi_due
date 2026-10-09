-- Da eseguire DOPO aver pubblicato la funzione notify-scadenze (passo 4 della guida).
-- Sostituisci INCOLLA_QUI_CRON_SECRET con il valore di CRON_SECRET (file SEGRETI_NOTIFICHE.txt).
-- Gira ogni ora al minuto 5: la funzione decide da sola a chi tocca, in base all'ora scelta nell'app.

select cron.unschedule('bilancio-scadenze')
where exists (select 1 from cron.job where jobname = 'bilancio-scadenze');

select cron.schedule(
  'bilancio-scadenze',
  '5 * * * *',
  $$
  select net.http_post(
    url     := 'https://thdlzqhqdktbkpnplxdm.supabase.co/functions/v1/notify-scadenze',
    headers := '{"Content-Type":"application/json","x-cron-secret":"INCOLLA_QUI_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Per controllare che giri: select * from cron.job_run_details order by start_time desc limit 5;
-- Per vedere le risposte della funzione: select * from net._http_response order by created desc limit 5;
