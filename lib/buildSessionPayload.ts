/**
 * Pure construction of the Talon.One `updateCustomerSession` v2 request body.
 *
 * Omission rules matter here: Talon.One treats an explicitly-sent `0`,
 * `null`, `[]` or `{}` differently from an absent key when evaluating rules,
 * so every optional field is conditionally assigned rather than set to a
 * falsy placeholder. Objects are built first and keys added afterwards so the
 * result is `exactOptionalPropertyTypes`-safe: omitted keys are genuinely
 * absent (`'key' in obj === false`), not present-with-undefined.
 */

import { RESPONSE_CONTENT, SHIPPING_CITY } from './constants';
import type {
  AdditionalCosts,
  CartLine,
  SessionConfig,
  TalonCartItem,
  TalonCustomerSession,
  TalonSessionPayload,
} from './types';

/** True when the value is a usable numeric measurement (not undefined/NaN). */
function isPresentNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True when additionalCosts carries at least one entry. */
function hasCosts(costs: AdditionalCosts | undefined): costs is AdditionalCosts {
  return costs !== undefined && costs !== null && Object.keys(costs).length > 0;
}

function buildCartItem(line: CartLine): TalonCartItem {
  const item: TalonCartItem = {
    name: line.name,
    sku: line.sku,
    quantity: line.quantity,
    price: line.price,
    category: line.category,
  };

  if (isPresentNumber(line.weight)) item.weight = line.weight;
  if (isPresentNumber(line.height)) item.height = line.height;
  if (isPresentNumber(line.width)) item.width = line.width;
  if (isPresentNumber(line.length)) item.length = line.length;
  if (hasCosts(line.additionalCosts)) item.additionalCosts = line.additionalCosts;

  return item;
}

/**
 * Builds the full request body for `PUT /v2/customer_sessions/{sessionId}`.
 *
 * @param cart  Current cart lines, in display order (index === Talon `position`).
 * @param session Session identity and evaluation switches.
 */
export function buildSessionPayload(
  cart: CartLine[],
  session: SessionConfig,
): TalonSessionPayload {
  const customerSession: TalonCustomerSession = {
    profileId: session.profileId,
    state: session.state,
    cartItems: cart.map(buildCartItem),
    attributes: { ShippingCity: SHIPPING_CITY },
  };

  // evaluableCampaignIds is meaningful only alongside ?dry=true.
  if (session.dryRun && session.evaluableCampaignIds.length > 0) {
    customerSession.evaluableCampaignIds = [...session.evaluableCampaignIds];
  }

  // A blank or whitespace-only code is "no coupon", never `[""]` or `[]`.
  // couponCodes is ALWAYS sent, including as an empty array.
  //
  // Talon.One treats an omitted couponCodes as "leave the session's existing
  // coupons alone", and an explicit [] as "discard them". Omitting it when the
  // user removes a coupon would therefore keep the coupon applied server-side
  // and the discount would survive removal. Sending the authoritative list on
  // every request keeps the session in step with the UI.
  const trimmedCoupon = session.couponCode?.trim() ?? '';
  customerSession.couponCodes = trimmedCoupon.length > 0 ? [trimmedCoupon] : [];

  if (session.shippingCost > 0) {
    customerSession.additionalCosts = { shipping: { price: session.shippingCost } };
  }

  return {
    customerSession,
    responseContent: [...RESPONSE_CONTENT],
  };
}
