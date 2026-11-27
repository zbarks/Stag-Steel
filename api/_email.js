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
//                      (comma separated; default zach@barkerdigital.co.uk and haroldstevens911@icloud.com)
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
        const recipients = (Array.isArray(to) ? to : String(to).split(',')).map((x) => x.trim()).filter(Boolean);
        const payload = { from: process.env.EMAIL_FROM, to: recipients, subject, html };
        const rt = replyTo || process.env.EMAIL_REPLY_TO || 'help@stagandsteel.co.uk';
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
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ddd3c4;font-size:14px;">${esc(it.quantity || 1)} x ${esc(it.name || 'Item')}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #ddd3c4;font-size:14px;text-align:right;white-space:nowrap;">${gbp(it.amount_total)}</td></tr>`
    ).join('');
}

function address(order) {
    const a = order.shipping_address || {};
    const lines = [order.shipping_name || order.customer_name, a.line1, a.line2, a.city, a.postal_code, a.country].filter(Boolean).map(esc).join('<br>');
    return lines || '<span style="color:#b00">No address on file</span>';
}

const SERIF = "'Cormorant Garamond',Cormorant,Georgia,'Times New Roman',serif";
const SANS = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SITE = () => (process.env.SITE_URL || 'https://stagandsteel.co.uk').replace(/\/$/, '');

function shell(inner, preheader) {
    const site = SITE();
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(BRAND.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${BRAND.ink};">
<span style="display:none;opacity:0;font-size:1px;max-height:0;overflow:hidden;">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ink};"><tr><td align="center" style="padding:26px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${BRAND.cream};border-radius:4px;overflow:hidden;font-family:${SANS};color:${BRAND.ink};">
<tr><td align="center" style="background:${BRAND.peat};padding:34px 30px 26px;border-bottom:3px solid ${BRAND.kraft};">
<a href="${esc(site)}" style="text-decoration:none;"><img src="${esc(site)}/assets/monogram-cream.png" width="58" alt="S&amp;S" style="display:block;margin:0 auto;border:0;height:auto;"></a>
<div style="margin-top:14px;font-family:${SERIF};font-size:15px;letter-spacing:.42em;color:${BRAND.kraft};text-transform:uppercase;white-space:nowrap;padding-left:.42em;">Stag &amp; Steel</div></td></tr>
${inner}
<tr><td align="center" style="background:${BRAND.peat};padding:28px 30px;">
<div style="font-family:${SERIF};font-style:italic;font-size:18px;color:${BRAND.cream};">Handmade in Scotland</div>
<div style="margin-top:10px;font-size:12px;line-height:1.8;color:${BRAND.muted};"><a href="${esc(site)}" style="color:${BRAND.kraft};text-decoration:none;">stagandsteel.co.uk</a> &nbsp;&middot;&nbsp; <a href="mailto:help@stagandsteel.co.uk" style="color:${BRAND.kraft};text-decoration:none;">help@stagandsteel.co.uk</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

function totals(order) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${itemRows(order.items)}
<tr><td style="padding:10px 0 0;font-size:14px;color:${BRAND.muted};">Delivery</td><td style="padding:10px 0 0;font-size:14px;text-align:right;">${order.shipping_total ? gbp(order.shipping_total) : 'Free'}</td></tr>
<tr><td style="padding:6px 0 0;font-family:${SERIF};font-size:22px;font-weight:500;">Total</td><td style="padding:6px 0 0;font-family:${SERIF};font-size:22px;font-weight:500;text-align:right;">${gbp(order.amount_total)}</td></tr></table>`;
}

function renderCustomerConfirmation(order) {
    const first = (order.customer_name || '').trim().split(/\s+/)[0];
    const step = (n, t, d) => `<tr><td valign="top" style="padding:0 14px 14px 0;width:30px;"><div style="width:26px;height:26px;border-radius:13px;background:${BRAND.kraft};color:${BRAND.ink};font-size:13px;font-weight:700;text-align:center;line-height:26px;">${n}</div></td>
<td style="padding:0 0 14px;font-size:14px;line-height:1.5;"><b>${t}</b><br><span style="color:${BRAND.muted};">${d}</span></td></tr>`;
    const inner = `
<tr><td style="padding:34px 30px 8px;"><div style="font-size:11px;letter-spacing:.16em;color:${BRAND.kraft};text-transform:uppercase;">Order confirmed</div>
<div style="margin-top:8px;font-family:${SERIF};font-style:italic;font-size:38px;line-height:1.1;font-weight:500;">Thank you${first ? ', ' + esc(first) : ''}.</div>
<div style="margin-top:10px;font-size:15px;color:${BRAND.muted};line-height:1.6;">We have your order and we are getting started on it. Every piece is made and packed by hand in Scotland.</div></td></tr>
<tr><td style="padding:22px 30px 0;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid ${BRAND.kraft};">Your order</div>${totals(order)}</td></tr>
<tr><td style="padding:24px 30px 4px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Delivery to</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${address(order)}</div></td></tr>
<tr><td style="padding:22px 30px 6px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;padding-bottom:12px;">What happens next</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
${step(1, 'We pack it', 'Your order is checked and packed by hand.')}
${step(2, 'It is on its way', 'We will email you as soon as it is posted, with tracking where we have it.')}
${step(3, 'Enjoy it', 'Something not right? Just reply to this email and we will sort it.')}
</table></td></tr>
<tr><td style="padding:6px 30px 30px;"><a href="mailto:help@stagandsteel.co.uk" style="display:inline-block;border:1.5px solid ${BRAND.ink};color:${BRAND.ink};text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;padding:12px 20px;border-radius:2px;">Questions? Reply to this email</a></td></tr>`;
    return { subject: 'Your Stag & Steel order is confirmed', html: shell(inner, 'Thank you. Your Stag & Steel order is confirmed.') };
}

async function sendCustomerConfirmation(order) {
    const { subject, html } = renderCustomerConfirmation(order);
    return send({ to: order.customer_email, subject, html });
}

function trackLink(service, tracking) {
    if (!tracking) return '';
    const t = encodeURIComponent(tracking);
    if (/^rm-/.test(service || '')) return `https://www.royalmail.com/track-your-item#/tracking-results/${t}`;
    if (service === 'inpost') return 'https://inpost.co.uk/track';
    return '';
}

function renderShipped(order, { serviceName, service, tracking }) {
    const first = (order.customer_name || '').trim().split(/\s+/)[0];
    const link = trackLink(service, tracking);
    const trackBlock = tracking ? `
<tr><td style="padding:18px 30px 4px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Tracking</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${esc(serviceName || 'Courier')}<br><b>${esc(tracking)}</b></div>
${link ? `<div style="margin-top:12px;"><a href="${esc(link)}" style="display:inline-block;background:${BRAND.kraft};color:${BRAND.ink};text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:14px 24px;border-radius:2px;">Track your parcel</a></div>` : ''}</td></tr>` : `
<tr><td style="padding:18px 30px 4px;"><div style="font-size:14px;color:${BRAND.muted};line-height:1.6;">Sent with ${esc(serviceName || 'our courier')}.</div></td></tr>`;
    const inner = `
<tr><td style="padding:34px 30px 8px;"><div style="font-size:11px;letter-spacing:.16em;color:${BRAND.kraft};text-transform:uppercase;">On its way</div>
<div style="margin-top:8px;font-family:${SERIF};font-style:italic;font-size:38px;line-height:1.1;font-weight:500;">Good news${first ? ', ' + esc(first) : ''}.</div>
<div style="margin-top:10px;font-size:15px;color:${BRAND.muted};line-height:1.6;">Your Stag &amp; Steel order has been posted and is on its way to you.</div></td></tr>
${trackBlock}
<tr><td style="padding:22px 30px 4px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid ${BRAND.kraft};">In your parcel</div>${totals(order)}</td></tr>
<tr><td style="padding:22px 30px 4px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Delivering to</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${address(order)}</div></td></tr>
<tr><td style="padding:18px 30px 30px;"><a href="mailto:help@stagandsteel.co.uk" style="display:inline-block;border:1.5px solid ${BRAND.ink};color:${BRAND.ink};text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap;padding:12px 20px;border-radius:2px;">Questions? Reply to this email</a></td></tr>`;
    return { subject: 'Your Stag & Steel order is on its way', html: shell(inner, 'Your Stag & Steel order has been posted.') };
}

async function sendShippedEmail(order, info) {
    const { subject, html } = renderShipped(order, info || {});
    return send({ to: order.customer_email, subject, html });
}

function packLabel(order) {
    const b = Number(order.boxes) || 0;
    if (order.packaging === 'separate') return `Separate boxes${b > 1 ? ' (' + b + ' boxes)' : ''}`;
    if (order.packaging === 'one-box') return b > 1 ? `Packed together (${b} boxes, as few as possible)` : 'All in one box';
    return b > 1 ? `${b} boxes` : '';
}
function packNoteRow(order) {
    const p = packLabel(order), note = order.customer_note;
    if (!p && !note) return '';
    return `<tr><td style="padding:18px 30px 0;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Packing &amp; note</div>` +
        (p ? `<div style="margin-top:6px;font-size:15px;font-weight:600;">${esc(p)}</div>` : '') +
        (note ? `<div style="margin-top:6px;font-size:14px;line-height:1.6;font-style:italic;">&ldquo;${esc(note)}&rdquo;</div>` : '') + `</td></tr>`;
}

function renderOwnerAlert(order) {
    const site = (process.env.SITE_URL || 'https://stagandsteel.co.uk').replace(/\/$/, '');
    const inner = `
<tr><td style="padding:30px 30px 6px;"><div style="font-size:11px;letter-spacing:.16em;color:${BRAND.kraft};text-transform:uppercase;">New order</div>
<div style="margin-top:6px;font-family:${SERIF};font-size:44px;line-height:1;font-weight:500;">${gbp(order.amount_total)}</div>
<div style="margin-top:6px;font-size:14px;color:${BRAND.muted};">${esc(order.customer_name || 'A customer')} &middot; <a href="mailto:${esc(order.customer_email || '')}" style="color:${BRAND.muted};">${esc(order.customer_email || '')}</a>${order.customer_phone ? ' &middot; <a href="tel:' + esc(String(order.customer_phone).replace(/[^+\d]/g, '')) + '" style="color:' + BRAND.muted + ';">' + esc(order.customer_phone) + '</a>' : ''}</div></td></tr>
<tr><td style="padding:20px 30px 0;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid ${BRAND.kraft};">Items</div>${totals(order)}</td></tr>
<tr><td style="padding:22px 30px 8px;"><div style="font-size:11px;letter-spacing:.12em;color:${BRAND.muted};text-transform:uppercase;">Send to</div>
<div style="margin-top:6px;font-size:14px;line-height:1.6;">${address(order)}</div></td></tr>
${packNoteRow(order)}
<tr><td style="padding:12px 30px 28px;"><a href="${esc(site)}/portal" style="display:inline-block;background:${BRAND.kraft};color:${BRAND.ink};text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:14px 24px;border-radius:2px;">Open the portal</a></td></tr>`;
    return { subject: `New Stag & Steel order: ${gbp(order.amount_total)}`, html: shell(inner, `New order from ${order.customer_name || 'a customer'}`) };
}

async function sendOwnerAlert(order) {
    const to = process.env.OWNER_NOTIFY_EMAIL || 'zach@barkerdigital.co.uk,haroldstevens911@icloud.com';
    const { subject, html } = renderOwnerAlert(order);
    return send({ to, subject, html, replyTo: order.customer_email || undefined });
}

module.exports = { enabled, sendCustomerConfirmation, sendOwnerAlert, renderCustomerConfirmation, renderOwnerAlert, renderShipped, sendShippedEmail };
