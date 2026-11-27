// =============================================================
//  GET /api/portal-orders
//  Returns the latest orders for the /portal dashboard.
//  Protected by middleware.js (HTTP Basic Auth).
//  Designed by Barker Digital
// =============================================================
const { sb, ORDERS_TABLE } = require('./_portal');

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        const rows = await sb(ORDERS_TABLE + '?select=*&order=created_at.desc&limit=1000');
        const orders = (rows || []).map((o) => ({
            id: o.id,
            created_at: o.created_at,
            customer_name: o.customer_name || o.shipping_name || '',
            customer_email: o.customer_email || '',
            amount_total: o.amount_total || 0,
            amount_subtotal: o.amount_subtotal != null ? o.amount_subtotal : (o.amount_total || 0),
            shipping_total: o.shipping_total || 0,
            items: Array.isArray(o.items) ? o.items : [],
            skus: o.skus && typeof o.skus === 'object' ? o.skus : {},
            shipping_name: o.shipping_name || '',
            shipping_address: o.shipping_address || null,
            status: o.status || 'paid',
            shipping_service: o.shipping_service || null,
            tracking_number: o.tracking_number || null,
            shipped_at: o.shipped_at || null,
            exclude_from_revenue: !!o.exclude_from_revenue,
        }));
        return res.status(200).json({ orders });
    } catch (err) {
        console.error('[portal-orders]', err && err.message);
        return res.status(500).json({ error: 'Could not load orders.' });
    }
};
