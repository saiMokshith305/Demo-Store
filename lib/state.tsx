'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { SEED_CATALOG } from '@/data/seedCatalog';
import type {
  ApiCallRecord,
  AppError,
  CartLine,
  ParsedEffects,
  Product,
  SessionConfig,
  SessionState,
  Toast,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
/** Monotonic, collision-free id for client-side entities. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSessionId(): string {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AppState {
  catalog: Product[];
  cart: CartLine[];
  session: SessionConfig;
  /** the most recent request/response pair, drives the inspector */
  lastCall: ApiCallRecord | null;
  parsed: ParsedEffects | null;
  syncing: boolean;
  errors: AppError[];
  toasts: Toast[];
}

export const initialState: AppState = {
  catalog: SEED_CATALOG,
  cart: [],
  session: {
    sessionId: '',
    profileId: 'demo-customer-1',
    couponCode: null,
    state: 'open',
    shippingCost: 0,
    dryRun: false,
    evaluableCampaignIds: [],
  },
  lastCall: null,
  parsed: null,
  syncing: false,
  errors: [],
  toasts: [],
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'ADD_TO_CART'; product: Product }
  | { type: 'REMOVE_LINE'; lineId: string }
  | { type: 'UPDATE_LINE'; lineId: string; patch: Partial<CartLine> }
  | { type: 'CLEAR_CART' }
  | { type: 'ADD_PRODUCT'; product: Product }
  | { type: 'UPDATE_PRODUCT'; id: string; patch: Partial<Product> }
  | { type: 'REMOVE_PRODUCT'; id: string }
  | { type: 'SET_COUPON'; code: string | null }
  | { type: 'SET_PROFILE_ID'; profileId: string }
  | { type: 'SET_SESSION_STATE'; state: SessionState }
  | { type: 'SET_SHIPPING_COST'; shippingCost: number }
  | { type: 'SET_DRY_RUN'; dryRun: boolean }
  | { type: 'SET_EVALUABLE_CAMPAIGN_IDS'; ids: number[] }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_RESULT'; call: ApiCallRecord; parsed: ParsedEffects | null }
  | { type: 'PUSH_ERROR'; error: AppError }
  | { type: 'DISMISS_ERROR'; id: string }
  | { type: 'CLEAR_ERRORS'; kinds: AppError['kind'][] }
  | { type: 'PUSH_TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: string };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SESSION_ID':
      return { ...state, session: { ...state.session, sessionId: action.sessionId } };

    case 'ADD_TO_CART': {
      const existing = state.cart.find((l) => l.id === action.product.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((l) =>
            l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      const line: CartLine = { ...action.product, lineId: nextId('line'), quantity: 1 };
      return { ...state, cart: [...state.cart, line] };
    }

    case 'REMOVE_LINE':
      return { ...state, cart: state.cart.filter((l) => l.lineId !== action.lineId) };

    case 'UPDATE_LINE':
      return {
        ...state,
        cart: state.cart.map((l) =>
          l.lineId === action.lineId ? { ...l, ...action.patch } : l,
        ),
      };

    case 'CLEAR_CART':
      return { ...state, cart: [] };

    case 'ADD_PRODUCT':
      return { ...state, catalog: [...state.catalog, action.product] };

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        catalog: state.catalog.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      };

    case 'REMOVE_PRODUCT':
      return { ...state, catalog: state.catalog.filter((p) => p.id !== action.id) };

    case 'SET_COUPON':
      return { ...state, session: { ...state.session, couponCode: action.code } };

    case 'SET_PROFILE_ID':
      return { ...state, session: { ...state.session, profileId: action.profileId } };

    case 'SET_SESSION_STATE':
      return { ...state, session: { ...state.session, state: action.state } };

    case 'SET_SHIPPING_COST':
      return { ...state, session: { ...state.session, shippingCost: action.shippingCost } };

    case 'SET_DRY_RUN':
      return { ...state, session: { ...state.session, dryRun: action.dryRun } };

    case 'SET_EVALUABLE_CAMPAIGN_IDS':
      return { ...state, session: { ...state.session, evaluableCampaignIds: action.ids } };

    case 'SYNC_START':
      return { ...state, syncing: true };

    case 'SYNC_RESULT':
      return { ...state, syncing: false, lastCall: action.call, parsed: action.parsed };

    case 'PUSH_ERROR':
      return { ...state, errors: [...state.errors, action.error] };

    case 'DISMISS_ERROR':
      return { ...state, errors: state.errors.filter((e) => e.id !== action.id) };

    case 'CLEAR_ERRORS':
      return { ...state, errors: state.errors.filter((e) => !action.kinds.includes(e.kind)) };

    case 'PUSH_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };

    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Generated after mount so server and client markup match.
  useEffect(() => {
    dispatch({ type: 'SET_SESSION_ID', sessionId: generateSessionId() });
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within a StoreProvider');
  return store;
}

// ---------------------------------------------------------------------------
// Convenience helpers for components
// ---------------------------------------------------------------------------

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
