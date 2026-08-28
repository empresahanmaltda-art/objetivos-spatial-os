-- Replace the placeholders in the Supabase SQL editor. Never commit the real secrets.
select vault.create_secret('https://PROJECT_REF.supabase.co', 'objetivos_project_url');
select vault.create_secret('GENERATED_CRON_SECRET', 'objetivos_cron_secret');

select cron.schedule(
  'objetivos-push-due',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'objetivos_project_url') || '/functions/v1/push-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'objetivos_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);

