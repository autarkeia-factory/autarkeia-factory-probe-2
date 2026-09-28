import { createServer } from 'node:http';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 8080);
const app = createApp();
const server = createServer(app.handler);
server.listen(port, '0.0.0.0', () => {
  console.log(`${app.identity.service} listening on ${port}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
