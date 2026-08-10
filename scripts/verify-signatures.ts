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
    // Uses pwsh (PowerShell 7) rather than powershell.exe (Windows
    // PowerShell 5.1): on some windows-latest GitHub Actions runners,
    // 5.1's Get-AuthenticodeSignature fails to autoload its own
    // Microsoft.PowerShell.Security module ("CouldNotAutoloadMatchingModule"),
    // while pwsh — already used elsewhere in this pipeline — loads it fine.
    execFileSync(
      'pwsh',
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
