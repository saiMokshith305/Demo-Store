# Best Buy × Talon.One — Demo App

A local demo harness for walking developers through Talon.One promotion campaigns. Build a cart, apply a coupon, and watch the exact `updateCustomerSession V2` request and response that produced the discount.

Built to support the Technical Account Manager take-home task: campaign creation (Part A), campaign troubleshooting (Part B), and production session debugging (Part C).

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in your deployment URL and Integration API key
npm run dev
```

Open http://localhost:3000.

`NEXT_PUBLIC_*` variables are inlined at build time — **restart the dev server** after editing `.env.local`.

### Where the credentials come from

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL` | Your Campaign Manager URL, e.g. `https://mycompany.europe-west1.talon.one` (no trailing slash) |
| `NEXT_PUBLIC_TALONONE_API_KEY` | Campaign Manager → Settings → Developer settings → API keys, for the Application you are demoing |

## ⚠️ Run locally only

This app calls the Talon.One API **directly from the browser**, so the API key is present in client-side JavaScript and visible in devtools. That is acceptable for a localhost demo and is why the app is built this way — it keeps the network tab honest, showing devs the real call with no proxy in between.

**Do not deploy this to a public URL.** Doing so would expose your Integration API key. If public hosting is ever needed, move the call behind a Next.js API route that holds the key server-side.

## What it does

- **Catalog (left)** — browse seed products, filter by category, edit any product inline (name, SKU, price, category, dimensions), or add new ones.
- **Cart (right)** — adjust quantities, override any field per line, apply a coupon, and see a plain-language discount breakdown.
- **API Inspector (bottom drawer)** — the exact request URL, request JSON, and response JSON for every call, plus latency and HTTP status.

Every edit triggers a debounced session sync, so totals and discounts update live.

### Two features worth knowing during a demo

**Dry run.** Toggling it in the session bar switches the call to `?dry=true` with your chosen campaign IDs. The response then includes `ruleFailureReasons` — Talon.One explaining *why* each campaign did not fire. The inspector surfaces this as its own tab. This is the fastest route to diagnosing a campaign that isn't triggering.

**Coupon rejections return HTTP 200.** A rejected coupon is not an HTTP error; it arrives as a `rejectCoupon` effect inside a successful response. The app checks for this on every response and raises a banner with the `rejectionReason`, so a rejected coupon never looks like a silently broken campaign.

**Removing a coupon requires sending `couponCodes: []`.** Omitting the field tells Talon.One to keep whatever coupons the session already has — so an integration that omits it on removal will find the discount stubbornly still applied. This app always sends the authoritative list.

## Editing model

The catalog and the cart are independent on purpose:

- Editing a **catalog** product changes the template for future adds. It does not touch lines already in the cart.
- Editing a **cart line** changes only that line. It does not touch the catalog.

This lets you construct a specific scenario (a cart totalling exactly $100, four HDMI cables, a particular SKU) without disturbing your reusable starting point.

## Seed catalog

| Category | Items |
| --- | --- |
| `games` | Zelda, Spider-Man 2, FC 25 |
| `console` | PS5, Xbox Series X, Switch OLED |
| `cables` | HDMI-cable, USB-C cable |
| `accessories` | Mouse, Headphones, AA Batteries |

SKUs and categories are guesses at what the campaigns match on. Every field is editable inline, so adjust them to match the real rules in Campaign Manager.

## Payload shape

```jsonc
{
  "customerSession": {
    "profileId": "demo-customer-1",
    "state": "open",
    "couponCodes": ["SAVE10"],        // always sent; [] when no coupon applied
    "evaluableCampaignIds": [42],     // only when dry run is on
    "cartItems": [ /* name, sku, quantity, price, category, dimensions */ ],
    "additionalCosts": { "shipping": { "price": 9.99 } },  // omitted when 0
    "attributes": { "ShippingCity": "Minneapolis" }
  },
  "responseContent": ["customerSession", "customerProfile"]
}
```

`ShippingCity` only affects rule evaluation if a session attribute of that name exists in Campaign Manager; otherwise it is inert. It is a constant in `lib/constants.ts`.

## Tests

```bash
npm test
```

Covers the two pure modules carrying the real logic: `buildSessionPayload` (payload shape and omission rules) and `parseEffects` (discount breakdown, coupon rejections, malformed-response handling). UI and campaign behavior are verified live against the deployment, which is the only meaningful check for whether a campaign actually fires.

## Project layout

```
app/          layout, page, design tokens (globals.css)
components/   catalog, cart, session bar, inspector, banner, toaster
lib/          types, constants, store, payload builder, API client, effects parser
data/         seed catalog
docs/         design spec
```

## AI tool disclosure

The task brief requires disclosing AI assistance. This application is a demo aid, not the analytical content of the submission — AI tooling was used to scaffold and build it, and for design brainstorming. The campaign configuration, troubleshooting diagnoses, and infrastructure review are the candidate's own work.
