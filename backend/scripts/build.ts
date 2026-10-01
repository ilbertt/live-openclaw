import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const frontend = resolve(root, '../miniapp/dist');
const assets = resolve(root, 'src/public');
await rm(assets, { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });
const embedded: string[] = [];
if (existsSync(frontend) && existsSync(resolve(root, '../miniapp/package.json'))) {
  await cp(frontend, assets, { recursive: true });
  embedded.push(assets);
}
const result = await Bun.build({
  entrypoints: [resolve(root, 'src/main.ts')],
  target: 'bun',
  compile: {
    outfile: resolve(root, 'dist/app'),
    ...(process.env.BUILD_TARGET === 'host' ? {} : { target: 'bun-linux-x64' as const }),
    assets: embedded,
  },
  minify: true,
});
if (!result.success) {
  console.error(result.logs);
  process.exit(1);
}
console.log(`Built ${root}/dist/app`);
