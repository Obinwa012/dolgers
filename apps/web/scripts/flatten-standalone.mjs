// Firebase App Hosting's Next.js adapter looks for the standalone server at .next/standalone/,
// but in this npm-workspaces monorepo Next.js nests it at .next/standalone/apps/web/
// (because the output tracing root is the repo root). Move the app's files up one level so the
// adapter finds server.js, .next/ and node_modules/ where it expects them.
import { cpSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const standalone = join(process.cwd(), '.next', 'standalone');

function findServerDir(dir, depth = 0) {
  if (existsSync(join(dir, 'server.js'))) return dir;
  if (depth > 4) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.next') continue;
    const found = findServerDir(join(dir, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

if (!existsSync(standalone)) {
  console.log('[flatten-standalone] no standalone output, nothing to do');
  process.exit(0);
}

const nested = findServerDir(standalone);
if (!nested || nested === standalone) {
  console.log('[flatten-standalone] standalone output is already flat');
  process.exit(0);
}

const entries = readdirSync(nested);
for (const name of entries) {
  const from = join(nested, name);
  const to = join(standalone, name);
  if (name === 'node_modules' && existsSync(to)) {
    // Merge app-local deps into the hoisted ones; app-local versions win.
    cpSync(from, to, { recursive: true, force: true, verbatimSymlinks: true });
    rmSync(from, { recursive: true, force: true });
  } else {
    rmSync(to, { recursive: true, force: true });
    renameSync(from, to);
  }
}

const top = relative(standalone, nested).split(sep)[0];
if (top && !entries.includes(top)) rmSync(join(standalone, top), { recursive: true, force: true });

console.log(`[flatten-standalone] moved ${relative(standalone, nested)}/* to .next/standalone/`);
