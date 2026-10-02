import { appendFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { $ } from 'bun';

if (process.env.BUILD_TARGET === 'host') {
  throw new Error('Releases require a Linux x64 build');
}

const now = new Date();
const prefix = `v${now.getUTCFullYear()}.${now.getUTCMonth() + 1}.${now.getUTCDate()}-`;
const tags = (await $`git tag --list`.text()).trim().split('\n');
const numbers = tags
  .filter((tag) => tag.startsWith(prefix))
  .map((tag) => Number(tag.slice(prefix.length)))
  .filter(Number.isSafeInteger);
const tag = `${prefix}${Math.max(0, ...numbers) + 1}`;

const dist = resolve(import.meta.dir, '../dist');
const binaryPath = resolve(dist, 'app');
const binary = Bun.file(binaryPath);
const header = new Uint8Array(await binary.slice(0, 20).arrayBuffer());
if (
  header[0] !== 0x7f ||
  header[1] !== 0x45 ||
  header[2] !== 0x4c ||
  header[3] !== 0x46 ||
  header[4] !== 2 ||
  header[5] !== 1 ||
  header[18] !== 62 ||
  header[19] !== 0
) {
  throw new Error('The release binary must be a Linux x64 ELF executable');
}
const asset = resolve(dist, 'live-openclaw-linux-x64');
await copyFile(binaryPath, asset);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\nasset=${asset}\n`);
}
console.log(tag);
console.log(asset);
