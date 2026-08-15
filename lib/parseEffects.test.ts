import { describe, it, expect } from 'vitest';

import { hasRejections, parseEffects } from './parseEffects';
import type { TalonSessionResponse } from './types';

/** Wrap an effects array in a minimally realistic IntegrationStateV2 response. */
function responseWith(effects: unknown): TalonSessionResponse {
  return {
    customerSession: {
      integrationId: 'session-1',
      profileId: 'profile-1',
      total: 606,
      discounts: { 'Bundle Discount': 167.4 },
    },
    effects,
  } as TalonSessionResponse;
}

describe('parseEffects — empty and missing input', () => {
  it('returns a fully populated empty result for a null response', () => {
    const parsed = parseEffects(null);

    expect(parsed).toEqual({
      discountLines: [],
      totalDiscount: 0,
      acceptedCoupons: [],
      rejections: [],
      otherEffects: [],
    });
  });

  it('returns an empty result when effects is missing entirely', () => {
    const parsed = parseEffects({ customerSession: { total: 100 } });

    expect(parsed.discountLines).toEqual([]);
    expect(parsed.totalDiscount).toBe(0);
    expect(parsed.otherEffects).toEqual([]);
  });

  it('returns an empty result for an empty effects array', () => {
    const parsed = parseEffects(responseWith([]));

    expect(parsed.discountLines).toHaveLength(0);
    expect(parsed.totalDiscount).toBe(0);
    expect(parsed.acceptedCoupons).toHaveLength(0);
    expect(parsed.rejections).toHaveLength(0);
  });

  it('ignores customerSession.discounts and reads only the top-level effects array', () => {
    // customerSession.discounts carries a value; effects does not.
    const parsed = parseEffects(responseWith([]));

    expect(parsed.totalDiscount).toBe(0);
  });
});

describe('parseEffects — discounts', () => {
  it('maps setDiscount to a breakdown line and a total', () => {
    const parsed = parseEffects(
      responseWith([
        {
          campaignId: 42,
          rulesetId: 7,
          ruleIndex: 0,
          ruleName: '30% off bundle',
          effectType: 'setDiscount',
          props: { name: 'Bundle Discount', value: 167.4 },
        },
      ]),
    );

    expect(parsed.discountLines).toHaveLength(1);
    expect(parsed.discountLines[0]).toMatchObject({
      label: 'Bundle Discount',
      value: 167.4,
      effectType: 'setDiscount',
      campaignId: 42,
      ruleName: '30% off bundle',
    });
    expect(parsed.discountLines[0].position).toBeUndefined();
    expect(parsed.totalDiscount).toBeCloseTo(167.4, 5);
  });

  it('sums multiple discount effects', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'setDiscount', props: { name: 'Bundle Discount', value: 10 } },
        { effectType: 'setDiscount', props: { name: 'Loyalty', value: 5.5 } },
        {
          effectType: 'setDiscountPerItem',
          props: { name: 'Free cable', value: 12.99, position: 2 },
        },
      ]),
    );

    expect(parsed.discountLines.map((line) => line.label)).toEqual([
      'Bundle Discount',
      'Loyalty',
      'Free cable',
    ]);
    expect(parsed.totalDiscount).toBeCloseTo(28.49, 5);
  });

  it('carries position through for setDiscountPerItem', () => {
    const parsed = parseEffects(
      responseWith([
        {
          campaignId: 9,
          effectType: 'setDiscountPerItem',
          props: { name: 'HDMI cable free', value: 12.99, position: 3 },
        },
      ]),
    );

    expect(parsed.discountLines[0]).toMatchObject({
      label: 'HDMI cable free',
      value: 12.99,
      effectType: 'setDiscountPerItem',
      position: 3,
    });
  });

  it('coerces string discount values and normalises sign to a positive magnitude', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'setDiscount', props: { name: 'String value', value: '20.50' } },
        { effectType: 'setDiscount', props: { name: 'Negative value', value: -15 } },
      ]),
    );

    expect(parsed.discountLines[0].value).toBe(20.5);
    expect(parsed.discountLines[1].value).toBe(15);
    expect(parsed.totalDiscount).toBe(35.5);
  });

  it('falls back to ruleName then effectType when props.name is missing', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'setDiscount', ruleName: 'Weekend rule', props: { value: 5 } },
        { effectType: 'setDiscount', props: { value: 7 } },
      ]),
    );

    expect(parsed.discountLines[0].label).toBe('Weekend rule');
    expect(parsed.discountLines[1].label).toBe('setDiscount');
    expect(parsed.totalDiscount).toBe(12);
  });
});

describe('parseEffects — coupons', () => {
  it('collects accepted coupon codes', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'acceptCoupon', props: { value: 'BESTBUY10' } },
        { effectType: 'setDiscount', props: { name: 'Coupon discount', value: 10 } },
      ]),
    );

    expect(parsed.acceptedCoupons).toEqual(['BESTBUY10']);
    expect(parsed.rejections).toHaveLength(0);
    expect(hasRejections(parsed)).toBe(false);
  });

  it('extracts a rejection with the code and rejection reason', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'rejectCoupon', props: { value: 'XMAS22', rejectionReason: 'CouponNotFound' } },
      ]),
    );

    expect(parsed.rejections).toEqual([{ code: 'XMAS22', reason: 'CouponNotFound' }]);
    expect(hasRejections(parsed)).toBe(true);
    expect(parsed.discountLines).toHaveLength(0);
    expect(parsed.totalDiscount).toBe(0);
  });

  it('still reports a rejection when the reason is missing', () => {
    const parsed = parseEffects(
      responseWith([{ effectType: 'rejectCoupon', props: { value: 'XMAS22' } }]),
    );

    expect(hasRejections(parsed)).toBe(true);
    expect(parsed.rejections[0].code).toBe('XMAS22');
    expect(typeof parsed.rejections[0].reason).toBe('string');
    expect(parsed.rejections[0].reason.length).toBeGreaterThan(0);
  });
});

describe('parseEffects — unknown effect types', () => {
  it('keeps an unknown effect type in otherEffects rather than dropping it', () => {
    const parsed = parseEffects(
      responseWith([
        {
          campaignId: 11,
          ruleName: 'Free shipping rule',
          effectType: 'addFreeItem',
          props: { sku: 'HDMI-cable', quantity: 1 },
        },
      ]),
    );

    expect(parsed.discountLines).toHaveLength(0);
    expect(parsed.otherEffects).toHaveLength(1);
    expect(parsed.otherEffects[0]).toMatchObject({
      effectType: 'addFreeItem',
      campaignId: 11,
      ruleName: 'Free shipping rule',
      props: { sku: 'HDMI-cable', quantity: 1 },
    });
  });

  it('routes each effect to exactly one bucket in a mixed response', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'acceptCoupon', props: { value: 'BESTBUY10' } },
        { effectType: 'setDiscount', props: { name: 'Coupon discount', value: 25 } },
        { effectType: 'rejectCoupon', props: { value: 'XMAS22', rejectionReason: 'CouponExpired' } },
        { effectType: 'customEffect', props: { payload: { a: 1 } } },
      ]),
    );

    expect(parsed.discountLines).toHaveLength(1);
    expect(parsed.acceptedCoupons).toEqual(['BESTBUY10']);
    expect(parsed.rejections).toEqual([{ code: 'XMAS22', reason: 'CouponExpired' }]);
    expect(parsed.otherEffects).toHaveLength(1);
    expect(parsed.totalDiscount).toBe(25);
  });
});

describe('parseEffects — malformed input', () => {
  it('does not throw when effects is not an array', () => {
    expect(() => parseEffects(responseWith('not-an-array'))).not.toThrow();
    expect(parseEffects(responseWith('not-an-array')).discountLines).toEqual([]);
    expect(parseEffects(responseWith({ effectType: 'setDiscount' })).totalDiscount).toBe(0);
    expect(parseEffects(responseWith(null)).totalDiscount).toBe(0);
  });

  it('skips discount effects whose value is non-numeric instead of producing NaN', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'setDiscount', props: { name: 'Broken', value: 'not-a-number' } },
        { effectType: 'setDiscount', props: { name: 'Null value', value: null } },
        { effectType: 'setDiscount', props: { name: 'Good', value: 30 } },
      ]),
    );

    expect(parsed.discountLines).toHaveLength(1);
    expect(parsed.discountLines[0].label).toBe('Good');
    expect(parsed.totalDiscount).toBe(30);
    expect(Number.isNaN(parsed.totalDiscount)).toBe(false);
  });

  it('survives effects with missing props and non-object entries', () => {
    const parsed = parseEffects(
      responseWith([
        { effectType: 'setDiscount' },
        { effectType: 'acceptCoupon' },
        { effectType: 'rejectCoupon' },
        { effectType: 'someOtherEffect' },
        null,
        'garbage',
        42,
        {},
        { effectType: 'setDiscount', props: { name: 'Good', value: 9.99 } },
      ]),
    );

    expect(parsed.discountLines).toHaveLength(1);
    expect(parsed.discountLines[0].value).toBe(9.99);
    expect(parsed.acceptedCoupons).toEqual([]);
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0].code).toBe('');
    // someOtherEffect plus the empty object are both kept, nothing silently dropped.
    expect(parsed.otherEffects).toHaveLength(2);
    expect(parsed.otherEffects[1].effectType).toBe('unknown');
    expect(parsed.otherEffects.every((effect) => typeof effect.props === 'object')).toBe(true);
    expect(parsed.totalDiscount).toBe(9.99);
  });

  it('never throws for arbitrary junk responses', () => {
    const junk = [
      responseWith([{ effectType: 42, props: 'nope' }]),
      responseWith([{ props: { value: 5 } }]),
      { effects: [[], []] } as unknown as TalonSessionResponse,
    ];

    for (const input of junk) {
      expect(() => parseEffects(input)).not.toThrow();
      expect(Number.isNaN(parseEffects(input).totalDiscount)).toBe(false);
    }
  });
});

describe('hasRejections', () => {
  it('is false for an empty parse result and true once a rejection exists', () => {
    expect(hasRejections(parseEffects(null))).toBe(false);
    expect(
      hasRejections(
        parseEffects(
          responseWith([
            { effectType: 'rejectCoupon', props: { value: 'XMAS22', rejectionReason: 'CouponNotFound' } },
          ]),
        ),
      ),
    ).toBe(true);
  });
});

describe('per-unit split effects (real bundle campaign response)', () => {
  // Talon.One splits a quantity>1 cart line into one effect per unit. These
  // three effects are the real response for a cart of 1 PS5 + 2x FC 25 under
  // "30% discount on a bundle of 2 games and 1 console": the two FC 25 units
  // are identical except for subPosition.
  const BUNDLE_EFFECTS = [
    {
      campaignId: 15154,
      ruleName: '30% discount on a bundle of 2 games and 1 console',
      effectType: 'setDiscountPerItem',
      props: { name: '30% off per item#2', value: 149.7, position: 2, subPosition: 0 },
    },
    {
      campaignId: 15154,
      ruleName: '30% discount on a bundle of 2 games and 1 console',
      effectType: 'setDiscountPerItem',
      props: { name: '30% off per item#1', value: 14.997, position: 1, subPosition: 0 },
    },
    {
      campaignId: 15154,
      ruleName: '30% discount on a bundle of 2 games and 1 console',
      effectType: 'setDiscountPerItem',
      props: { name: '30% off per item#1', value: 14.997, position: 1, subPosition: 1 },
    },
  ];

  it('keeps both units of a split line rather than collapsing them', () => {
    const parsed = parseEffects(responseWith(BUNDLE_EFFECTS));

    expect(parsed.discountLines).toHaveLength(3);
    const perUnit = parsed.discountLines.filter((l) => l.label === '30% off per item#1');
    expect(perUnit).toHaveLength(2);
  });

  it('sums every unit into the total discount', () => {
    const parsed = parseEffects(responseWith(BUNDLE_EFFECTS));

    expect(parsed.totalDiscount).toBeCloseTo(149.7 + 14.997 + 14.997, 5);
  });
});
