// ===========================================================================
// DEPLOYMENT — which Base44 app this code is running in.
//
//   production   hex6-ble.com, what users see. The default: with nothing set,
//                the code behaves exactly as it did before this file existed.
//   test         the team's test app ("hex-pi copy"). Set the secret
//                HEX_ENV=test in that app's Base44 settings.
//
// What it changes:
//   - every CallLedger, EngineStatus, MomentMemory and NightlyCalibration row
//     records the deployment that wrote it, so test rows can never be mistaken
//     for production rows, even if the two apps ever share data;
//   - a test app posts nothing in public: no Discord messages, no replies on X.
// What it never changes: a probability, a call, the ledger's scoring, the
// version rule, the verified flag, or anything a user sees in production.
// ===========================================================================

export type Deployment = 'production' | 'test';

/** The deployment named by the HEX_ENV secret. Anything that is not a test name, including nothing at all, is production. */
export function deployment(): Deployment {
  let v = '';
  try { v = String((globalThis as any).Deno?.env?.get?.('HEX_ENV') ?? ''); } catch { /* no environment: production */ }
  return /^\s*(test|testing|staging|copy|dev|development)\s*$/i.test(v) ? 'test' : 'production';
}

/** True only in production: the one place public posts (Discord, X) may be sent from. */
export const postsAllowed = (): boolean => deployment() === 'production';
