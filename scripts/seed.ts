// Seeds Firestore with the demo catalog using the Admin SDK (bypasses security rules).
// Usage: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run seed
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { brands, categories, posts, products } from "../src/data/catalog.ts";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your service-account JSON path.");
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

async function write(name: string, rows: { [k: string]: unknown }[], key: string) {
  const batch = db.batch();
  for (const row of rows) batch.set(db.collection(name).doc(String(row[key])), row);
  await batch.commit();
  console.log(`✓ ${name}: ${rows.length}`);
}

await write("products", products as never, "slug");
await write("categories", categories as never, "slug");
await write("brands", brands as never, "slug");
await write("posts", posts as never, "slug");
console.log("Done.");
