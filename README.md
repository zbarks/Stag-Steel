# Stag & Steel — Setup & Deploy

Static site with Stripe Checkout via a Vercel serverless function.

---

## How it works

- **Static HTML** — all pages render with no build step
- **Cart** — pure client-side, persists in `localStorage`. Opens as a slide-in drawer.
- **Checkout** — `/api/checkout.js` creates a Stripe Checkout Session, redirects the user to Stripe-hosted payment page
- **Security** — prices are validated server-side from a hardcoded map. Browser-sent prices are ignored.

---

## One-time setup

### 1. Stripe account

- Go to https://dashboard.stripe.com → sign up (UK, GBP)
- In top-right, ensure **Test mode** is on while developing
- Left sidebar → **Developers** → **API keys**
- Copy your **Secret key** (starts `sk_test_…`). Don't share it. Don't commit it.

### 2. Push the code to GitHub

These files go at the root of your `Stag-Steel` repo:

```
api/checkout.js          # Stripe serverless function
assets/                   # (your existing folder)
index.html
shop.html
tine-opener.html
stem-opener.html
corkscrew.html
the-set.html
success.html             # NEW — post-purchase page
style.css
script.js
vercel.json
package.json             # NEW — declares Stripe SDK dependency
.gitignore
```

```bash
git add .
git commit -m "Migrate cart to Stripe Checkout"
git push
```

Vercel will auto-deploy on push.

### 3. Add the Stripe secret key to Vercel

This is the only env var you need.

- Go to https://vercel.com/dashboard → select the **Stag-Steel** project
- **Settings** → **Environment Variables**
- Add:
  - **Name**: `STRIPE_SECRET_KEY`
  - **Value**: your `sk_test_…` (test) or `sk_live_…` (live) key
  - **Environments**: select all three (Production, Preview, Development)
- Save
- Go to **Deployments** → click "…" on the latest deployment → **Redeploy**
  (Env var changes only apply on next deploy)

---

## Test it

Once redeployed:

1. Go to https://stagandsteel.vercel.app/shop.html
2. Click **Quick Add — £30** on the Tine Opener — toast appears, cart counter bumps
3. Click the cart button (top-right) — drawer slides in
4. Add more items, change quantities
5. Click **Proceed to Checkout** — redirects to Stripe-hosted checkout
6. Use a Stripe test card: **`4242 4242 4242 4242`**, any future expiry (e.g. `12/30`), any 3-digit CVC, any UK postcode
7. Complete checkout → redirected back to `/success.html`
8. Cart is cleared automatically

If anything fails, open the browser console (F12) and check for errors. The `/api/checkout` endpoint also logs errors to Vercel logs (Vercel dashboard → your project → **Logs** tab).

---

## Going live

When you're ready to take real money:

1. In Stripe dashboard, complete account activation (provide business details, bank account)
2. Toggle to **Live mode** (top right)
3. Get your **Live secret key** (`sk_live_…`)
4. In Vercel → Environment Variables → edit `STRIPE_SECRET_KEY` → paste the live key
5. Save → redeploy
6. Test the live flow with a real card you own. You can refund it from the Stripe dashboard immediately.

---

## What's where

```
api/checkout.js           # Stripe Checkout Session creation. PRICES LIVE HERE.
script.js                 # Cart logic, drawer, toast, checkout button
style.css                 # All styles, including drawer + toast
*.html                    # Pages
```

### Changing a price

Update **two places**:

1. `api/checkout.js` — the `PRODUCTS` map (in pence, e.g. `3000` = £30.00)
2. `script.js` — the `CATALOGUE` map (in £, e.g. `30.00`)
3. The displayed price in the corresponding `.html` files (where `£30` appears as text)

The serverless function is the source of truth. If they don't match, the server's price wins at checkout — but the cart UI will show the wrong number to the customer until you update it.

### Adding a new product

1. Add to `PRODUCTS` in `api/checkout.js`
2. Add to `CATALOGUE` in `script.js`
3. Create `<new-id>.html` (copy an existing product page, swap the contents)
4. Add a card to `shop.html`
5. Add product images to `assets/`

### Changing shipping

In `api/checkout.js`, update `SHIPPING_PENCE` (top of file). In `script.js`, update `SHIPPING` (top of file). In `style.css` you'd find any displayed shipping copy — but the only place is currently `success.html` and the drawer, both of which read from those constants.

---

## Files NOT in the deploy

These are scaffolding I left in `/home/claude` for my own use — don't push them:

- `migrate.py` — one-shot migration script (already run)
- `apply_v2_changes.py` — earlier scaffolding
- `index_old.html` — original Snipcart version (keep locally for reference, or delete)

---

## Support / debugging

- **Vercel function logs**: Vercel dashboard → project → **Logs** tab → filter by `/api/checkout`
- **Stripe dashboard**: see all checkout sessions, payments, refunds in real time
- **Local dev**: `npx vercel dev` will run the site + serverless function locally on port 3000. You'll need to set the env var first: `vercel env pull .env.local`

---

## Notes on what was removed

- **Snipcart** — removed entirely. No more API key, no more `data-item-*` attributes, no more browser IndexedDB issues.
- **`cart.html`** — old standalone cart page, deleted. The slide-in drawer replaces it.
- All `.snipcart-add-item`, `.snipcart-checkout`, `.snipcart-items-count` classes have been replaced with the new system.
