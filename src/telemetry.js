import { randomUUID } from 'node:crypto';

/** Standard product events (AUTARKEIA docs/19). Analytics are never revenue evidence. */
export const EVENTS = Object.freeze([
  'page_view',
  'signup',
  'activation',
  'core_usage',
  'checkout_start',
  'payment_success',
  'cancellation',
  'retention_observation',
  'error',
]);

/** Only deployed environments report; each has its own write key (test and production never mix). */
const REPORTING_ENVIRONMENTS = new Set(['preview', 'production']);
const MAX_PROPS = 16;
const MAX_VALUE = 200;

function allowedUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))
    );
  } catch {
    return false;
  }
}

/** Keep only small primitive properties. Callers must not pass personal data or request content. */
export function cleanProps(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props).slice(0, MAX_PROPS)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, MAX_VALUE);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * Telemetry client. Disabled (and silent) unless the ingest URL and this environment's write key are
 * configured by AUTARKEIA's publisher. Sending never blocks or fails a request.
 */
export function createTelemetry({ identity, env = process.env, send = globalThis.fetch, timeoutMs = 2000 }) {
  const url = env.ZERO_TELEMETRY_URL;
  const key = env.ZERO_TELEMETRY_KEY;
  const enabled = Boolean(url && key) && allowedUrl(url) && REPORTING_ENVIRONMENTS.has(identity.environment);
  return {
    status: enabled ? 'enabled' : 'disabled',
    /** Resolves true when the ingest endpoint accepted the event, false otherwise (never rejects). */
    async track(event, props = {}) {
      if (!EVENTS.includes(event)) throw new Error(`unknown telemetry event ${event}`);
      if (!enabled) return false;
      const body = {
        events: [
          {
            event,
            dedupKey: randomUUID(),
            occurredAt: new Date().toISOString(),
            version: identity.sha,
            environment: identity.environment,
            props: cleanProps(props),
          },
        ],
      };
      try {
        const res = await send(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-autarkeia-telemetry-key': key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
