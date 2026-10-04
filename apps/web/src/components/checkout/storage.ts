'use client';

// Small per-tab conveniences shared by the bag and checkout. Nothing here is trusted: the promo
// code is re-checked by the server on every quote and at checkout.
const PROMO_KEY = 'dolgers.promo';
const NOTICE_KEY = 'dolgers.bag.notice';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // storage blocked: the feature simply does not carry over
  }
}

export const savedPromo = {
  get: () => read(PROMO_KEY),
  set: (code: string | null) => write(PROMO_KEY, code),
};

/** A one-time message for the bag page, e.g. after checkout found an item sold out. */
export const bagNotice = {
  take: () => {
    const v = read(NOTICE_KEY);
    if (v) write(NOTICE_KEY, null);
    return v;
  },
  set: (message: string) => write(NOTICE_KEY, message),
};
