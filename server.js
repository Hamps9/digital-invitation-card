const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function loadDotEnv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.replace(/^\uFEFF/, '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).replace(/^\uFEFF/, '').trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key && !(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function readDotEnvValue(filePath, wantedKey) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const lines = raw.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.replace(/^\uFEFF/, '').trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx === -1) continue;
            const key = trimmed.slice(0, idx).replace(/^\uFEFF/, '').trim();
            if (key === wantedKey) return trimmed.slice(idx + 1).trim();
        }
    } catch {
        return '';
    }
    return '';
}

function getAdminSecret() {
    return String(process.env.ADMIN_SECRET || readDotEnvValue(path.join(__dirname, '.env'), 'ADMIN_SECRET') || '').trim();
}

loadDotEnv(path.join(__dirname, '.env'));

const PORT = process.env.PORT || 3001;
const EXTERNAL_URL = process.env.EXTERNAL_URL || process.env.RENDER_EXTERNAL_URL || ''; // e.g., https://your-app.onrender.com
const ROOT = __dirname;
const INVITATION_FILE = path.join(ROOT, 'Invitation Card.html');
const ADMIN_FILE = path.join(ROOT, 'admin.html');
const ADMIN_ACCESS_FILE = path.join(ROOT, 'admin-access.html');
const INVITES_FILE = path.join(ROOT, 'invites.json');
const ADMIN_SECRET = getAdminSecret();
const ADMIN_COOKIE_NAME = 'admin_session';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_OPENING_MESSAGE = 'You are warmly invited to celebrate our special day.';

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ({
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.json': 'application/json; charset=utf-8'
    })[ext] || 'application/octet-stream';
}

function normalizeWhatsAppNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return '26' + digits.slice(1);
    return digits;
}

function buildMessage(data) {
    return [
        'Wedding RSVP Response',
        '',
        `Name: ${data.name}`,
        `Phone: ${data.phone}`,
        `Will Attend: ${data.attendingText || data.attending}`,
        `Number Attending: ${data.guests}`,
        `Special Requests: ${data.notes || 'None'}`,
        '',
        `Submitted: ${new Date(data.submittedAt || Date.now()).toLocaleString()}`
    ].join('\n');
}

function isConfigured(value) {
    return Boolean(String(value || '').trim());
}

function cleanText(value, maxLength) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeInviteType(value) {
    const type = cleanText(value, 24).toLowerCase();
    if (type === 'individual' || type === 'couple' || type === 'family') return type;
    return 'custom';
}

function defaultOpeningMessage(type) {
    if (type === 'family') return 'You and your family are warmly invited to celebrate our special day.';
    if (type === 'couple') return 'You are warmly invited to celebrate our special day together.';
    return DEFAULT_OPENING_MESSAGE;
}

async function readInviteStore() {
    try {
        const raw = await fsp.readFile(INVITES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeInviteStore(invites) {
    const tmpFile = INVITES_FILE + '.tmp';
    await fsp.writeFile(tmpFile, JSON.stringify(invites, null, 2), 'utf8');
    await fsp.rename(tmpFile, INVITES_FILE);
}

async function findInvite(token) {
    const invites = await readInviteStore();
    return invites.find(invite => invite.token === token) || null;
}

function createInviteRecord(body) {
    const inviteType = normalizeInviteType(body.inviteType);
    const displayName = cleanText(body.displayName || body.name || '', 120);
    const openingMessage = cleanText(body.openingMessage || body.message || defaultOpeningMessage(inviteType), 240) || defaultOpeningMessage(inviteType);
    const token = crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    return {
        token,
        displayName,
        inviteType,
        openingMessage,
        createdAt: now,
        updatedAt: now
    };
}

function buildInviteLink(req, token) {
    // If EXTERNAL_URL is configured, use it for guest links
    if (EXTERNAL_URL) {
        return `${EXTERNAL_URL}/invite/${encodeURIComponent(token)}`;
    }

    // Otherwise fall back to request headers
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    const protocol = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim() || 'http';
    return `${protocol}://${host}/invite/${encodeURIComponent(token)}`;
}

function parseCookies(header) {
    const out = {};
    String(header || '').split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) out[key] = decodeURIComponent(value);
    });
    return out;
}

function encodeBase64Url(text) {
    return Buffer.from(String(text), 'utf8').toString('base64url');
}

function decodeBase64Url(text) {
    return Buffer.from(String(text), 'base64url').toString('utf8');
}

function signAdminSession(expirationMs) {
    if (!ADMIN_SECRET) return '';
    const payload = encodeBase64Url(JSON.stringify({ exp: expirationMs }));
    const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

function verifyAdminSession(cookieValue) {
    if (!ADMIN_SECRET || !cookieValue) return false;
    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
    if (signature.length !== expected.length) return false;

    try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
        const data = JSON.parse(decodeBase64Url(payload));
        return typeof data.exp === 'number' && data.exp > Date.now();
    } catch {
        return false;
    }
}

function getAdminSession(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    return verifyAdminSession(cookies[ADMIN_COOKIE_NAME]);
}

function requireAdminSecretConfigured(res) {
    if (!ADMIN_SECRET) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'ADMIN_SECRET is not configured' }));
        return false;
    }
    return true;
}

function hasAdminAccess(req) {
    if (!ADMIN_SECRET) return false;
    return getAdminSession(req);
}

async function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
    res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
    let raw = '';
    await new Promise((resolve, reject) => {
        req.on('data', chunk => {
            raw += chunk;
            if (raw.length > 1e6) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', resolve);
        req.on('error', reject);
    });
    return raw ? JSON.parse(raw) : {};
}

async function sendWhatsApp(data) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const to = normalizeWhatsAppNumber(process.env.WHATSAPP_TO_NUMBER || '0776919101');

    if (!isConfigured(token) || !isConfigured(phoneNumberId) || !isConfigured(to)) {
        return { channel: 'whatsapp', sent: false, skipped: true, reason: 'WhatsApp not configured' };
    }

    try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: buildMessage(data) }
            })
        });

        if (!res.ok) {
            return { channel: 'whatsapp', sent: false, skipped: true, reason: `WhatsApp API error: ${res.status}` };
        }

        return { channel: 'whatsapp', sent: true };
    } catch (err) {
        return { channel: 'whatsapp', sent: false, skipped: true, reason: `WhatsApp request failed: ${err.message}` };
    }
}

async function sendEmail(data) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const to = process.env.RESEND_TO_EMAIL || 'dennishamps2000@gmail.com';

    if (!isConfigured(apiKey) || !isConfigured(from) || !isConfigured(to)) {
        return { channel: 'email', sent: false, skipped: true, reason: 'Email not configured' };
    }

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to,
                subject: `Wedding RSVP Response - ${data.name}`,
                text: buildMessage(data)
            })
        });

        if (!res.ok) {
            return { channel: 'email', sent: false, skipped: true, reason: `Email API error: ${res.status}` };
        }

        return { channel: 'email', sent: true };
    } catch (err) {
        return { channel: 'email', sent: false, skipped: true, reason: `Email request failed: ${err.message}` };
    }
}

async function serveFile(res, filePath) {
    try {
        const buf = await fsp.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath) });
        res.end(buf);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
    }
}

function parseRsvpBody(raw) {
    const data = JSON.parse(raw || '{}');
    return {
        name: String(data.name || '').trim(),
        phone: String(data.phone || '').trim(),
        attending: String(data.attending || '').trim(),
        guests: String(data.guests || '').trim(),
        notes: String(data.notes || '').trim(),
        submittedAt: data.submittedAt || new Date().toISOString(),
        attendingText: data.attendingText || (data.attending === 'yes' ? 'Joyfully Yes' : 'Regretfully No')
    };
}

function getDeliveryStatus() {
    return {
        ready: true,
        message: 'Client-side Gmail and WhatsApp drafts are enabled.'
    };
}

function authCookieOptions(maxAgeSeconds) {
    return [
        `${ADMIN_COOKIE_NAME}=`,
        `Max-Age=${maxAgeSeconds}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict'
    ].join('; ');
}

function clearAdminCookieHeader() {
    return `${ADMIN_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

function redirect(res, location, extraHeaders = {}) {
    res.writeHead(302, { Location: location, ...extraHeaders });
    res.end();
}

const server = http.createServer(async(req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (req.method === 'GET' && url.pathname === '/api/rsvp-status') {
            await sendJson(res, 200, getDeliveryStatus());
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/admin/config') {
            await sendJson(res, 200, {
                requiresAuth: Boolean(ADMIN_SECRET),
                authenticated: hasAdminAccess(req),
                accessPath: '/admin'
            });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/favicon.ico') {
            res.writeHead(204, { 'Content-Type': 'image/x-icon', 'Cache-Control': 'no-store' });
            res.end();
            return;
        }

        if (req.method === 'GET' && url.pathname === '/admin/logout') {
            redirect(res, '/admin', { 'Set-Cookie': clearAdminCookieHeader() });
            return;
        }

        if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin.html' || url.pathname === '/admin/access')) {
            if (!ADMIN_SECRET) {
                await serveFile(res, ADMIN_ACCESS_FILE);
                return;
            }

            if (hasAdminAccess(req)) {
                await serveFile(res, ADMIN_FILE);
            } else {
                await serveFile(res, ADMIN_ACCESS_FILE);
            }
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/login') {
            if (!requireAdminSecretConfigured(res)) return;

            let body = {};
            try {
                body = await readJsonBody(req);
            } catch (err) {
                await sendJson(res, 400, { ok: false, error: err.message || 'Invalid JSON body' });
                return;
            }

            const password = String(body.password || '').trim();
            if (!password) {
                await sendJson(res, 400, { ok: false, error: 'Password is required' });
                return;
            }

            const provided = Buffer.from(password);
            const expected = Buffer.from(ADMIN_SECRET);
            if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
                await sendJson(res, 401, { ok: false, error: 'Invalid access code' });
                return;
            }

            const session = signAdminSession(Date.now() + ADMIN_SESSION_TTL_MS);
            const cookie = `${ADMIN_COOKIE_NAME}=${encodeURIComponent(session)}; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; SameSite=Strict`;
            await sendJson(res, 200, { ok: true, redirectTo: '/admin' }, { 'Set-Cookie': cookie });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
            await sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearAdminCookieHeader() });
            return;
        }

        if (req.method === 'GET' && url.pathname.startsWith('/invite/')) {
            const token = decodeURIComponent(url.pathname.replace('/invite/', '').replace(/^\/+/, ''));
            if (!token) {
                redirect(res, '/');
                return;
            }
            redirect(res, `/?invite=${encodeURIComponent(token)}`);
            return;
        }

        if (req.method === 'GET' && url.pathname.startsWith('/api/invites/')) {
            const token = decodeURIComponent(url.pathname.replace('/api/invites/', '').replace(/^\/+/, ''));
            const invite = await findInvite(token);
            if (!invite) {
                await sendJson(res, 404, { ok: false, error: 'Invite not found' });
                return;
            }
            await sendJson(res, 200, {
                ok: true,
                invite: {
                    token: invite.token,
                    displayName: invite.displayName,
                    inviteType: invite.inviteType,
                    openingMessage: invite.openingMessage,
                    createdAt: invite.createdAt,
                    updatedAt: invite.updatedAt
                }
            });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/admin/invites') {
            if (!ADMIN_SECRET) {
                await sendJson(res, 503, { ok: false, error: 'ADMIN_SECRET is not configured' });
                return;
            }
            if (!hasAdminAccess(req)) {
                await sendJson(res, 403, { ok: false, error: 'Forbidden' });
                return;
            }

            const invites = await readInviteStore();
            invites.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            await sendJson(res, 200, {
                ok: true,
                invites: invites.map(invite => ({
                    token: invite.token,
                    displayName: invite.displayName,
                    inviteType: invite.inviteType,
                    openingMessage: invite.openingMessage,
                    createdAt: invite.createdAt,
                    updatedAt: invite.updatedAt,
                    link: buildInviteLink(req, invite.token)
                }))
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/invites') {
            if (!ADMIN_SECRET) {
                await sendJson(res, 503, { ok: false, error: 'ADMIN_SECRET is not configured' });
                return;
            }
            if (!hasAdminAccess(req)) {
                await sendJson(res, 403, { ok: false, error: 'Forbidden' });
                return;
            }

            let body = {};
            try {
                body = await readJsonBody(req);
            } catch (err) {
                await sendJson(res, 400, { ok: false, error: err.message || 'Invalid JSON body' });
                return;
            }

            const displayName = cleanText(body.displayName || body.name || '', 120);
            if (!displayName) {
                await sendJson(res, 400, { ok: false, error: 'displayName is required' });
                return;
            }

            const invite = createInviteRecord(body);
            const invites = await readInviteStore();
            invites.unshift(invite);
            await writeInviteStore(invites);

            await sendJson(res, 201, {
                ok: true,
                invite: {
                    token: invite.token,
                    displayName: invite.displayName,
                    inviteType: invite.inviteType,
                    openingMessage: invite.openingMessage,
                    createdAt: invite.createdAt,
                    updatedAt: invite.updatedAt,
                    link: buildInviteLink(req, invite.token)
                }
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/rsvp') {
            let raw = '';
            req.on('data', chunk => {
                raw += chunk;
                if (raw.length > 1e6) req.destroy();
            });
            req.on('end', () => {
                let data = {};
                try {
                    data = raw ? parseRsvpBody(raw) : {};
                } catch (err) {
                    data = {};
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    ok: true,
                    mode: 'compose-links',
                    message: 'This invitation opens Gmail and WhatsApp drafts in the browser. No server email delivery is required.',
                    guest: {
                        name: data.name || '',
                        phone: data.phone || '',
                        attending: data.attending || '',
                        guests: data.guests || '',
                        notes: data.notes || ''
                    }
                }));
            });
            return;
        }

        const pathname = decodeURIComponent(url.pathname === '/' ? '/Invitation Card.html' : url.pathname);
        const filePath = path.join(ROOT, pathname.replace(/^\/+/, ''));
        if (!filePath.startsWith(ROOT)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            await serveFile(res, filePath);
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err.message || 'Server error');
    }
});

server.listen(PORT, () => {
    console.log(`Invitation Card server running at http://127.0.0.1:${PORT}`);
    console.log(`Admin access point: http://127.0.0.1:${PORT}/admin`);
});
