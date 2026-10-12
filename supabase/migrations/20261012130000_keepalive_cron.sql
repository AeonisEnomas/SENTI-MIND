-- Keep the free-tier Render backend awake (and this project active) by having the
-- database itself call the backend's /keepalive endpoint every 10 minutes.
-- GitHub Actions schedules (.github/workflows/keep-alive.yml) remain as a backup,
-- but they start late and can be skipped; pg_cron runs on time.
--
-- /keepalive makes a tiny PostgREST read back into this project, so each ping also
-- counts as database activity. The long timeout covers a Render cold start; even if
-- pg_net gives up first, the request has already woken the service.

create extension if not exists pg_cron;
-- pg_net lives in the extensions schema (Supabase lint 0014); its functions are under net.*
create extension if not exists pg_net with schema extensions;

-- Idempotent: drop any previous version of the job before (re)scheduling it.
select cron.unschedule(jobid) from cron.job where jobname = 'senti-mind-keepalive';

select cron.schedule(
  'senti-mind-keepalive',
  '*/10 * * * *',
  $$ select net.http_get(
       url := 'https://senti-mind-majc.onrender.com/keepalive',
       timeout_milliseconds := 90000
     ) $$
);
