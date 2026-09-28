import { PROJECT } from './project.js';
import { createTelemetry } from './telemetry.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Build identity comes from the build (Dockerfile ARGs → environment), never from a request. */
export function buildIdentity(build = {}, env = process.env) {
  return {
    service: PROJECT.service,
    projectId: PROJECT.projectId,
    sha: build.sha ?? env.ZERO_BUILD_SHA ?? 'unknown',
    environment: build.environment ?? env.ZERO_ENVIRONMENT ?? 'development',
    builtAt: build.builtAt ?? env.ZERO_BUILT_AT ?? null,
  };
}

function homePage(identity) {
  const name = escapeHtml(PROJECT.name);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title></head>
<body>
<main>
<h1 id="greeting">${name}</h1>
<p>This product is being built by AUTARKEIA. Every change is verified before it ships.</p>
<p><small>build <code>${escapeHtml(identity.sha.slice(0, 12))}</code> · ${escapeHtml(identity.environment)}</small></p>
</main>
<footer><p>${escapeHtml(identity.service)}</p></footer>
</body>
</html>`;
}

function send(res, status, type, body, head) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(head ? undefined : body);
}

/**
 * The product's HTTP handler. `routes` maps a GET path to a function returning
 * `{ status, type, body }`; products add their own routes here. `/_zero/health` is reserved:
 * AUTARKEIA's verifier uses it to prove which commit is deployed.
 */
export function createApp(options = {}) {
  const identity = buildIdentity(options.build, options.env);
  const telemetry = options.telemetry ?? createTelemetry({ identity, env: options.env ?? process.env });
  const routes = {
    '/': () => {
      void telemetry.track('page_view', { path: '/' });
      return { status: 200, type: 'text/html; charset=utf-8', body: homePage(identity) };
    },
    ...(options.routes ?? {}),
    '/_zero/health': () => ({
      status: 200,
      type: 'application/json',
      body: JSON.stringify({ ok: true, ...identity, telemetry: telemetry.status }),
    }),
  };

  async function handler(req, res) {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const head = req.method === 'HEAD';
    if (req.method !== 'GET' && !head) {
      send(res, 405, 'application/json', JSON.stringify({ error: 'method_not_allowed' }), head);
      return;
    }
    const route = Object.hasOwn(routes, path) ? routes[path] : undefined;
    if (!route) {
      send(res, 404, 'application/json', JSON.stringify({ error: 'not_found' }), head);
      return;
    }
    try {
      const r = await route(req);
      send(res, r.status ?? 200, r.type ?? 'text/plain; charset=utf-8', r.body ?? '', head);
    } catch (err) {
      // Error reporting: the route and error class only; never the message, request or user data.
      void telemetry.track('error', { route: path, kind: err instanceof Error ? err.name : 'unknown' });
      console.error(`request failed on ${path}`);
      send(res, 500, 'application/json', JSON.stringify({ error: 'internal_error' }), head);
    }
  }

  return { identity, telemetry, handler };
}
