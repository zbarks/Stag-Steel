# Stag & Steel — Storefront

Static shop with Stripe Checkout. Completed orders are written to Supabase by a
webhook, which is what feeds the **admin portal** (separate project).

```
index.html                Home (rebuilt — human copy, team, how it's made)
shop.html                 All products
tine-opener.html …        Product pages
success.html              Post-purchase page
style.css / script.js     Styles + cart (localStorage drawer)
api/checkout.js           Creates the Stripe Checkout Session (prices live here)
api/webhook.js            Stripe → Supabase order storage
assets/                   Images
```

---

## Environment variables (Vercel → this project)

| Name | What it is |
|------|-----------|
| `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook you create (below) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (server-side only) |

Add all four to Production, Preview and Development, then redeploy.

---

## One-time setup

**1. Supabase.** Create a project. Open the SQL editor and run
`supabase-schema.sql` (shipped with the portal). Copy the project URL and the
`service_role` key into the env vars above (the same values go in the portal).

**2. Stripe webhook.** Stripe dashboard → Developers → Webhooks → **Add endpoint**:

- URL: `https://stagandsteel.co.uk/api/webhook` — **exact path, no trailing slash**
- Event: `checkout.session.completed`
- Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`, redeploy.

> The `/api/webhook` handler reads the **raw** request body to verify the Stripe
> signature (body parsing is disabled). `vercel.json` keeps `trailingSlash` and
> `cleanUrls` off so Stripe isn't 308-redirected — a redirect would drop the POST
> body and the signature check would fail.

**3. Test.** Buy something with test card `4242 4242 4242 4242` (any future
expiry, any CVC, any UK postcode). You should land on `success.html`, and a row
should appear in the Supabase `orders` table (and in the portal).

---

## Prices

`api/checkout.js` is the source of truth (`PRODUCTS`, in pence). The cart UI in
`script.js` (`CATALOGUE`, in £) is only for display — the server price wins at
checkout. Keep them, and the `£` text in the product HTML, in sync.

Flat UK shipping is `SHIPPING_PENCE` in `api/checkout.js` and `SHIPPING` in
`script.js`.

---

## Team photos

`index.html` uses `assets/team-harry.jpg` and `assets/team-zach.jpg` — these are
placeholders. Drop in real square headshots at those paths (same filenames) and
they'll appear on the home page.
