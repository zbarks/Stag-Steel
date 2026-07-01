// /api/webhook.js
// Stripe webhook → stores completed orders in Supabase.
//
// This is what feeds the admin portal. When a customer finishes checkout,
// Stripe sends `checkout.session.completed` here, and we write one row into
// the `orders` table (see supabase-schema.sql).
//
// Required env vars on Vercel (Storefront project):
//   STRIPE_SECRET_KEY            sk_live_… or sk_test_…
//   STRIPE_WEBHOOK_SECRET        whsec_…  (from the Stripe webhook you create)
//   SUPABASE_URL                 https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service_role key (server-side only, never in the browser)
//
// IMPORTANT (the 308 gotcha): register the endpoint in Stripe as the EXACT path
//   https://stagandsteel.co.uk/api/webhook   — no trailing slash.
// vercel.json keeps trailingSlash + cleanUrls off so Stripe isn't 308-redirected
// (a redirect drops the POST body and signature check fails).

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Vercel: turn OFF automatic body parsing so we can verify the raw signature.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        console.error('Stripe env vars missing');
        return res.status(500).json({ error: 'Server not configured (Stripe)' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

    // 1) Verify the signature against the raw body
    let event;
    try {
        const raw = await readRawBody(req);
        const sig = req.headers['stripe-signature'];
        event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // We only care about completed checkouts for now
    if (event.type !== 'checkout.session.completed') {
        return res.status(200).json({ received: true, ignored: event.type });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        // Acknowledge so Stripe doesn't keep retrying, but log loudly.
        console.error('Supabase env vars missing — order NOT stored');
        return res.status(200).json({ received: true, stored: false });
    }

    try {
        // 2) Re-fetch the session fully expanded so we always have line items,
        //    customer details and the shipping address regardless of what the
        //    thin webhook payload included.
        const sessionId = event.data.object.id;
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'line_items.data.price.product', 'customer_details'],
        });

        // Shipping address moved between Stripe API versions. Check every known spot.
        const shipping =
            session.shipping_details ||
            (session.collected_information && session.collected_information.shipping_details) ||
            null;

        const shippingAddress = shipping && shipping.address ? shipping.address : null;
        const shippingName =
            (shipping && shipping.name) ||
            (session.customer_details && session.customer_details.name) ||
            null;

        // Build a clean, portal-friendly items array.
        let items = [];
        if (session.line_items && Array.isArray(session.line_items.data)) {
            items = session.line_items.data.map((li) => ({
                name: li.description || (li.price && li.price.product && li.price.product.name) || 'Item',
                quantity: li.quantity || 1,
                amount_total: li.amount_total, // pence, incl. that line
                currency: li.currency,
            }));
        }

        // SKU map we stamped on at checkout ({ 'tine-opener': 2, ... })
        let skus = {};
        try { skus = JSON.parse((session.metadata && session.metadata.skus) || '{}'); }
        catch (_) { skus = {}; }

        const order = {
            stripe_session_id: session.id,
            stripe_payment_intent:
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : (session.payment_intent && session.payment_intent.id) || null,
            customer_email:
                (session.customer_details && session.customer_details.email) ||
                session.customer_email ||
                null,
            customer_name: (session.customer_details && session.customer_details.name) || null,
            amount_total: session.amount_total,        // pence, incl. shipping
            amount_subtotal: session.amount_subtotal,  // pence, ex shipping
            shipping_total:
                (session.total_details && session.total_details.amount_shipping) || 0,
            currency: session.currency || 'gbp',
            items,       // jsonb — human-readable line items
            skus,        // jsonb — { sku: qty } for product reporting
            shipping_name: shippingName,
            shipping_address: shippingAddress, // jsonb — line1/line2/city/postal_code/country
            status: 'paid',                    // paid → shipped (set in the portal)
            tracking_number: null,
            shipping_service: null,
            shipped_at: null,
        };

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // Idempotent: if Stripe retries, don't double-insert the same session.
        const { error } = await supabase
            .from('orders')
            .upsert(order, { onConflict: 'stripe_session_id' });

        if (error) {
            console.error('Supabase insert error:', error);
            // 500 so Stripe retries later
            return res.status(500).json({ error: 'Failed to store order' });
        }

        console.log('Order stored:', session.id);
        return res.status(200).json({ received: true, stored: true });
    } catch (err) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
};
