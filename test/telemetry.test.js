import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanProps, createTelemetry } from '../src/telemetry.js';

const identity = { sha: 'c'.repeat(40), environment: 'preview' };
const configured = {
  ZERO_TELEMETRY_URL: 'https://ingest.example.invalid/v1/telemetry',
  ZERO_TELEMETRY_KEY: 'atk_x',
};

function recorder(ok = true) {
  const calls = [];
  const send = async (url, init) => {
    calls.push({ url, init });
    return { ok };
  };
  return { calls, send };
}

test('disabled without an ingest URL and key', async () => {
  const r = recorder();
  const t = createTelemetry({ identity, env: {}, send: r.send });
  assert.equal(t.status, 'disabled');
  assert.equal(await t.track('page_view'), false);
  assert.equal(r.calls.length, 0);
});

test('never reports from verification or development builds', async () => {
  const r = recorder();
  for (const environment of ['verification', 'development', 'test']) {
    const t = createTelemetry({ identity: { ...identity, environment }, env: configured, send: r.send });
    assert.equal(t.status, 'disabled');
    await t.track('page_view');
  }
  assert.equal(r.calls.length, 0);
});

test('refuses non-https endpoints except loopback', () => {
  const env = { ...configured, ZERO_TELEMETRY_URL: 'http://ingest.example.invalid/x' };
  assert.equal(createTelemetry({ identity, env }).status, 'disabled');
  const local = { ...configured, ZERO_TELEMETRY_URL: 'http://127.0.0.1:8787/x' };
  assert.equal(createTelemetry({ identity, env: local }).status, 'enabled');
});

test('sends a standard event with identity, environment and a dedup key', async () => {
  const r = recorder();
  const t = createTelemetry({ identity, env: configured, send: r.send });
  assert.equal(await t.track('signup', { plan: 'free', count: 1 }), true);
  assert.equal(r.calls.length, 1);
  const { url, init } = r.calls[0];
  assert.equal(url, configured.ZERO_TELEMETRY_URL);
  assert.equal(init.headers['x-autarkeia-telemetry-key'], 'atk_x');
  const [event] = JSON.parse(init.body).events;
  assert.equal(event.event, 'signup');
  assert.equal(event.version, identity.sha);
  assert.equal(event.environment, 'preview');
  assert.match(event.dedupKey, /^[0-9a-f-]{36}$/);
  assert.deepEqual(event.props, { plan: 'free', count: 1 });
});

test('unknown events are a programming error; delivery failures are not', async () => {
  const t = createTelemetry({
    identity,
    env: configured,
    send: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(() => t.track('made_up'), /unknown telemetry event/);
  assert.equal(await t.track('page_view'), false);
});

test('props keep only small primitives with safe keys', () => {
  const long = 'x'.repeat(500);
  assert.deepEqual(cleanProps({ ok: 'y', n: 2, b: true, nested: { a: 1 }, 'Bad Key': 1, s: long }), {
    ok: 'y',
    n: 2,
    b: true,
    s: 'x'.repeat(200),
  });
});
