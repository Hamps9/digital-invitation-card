# Digital Invitation Card

This project runs as a Node web service.

## Deploy on Render

1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo.
3. Let Render use `render.yaml`, or set these values manually:
   - Build command: `npm install`
   - Start command: `npm start`
   - Runtime: Node 20
   - Plan: Free
4. Add `ADMIN_SECRET` in the Render environment variables if you want the admin dashboard.
5. After deployment, open the `onrender.com` URL and share it with your guests.

## Important note

This app stores invite records in `invites.json`. On Render's free web service, the filesystem is ephemeral, so invite records may not survive restarts or redeploys.

If you want invite data to persist, the next upgrade is to move invite storage to a database such as Supabase.
