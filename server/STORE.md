# Cosmetic store (Stripe Checkout)

`server/store.js` sells the `premium: true` items in
`sources/data/upgrades.js` for real money via Stripe Checkout. It's a
separate small HTTP service from the multiplayer relay (`server/index.js`)
— run one, both, or neither; the game works fine with either offline.

**Everything sold here is cosmetic.** Truck paints, hero outfits, weapon
skins — no stat, no gameplay effect, same as the credit-bought versions.
That was a deliberate choice (see `readme.md` → "Where this could go
next"): cosmetic-only purchases fit an open-world game like this, and
avoid the pay-to-win problem that upgrade-purchases would create.

## What you need

A Stripe account (any account works for test mode — no business
verification required to start testing). From the
[Stripe Dashboard](https://dashboard.stripe.com):

1. **Secret key** — Developers → API keys → "Secret key" (starts `sk_test_`
   while testing, `sk_live_` once you go live).
2. **Webhook secret** — this is how `server/store.js` finds out a payment
   actually succeeded (the browser redirect alone isn't trustworthy — a
   user could hit the success URL without paying). Two ways to get one:
   - **Local testing:** install the [Stripe CLI](https://stripe.com/docs/stripe-cli),
     run `stripe listen --forward-to localhost:8081/api/webhook` — it
     prints a `whsec_...` secret for that session.
   - **Production:** Developers → Webhooks → "Add endpoint", point it at
     `https://your-store-host/api/webhook`, subscribe to the
     `checkout.session.completed` event, copy the signing secret it shows
     you.

## Run it

```bash
npm install

STRIPE_SECRET_KEY=sk_test_xxx \
STRIPE_WEBHOOK_SECRET=whsec_xxx \
STORE_SUCCESS_URL=http://localhost:5173/?purchase=success \
STORE_CANCEL_URL=http://localhost:5173/?purchase=cancelled \
npm run store
```

Then point the client at it in `.env`:

```
VITE_STORE_URL=http://localhost:8081
```

Without `STRIPE_SECRET_KEY` set, the server still starts (so the rest of
the game isn't blocked on it) but `/api/checkout` answers `503` — premium
Garage rows are visible but not purchasable until it's configured.

## What it does

- `POST /api/checkout` — client sends `{ playerId, kind, key }`
  (`playerId` is a uuid the client generates and keeps in localStorage,
  not an account); server looks up the item's price and creates a Stripe
  Checkout Session, returns its `url` for the client to redirect to.
- `POST /api/webhook` — Stripe calls this after a real payment completes.
  Verifies the signature, then grants the item to `playerId` in
  `server/store-grants.json` (gitignored — this file **is** the
  database for this scaffold; see below).
- `GET /api/entitlements/:playerId` — the client polls this after
  returning from Checkout to pick up the grant and unlock the item.

## Limitations, on purpose (it's a scaffold)

- **Grants are stored in a flat JSON file**, not a real database. Fine for
  a small store, but if you're expecting real traffic, swap
  `loadGrants`/`saveGrants` in `server/store.js` for a proper datastore —
  the rest of the logic doesn't change.
- **No accounts.** `playerId` is a browser-local uuid — clear localStorage
  or switch browsers and past purchases won't follow you. Tying purchases
  to a real account needs the (separate, not-yet-built) accounts/cloud-save
  system mentioned in `readme.md`'s roadmap.
- **No refund/chargeback handling** beyond whatever Stripe's dashboard
  gives you directly — this scaffold only listens for
  `checkout.session.completed`.
- **No tax/VAT handling** — add
  [Stripe Tax](https://stripe.com/tax) in the Checkout Session config
  (`automatic_tax: { enabled: true }`) before selling for real.

## Adding a new premium item

Add an entry with `premium: true` and `priceCents` to `truckPaints`,
`heroOutfits` or `weaponSkins` in `sources/data/upgrades.js` — the Garage
UI and `server/store.js` both read that same table, so nothing else needs
to change.
