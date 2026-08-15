/**
 * Shared type contracts for the Best Buy x Talon.One demo app.
 * Every module builds against these; do not redefine them locally.
 */

export type Category = 'games' | 'console' | 'cables' | 'accessories';

/** A cost entry as Talon.One expects it: { shipping: { price: 9.99 } } */
export type AdditionalCosts = Record<string, { price: number }>;

/** Catalog entry. Editable in the UI; seeds new cart lines. */
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  /** grams */
  weight?: number;
  /** mm */
  height?: number;
  /** mm */
  width?: number;
  /** mm */
  length?: number;
}

/** A cart line: a snapshot of a Product at add-time, independently editable. */
export interface CartLine extends Product {
  lineId: string;
  quantity: number;
  additionalCosts?: AdditionalCosts;
}

export interface SessionConfig {
  /** auto-generated on load, read-only in the UI */
  sessionId: string;
  profileId: string;
  /** single applied coupon, or null */
  couponCode: string | null;
  /** session-level additionalCosts.shipping.price */
  shippingCost: number;
  dryRun: boolean;
  /** only sent when dryRun is true */
  evaluableCampaignIds: number[];
}

// ---------------------------------------------------------------------------
// Talon.One wire format
// ---------------------------------------------------------------------------

export interface TalonCartItem {
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  additionalCosts?: AdditionalCosts;
}

export interface TalonCustomerSession {
  profileId: string;
  evaluableCampaignIds?: number[];
  state: 'open';
  couponCodes?: string[];
  cartItems: TalonCartItem[];
  additionalCosts?: AdditionalCosts;
  attributes: { ShippingCity: string };
}

export interface TalonSessionPayload {
  customerSession: TalonCustomerSession;
  responseContent: string[];
}

/** One entry of the top-level `effects` array in an IntegrationStateV2 response. */
export interface TalonEffect {
  campaignId?: number;
  rulesetId?: number;
  ruleIndex?: number;
  ruleName?: string;
  effectType: string;
  triggeredByCoupon?: number;
  props?: Record<string, unknown>;
}

/** Partial shape of IntegrationStateV2 — only what the UI reads. */
export interface TalonSessionResponse {
  customerSession?: {
    integrationId?: string;
    profileId?: string;
    total?: number;
    cartItems?: TalonCartItem[];
    discounts?: Record<string, number>;
    [key: string]: unknown;
  };
  customerProfile?: Record<string, unknown>;
  effects?: TalonEffect[];
  /** present when dry=true with evaluableCampaignIds — why campaigns did NOT fire */
  ruleFailureReasons?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Parsed / derived view models
// ---------------------------------------------------------------------------

/** One line in the friendly discount breakdown. */
export interface DiscountLine {
  /** props.name from the effect, e.g. "Bundle Discount" */
  label: string;
  /** positive magnitude of the discount */
  value: number;
  effectType: string;
  campaignId?: number;
  ruleName?: string;
  /** set for setDiscountPerItem */
  position?: number;
}

export interface CouponRejection {
  code: string;
  reason: string;
}

/** Effects the UI does not render specially, kept so nothing is silently dropped. */
export interface GenericEffect {
  effectType: string;
  ruleName?: string;
  campaignId?: number;
  props: Record<string, unknown>;
}

export interface ParsedEffects {
  discountLines: DiscountLine[];
  /** sum of all discountLines values */
  totalDiscount: number;
  acceptedCoupons: string[];
  rejections: CouponRejection[];
  otherEffects: GenericEffect[];
}

// ---------------------------------------------------------------------------
// API call record (drives the inspector)
// ---------------------------------------------------------------------------

export interface ApiCallRecord {
  url: string;
  method: 'PUT';
  requestBody: TalonSessionPayload;
  status: number | null;
  responseBody: TalonSessionResponse | null;
  /** error message when the call failed at transport or HTTP level */
  error: string | null;
  durationMs: number;
}

export interface AppError {
  id: string;
  message: string;
  /** 'config' errors persist and cannot be dismissed until fixed */
  kind: 'config' | 'http' | 'network' | 'coupon';
}

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'info';
}
