const major = Number(process.versions.node.split('.')[0])

if (major !== 22) {
  console.error(`\nOPL Forge requer Node.js 22 LTS. Versao atual: ${process.version}`)
  console.error('Execute:')
  console.error('  nvm install')
  console.error('  nvm use\n')
  process.exit(1)
}
