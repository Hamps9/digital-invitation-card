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
const ADMIN_NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
};
const MAX_EMBEDDED_IMAGE_LENGTH = 20 * 1024 * 1024;
const ADMIN_COOKIE_NAME = 'admin_session';
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_OPENING_MESSAGE = 'You are warmly invited to celebrate our special day.';
const SITE_SETTINGS_FILE = path.join(ROOT, 'site-settings.json');
const DEFAULT_SITE_SETTINGS = {
    coupleNames: 'Amara & Josiah',
    heroTagline: 'request the pleasure of your company as they exchange vows',
    dateText: '18th April 2027',
    weddingDateTime: '2027-04-18T11:00:00',
    calendarTitle: 'Amara & Josiah Wedding',
    calendarDetails: 'Save the date for Amara and Josiah\'s wedding on April 18, 2027. Ceremony: 11:00 AM at 1 John Akapelwa Rd. Reception: 2:00 PM at 1 John Akapelwa Rd.',
    calendarLocation: '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    envelopePrompt: 'Tap the envelope to open',
    openingMessage: 'You are warmly invited to celebrate our special day.',
    ceremonyVenue: '1 John Akapelwa Rd',
    ceremonyTime: '11:00 AM - Saturday',
    ceremonyLocation: '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    ceremonyDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=1%20John%20Akapelwa%20Rd%2C%20Lusaka%2C%2010101%2C%20Lusaka%2C%20Zambia',
    receptionVenue: '1 John Akapelwa Rd',
    receptionTime: '2:00 PM - Saturday',
    receptionLocation: '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    receptionDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=1%20John%20Akapelwa%20Rd%2C%20Lusaka%2C%2010101%2C%20Lusaka%2C%20Zambia',
    dressCodeTitle: 'Elegant Garden Party',
    dressCodeDescription: 'Soft, breathable fabrics in our wedding palette - flowing dresses, light suits, garden-ready shoes.',
    ladiesHeading: 'Ladies Dress Code',
    menHeading: 'Men\'s Dress Code',
    ladiesImageUrls: [
        'https://www.nicea-mariage.com/img/robes-mariees/thumbnails/Eo7rN3Kk2EIdBWO_1600.jpg',
        'https://www.weddingsinhouston.com/uploads/real_weddings/vivian-matt-real-wedding/RW-Vivian-Matt-TheGallery-CakesByGina-IvoryBridalAtelier-Ouisie-sTable-HIRES0256.jpg',
        'https://i0.wp.com/bridalmusings.com/wp-content/uploads/2023/08/image-16.png?quality=80&resize=1140%2C760&ssl=1'
    ],
    ladiesCaptions: ['Flowing Dress', 'Elegant Gown', 'Garden Party'],
    menImageUrls: [
        'https://www.bentexsuits.com.au/assets/image/DC108951.jpg',
        'https://images.squarespace-cdn.com/content/v1/5da5bb25a00bd00e72244aac/1662502210847-NHNX70WKRCD5INGPJ6D8/2206-07%2BSydney%2B%2B%2BConley%2BWedding%2B2035.jpg',
        'https://icdn2.insideweddings.com/fit-in/1440x0/filters%3Aquality%2890%29/filters%3Ano_upscale%28%29/filters%3Astrip_icc%28%29/fileupload/2019/04/13/Eric%20Kelley-Kuhl-groom.jpg'
    ],
    menCaptions: ['Light Suit', 'Dress Shirt', 'Smart Casual'],
    giftQuote: '"Your presence is our greatest gift. Should you wish to bless us further, contributions are warmly welcome."',
    mobileMoneyLabel: 'Mobile Money',
    mobileMoneyValue: '+260 97 000 0000',
    bankLabel: 'Bank Transfer',
    bankValue: 'Stanbic - 900 000 0000',
    adultsOnly: 'Adults Only Event',
    stayHeading: 'Nearby Rest',
    stay1Name: 'Edinburgh Hotel',
    stay1Detail: '8 min from venue - from K950/night',
    stay1Phone: '+260000000000',
    stay2Name: 'Hillcrest Guest Lodge',
    stay2Detail: '12 min from venue - from K620/night',
    stay2Phone: '+260000000000',
    rsvpIntro: "We'd love to know if we can save you a seat."
};

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
const SUPABASE_REST_URL = SUPABASE_URL ? SUPABASE_URL + '/rest/v1' : '';
const SUPABASE_STORAGE_URL = SUPABASE_URL ? SUPABASE_URL + '/storage/v1' : '';
const IMAGE_STORAGE_BUCKET = 'invitation-images';
const IMAGE_STORAGE_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function hasSupabaseConfig() {
    return Boolean(SUPABASE_REST_URL && SUPABASE_SERVICE_KEY);
}

function supabaseAuthHeaders(extraHeaders = {}) {
    return Object.assign({
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
        Prefer: 'return=representation'
    }, extraHeaders);
}

function supabaseJsonHeaders(extraHeaders = {}) {
    return supabaseAuthHeaders(Object.assign({
        'Content-Type': 'application/json'
    }, extraHeaders));
}

async function supabaseRequest(pathSuffix, options = {}) {
    if (!hasSupabaseConfig()) {
        throw new Error('Supabase is not configured');
    }

    const res = await fetch(SUPABASE_REST_URL + pathSuffix, {
        ...options,
        headers: supabaseAuthHeaders(options.headers || {})
    });

    const raw = await res.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }
    }

    return { res, data };
}

async function supabaseStorageRequest(pathSuffix, options = {}) {
    if (!hasSupabaseConfig()) {
        throw new Error('Supabase is not configured');
    }

    const res = await fetch(SUPABASE_STORAGE_URL + pathSuffix, {
        ...options,
        headers: supabaseAuthHeaders(options.headers || {})
    });

    const raw = await res.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }
    }

    return { res, data };
}

function normalizeSiteSettingsRecord(record) {
    if (!record) return cloneDefaultSiteSettings();
    return normalizeSiteSettings(record.settings || record.payload || record);
}

function normalizeSupabaseInviteRecord(record) {
    const invite = record && typeof record.invite === 'object' && record.invite ? record.invite : {};
    const token = cleanText(record.token || invite.token || '', 64);
    const inviteType = normalizeInviteType(invite.inviteType || record.invite_type || 'custom');
    const openingMessage = cleanText(invite.openingMessage || invite.message || record.opening_message || defaultOpeningMessage(inviteType), 240) || defaultOpeningMessage(inviteType);

    return {
        token,
        displayName: cleanText(invite.displayName || invite.name || record.display_name || '', 120),
        inviteType,
        openingMessage,
        createdAt: String(record.created_at || invite.createdAt || new Date().toISOString()),
        updatedAt: String(record.updated_at || invite.updatedAt || record.created_at || new Date().toISOString())
    };
}

async function readLocalInviteStore() {
    try {
        const raw = await fsp.readFile(INVITES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeLocalInviteStore(invites) {
    const tmpFile = INVITES_FILE + '.tmp';
    await fsp.writeFile(tmpFile, JSON.stringify(invites, null, 2), 'utf8');
    await fsp.rename(tmpFile, INVITES_FILE);
}

async function readLocalSiteSettings() {
    try {
        const raw = await fsp.readFile(SITE_SETTINGS_FILE, 'utf8');
        const parsed = raw ? JSON.parse(raw) : {};
        return normalizeSiteSettings(parsed);
    } catch {
        return cloneDefaultSiteSettings();
    }
}

async function writeLocalSiteSettings(settings) {
    const tmpFile = SITE_SETTINGS_FILE + '.tmp';
    await fsp.writeFile(tmpFile, JSON.stringify(settings, null, 2), 'utf8');
    await fsp.rename(tmpFile, SITE_SETTINGS_FILE);
}

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
    const localInvites = await readLocalInviteStore();
    if (hasSupabaseConfig()) {
        try {
            const { res, data } = await supabaseRequest('/invites?select=token,invite,created_at,updated_at&order=created_at.desc', {
                method: 'GET'
            });
            if (res.ok && Array.isArray(data)) {
                const remoteInvites = data.map(normalizeSupabaseInviteRecord).filter(invite => invite.token);
                const remoteTokens = new Set(remoteInvites.map(invite => invite.token));
                const merged = remoteInvites.concat(localInvites.filter(invite => invite && invite.token && !remoteTokens.has(invite.token)));

                await writeLocalInviteStore(merged);
                if (merged.length > remoteInvites.length) {
                    try {
                        await writeInviteStore(merged);
                    } catch {}
                }
                return merged;
            }
        } catch {}

        if (localInvites.length) {
            try {
                await writeInviteStore(localInvites);
            } catch {}
        }
        return localInvites;
    }

    return readLocalInviteStore();
}

async function writeInviteStore(invites) {
    const normalized = Array.isArray(invites) ? invites : [];
    await writeLocalInviteStore(normalized);

    if (hasSupabaseConfig()) {
        const rows = normalized.map(invite => ({
            token: invite.token,
            invite: {
                token: invite.token,
                displayName: invite.displayName,
                inviteType: invite.inviteType,
                openingMessage: invite.openingMessage,
                createdAt: invite.createdAt,
                updatedAt: invite.updatedAt
            },
            created_at: invite.createdAt,
            updated_at: invite.updatedAt
        }));

        const { res } = await supabaseRequest('/invites?on_conflict=token', {
            method: 'POST',
            headers: supabaseJsonHeaders({
                Prefer: 'resolution=merge-duplicates,return=representation'
            }),
            body: JSON.stringify(rows)
        });

        if (!res.ok) {
            throw new Error('Failed to save invite records to Supabase');
        }
    }
}

function cloneDefaultSiteSettings() {
    return JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
}

function splitFieldLines(value, maxItems = 3, maxLength = 500) {
    const source = Array.isArray(value) ? value : String(value || '').split(String.fromCharCode(10));
    return source
        .map(item => cleanText(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeImageList(value, maxItems = 3) {
    const source = Array.isArray(value) ? value : String(value || '').split(String.fromCharCode(10));
    return source
        .map(item => cleanUrl(item, MAX_EMBEDDED_IMAGE_LENGTH))
        .filter(Boolean)
        .slice(0, maxItems);
}

function isDataImageUrl(value) {
    return typeof value === 'string' && /^data:image\/[^;]+;base64,/i.test(value.trim());
}

function parseDataImageUrl(value) {
    const match = String(value || '').trim().match(/^data:(image\/[^;]+);base64,(.+)$/i);
    if (!match) {
        throw new Error('Invalid image data');
    }
    return {
        mimeType: match[1].toLowerCase(),
        buffer: Buffer.from(match[2], 'base64')
    };
}

function extensionFromMimeType(mimeType) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif'
    };
    return map[mimeType] || 'png';
}

function encodeStoragePath(filePath) {
    return String(filePath || '').split('/').map(encodeURIComponent).join('/');
}

function publicStorageUrl(bucket, objectPath) {
    return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + encodeStoragePath(objectPath);
}

async function uploadImageDataUrl(dataUrl, objectPath) {
    const parsed = parseDataImageUrl(dataUrl);
    const targetPath = encodeStoragePath(objectPath);
    const { res, data } = await supabaseStorageRequest('/object/' + IMAGE_STORAGE_BUCKET + '/' + targetPath, {
        method: 'POST',
        headers: supabaseAuthHeaders({
            'Content-Type': parsed.mimeType,
            'x-upsert': 'false',
            'Cache-Control': '31536000'
        }),
        body: parsed.buffer
    });

    if (!res.ok) {
        const detail = typeof data === 'string' ? data : (data && data.message) || (data && data.error) || ('HTTP ' + res.status);
        const bucketHint = res.status === 404 || /bucket/i.test(String(detail)) ?
            " Make sure storage bucket 'invitation-images' exists by running supabase-schema.sql in Supabase." :
            '';
        throw new Error('Failed to upload image to Supabase Storage: ' + detail + bucketHint);
    }

    return publicStorageUrl(IMAGE_STORAGE_BUCKET, objectPath);
}

async function materializeImageList(values, prefix) {
    const items = Array.isArray(values) ? values : [];
    const output = [];

    for (let i = 0; i < items.length; i += 1) {
        const value = cleanUrl(items[i], MAX_EMBEDDED_IMAGE_LENGTH);
        if (!value) continue;

        if (isDataImageUrl(value)) {
            const parsed = parseDataImageUrl(value);
            const ext = extensionFromMimeType(parsed.mimeType);
            const objectPath = 'site-settings/' + prefix + '/' + Date.now() + '-' + i + '-' + crypto.randomBytes(6).toString('hex') + '.' + ext;
            output.push(await uploadImageDataUrl(value, objectPath));
        } else {
            output.push(value);
        }
    }

    return output.slice(0, 3);
}

async function materializeUploadedImages(settings) {
    const prepared = JSON.parse(JSON.stringify(settings || {}));
    prepared.ladiesImageUrls = await materializeImageList(prepared.ladiesImageUrls, 'ladies');
    prepared.menImageUrls = await materializeImageList(prepared.menImageUrls, 'men');
    return prepared;
}

function cleanUrl(value, maxLength = 500) {
    const text = cleanText(value, maxLength);
    if (!text) return '';
    try {
        return new URL(text).href;
    } catch {
        return text;
    }
}

function normalizeSiteSettings(body = {}) {
    const source = body && typeof body === 'object' ? body : {};
    const settings = cloneDefaultSiteSettings();

    settings.coupleNames = cleanText(source.coupleNames, 80) || settings.coupleNames;
    settings.heroTagline = cleanText(source.heroTagline, 180) || settings.heroTagline;
    settings.dateText = cleanText(source.dateText, 60) || settings.dateText;
    settings.weddingDateTime = cleanText(source.weddingDateTime, 40) || settings.weddingDateTime;
    settings.calendarTitle = cleanText(source.calendarTitle, 120) || settings.calendarTitle;
    settings.calendarDetails = cleanText(source.calendarDetails, 500) || settings.calendarDetails;
    settings.calendarLocation = cleanText(source.calendarLocation, 180) || settings.calendarLocation;
    settings.envelopePrompt = cleanText(source.envelopePrompt, 80) || settings.envelopePrompt;
    settings.openingMessage = cleanText(source.openingMessage, 280) || settings.openingMessage;

    settings.ceremonyVenue = cleanText(source.ceremonyVenue, 120) || settings.ceremonyVenue;
    settings.ceremonyTime = cleanText(source.ceremonyTime, 80) || settings.ceremonyTime;
    settings.ceremonyLocation = cleanText(source.ceremonyLocation, 180) || settings.ceremonyLocation;
    settings.ceremonyDirectionsUrl = cleanUrl(source.ceremonyDirectionsUrl) || settings.ceremonyDirectionsUrl;

    settings.receptionVenue = cleanText(source.receptionVenue, 120) || settings.receptionVenue;
    settings.receptionTime = cleanText(source.receptionTime, 80) || settings.receptionTime;
    settings.receptionLocation = cleanText(source.receptionLocation, 180) || settings.receptionLocation;
    settings.receptionDirectionsUrl = cleanUrl(source.receptionDirectionsUrl) || settings.receptionDirectionsUrl;

    settings.dressCodeTitle = cleanText(source.dressCodeTitle, 120) || settings.dressCodeTitle;
    settings.dressCodeDescription = cleanText(source.dressCodeDescription, 240) || settings.dressCodeDescription;
    settings.ladiesHeading = cleanText(source.ladiesHeading, 120) || settings.ladiesHeading;
    settings.menHeading = cleanText(source.menHeading, 120) || settings.menHeading;
    settings.ladiesImageUrls = normalizeImageList(source.ladiesImageUrls, 3);
    settings.ladiesCaptions = splitFieldLines(source.ladiesCaptions, 3, 80);
    settings.menImageUrls = normalizeImageList(source.menImageUrls, 3);
    settings.menCaptions = splitFieldLines(source.menCaptions, 3, 80);

    settings.giftQuote = cleanText(source.giftQuote, 280) || settings.giftQuote;
    settings.mobileMoneyLabel = cleanText(source.mobileMoneyLabel, 80) || settings.mobileMoneyLabel;
    settings.mobileMoneyValue = cleanText(source.mobileMoneyValue, 80) || settings.mobileMoneyValue;
    settings.bankLabel = cleanText(source.bankLabel, 80) || settings.bankLabel;
    settings.bankValue = cleanText(source.bankValue, 120) || settings.bankValue;
    settings.adultsOnly = cleanText(source.adultsOnly, 80) || settings.adultsOnly;

    settings.stayHeading = cleanText(source.stayHeading, 120) || settings.stayHeading;
    settings.stay1Name = cleanText(source.stay1Name, 120) || settings.stay1Name;
    settings.stay1Detail = cleanText(source.stay1Detail, 120) || settings.stay1Detail;
    settings.stay1Phone = cleanText(source.stay1Phone, 40) || settings.stay1Phone;
    settings.stay2Name = cleanText(source.stay2Name, 120) || settings.stay2Name;
    settings.stay2Detail = cleanText(source.stay2Detail, 120) || settings.stay2Detail;
    settings.stay2Phone = cleanText(source.stay2Phone, 40) || settings.stay2Phone;
    settings.rsvpIntro = cleanText(source.rsvpIntro, 180) || settings.rsvpIntro;

    return settings;
}

function migrateLegacyVenueSettings(settings) {
    const normalized = normalizeSiteSettings(settings);
    const legacyValues = [
        'St. Augustine Gardens Chapel',
        'Plot 14, Riverside Drive, Kitwe',
        'The Mosi Pavilion',
        '27 Parklands Avenue, Kitwe'
    ];
    const hasLegacyVenue = [
        normalized.calendarLocation,
        normalized.ceremonyVenue,
        normalized.ceremonyLocation,
        normalized.receptionVenue,
        normalized.receptionLocation
    ].some(value => legacyValues.includes(value));

    if (!hasLegacyVenue) return { settings: normalized, changed: false };

    const migrated = {
        ...normalized,
        calendarDetails: 'Save the date for Amara and Josiah\'s wedding on April 18, 2027. Ceremony: 11:00 AM at 1 John Akapelwa Rd. Reception: 2:00 PM at 1 John Akapelwa Rd.',
        calendarLocation: DEFAULT_SITE_SETTINGS.calendarLocation,
        ceremonyVenue: DEFAULT_SITE_SETTINGS.ceremonyVenue,
        ceremonyLocation: DEFAULT_SITE_SETTINGS.ceremonyLocation,
        ceremonyDirectionsUrl: DEFAULT_SITE_SETTINGS.ceremonyDirectionsUrl,
        receptionVenue: DEFAULT_SITE_SETTINGS.receptionVenue,
        receptionLocation: DEFAULT_SITE_SETTINGS.receptionLocation,
        receptionDirectionsUrl: DEFAULT_SITE_SETTINGS.receptionDirectionsUrl
    };

    return { settings: migrated, changed: true };
}

async function readSiteSettings() {
    if (hasSupabaseConfig()) {
        try {
            const { res, data } = await supabaseRequest('/site_settings?select=id,settings,updated_at&id=eq.default&limit=1', {
                method: 'GET'
            });
            if (res.ok && Array.isArray(data) && data.length) {
                const migration = migrateLegacyVenueSettings(normalizeSiteSettingsRecord(data[0]));
                if (migration.changed) {
                    try {
                        await writeSiteSettings(migration.settings);
                    } catch {}
                }
                return migration.settings;
            }
        } catch {}

        const localSettings = await readLocalSiteSettings();
        try {
            await writeSiteSettings(localSettings);
        } catch {}
        return localSettings;
    }

    return readLocalSiteSettings();
}

async function writeSiteSettings(settings) {
    let normalized = normalizeSiteSettings(settings);
    if (hasSupabaseConfig()) {
        normalized = await materializeUploadedImages(normalized);
        const rows = [{
            id: 'default',
            settings: normalized,
            updated_at: new Date().toISOString()
        }];

        const { res } = await supabaseRequest('/site_settings?on_conflict=id', {
            method: 'POST',
            headers: supabaseJsonHeaders({
                Prefer: 'resolution=merge-duplicates,return=representation'
            }),
            body: JSON.stringify(rows)
        });

        if (!res.ok) {
            throw new Error('Failed to save settings to Supabase');
        }
    }

    await writeLocalSiteSettings(normalized);
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

function updateInviteRecord(existing, body) {
    const displayName = cleanText(body.displayName || body.name || existing.displayName || '', 120);
    const inviteType = normalizeInviteType(body.inviteType || existing.inviteType);
    const openingMessage = cleanText(body.openingMessage || body.message || existing.openingMessage || defaultOpeningMessage(inviteType), 240) || defaultOpeningMessage(inviteType);

    return {
        ...existing,
        displayName,
        inviteType,
        openingMessage,
        updatedAt: new Date().toISOString()
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
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        ...extraHeaders
    });
    res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
    let raw = '';
    await new Promise((resolve, reject) => {
        req.on('data', chunk => {
            raw += chunk;
            if (raw.length > 25 * 1024 * 1024) {
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

async function serveFile(res, filePath, extraHeaders = {}) {
    try {
        const buf = await fsp.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType(filePath), ...extraHeaders });
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

        if (req.method === 'GET' && url.pathname === '/api/site-settings') {
            const settings = await readSiteSettings();
            await sendJson(res, 200, { ok: true, settings });
            return;
        }

        if (req.method === 'GET' && url.pathname === '/api/admin/site-settings') {
            if (!ADMIN_SECRET) {
                await sendJson(res, 503, { ok: false, error: 'ADMIN_SECRET is not configured' });
                return;
            }
            if (!hasAdminAccess(req)) {
                await sendJson(res, 403, { ok: false, error: 'Forbidden' });
                return;
            }

            const settings = await readSiteSettings();
            await sendJson(res, 200, { ok: true, settings });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/admin/site-settings') {
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

            const settings = normalizeSiteSettings(body);
            await writeSiteSettings(settings);
            await sendJson(res, 200, { ok: true, settings });
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
                await serveFile(res, ADMIN_ACCESS_FILE, ADMIN_NO_CACHE_HEADERS);
                return;
            }

            if (hasAdminAccess(req)) {
                await serveFile(res, ADMIN_FILE, ADMIN_NO_CACHE_HEADERS);
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

        if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname.startsWith('/api/admin/invites/')) {
            if (!ADMIN_SECRET) {
                await sendJson(res, 503, { ok: false, error: 'ADMIN_SECRET is not configured' });
                return;
            }
            if (!hasAdminAccess(req)) {
                await sendJson(res, 403, { ok: false, error: 'Forbidden' });
                return;
            }

            const token = decodeURIComponent(url.pathname.replace('/api/admin/invites/', '').replace(/^\/+/, ''));
            if (!token) {
                await sendJson(res, 400, { ok: false, error: 'Invite token is required' });
                return;
            }

            let body = {};
            try {
                body = await readJsonBody(req);
            } catch (err) {
                await sendJson(res, 400, { ok: false, error: err.message || 'Invalid JSON body' });
                return;
            }

            const invites = await readInviteStore();
            const index = invites.findIndex(invite => invite.token === token);
            if (index === -1) {
                await sendJson(res, 404, { ok: false, error: 'Invite not found' });
                return;
            }

            const updated = updateInviteRecord(invites[index], body);
            invites[index] = updated;
            await writeInviteStore(invites);

            await sendJson(res, 200, {
                ok: true,
                invite: {
                    token: updated.token,
                    displayName: updated.displayName,
                    inviteType: updated.inviteType,
                    openingMessage: updated.openingMessage,
                    createdAt: updated.createdAt,
                    updatedAt: updated.updatedAt,
                    link: buildInviteLink(req, updated.token)
                }
            });
            return;
        }

        if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/invites/')) {
            if (!ADMIN_SECRET) {
                await sendJson(res, 503, { ok: false, error: 'ADMIN_SECRET is not configured' });
                return;
            }
            if (!hasAdminAccess(req)) {
                await sendJson(res, 403, { ok: false, error: 'Forbidden' });
                return;
            }

            const token = decodeURIComponent(url.pathname.replace('/api/admin/invites/', '').replace(/^\/+/, ''));
            if (!token) {
                await sendJson(res, 400, { ok: false, error: 'Invite token is required' });
                return;
            }

            const invites = await readInviteStore();
            const nextInvites = invites.filter(invite => invite.token !== token);
            if (nextInvites.length === invites.length) {
                await sendJson(res, 404, { ok: false, error: 'Invite not found' });
                return;
            }

            if (hasSupabaseConfig()) {
                const deletePath = '/invites?token=eq.' + encodeURIComponent(token);
                const { res: deleteRes } = await supabaseRequest(deletePath, { method: 'DELETE' });
                if (!deleteRes.ok) {
                    await sendJson(res, 500, { ok: false, error: 'Failed to delete invite from Supabase' });
                    return;
                }
            }

            await writeLocalInviteStore(nextInvites);
            await sendJson(res, 200, { ok: true });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/rsvp') {
            let raw = '';
            req.on('data', chunk => {
                raw += chunk;
                if (raw.length > 25 * 1024 * 1024) req.destroy();
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