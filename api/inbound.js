// /api/inbound.js
// Resend "email.received" webhook: forwards mail sent to help@stagandsteel.co.uk
// to the owner's own inbox.
//
// Env vars (Vercel):
//   RESEND_API_KEY          re_...
//   RESEND_WEBHOOK_SECRET   whsec_...  (shown when the webhook is created in Resend)
//   FORWARD_TO              where help@ mail goes (default zach@barkerdigital.co.uk)
//   FORWARD_FROM            sender shown on the forward
//                           (default Stag & Steel Help <help@stagandsteel.co.uk>)
//
// Register in Resend as the EXACT path https://stagandsteel.co.uk/api/inbound
// (no trailing slash), event: email.received.

const crypto = require('crypto');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

// Resend signs webhooks with Svix: HMAC-SHA256 over "id.timestamp.body".
function verify(raw, headers, secret) {
    const id = headers['svix-id'];
    const ts = headers['svix-timestamp'];
    const sigHeader = headers['svix-signature'];
    if (!id || !ts || !sigHeader) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
    const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw.toString('utf8')}`).digest('base64');
    return sigHeader.split(' ').some((part) => {
        const sig = part.split(',')[1];
        if (!sig) return false;
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { RESEND_API_KEY, RESEND_WEBHOOK_SECRET } = process.env;
    if (!RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) {
        console.error('inbound: RESEND_API_KEY / RESEND_WEBHOOK_SECRET missing');
        return res.status(500).json({ error: 'Server not configured' });
    }

    const raw = await readRawBody(req);
    if (!verify(raw, req.headers, RESEND_WEBHOOK_SECRET)) {
        return res.status(400).json({ error: 'Bad signature' });
    }

    let evt;
    try { evt = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Bad JSON' }); }
    if (evt.type !== 'email.received') return res.status(200).json({ ignored: evt.type });

    const emailId = evt.data && evt.data.email_id;
    if (!emailId) return res.status(200).json({ ignored: 'no-email-id' });

    try {
        const r = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
            headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        if (!r.ok) throw new Error(`fetch ${r.status}`);
        const mail = await r.json();

        const from = mail.from || (evt.data && evt.data.from) || 'unknown sender';
        const subject = mail.subject || (evt.data && evt.data.subject) || '(no subject)';
        const replyAddr = (String(from).match(/<([^>]+)>/) || [])[1] || from;
        const attachments = (mail.attachments || evt.data.attachments || []).length;

        const note = `<div style="font:12px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#6b625a;background:#f3eee6;padding:10px 14px;margin-bottom:14px;border-radius:8px;">
Sent to help@stagandsteel.co.uk by <b>${esc(from)}</b>. Hit reply to answer them directly.${attachments ? ` (${attachments} attachment${attachments > 1 ? 's' : ''} not forwarded, see the Resend dashboard.)` : ''}</div>`;
        const html = note + (mail.html || `<pre style="font:14px/1.5 Arial,sans-serif;white-space:pre-wrap;">${esc(mail.text || '')}</pre>`);

        const out = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: process.env.FORWARD_FROM || 'Stag & Steel Help <help@stagandsteel.co.uk>',
                to: [process.env.FORWARD_TO || 'zach@barkerdigital.co.uk'],
                reply_to: replyAddr,
                subject: `[Help] ${subject}`,
                html,
                text: `Sent to help@stagandsteel.co.uk by ${from}\n\n${mail.text || ''}`,
            }),
        });
        if (!out.ok) throw new Error(`send ${out.status}: ${(await out.text()).slice(0, 200)}`);
        return res.status(200).json({ forwarded: true });
    } catch (err) {
        console.error('inbound forward failed:', err);
        // 500 makes Resend retry the webhook.
        return res.status(500).json({ error: 'Forward failed' });
    }
};
