// Storage rules tests. Run with `npm run test:rules`.
import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dolgers',
    storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), 'public/products/p1/960.webp'), new Uint8Array([1]), { contentType: 'image/webp' });
  });
});

after(async () => {
  await env?.cleanup();
});

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const meta = { contentType: 'image/jpeg' };
const vendor = () => env.authenticatedContext('vera', { vendorId: 'nordhavn' }).storage();

describe('uploads', () => {
  test('a vendor can upload an image to its own folder', async () => {
    await assertSucceeds(uploadBytes(ref(vendor(), 'uploads/vendors/nordhavn/abcd1234.jpg'), jpeg, meta));
  });

  test('a vendor cannot upload to another vendor folder', async () => {
    await assertFails(uploadBytes(ref(vendor(), 'uploads/vendors/other/abcd1234.jpg'), jpeg, meta));
  });

  test('only images with safe names are accepted', async () => {
    await assertFails(uploadBytes(ref(vendor(), 'uploads/vendors/nordhavn/abcd1234.svg'), jpeg, { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(vendor(), 'uploads/vendors/nordhavn/x.jpg'), jpeg, meta));
    await assertFails(uploadBytes(ref(vendor(), 'uploads/vendors/nordhavn/abcd1234.jpg'), jpeg, { contentType: 'text/html' }));
  });

  test('shoppers cannot upload and nobody reads raw uploads', async () => {
    const shopper = env.authenticatedContext('alice').storage();
    await assertFails(uploadBytes(ref(shopper, 'uploads/vendors/nordhavn/abcd1234.jpg'), jpeg, meta));
    await assertFails(getBytes(ref(vendor(), 'uploads/vendors/nordhavn/abcd1234.jpg')));
  });

  test('only admins upload to the admin folder', async () => {
    const admin = env.authenticatedContext('root', { admin: true }).storage();
    await assertSucceeds(uploadBytes(ref(admin, 'uploads/admin/hero12345.jpg'), jpeg, meta));
    await assertFails(uploadBytes(ref(vendor(), 'uploads/admin/hero12345.jpg'), jpeg, meta));
  });
});

describe('public images', () => {
  test('anyone can read processed images but nobody writes them', async () => {
    const anon = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(anon, 'public/products/p1/960.webp')));
    await assertFails(uploadBytes(ref(vendor(), 'public/products/p1/960.webp'), jpeg, meta));
  });
});
