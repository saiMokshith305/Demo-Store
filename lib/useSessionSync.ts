'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { buildSessionPayload } from '@/lib/buildSessionPayload';
import { parseEffects } from '@/lib/parseEffects';
import { updateCustomerSession } from '@/lib/talonOneClient';
import { getConfigError, SYNC_DEBOUNCE_MS } from '@/lib/constants';
import { nextId, useStore } from '@/lib/state';
import type { AppError } from '@/lib/types';

/**
 * Keeps the Talon.One session in step with the cart.
 *
 * Any change to the cart or session config rebuilds the payload; if the payload
 * actually differs from the last one sent, a debounced PUT goes out. Responses
 * are applied only if no newer request has been issued in the meantime, so a
 * slow response can never overwrite fresher state.
 *
 * Returns a `reevaluate` callback for the inspector's manual trigger.
 */
export function useSessionSync() {
  const { state, dispatch } = useStore();
  const { cart, session } = state;

  const payload = useMemo(() => buildSessionPayload(cart, session), [cart, session]);
  const payloadKey = JSON.stringify(payload);

  /** Monotonic request counter — only the newest response is allowed to land. */
  const requestSeq = useRef(0);
  /**
   * True once a session has been pushed. After that, emptying the cart must
   * still sync — otherwise Talon.One keeps the old cart and the breakdown
   * would keep showing discounts for items no longer there.
   */
  const hasSyncedRef = useRef(false);

  // Surface a bad .env.local immediately rather than as a mysterious failed call.
  useEffect(() => {
    const configError = getConfigError();
    if (!configError) return;
    dispatch({
      type: 'PUSH_ERROR',
      error: { id: nextId('err'), kind: 'config', message: configError },
    });
  }, [dispatch]);

  const runSync = useCallback(async () => {
    if (!session.sessionId) return; // generated after mount
    if (getConfigError()) return; // config banner already explains the problem

    const seq = ++requestSeq.current;
    dispatch({ type: 'SYNC_START' });

    const call = await updateCustomerSession(session.sessionId, payload, {
      dryRun: session.dryRun,
    });

    // A newer request overtook this one — drop the stale result.
    if (seq !== requestSeq.current) return;

    hasSyncedRef.current = true;

    const parsed = call.responseBody ? parseEffects(call.responseBody) : null;
    dispatch({ type: 'SYNC_RESULT', call, parsed });

    // Replace transient errors from the previous attempt rather than stacking them.
    dispatch({ type: 'CLEAR_ERRORS', kinds: ['http', 'network', 'coupon'] });

    const errors: AppError[] = [];

    if (call.error) {
      errors.push({
        id: nextId('err'),
        kind: call.status === null ? 'network' : 'http',
        message: call.error,
      });
    }

    // A rejected coupon comes back inside an HTTP 200 — without this it would
    // look like a silently broken campaign.
    for (const rejection of parsed?.rejections ?? []) {
      errors.push({
        id: nextId('err'),
        kind: 'coupon',
        message: `Coupon "${rejection.code}" was rejected — ${rejection.reason}`,
      });
    }

    for (const error of errors) dispatch({ type: 'PUSH_ERROR', error });

    if (parsed?.acceptedCoupons.length) {
      dispatch({
        type: 'PUSH_TOAST',
        toast: {
          id: nextId('toast'),
          tone: 'success',
          message: `Coupon ${parsed.acceptedCoupons.join(', ')} applied`,
        },
      });
    }
  }, [dispatch, payload, session.sessionId, session.dryRun]);

  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;

  // Nothing meaningful to evaluate until there's a cart or a coupon.
  const hasSomethingToEvaluate = cart.length > 0 || session.couponCode !== null;

  useEffect(() => {
    if (!session.sessionId) return;
    // Nothing to send yet — but once we've synced, keep syncing so that
    // emptying the cart clears the discounts rather than leaving them stale.
    if (!hasSomethingToEvaluate && !hasSyncedRef.current) return;

    const timer = setTimeout(() => {
      void runSyncRef.current();
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // payloadKey collapses cart+session into one value, so identical edits
    // (e.g. retyping the same price) don't trigger redundant calls.
  }, [payloadKey, session.sessionId, hasSomethingToEvaluate]);

  /** Manual trigger for the inspector — fires even if the payload is unchanged. */
  const reevaluate = useCallback(() => {
    void runSyncRef.current();
  }, []);

  return { reevaluate };
}
