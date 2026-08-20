# No-Domain RSVP Flow

The invitation now uses a simple client-side RSVP flow.

- Guests tap the response button once.
- Gmail opens with a prefilled message to `dennishamps2000@gmail.com`.
- WhatsApp opens with the same RSVP details.

No domain, API key, or mail server setup is required for this version.

## How it works

The page prepares the response draft locally in the browser and opens the two contact channels directly.

If you later want true automatic sending from the server, you will need an email/WhatsApp provider and the matching credentials.

## Network Access & Port Forwarding

To allow guests on other devices (phones, tablets) to access invitation links:

### Option 1: Local Network IP (Recommended for home/office networks)
1. Find your computer's local IP address (e.g., `192.168.1.100`)
2. Set in `.env`:
   ```
   EXTERNAL_URL=http://192.168.1.100:3001
   ```
3. Share this URL with guests: `http://192.168.1.100:3001/invite/TOKEN`
4. Guests must be on the same WiFi network

### Option 2: Router Port Forwarding (For external access)
1. Forward port 3001 on your router to your computer's local IP
2. Use your public IP address in `.env`:
   ```
   EXTERNAL_URL=http://YOUR_PUBLIC_IP:3001
   ```
3. Note: Your public IP may change; use a dynamic DNS service for stability

### Option 3: Tunneling Service (e.g., ngrok)
1. Use ngrok or similar to expose your local server
2. Set in `.env`:
   ```
   EXTERNAL_URL=https://YOUR_TUNNEL_URL
   ```

After updating `.env`, restart the server for changes to take effect.
