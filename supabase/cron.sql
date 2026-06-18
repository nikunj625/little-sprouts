-- =====================================================================
--  Schedule the reminder function every 15 minutes with pg_cron.
--  Run once in the SQL Editor AFTER deploying the edge function.
--  Replace <PROJECT_REF> and <ANON_OR_SERVICE_KEY>.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'little-sprouts-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers:= jsonb_build_object(
                'Content-Type','application/json',
                'Authorization','Bearer <ANON_OR_SERVICE_KEY>'),
    body   := '{}'::jsonb
  );
  $$
);

-- To remove later:  select cron.unschedule('little-sprouts-reminders');
