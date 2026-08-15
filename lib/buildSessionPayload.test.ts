import { describe, it, expect } from 'vitest';

import { buildSessionPayload } from './buildSessionPayload';
import { RESPONSE_CONTENT, SHIPPING_CITY } from './constants';
import type { CartLine, SessionConfig } from './types';

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    lineId: 'line-1',
    id: 'p-zelda',
    name: 'The Legend of Zelda',
    sku: 'GAME-ZELDA',
    price: 59.99,
    category: 'games',
    quantity: 1,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    sessionId: 'session-abc',
    profileId: 'demo-customer-1',
    couponCode: null,
    shippingCost: 0,
    dryRun: false,
    evaluableCampaignIds: [],
    ...overrides,
  };
}

describe('buildSessionPayload', () => {
  describe('always-present fields', () => {
    it('copies profileId from the session config', () => {
      const payload = buildSessionPayload([], makeSession({ profileId: 'shopper-42' }));
      expect(payload.customerSession.profileId).toBe('shopper-42');
    });

    it("always sets state to 'open'", () => {
      const payload = buildSessionPayload([], makeSession());
      expect(payload.customerSession.state).toBe('open');
    });

    it('always sends the hardcoded ShippingCity attribute', () => {
      const payload = buildSessionPayload([], makeSession());
      expect(payload.customerSession.attributes).toEqual({ ShippingCity: SHIPPING_CITY });
    });

    it('always sends the agreed responseContent', () => {
      const payload = buildSessionPayload([], makeSession());
      expect(payload.responseContent).toEqual(RESPONSE_CONTENT);
    });

    it('sends an empty cartItems array for an empty cart', () => {
      const payload = buildSessionPayload([], makeSession());
      expect(payload.customerSession.cartItems).toEqual([]);
    });
  });

  describe('cart item mapping', () => {
    it('maps the required fields of every line, in order', () => {
      const payload = buildSessionPayload(
        [
          makeLine(),
          makeLine({ lineId: 'line-2', name: 'PS5', sku: 'CONSOLE-PS5', price: 499, category: 'console', quantity: 2 }),
        ],
        makeSession(),
      );

      expect(payload.customerSession.cartItems).toEqual([
        { name: 'The Legend of Zelda', sku: 'GAME-ZELDA', quantity: 1, price: 59.99, category: 'games' },
        { name: 'PS5', sku: 'CONSOLE-PS5', quantity: 2, price: 499, category: 'console' },
      ]);
    });

    it('does not leak catalog-only fields such as id or lineId', () => {
      const [item] = buildSessionPayload([makeLine()], makeSession()).customerSession.cartItems;
      expect('id' in item!).toBe(false);
      expect('lineId' in item!).toBe(false);
    });

    it('omits weight, height, width and length when undefined', () => {
      const [item] = buildSessionPayload([makeLine()], makeSession()).customerSession.cartItems;
      expect('weight' in item!).toBe(false);
      expect('height' in item!).toBe(false);
      expect('width' in item!).toBe(false);
      expect('length' in item!).toBe(false);
    });

    it('includes dimensions when they are set', () => {
      const [item] = buildSessionPayload(
        [makeLine({ weight: 100, height: 15, width: 135, length: 170 })],
        makeSession(),
      ).customerSession.cartItems;

      expect(item).toEqual({
        name: 'The Legend of Zelda',
        sku: 'GAME-ZELDA',
        quantity: 1,
        price: 59.99,
        category: 'games',
        weight: 100,
        height: 15,
        width: 135,
        length: 170,
      });
    });

    it('includes a dimension that is legitimately zero', () => {
      const [item] = buildSessionPayload([makeLine({ weight: 0 })], makeSession()).customerSession.cartItems;
      expect('weight' in item!).toBe(true);
      expect(item!.weight).toBe(0);
    });

    it('omits only the dimensions that are undefined, keeping the rest', () => {
      const [item] = buildSessionPayload([makeLine({ weight: 100 })], makeSession()).customerSession.cartItems;
      expect('weight' in item!).toBe(true);
      expect('height' in item!).toBe(false);
      expect('width' in item!).toBe(false);
      expect('length' in item!).toBe(false);
    });

    it('omits item additionalCosts when undefined', () => {
      const [item] = buildSessionPayload([makeLine()], makeSession()).customerSession.cartItems;
      expect('additionalCosts' in item!).toBe(false);
    });

    it('omits item additionalCosts when an empty object', () => {
      const [item] = buildSessionPayload(
        [makeLine({ additionalCosts: {} })],
        makeSession(),
      ).customerSession.cartItems;
      expect('additionalCosts' in item!).toBe(false);
    });

    it('includes item additionalCosts when populated', () => {
      const [item] = buildSessionPayload(
        [makeLine({ additionalCosts: { shipping: { price: 2.5 } } })],
        makeSession(),
      ).customerSession.cartItems;
      expect(item!.additionalCosts).toEqual({ shipping: { price: 2.5 } });
    });
  });

  describe('couponCodes', () => {
    it('omits couponCodes when couponCode is null', () => {
      const payload = buildSessionPayload([], makeSession({ couponCode: null }));
      expect('couponCodes' in payload.customerSession).toBe(false);
    });

    it('omits couponCodes when couponCode is an empty string', () => {
      const payload = buildSessionPayload([], makeSession({ couponCode: '' }));
      expect('couponCodes' in payload.customerSession).toBe(false);
    });

    it('omits couponCodes when couponCode is whitespace only', () => {
      const payload = buildSessionPayload([], makeSession({ couponCode: '   \t ' }));
      expect('couponCodes' in payload.customerSession).toBe(false);
    });

    it('sends a single-element array when a coupon is applied', () => {
      const payload = buildSessionPayload([], makeSession({ couponCode: 'SAVE10' }));
      expect(payload.customerSession.couponCodes).toEqual(['SAVE10']);
    });

    it('trims surrounding whitespace from the coupon code', () => {
      const payload = buildSessionPayload([], makeSession({ couponCode: '  SAVE10  ' }));
      expect(payload.customerSession.couponCodes).toEqual(['SAVE10']);
    });
  });

  describe('evaluableCampaignIds', () => {
    it('is omitted when dryRun is false even if ids are present', () => {
      const payload = buildSessionPayload([], makeSession({ dryRun: false, evaluableCampaignIds: [42, 43] }));
      expect('evaluableCampaignIds' in payload.customerSession).toBe(false);
    });

    it('is omitted when dryRun is true but the array is empty', () => {
      const payload = buildSessionPayload([], makeSession({ dryRun: true, evaluableCampaignIds: [] }));
      expect('evaluableCampaignIds' in payload.customerSession).toBe(false);
    });

    it('is included when dryRun is true and ids are present', () => {
      const payload = buildSessionPayload([], makeSession({ dryRun: true, evaluableCampaignIds: [42, 43] }));
      expect(payload.customerSession.evaluableCampaignIds).toEqual([42, 43]);
    });

    it('copies the ids rather than aliasing the session array', () => {
      const session = makeSession({ dryRun: true, evaluableCampaignIds: [42] });
      const payload = buildSessionPayload([], session);
      session.evaluableCampaignIds.push(99);
      expect(payload.customerSession.evaluableCampaignIds).toEqual([42]);
    });
  });

  describe('session-level additionalCosts', () => {
    it('is omitted when shippingCost is 0', () => {
      const payload = buildSessionPayload([], makeSession({ shippingCost: 0 }));
      expect('additionalCosts' in payload.customerSession).toBe(false);
    });

    it('is omitted when shippingCost is negative', () => {
      const payload = buildSessionPayload([], makeSession({ shippingCost: -5 }));
      expect('additionalCosts' in payload.customerSession).toBe(false);
    });

    it('is included as shipping.price when shippingCost is positive', () => {
      const payload = buildSessionPayload([], makeSession({ shippingCost: 9.99 }));
      expect(payload.customerSession.additionalCosts).toEqual({ shipping: { price: 9.99 } });
    });
  });

  describe('happy path', () => {
    it('produces the full documented payload with every optional field present', () => {
      const cart: CartLine[] = [
        makeLine({
          weight: 100,
          height: 15,
          width: 135,
          length: 170,
          additionalCosts: { shipping: { price: 2.5 } },
        }),
      ];
      const session = makeSession({
        profileId: 'demo-customer-1',
        couponCode: 'SAVE10',
        shippingCost: 9.99,
        dryRun: true,
        evaluableCampaignIds: [42],
      });

      expect(buildSessionPayload(cart, session)).toEqual({
        customerSession: {
          profileId: 'demo-customer-1',
          evaluableCampaignIds: [42],
          state: 'open',
          couponCodes: ['SAVE10'],
          cartItems: [
            {
              name: 'The Legend of Zelda',
              sku: 'GAME-ZELDA',
              quantity: 1,
              price: 59.99,
              category: 'games',
              weight: 100,
              height: 15,
              width: 135,
              length: 170,
              additionalCosts: { shipping: { price: 2.5 } },
            },
          ],
          additionalCosts: { shipping: { price: 9.99 } },
          attributes: { ShippingCity: SHIPPING_CITY },
        },
        responseContent: ['customerSession', 'customerProfile'],
      });
    });

    it('produces the minimal payload when nothing optional is set', () => {
      const payload = buildSessionPayload([makeLine()], makeSession());

      expect(Object.keys(payload.customerSession).sort()).toEqual(
        ['attributes', 'cartItems', 'profileId', 'state'].sort(),
      );
      expect(JSON.parse(JSON.stringify(payload))).toEqual({
        customerSession: {
          profileId: 'demo-customer-1',
          state: 'open',
          cartItems: [
            { name: 'The Legend of Zelda', sku: 'GAME-ZELDA', quantity: 1, price: 59.99, category: 'games' },
          ],
          attributes: { ShippingCity: SHIPPING_CITY },
        },
        responseContent: ['customerSession', 'customerProfile'],
      });
    });
  });
});
