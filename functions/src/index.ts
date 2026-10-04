// DOLGERS Cloud Functions: the only code that writes orders, stock, money and roles.
import { setGlobalOptions } from 'firebase-functions/options';

setGlobalOptions({ region: 'us-central1', maxInstances: 20 });

export { createCheckout } from './checkout.ts';
export { stripeWebhook } from './webhook.ts';
export { vendorApi } from './vendor.ts';
export { adminApi } from './admin.ts';
export { accountApi } from './account.ts';
export { onProductWritten, onInventoryWritten, onVendorWritten, onFollowWritten, onImageUploaded } from './triggers.ts';
export { releaseExpiredReservations } from './scheduled.ts';
