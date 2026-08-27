# Digital Invitation Card

This project runs as a Node web service.

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Let Render use render.yaml, or set these values manually:
   - Build command: npm install
   - Start command: npm start
   - Runtime: Node 20
   - Plan: Free
4. Add these environment variables in Render:
   - ADMIN_SECRET for the admin dashboard access code
   - SUPABASE_URL from your Supabase project settings
   - SUPABASE_SERVICE_ROLE_KEY from Supabase API keys. Use the service-role secret key for server writes, not the anon/publishable key.
5. After deployment, open the onrender.com URL and share it with your guests.

## Supabase setup

1. Create a new Supabase project.
2. Open the SQL editor and run supabase-schema.sql.
3. Copy the project URL into SUPABASE_URL.
4. Copy the current secret or service role key into SUPABASE_SERVICE_ROLE_KEY. In Render, update the variable under Environment, save changes, and redeploy. The admin dashboard reports the live connection status.

The app will seed the current local site-settings.json and invites.json data into Supabase the first time it starts with those variables set.

## Important note

This app now uses Supabase for permanent storage when the Supabase environment variables are set. On Render's free web service, the filesystem is still ephemeral, so Supabase is what keeps your invitation settings and invite links online permanently.
