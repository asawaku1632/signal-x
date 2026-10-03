# SIGNALX Notification Runner

Isolated Vercel Pro cron runner for SIGNALX push notifications.

- Runs every 10 minutes on weekdays during the Tokyo market UTC window.
- Calls the production SIGNALX cron endpoints.
- Uses the same `CRON_SECRET` as the SIGNALX production project.
- Does not contain Supabase credentials or notification business logic.
