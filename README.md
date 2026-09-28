# AUTARKEIA factory probe 2

An AUTARKEIA product (project `prj_0199b2c0a1d27f3e8b4c5d6e7f809a2c`, key `autarkeia-factory-probe-2`), created by the AUTARKEIA project factory from the `node-service` template.

- `GET /` — product home page.
- `GET /_zero/health` — `{ ok, service, projectId, sha, environment, builtAt, telemetry }`. Reserved: AUTARKEIA's trusted verifier uses `service` and `sha` to prove which commit is deployed.

## Development

```sh
npm ci --ignore-scripts
npm test
PORT=8080 node src/server.js
```

## How changes ship

Changes arrive as pull requests from AUTARKEIA's gateway. This repository's CI runs untrusted checks with a read-only token. Deployment is performed by AUTARKEIA's trusted publisher from the verified commit; deploy configuration and acceptance assertions live outside this repository's write scope.

## Telemetry

`src/telemetry.js` sends the standard product events (page view, signup, activation, core usage, checkout start, payment success, cancellation, retention observation, error) to AUTARKEIA's ingest endpoint with a per-environment write key. It is disabled unless the publisher configures `ZERO_TELEMETRY_URL` and `ZERO_TELEMETRY_KEY`, and never reports from verification or development builds. Do not send personal data or request content. Analytics are never revenue evidence.

## Before launch (project-specific review required)

- [PRIVACY.md](PRIVACY.md) and [SUPPORT.md](SUPPORT.md) are placeholders and must be reviewed for this product.
- Payment, authentication, database and wallet modules are not included. Add only the real adapters this product needs.
