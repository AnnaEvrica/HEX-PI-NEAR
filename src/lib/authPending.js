// A sign-in or checkout redirect is "pending" for two minutes after it was
// started. The flags are timestamps written just before the redirect; an old
// flag (an abandoned sign-in) no longer counts, so it cannot hold a spinner.
const WINDOW_MS = 2 * 60 * 1000;

const fresh = (key) => {
  try {
    const at = Number(sessionStorage.getItem(key));
    return Number.isFinite(at) && at > 0 && Date.now() - at < WINDOW_MS;
  } catch {
    return false;
  }
};

export const redirectPending = () => {
  let checkout = false;
  try { checkout = new URLSearchParams(window.location.search).get('checkout') === 'success'; } catch { /* no window */ }
  return checkout || fresh('hex6_checkout_pending') || fresh('hex6_auth_pending');
};

export const markAuthPending = () => {
  try { sessionStorage.setItem('hex6_auth_pending', Date.now().toString()); } catch { /* storage unavailable */ }
};

export const clearPending = () => {
  try {
    sessionStorage.removeItem('hex6_checkout_pending');
    sessionStorage.removeItem('hex6_auth_pending');
    sessionStorage.removeItem('hex6_auth_retry_count');
  } catch { /* storage unavailable */ }
};
