// Hook "Stop" do Claude Code: quando o Claude termina uma resposta, roda o
// typecheck nas pastas que tiveram arquivo .ts/.tsx alterado. Se falhar,
// devolve o erro ao Claude (código 2) para ele corrigir antes de encerrar.
// Escrito em Node (não em bash) para funcionar igual no Windows.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {}
// Evita laço: se o Claude já está corrigindo por causa deste hook, não roda de novo.
if (input.stop_hook_active) process.exit(0)

const root = input.cwd || process.cwd()
let changed = []
try {
  changed = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
    .filter((f) => /\.(ts|tsx)$/.test(f))
} catch {
  process.exit(0)
}
if (changed.length === 0) process.exit(0)

const targets = []
if (changed.some((f) => f.startsWith('mobile/') || f.startsWith('src/domain/'))) targets.push('mobile')
if (changed.some((f) => !f.startsWith('mobile/'))) targets.push('.')

const errors = []
for (const dir of targets) {
  const cwd = join(root, dir)
  if (!existsSync(join(cwd, 'node_modules'))) continue
  try {
    execSync('npm run typecheck', { cwd, encoding: 'utf8', stdio: 'pipe', shell: true, timeout: 120000 })
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim().split(/\r?\n/).slice(-30).join('\n')
    errors.push(`Typecheck falhou em ${dir === '.' ? 'raiz' : dir}/:\n${out}`)
  }
}

if (errors.length) {
  process.stderr.write(errors.join('\n\n') + '\n')
  process.exit(2)
}
