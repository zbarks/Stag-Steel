// =============================================================
//  Shared helpers for the /portal API routes.
//  Server only: uses the Supabase service-role key.
//  Designed by Barker Digital
// =============================================================

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'stag_steel_orders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SERVICES = {
    'rm-tracked-48': 'Royal Mail Tracked 48',
    'rm-tracked-24': 'Royal Mail Tracked 24',
    'rm-signed-1st': 'Royal Mail Signed For 1st Class',
    'rm-signed-2nd': 'Royal Mail Signed For 2nd Class',
    'rm-special': 'Royal Mail Special Delivery',
    'other': 'Other courier',
};

function config() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ''), key };
}

async function sb(path, opts) {
    const c = config();
    if (!c) throw new Error('Supabase is not configured on this project.');
    const resp = await fetch(`${c.url}/rest/v1/${path}`, Object.assign({}, opts, {
        headers: Object.assign({
            apikey: c.key,
            Authorization: `Bearer ${c.key}`,
            'Content-Type': 'application/json',
        }, (opts && opts.headers) || {}),
    }));
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!resp.ok) {
        const msg = (data && data.message) || (typeof data === 'string' && data) || `Supabase error ${resp.status}`;
        const err = new Error(msg);
        err.status = resp.status;
        throw err;
    }
    return data;
}

module.exports = { sb, UUID_RE, SERVICES, ORDERS_TABLE };
