import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const tests = [
  'src/engine/pon.test.ts',
  'src/engine/riichi.test.ts',
  'src/engine/regression.test.ts',
  'src/engine/release.test.ts',
  'src/utils/stats.test.ts',
  'src/engine/connections.test.ts',
]

const outdir = await mkdtemp(join(tmpdir(), 'emoji-mahjong-tests-'))

try {
  for (const test of tests) {
    const outfile = join(outdir, `${basename(test, '.ts')}.mjs`)
    await build({
      entryPoints: [test],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      outfile,
      logLevel: 'silent',
    })

    const result = spawnSync(process.execPath, [outfile], {
      stdio: 'inherit',
      env: process.env,
    })

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1
      break
    }
  }
} finally {
  await rm(outdir, { recursive: true, force: true })
}
