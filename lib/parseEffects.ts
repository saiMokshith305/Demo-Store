/**
 * Translates the top-level `effects` array of a Talon.One IntegrationStateV2
 * response into the friendly view model the cart renders.
 *
 * Deliberately reads `response.effects` and NOT `customerSession.discounts`:
 * the effects array is the authoritative, per-rule breakdown, while
 * `discounts` is a flattened map that loses rule attribution.
 *
 * Every function here is total: malformed input degrades to an empty or
 * partial result, never a throw. A single bad effect never aborts the parse.
 */

import type {
  CouponRejection,
  DiscountLine,
  GenericEffect,
  ParsedEffects,
  TalonEffect,
  TalonSessionResponse,
} from './types';

/** Effect types that produce a discount breakdown line. */
const DISCOUNT_EFFECT_TYPES = ['setDiscount', 'setDiscountPerItem'] as const;

function emptyParsedEffects(): ParsedEffects {
  return {
    discountLines: [],
    totalDiscount: 0,
    acceptedCoupons: [],
    rejections: [],
    otherEffects: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerce a raw props value to a finite number.
 * Talon.One sends numbers, but attribute-driven props can arrive as strings.
 * Returns NaN for anything that cannot be read as a number.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/** A non-empty trimmed string, or undefined. */
function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

/** Only surface campaignId when it is genuinely numeric. */
function toOptionalNumber(value: unknown): number | undefined {
  const n = toFiniteNumber(value);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Label priority: props.name → ruleName → effectType.
 * Guarantees the UI always has something to render.
 */
function resolveLabel(effect: TalonEffect, props: Record<string, unknown>): string {
  return (
    toNonEmptyString(props.name) ??
    toNonEmptyString(effect.ruleName) ??
    toNonEmptyString(effect.effectType) ??
    'Discount'
  );
}

function buildDiscountLine(
  effect: TalonEffect,
  props: Record<string, unknown>,
  effectType: string,
): DiscountLine | null {
  const raw = toFiniteNumber(props.value);
  // A NaN discount would render as "$NaN" — drop the line instead.
  if (Number.isNaN(raw)) return null;

  const line: DiscountLine = {
    label: resolveLabel(effect, props),
    // Talon.One returns positive magnitudes; Math.abs is belt-and-braces so a
    // sign flip upstream can never turn a discount into a negative total.
    value: Math.abs(raw),
    effectType,
  };

  const campaignId = toOptionalNumber(effect.campaignId);
  if (campaignId !== undefined) line.campaignId = campaignId;

  const ruleName = toNonEmptyString(effect.ruleName);
  if (ruleName !== undefined) line.ruleName = ruleName;

  if (effectType === 'setDiscountPerItem') {
    const position = toOptionalNumber(props.position);
    if (position !== undefined) line.position = position;
  }

  return line;
}

function buildGenericEffect(
  effect: TalonEffect,
  props: Record<string, unknown>,
  effectType: string,
): GenericEffect {
  const generic: GenericEffect = { effectType, props };

  const campaignId = toOptionalNumber(effect.campaignId);
  if (campaignId !== undefined) generic.campaignId = campaignId;

  const ruleName = toNonEmptyString(effect.ruleName);
  if (ruleName !== undefined) generic.ruleName = ruleName;

  return generic;
}

/**
 * Parse a Talon.One session response into the cart's discount breakdown,
 * accepted coupons, coupon rejections, and every other effect verbatim.
 *
 * Always returns a fully populated object — arrays are never undefined.
 */
export function parseEffects(response: TalonSessionResponse | null): ParsedEffects {
  const parsed = emptyParsedEffects();

  if (!isRecord(response)) return parsed;

  const effects: unknown = response.effects;
  if (!Array.isArray(effects)) return parsed;

  for (const raw of effects as unknown[]) {
    if (!isRecord(raw)) continue; // nothing meaningful to render from a non-object

    const effect = raw as unknown as TalonEffect;
    // Keep unlabelled effects visible rather than dropping them.
    const effectType = toNonEmptyString(effect.effectType) ?? 'unknown';
    const props = isRecord(effect.props) ? effect.props : {};

    if ((DISCOUNT_EFFECT_TYPES as readonly string[]).includes(effectType)) {
      const line = buildDiscountLine(effect, props, effectType);
      if (line) parsed.discountLines.push(line);
      continue;
    }

    if (effectType === 'acceptCoupon') {
      const code = toNonEmptyString(props.value);
      if (code !== undefined) parsed.acceptedCoupons.push(code);
      continue;
    }

    if (effectType === 'rejectCoupon') {
      const rejection: CouponRejection = {
        code: toNonEmptyString(props.value) ?? '',
        reason: toNonEmptyString(props.rejectionReason) ?? 'Unknown reason',
      };
      parsed.rejections.push(rejection);
      continue;
    }

    parsed.otherEffects.push(buildGenericEffect(effect, props, effectType));
  }

  parsed.totalDiscount = parsed.discountLines.reduce((sum, line) => sum + line.value, 0);

  return parsed;
}

/** True when the response carried at least one `rejectCoupon` effect. */
export function hasRejections(parsed: ParsedEffects): boolean {
  return Array.isArray(parsed?.rejections) && parsed.rejections.length > 0;
}
