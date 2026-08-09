import { spawn } from 'node:child_process'
import { watch } from 'node:fs'

let child
let timer
function start() {
  child = spawn(process.execPath, ['node_modules/electron/cli.js', '.'], {
    stdio: 'inherit',
    env: { ...process.env }
  })
}
function restart() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    child?.once('exit', start)
    child?.kill('SIGTERM')
  }, 250)
}
start()
watch('dist-electron/main.cjs', restart)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    child?.kill(signal)
    process.exit(0)
  })
