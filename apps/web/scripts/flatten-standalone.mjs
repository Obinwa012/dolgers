// Firebase App Hosting's Next.js adapter looks for the standalone server at .next/standalone/,
// but in this npm-workspaces monorepo Next.js nests it at .next/standalone/apps/web/
// (because the output tracing root is the repo root). Move the app's files up one level so the
// adapter finds server.js, .next/ and node_modules/ where it expects them, then repoint any
// relative symlinks (Turbopack links external packages from .next/node_modules) that moved.
import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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

// Rewrite a relative symlink that moved from its old location (under nested) to newPath.
function fixLink(newPath) {
  const target = readlinkSync(newPath);
  if (isAbsolute(target)) return;
  const oldPath = join(nested, relative(standalone, newPath));
  let dest = resolve(dirname(oldPath), target);
  if (dest === nested || dest.startsWith(nested + sep)) dest = join(standalone, relative(nested, dest));
  const newTarget = relative(dirname(newPath), dest);
  if (newTarget === target) return;
  unlinkSync(newPath);
  symlinkSync(newTarget, newPath);
}

// Walk moved files and fix symlinks. Inside node_modules only look at packages and @scopes.
function walk(dir, inNodeModules = 0) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isSymbolicLink()) fixLink(p);
    else if (entry.isDirectory()) {
      if (entry.name === 'node_modules') walk(p, 1);
      else if (inNodeModules === 0) walk(p, 0);
      else if (inNodeModules === 1 && entry.name.startsWith('@')) walk(p, 2);
    }
  }
}

const entries = readdirSync(nested);
const moved = [];
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
    moved.push(to);
  }
}

for (const p of moved) {
  const st = lstatSync(p);
  if (st.isSymbolicLink()) fixLink(p);
  else if (st.isDirectory()) walk(p, p.endsWith(sep + 'node_modules') ? 1 : 0);
}

const top = relative(standalone, nested).split(sep)[0];
if (top && !entries.includes(top)) rmSync(join(standalone, top), { recursive: true, force: true });

console.log(`[flatten-standalone] moved ${relative(standalone, nested)}/* to .next/standalone/`);
