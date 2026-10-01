import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BunFile } from 'bun';
export class AssetsRepository {
  constructor(private readonly folder = resolve(import.meta.dir, '../public')) {}
  list(): Map<string, Blob> {
    const assets = new Map<string, Blob>();
    if (Bun.isStandaloneExecutable) {
      for (const file of Bun.embeddedFiles as readonly BunFile[]) {
        if (file.name?.startsWith('public/')) assets.set(`/${file.name.slice(7)}`, file);
      }
    } else if (existsSync(this.folder)) {
      for (const path of new Bun.Glob('**/*').scanSync({ cwd: this.folder, onlyFiles: true }))
        assets.set(`/${path}`, Bun.file(resolve(this.folder, path)));
    }
    return assets;
  }
}
