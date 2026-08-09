import { execFileSync } from 'node:child_process'
const mode = process.argv[2] || 'smoke'
const files = process.argv.slice(3)
if (mode === 'smoke') {
  console.log('Unsigned smoke package accepted; it cannot be published.')
  process.exit(0)
}
if (!files.length) throw new Error('No public artifacts supplied')
for (const file of files) {
  if (process.platform === 'win32')
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(Get-AuthenticodeSignature -LiteralPath '${file.replaceAll("'", "''")}').Status -eq 'Valid' | ConvertTo-Json`
      ],
      { stdio: 'inherit' }
    )
  else if (file.endsWith('.dmg'))
    execFileSync(
      'spctl',
      ['--assess', '--type', 'open', '--context', 'context:primary-signature', file],
      { stdio: 'inherit' }
    )
  else throw new Error(`Public signature verification for ${file} requires its native runner`)
}
