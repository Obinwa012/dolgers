// Shared helpers for sign-in, registration and account pages.

export const MIN_PASSWORD = 8;

/** Only same-site relative paths are allowed as a post-sign-in destination. */
export function safeNext(raw: string | string[] | undefined | null, fallback = '/account'): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(value) || value.length > 500) return fallback;
  return value;
}

export function withNext(path: string, next: string): string {
  return next && next !== '/account' ? `${path}?next=${encodeURIComponent(next)}` : path;
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password do not match an account.',
  'auth/wrong-password': 'That email and password do not match an account.',
  'auth/user-not-found': 'That email and password do not match an account.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/email-already-in-use': 'An account already uses this email. Sign in instead, or reset your password.',
  'auth/credential-already-in-use': 'An account already uses this email. Sign in instead, or reset your password.',
  'auth/weak-password': `Choose a longer password: at least ${MIN_PASSWORD} characters.`,
  'auth/password-does-not-meet-requirements': `Choose a stronger password: at least ${MIN_PASSWORD} characters, mixing letters and numbers.`,
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'We could not reach the server. Check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/user-disabled': 'This account has been disabled. Contact us if you think this is a mistake.',
  'auth/operation-not-allowed': 'This way of signing in is not available right now.',
  'auth/account-exists-with-different-credential': 'This email is registered with a password. Sign in with your email and password instead.',
  'auth/requires-recent-login': 'For your security, please sign in again and retry.',
  'auth/provider-already-linked': 'This guest session is already linked to an account.',
};

/** Turns a Firebase Auth error into a friendly sentence. Returns null for "user closed the popup". */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (MESSAGES[code]) return MESSAGES[code];
  const msg = (err as { message?: string } | null)?.message;
  if (msg && !msg.startsWith('Firebase')) return msg;
  return 'Something went wrong. Please try again.';
}
