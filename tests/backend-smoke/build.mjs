import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fns = ['think','discordMorningSignal','xEngagement','walkForwardAccuracy','calibrateCognition','landingComparison','stripeWebhook','stripeCheckout','contactInquiry','spineAlert','asiSpine'];
for (const fn of fns) {
  await build({
    entryPoints: [path.join(root, 'base44/functions', fn, 'entry.ts')],
    bundle: true, format: 'esm', platform: 'node', outfile: path.join(here, 'out', `${fn}.mjs`), logLevel: 'error',
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: path.join(here, 'sdk-stub.mjs') }));
      b.onResolve({ filter: /^base44:runtime$/ }, () => ({ path: path.join(here, 'runtime-stub.mjs') }));
    } }],
  });
}
