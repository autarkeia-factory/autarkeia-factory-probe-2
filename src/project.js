import { readFileSync } from 'node:fs';

/**
 * AUTARKEIA project identity, written once by the project factory. The service name is what the
 * trusted verifier expects at /_zero/health; it is server-side configuration, not request input.
 */
export const PROJECT = Object.freeze(
  JSON.parse(readFileSync(new URL('../autarkeia.project.json', import.meta.url), 'utf8')),
);
