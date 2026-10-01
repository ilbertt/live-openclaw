import { homedir } from 'node:os';
import { join } from 'node:path';
import { isObject } from '#protocol.ts';
export class OpenClawConfigRepository {
  constructor(
    private readonly path = process.env.OPENCLAW_CONFIG_PATH ||
      join(homedir(), '.openclaw', 'openclaw.json'),
  ) {}
  async gatewayToken(): Promise<string> {
    try {
      const config: unknown = await Bun.file(this.path).json();
      const gateway = isObject(config) && isObject(config.gateway) ? config.gateway : null;
      const auth = gateway && isObject(gateway.auth) ? gateway.auth : null;
      if (auth && typeof auth.token === 'string' && auth.token.trim()) return auth.token.trim();
    } catch {
      /* The CLI may resolve credentials outside the JSON config. */
    }
    const proc = Bun.spawn(['openclaw', 'gateway', 'auth-token', '--show'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0 || !stdout.trim())
      throw new Error(stderr.trim() || 'Could not load Gateway token');
    return stdout.trim();
  }
}
