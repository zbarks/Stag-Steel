// =============================================================
//  api/_email.js  -  order emails via Resend (server only)
//
//  Two emails per paid order:
//    1. a confirmation to the customer
//    2. a "new order" alert to the shop owner
//
//  Env vars (Vercel -> this project):
//    RESEND_API_KEY    re_...  from resend.com
//    EMAIL_FROM        e.g.  Stag & Steel <orders@yourdomain.co.uk>
//                      (the domain must be verified in Resend)
//    EMAIL_REPLY_TO    where customer replies land (optional)
//    OWNER_NOTIFY_EMAIL where the new-order alert goes
//                      (default zach@barkerdigital.co.uk)
//    EMAILS_ENABLED    must be "true" or nothing is sent
//    CUSTOMER_EMAILS_ENABLED  "true" to also email the customer a
//                      confirmation (off by default; the owner alert is always on)
//  Designed by Barker Digital
// =============================================================

const BRAND = { name: 'Stag & Steel', ink: '#120f0d', peat: '#1b1714', kraft: '#b8936a', cream: '#f3eee6', muted: '#8d847b' };

function enabled() {
    return process.env.EMAILS_ENABLED === 'true' && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gbp = (pence) => '£' + ((Number(pence) || 0) / 100).toFixed(2);

async function send({ to, subject, html, replyTo }) {
    if (!enabled()) return { skipped: 'emails-disabled' };
    if (!to) return { skipped: 'no-recipient' };
    try {
        const payload = { from: process.env.EMAIL_FROM, to: [to], subject, html };
        const rt = replyTo || process.env.EMAIL_REPLY_TO;
        if (rt) payload.reply_to = rt;
        const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) return { error: `resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}` };
        return { ok: true };
    } catch (err) {
        return { error: String((err && err.message) || err) };
    }
}

function itemRows(items) {
    return (items || []).map((it) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e6dfd3;font-size:14px;">${esc(it.quantity || 1)} x ${esc(it.name || 'Item')}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #e6dfd3;font-size:14px;text-align:right;white-space:nowrap;">${gbp(it.amount_total)}</td></tr>`
    ).join('');
}

function address(order) {
    const a = order.shipping_address || {};
    const lines = [order.shipping_name || order.customer_name, a.line1, a.line2, a.city, a.postal_code, a.country].filter(Boolean).map(esc).join('<br>');
    return lines || '<span style="color:#b00">No address on file</span>';
}

function shell(inner, preheader) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(BRAND.name)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
<span style="display:none;opacity:0;font-size:1px;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<tr><td style="background:${BRAND.peat};padding:24px 30px;"><div style="color:${BRAND.cream};font-size:19px;letter-spacing:.16em;white-space:nowrap;">STAG &amp; STEEL</div></td></tr>
${inner}
<tr><td style="padding:20px 30px;background:${BRAND.cream};color:${BRAND.muted};font-size:12px;line-height:1.6;">Stag &amp; Steel &middot; Handmade in Scotland</td></tr>
</table></td></tr></table></body></html>`;
}

function totals(order) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${itemRows(order.items)}
<tr><td style="padding:10px 0 0;font-size:14px;color:${BRAND.muted};">Delivery</td><td style="padding:10px 0 0;font-size:14px;text-align:right;">${order.shipping_total ? gbp(order.shipping_total) : 'Free'}</td></tr>
<tr><td style="padding:6px 0 0;font-size:16px;font-weight:700;">Total</td><td style="padding:6px 0 0;font-size:16px;font-weight:700;text-align:right;">${gbp(order.amount_total)}</td></tr></table>`;
}

async function sendCustomerConfirmation(order) {
    const first = (order.customer_name || '').trim().split(/\s+/)[0];
    const inner = `
<tr><td style="padding:28px 30px 6px;"><div style="font-size:19px;font-weight:600;">Thank you${first ? ', ' + esc(first) : ''}. Your order is confirmed.</div>
<div style="margin-top:6px;font-size:14px;color:${BRAND.muted};line-height:1.6;">We will pack it by hand and send it out shortly. If we have a tracking number we will email it to you.</div></td></tr>
<tr><td style="padding:14px 30px 0;">${totals(order)}</td></tr>
<tr><td style="padding:18px 30px 26px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Delivery to</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${address(order)}</div></td></tr>`;
    return send({
        to: order.customer_email,
        subject: 'Your Stag & Steel order is confirmed',
        html: shell(inner, 'Thank you. Your Stag & Steel order is confirmed.'),
    });
}

async function sendOwnerAlert(order) {
    const to = process.env.OWNER_NOTIFY_EMAIL || 'zach@barkerdigital.co.uk';
    const site = (process.env.SITE_URL || 'https://stagandsteel.co.uk').replace(/\/$/, '');
    const inner = `
<tr><td style="padding:28px 30px 6px;"><div style="font-size:19px;font-weight:600;">New order: ${gbp(order.amount_total)}</div>
<div style="margin-top:6px;font-size:14px;color:${BRAND.muted};">${esc(order.customer_name || 'A customer')} &middot; ${esc(order.customer_email || '')}</div></td></tr>
<tr><td style="padding:14px 30px 0;">${totals(order)}</td></tr>
<tr><td style="padding:18px 30px 8px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Send to</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${address(order)}</div></td></tr>
<tr><td style="padding:10px 30px 26px;"><a href="${esc(site)}/portal" style="display:inline-block;background:${BRAND.kraft};color:${BRAND.ink};text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:8px;">Open the portal</a></td></tr>`;
    return send({
        to,
        subject: `New Stag & Steel order: ${gbp(order.amount_total)}`,
        html: shell(inner, `New order from ${order.customer_name || 'a customer'}`),
        replyTo: order.customer_email || undefined,
    });
}

module.exports = { enabled, sendCustomerConfirmation, sendOwnerAlert };
