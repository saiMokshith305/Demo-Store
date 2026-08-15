'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '@/lib/state';

export interface ApiInspectorProps {
  /** Forces an immediate updateCustomerSession call. Optional so the drawer renders standalone. */
  onReevaluate?: () => void;
}

type TabId = 'request' | 'response' | 'failures';

/** Pretty-printed JSON that never throws on odd values. */
function pretty(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return '/* value could not be serialized */';
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      title={label}
      aria-label={label}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

/** Collapsible bottom drawer showing the exact Talon.One request / response. */
export default function ApiInspector({ onReevaluate }: ApiInspectorProps) {
  const { state } = useStore();
  const call = state.lastCall;
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<TabId>('request');

  const failures = useMemo(() => {
    const raw = call?.responseBody?.ruleFailureReasons;
    return Array.isArray(raw) && raw.length > 0 ? raw : null;
  }, [call]);

  // Never leave a tab selected that no longer exists.
  const activeTab: TabId = tab === 'failures' && !failures ? 'response' : tab;

  const status = call?.status ?? null;
  const statusChipClass =
    status === null
      ? 'chip chip-muted'
      : status >= 200 && status < 300
        ? 'chip chip-success'
        : 'chip chip-danger';
  const statusLabel = status === null ? (call ? 'ERR' : '—') : String(status);

  const tabBody =
    activeTab === 'request'
      ? pretty(call?.requestBody)
      : activeTab === 'response'
        ? pretty(call?.responseBody)
        : pretty(failures ?? []);

  const tabButton = (id: TabId, accent?: string): CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid',
    borderColor: activeTab === id ? 'var(--border-strong)' : 'transparent',
    background: activeTab === id ? 'var(--surface)' : 'transparent',
    color: accent ?? (activeTab === id ? 'var(--text)' : 'var(--text-muted)'),
    fontWeight: 600,
    fontSize: 13,
    boxShadow: activeTab === id ? 'var(--shadow-sm)' : 'none',
  });

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* --- collapsed / header bar --- */}
      <div
        style={{
          height: 'var(--drawer-collapsed-h)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
          background: 'var(--surface-2)',
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse API inspector' : 'Expand API inspector'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span aria-hidden style={{ fontSize: 11 }}>
            {expanded ? '▼' : '▲'}
          </span>
          <span className="panel-title">API Inspector</span>
        </button>

        <span className={statusChipClass} title="Last HTTP status">
          {statusLabel}
        </span>

        <span className="mono subtle">{call ? `${call.durationMs}ms` : '—'}</span>

        {failures && (
          <span
            className="chip"
            style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
            title="Campaigns that did not fire"
          >
            {failures.length} rule failure{failures.length === 1 ? '' : 's'}
          </span>
        )}

        {call?.error && (
          <span
            className="mono"
            style={{
              color: 'var(--danger)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 420,
            }}
          >
            {call.error}
          </span>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => onReevaluate?.()}
          disabled={!onReevaluate || state.syncing}
          title="Re-run updateCustomerSession now"
        >
          <span aria-hidden>⟳</span> {state.syncing ? 'Evaluating…' : 'Re-evaluate'}
        </button>
      </div>

      {/* --- expanded body --- */}
      {expanded && (
        <div
          style={{
            height: '45vh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slide-up 0.18s ease-out',
            minHeight: 0,
          }}
        >
          {!call ? (
            <div
              className="muted"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                textAlign: 'center',
              }}
            >
              No API call yet — add an item to the cart.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px 0',
                  flexShrink: 0,
                }}
              >
                <span className="chip chip-muted mono">{call.method}</span>
                <span
                  className="mono muted"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={call.url}
                >
                  {call.url}
                </span>
              </div>

              {call.error && (
                <div
                  className="mono"
                  style={{
                    margin: '8px 14px 0',
                    padding: '8px 10px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    fontWeight: 600,
                  }}
                >
                  {call.error}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  flexShrink: 0,
                }}
              >
                <button type="button" style={tabButton('request')} onClick={() => setTab('request')}>
                  Request
                </button>
                <button
                  type="button"
                  style={tabButton('response')}
                  onClick={() => setTab('response')}
                >
                  Response
                </button>
                {failures && (
                  <button
                    type="button"
                    style={{
                      ...tabButton('failures', 'var(--warning)'),
                      background: 'var(--warning-soft)',
                      borderColor: activeTab === 'failures' ? 'var(--warning)' : 'transparent',
                    }}
                    onClick={() => setTab('failures')}
                    title="Why campaigns did not fire (dry run only)"
                  >
                    ⚠ Rule failures ({failures.length})
                  </button>
                )}
                <span style={{ marginLeft: 'auto' }}>
                  <CopyButton text={tabBody} label={`Copy ${activeTab} JSON`} />
                </span>
              </div>

              <pre
                className="mono scroll-y"
                style={{
                  flex: 1,
                  minHeight: 0,
                  margin: '0 14px 14px',
                  padding: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
                {tabBody || '(empty)'}
              </pre>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
