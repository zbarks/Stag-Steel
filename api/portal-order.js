// =============================================================
//  POST /api/portal-order
//  Body: { id, action: 'ship' | 'unship' | 'exclude', ... }
//    ship     { service, tracking }  -> status 'shipped'
//    unship                          -> back to 'paid'
//    exclude  { value: true|false }  -> leave out of revenue
//  Protected by middleware.js (HTTP Basic Auth).
//  Designed by Barker Digital
// =============================================================
const { sb, UUID_RE, SERVICES, ORDERS_TABLE } = require('./_portal');
const { sendShippedEmail } = require('./_email');

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid order id.' });

    let patch;
    if (body.action === 'ship') {
        const service = SERVICES[body.service] ? body.service : 'other';
        const tracking = String(body.tracking || '').trim().slice(0, 60);
        patch = {
            status: 'shipped',
            shipped_at: new Date().toISOString(),
            shipping_service: service,
            tracking_number: tracking || null,
        };
    } else if (body.action === 'unship') {
        patch = { status: 'paid', shipped_at: null, shipping_service: null, tracking_number: null };
    } else if (body.action === 'exclude') {
        patch = { exclude_from_revenue: body.value === true };
    } else {
        return res.status(400).json({ error: 'Unknown action.' });
    }

    try {
        const rows = await sb(`${ORDERS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(patch),
        });
        if (!rows || !rows.length) return res.status(404).json({ error: 'Order not found.' });
        const o = rows[0];
        let emailed = false;
        if (body.action === 'ship' && body.notify === true && o.customer_email) {
            const r = await sendShippedEmail(o, { service: o.shipping_service, serviceName: SERVICES[o.shipping_service], tracking: o.tracking_number });
            emailed = !!(r && r.ok);
            if (!emailed) console.error('[portal-order] shipped email not sent', r);
        }
        return res.status(200).json({
            ok: true,
            emailed,
            order: {
                id: o.id,
                status: o.status,
                shipping_service: o.shipping_service || null,
                tracking_number: o.tracking_number || null,
                shipped_at: o.shipped_at || null,
                exclude_from_revenue: !!o.exclude_from_revenue,
            },
        });
    } catch (err) {
        console.error('[portal-order]', err && err.message);
        const hint = /exclude_from_revenue/.test(err && err.message || '')
            ? ' Run migrations/portal-columns.sql in Supabase first.' : '';
        return res.status(500).json({ error: 'Could not update the order.' + hint });
    }
};
