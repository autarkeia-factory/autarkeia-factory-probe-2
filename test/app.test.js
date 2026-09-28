import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApp, escapeHtml } from '../src/app.js';
import { PROJECT } from '../src/project.js';

async function serve(app) {
  const server = createServer(app.handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function recordingTelemetry() {
  const events = [];
  return {
    events,
    status: 'enabled',
    async track(event, props) {
      events.push({ event, props });
      return true;
    },
  };
}

test('project identity is present', () => {
  assert.match(PROJECT.projectId, /^prj_[0-9a-f]{32}$/);
  assert.match(PROJECT.service, /^[a-z][a-z0-9-]{2,62}$/);
  assert.ok(PROJECT.name.length > 0);
});

test('health reports build identity', async () => {
  const app = createApp({ build: { sha: 'b'.repeat(40), environment: 'test' }, env: {} });
  const s = await serve(app);
  try {
    const res = await fetch(`${s.base}/_zero/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, PROJECT.service);
    assert.equal(body.projectId, PROJECT.projectId);
    assert.equal(body.sha, 'b'.repeat(40));
    assert.equal(body.environment, 'test');
    assert.equal(body.telemetry, 'disabled');
  } finally {
    await s.close();
  }
});

test('home page renders the greeting heading and counts a page view', async () => {
  const telemetry = recordingTelemetry();
  const app = createApp({ build: { sha: 'a'.repeat(40) }, env: {}, telemetry });
  const s = await serve(app);
  try {
    const res = await fetch(`${s.base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(
      html.includes(`<h1 id="greeting">${escapeHtml(PROJECT.name)}</h1>`),
      'greeting heading missing',
    );
    assert.ok(html.includes('aaaaaaaaaaaa'), 'build identity missing from page');
    assert.deepEqual(telemetry.events, [{ event: 'page_view', props: { path: '/' } }]);
  } finally {
    await s.close();
  }
});

test('unknown paths are 404 and writes are refused', async () => {
  const s = await serve(createApp({ env: {} }));
  try {
    assert.equal((await fetch(`${s.base}/nope`)).status, 404);
    assert.equal((await fetch(`${s.base}/`, { method: 'POST' })).status, 405);
  } finally {
    await s.close();
  }
});

test('errors are reported without leaking their content', async () => {
  const telemetry = recordingTelemetry();
  const app = createApp({
    env: {},
    telemetry,
    routes: {
      '/boom': () => {
        throw new TypeError('secret detail');
      },
    },
  });
  const s = await serve(app);
  try {
    const res = await fetch(`${s.base}/boom`);
    assert.equal(res.status, 500);
    assert.ok(!(await res.text()).includes('secret detail'));
    assert.deepEqual(telemetry.events, [{ event: 'error', props: { route: '/boom', kind: 'TypeError' } }]);
  } finally {
    await s.close();
  }
});

test('products cannot replace the reserved health route', async () => {
  const app = createApp({ env: {}, routes: { '/_zero/health': () => ({ status: 200, body: 'fake' }) } });
  const s = await serve(app);
  try {
    const body = await (await fetch(`${s.base}/_zero/health`)).json();
    assert.equal(body.service, PROJECT.service);
  } finally {
    await s.close();
  }
});
