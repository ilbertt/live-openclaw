import { expect, test } from 'bun:test';

for (const name of ['test-responsive-merged.mjs', 'test-followup-retention.mjs'])
  test(`preserved OpenClaw regression: ${name}`, async () => {
    const child = Bun.spawn(
      ['bun', new URL(`../../patches/tests/${name}`, import.meta.url).pathname],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
    expect(stdout).toMatch(/pass/i);
  });
