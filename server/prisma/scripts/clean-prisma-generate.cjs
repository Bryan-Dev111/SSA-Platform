/**
 * Windows: `prisma generate` can fail with EBUSY if the query engine DLL is locked
 * (e.g. `npm run dev`, Prisma Studio, tests). Stop those first, then run:
 *   node prisma/scripts/clean-prisma-generate.cjs
 * from the server/ directory.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverRoot = path.join(__dirname, '..', '..');
const prismaEngineDir = path.join(serverRoot, 'node_modules', '.prisma');

try {
  fs.rmSync(prismaEngineDir, { recursive: true, force: true });
  console.log('Removed node_modules/.prisma');
} catch (e) {
  console.error(
    'Could not remove node_modules/.prisma (files may be locked).\n' +
      'Stop the API dev server, VS Code/Cursor Prisma extension tasks, and Prisma Studio, then retry.\n',
    e.message
  );
  process.exit(1);
}

execSync('npx prisma generate', { stdio: 'inherit', cwd: serverRoot, env: process.env, shell: true });
