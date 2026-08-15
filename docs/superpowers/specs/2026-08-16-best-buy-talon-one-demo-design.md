# Best Buy × Talon.One Demo App — Design

**Date:** 2026-08-16
**Status:** Approved

## Purpose

A local web app that demonstrates Talon.One promotion campaigns against a realistic e-commerce cart. It exists to support a Technical Account Manager take-home task: walking Best Buy's developers through campaign creation (Part A), campaign troubleshooting (Part B), and production session debugging (Part C).

The app must make the mechanics visible. A developer watching a screen-share should see the cart change, the discount apply, and the exact `updateCustomerSession V2` request and response that produced it — all in one view.

## Goals

- Browse a seed catalog and build a cart with items across multiple categories
- Edit product data (catalog defaults and per-cart-line overrides) to reach any scenario without code changes
- Apply a coupon code and see the resulting discount or rejection
- Show the raw request and response JSON for every API call
- Surface API errors and coupon rejections clearly and immediately

## Non-goals

- Checkout, payment, order history, or session closing
- User authentication or multiple concurrent users
- Persistence across page refreshes
- Public deployment (see Security below)
- Read-only lookup of pre-existing sessions such as `InterviewSession` (Part C is investigated via Campaign Manager and Postman)

## Architecture

A single Next.js application (App Router, TypeScript) running locally. The browser calls the Talon.One Integration API directly — there is no backend proxy.

```
Browser (React)
  ├── UI state (in-memory: catalog, cart, session identity, last request/response)
  └── lib/talonOneClient.ts
        └── PUT https://{deployment}/v2/customer_sessions/{sessionId}
```

### Security constraint

The API key ships in client-side JavaScript via `NEXT_PUBLIC_*` environment variables and is visible in browser devtools. This is acceptable **only** because the app runs on localhost for a demo call and is never deployed to a public URL. If public deployment is ever wanted, the design must change to route calls through a Next.js API route that holds the key server-side.

### Environment

`.env.local` (git-ignored):

```
NEXT_PUBLIC_TALONONE_DEPLOYMENT_URL=https://<your-deployment>.talon.one
NEXT_PUBLIC_TALONONE_API_KEY=<integration api key>
```

If either is missing on load, the app shows a persistent configuration banner rather than failing silently mid-demo.

## Data model

```ts
type Category = 'games' | 'console' | 'cables' | 'accessories'

// Catalog entry — editable, seeds new cart lines
type Product = {
  id: string
  name: string
  sku: string
  price: number
  category: Category | string
  weight?: number   // grams
  height?: number   // mm
  width?: number    // mm
  length?: number   // mm
}

// Cart line — a snapshot of a Product at add-time, independently editable
type CartLine = Product & {
  lineId: string
  quantity: number
  additionalCosts?: Record<string, { price: number }>
}

type SessionConfig = {
  sessionId: string          // auto-generated on load
  profileId: string          // editable
  couponCode: string | null  // single applied coupon
  shippingCost: number       // session-level additionalCosts.shipping.price
  dryRun: boolean
  evaluableCampaignIds: number[]  // only meaningful when dryRun is true
}
```

Editing a cart line never mutates the catalog. Editing a catalog product never mutates cart lines already added. Both are intentional: the catalog is the reusable starting point, the cart line is the scenario being demoed.

## Talon.One integration

### Request

```
PUT {deploymentUrl}/v2/customer_sessions/{sessionId}[?dry=true]
Content-Type: application/json
Authorization: ApiKey-v1 {apiKey}
```

```json
{
  "customerSession": {
    "profileId": "demo-customer-1",
    "evaluableCampaignIds": [42],
    "state": "open",
    "couponCodes": ["SAVE10"],
    "cartItems": [
      {
        "name": "The Legend of Zelda",
        "sku": "GAME-ZELDA",
        "quantity": 1,
        "price": 59.99,
        "category": "games",
        "weight": 100,
        "height": 15,
        "width": 135,
        "length": 170,
        "additionalCosts": { "shipping": { "price": 2.5 } }
      }
    ],
    "additionalCosts": { "shipping": { "price": 9.99 } },
    "attributes": { "ShippingCity": "Minneapolis" }
  },
  "responseContent": ["customerSession", "customerProfile"]
}
```

Payload construction rules, implemented in `lib/buildSessionPayload.ts`:

- `couponCodes` is omitted entirely when no coupon is applied (never sent as `[]`)
- `evaluableCampaignIds` is included only when `dryRun` is true, and the `?dry=true` query parameter is set in the same condition
- Optional item dimensions (`weight`, `height`, `width`, `length`) and `additionalCosts` are omitted when unset rather than sent as `0` or `{}`
- `attributes.ShippingCity` uses a hardcoded constant (`Minneapolis`) defined in `lib/constants.ts`
- `state` is always `open`

`ShippingCity` only influences rule evaluation if a session attribute of that name exists in Campaign Manager. If it is not configured, the field is inert but harmless.

### Response

The v2 endpoint returns `IntegrationStateV2`, containing `customerSession`, `customerProfile`, and a top-level `effects` array. Discounts are read from `effects`, not from `customerSession.discounts`.

Effect types handled explicitly in `lib/parseEffects.ts`:

| effectType | Meaning | Rendered as |
|---|---|---|
| `setDiscount` | Cart-level discount | Breakdown line: `props.name` → `−props.value` |
| `setDiscountPerItem` | Per-item discount | Breakdown line attributed to `props.position` |
| `acceptCoupon` | Coupon valid and applied | Coupon chip turns success-styled |
| `rejectCoupon` | Coupon refused | Error banner with `props.rejectionReason` |

Any other effect type is rendered generically as its `effectType` plus a formatted `props` object, so nothing is silently discarded.

When `dry=true` is used with `evaluableCampaignIds`, the response also carries `ruleFailureReasons` — why each campaign did *not* fire. This is the single most useful field for Part B troubleshooting and is surfaced prominently in the inspector when present.

### Sync behavior

Any change to cart contents, quantity, price, item attributes, coupon, shipping cost, profile ID, or dry-run settings triggers a debounced (400ms) call. A manual **Re-evaluate** button in the inspector forces a call on demand. Concurrent responses are discarded if a newer request has already been issued, so a slow response cannot overwrite fresher state.

## UI

Light theme, clean and minimal. Three regions:

```
┌────────────────────────────────────────────────────────┐
│  Best Buy × Talon.One    Session: abc123   Profile: ▢  │
├──────────────────────────┬─────────────────────────────┤
│  CATALOG                 │  CART (3)                   │
│  [product cards, ✎ edit] │  [line items, ✎ edit, ✕]    │
│                          │  Coupon: [_____] [Apply]    │
│                          │  ─────────────────────      │
│                          │  Subtotal        $606.00    │
│                          │  Bundle −30%    −$167.40    │
│                          │  Shipping          $9.99    │
│                          │  Total           $448.59    │
├──────────────────────────┴─────────────────────────────┤
│  ▲ API Inspector   [Request] Response    ⟳ 142ms       │
└────────────────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
|---|---|
| `SessionBar` | Session ID (read-only), profile ID (editable), shipping cost, dry-run toggle + campaign IDs |
| `CatalogPanel` / `ProductCard` | Grid of products; inline edit of name, SKU, price, category, dimensions; Add to cart |
| `CartPanel` / `CartLine` | Line items with quantity stepper, inline field overrides, remove |
| `CouponInput` | Single field + Apply; applied code shows as removable chip |
| `DiscountBreakdown` | Subtotal, per-effect discount lines, shipping, total |
| `ApiInspector` | Collapsible bottom drawer; Request / Response tabs, latency, Re-evaluate, `ruleFailureReasons` when present |
| `Banner` | Persistent errors — HTTP failures, coupon rejections, missing config |
| `Toaster` | Transient confirmations — item added, coupon applied, session synced |

Each panel owns one concern and reads from a single `useDemoState` reducer exposed via React context, so no component reaches into another's internals.

## Seed catalog

Chosen so every scenario in the task brief is reachable without editing anything first.

| Category | Items |
|---|---|
| `games` | Zelda $59.99, Spider-Man 2 $69.99, FC 25 $49.99 |
| `console` | PS5 $499.00, Xbox Series X $399.00, Switch OLED $349.00 |
| `cables` | HDMI-cable $12.99, USB-C cable $9.99 |
| `accessories` | Mouse $24.99, Headphones $79.99, Batteries $8.99 |

The HDMI entry is named and SKU'd `HDMI-cable` to match the Part B campaign. Since item matching is defined by the campaigns themselves, categories and SKUs here are a starting point — any of them can be retyped inline if the real rules expect different identifiers.

## Error handling

| Situation | Treatment |
|---|---|
| Missing env config | Banner on load, before any call is attempted |
| HTTP 4xx/5xx | Banner with status code and response body message |
| Network failure | Banner with the thrown error |
| `rejectCoupon` effect (inside HTTP 200) | Banner: ``Coupon `X` rejected — {rejectionReason}`` |
| Successful actions | Toast |

The distinction that matters for the demo: a rejected coupon returns HTTP 200. Treating only non-2xx as failure would make a rejected coupon look like a silently broken campaign, so effect-level rejections are checked on every successful response.

## Testing

Unit tests (Vitest) for the two pure modules carrying the real logic:

- `buildSessionPayload` — correct shape, only the agreed fields, omission rules for empty coupon/dimensions, dry-run conditionals
- `parseEffects` — discount breakdown from `setDiscount` and `setDiscountPerItem`, rejection extraction, generic fallback for unknown effect types

UI and campaign behavior are verified live against the real deployment, which is the only meaningful check for whether a campaign fires.

## Dependencies and risks

- **Campaign identifiers.** Seed SKUs and categories are guesses until the actual campaign rules are read in Campaign Manager. Mitigated by inline editing of every field.
- **`ShippingCity` attribute.** Inert unless configured as a session attribute in Campaign Manager.
- **API key exposure.** Acceptable only for localhost use; documented in README.

## AI tool disclosure

The task brief requires disclosing AI assistance. This app is a demo aid, not the analytical content of the submission. The disclosure should state that AI tooling was used for scaffolding this demo application and for design brainstorming, while the campaign configuration, troubleshooting diagnoses, and infrastructure review are the candidate's own work.
