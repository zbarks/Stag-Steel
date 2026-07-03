// /api/checkout.js
// Vercel serverless function — creates a Stripe Checkout Session.
//
// CRITICAL: This file is the security boundary. The browser sends
// { id, qty } pairs only. Prices, names, and images are looked up
// server-side from PRODUCTS below. Never trust client-sent prices.
//
// Required env var on Vercel: STRIPE_SECRET_KEY  (sk_test_... or sk_live_...)

const Stripe = require('stripe');

// ============================================================
// Single source of truth for products. Update prices here.
// Prices are in pence (Stripe uses smallest currency unit).
// ============================================================
const PRODUCTS = {
    'tine-opener': {
        name: 'The Tine Opener',
        price: 3000, // £30.00
        image: 'tine_main_white.jpg',
        description: "From the antler's outer point",
    },
    'stem-opener': {
        name: 'The Stem Opener',
        price: 2500, // £25.00
        image: 'stem_main_white.jpg',
        description: "Cut from the antler's main beam",
    },
    'corkscrew': {
        name: 'The Corkscrew',
        price: 2500, // £25.00
        image: 'corkscrew_main_white.jpg',
        description: "From the antler's burr, dense and short",
    },
    'the-set': {
        name: 'The Set',
        price: 4000, // £40.00
        image: 'set_main_white.jpg',
        description: 'Two-piece presentation box',
    },
};

// Flat UK shipping
const SHIPPING_PENCE = 450; // £4.50

// ============================================================
// Handler
// ============================================================
module.exports = async (req, res) => {
    // Defensive method check
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        console.error('STRIPE_SECRET_KEY env var not set');
        return res.status(500).json({ error: 'Server is not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20',
    });

    try {
        // Parse + validate the request body
        const body = req.body && typeof req.body === 'object'
            ? req.body
            : JSON.parse(req.body || '{}');

        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Build Stripe line_items by looking up each id in our PRODUCTS map.
        // Reject anything we don't recognise.
        const origin = getOrigin(req);
        const lineItems = [];

        for (const item of items) {
            const id = String(item.id || '').trim();
            const qty = Math.max(1, Math.min(10, parseInt(item.qty, 10) || 1));

            const product = PRODUCTS[id];
            if (!product) {
                return res.status(400).json({ error: `Unknown product: ${id}` });
            }

            lineItems.push({
                quantity: qty,
                price_data: {
                    currency: 'gbp',
                    unit_amount: product.price, // SERVER-SIDE PRICE — never trusts client
                    product_data: {
                        name: product.name,
                        description: product.description,
                        images: [`${origin}/assets/${product.image}`],
                    },
                },
            });
        }

        // Create the Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: lineItems,
            currency: 'gbp',

            // UK only — collect shipping address
            shipping_address_collection: { allowed_countries: ['GB'] },

            // Flat-rate UK shipping
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: SHIPPING_PENCE, currency: 'gbp' },
                        display_name: 'UK delivery',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 7 },
                        },
                    },
                },
            ],

            // Where to bounce the customer afterwards
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/shop.html`,

            // Light touch metadata for your own records
            metadata: {
                source: 'stagandsteel.vercel.app',
            },

            // Collect customer email
            phone_number_collection: { enabled: false },

            // Allow promotion codes (you can create these in Stripe dashboard)
            allow_promotion_codes: true,
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return res.status(500).json({
            error: err && err.message ? err.message : 'Checkout failed',
        });
    }
};

// ============================================================
// Helpers
// ============================================================
function getOrigin(req) {
    // Prefer the request's actual host so this works on previews,
    // production, and custom domains without code changes.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host']
        || req.headers.host
        || 'stagandsteel.vercel.app';
    return `${proto}://${host}`;
}
