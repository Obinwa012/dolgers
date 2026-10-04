import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';

export const SITE_URL = defineString('SITE_URL');
export const TYPESENSE_HOST = defineString('TYPESENSE_HOST', { default: '' });
export const ENFORCE_APP_CHECK = defineBoolean('ENFORCE_APP_CHECK', { default: true });
export const STRIPE_TAX_ENABLED = defineBoolean('STRIPE_TAX_ENABLED', { default: false });

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
export const TYPESENSE_ADMIN_KEY = defineSecret('TYPESENSE_ADMIN_KEY');
export const REVALIDATE_SECRET = defineSecret('REVALIDATE_SECRET');

export const REGION = 'us-central1';
