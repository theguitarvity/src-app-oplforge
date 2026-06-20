import { createReadStream, createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppInstallInput, GameImportInput, Ps1ImportInput } from '../../src/types/opl'
import { addHistory, recordFailure } from './history.service'
import { OPL_DIRS } from './device.service'
import { sendLog, sendProgress } from './logger'

const README = `# OPL Forge\n\nEstrutura preparada para uso com Open PS2 Loader, homebrews e arquivos fornecidos pelo usuario.\n\nAviso legal: Utilize apenas backups de jogos que voce possua legalmente ou arquivos distribuidos por seus respectivos autores.\n\nPastas criadas:\n- DVD: jogos PS2 em DVD\n- CD: jogos PS2 em CD\n- PS1: jogos PS1\n- APPS: homebrews e aplicativos\n- ART: capas e imagens\n- CFG: configuracoes\n- VMC: memory cards virtuais\n`

const sanitizeSegment = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove caracteres proibidos em nomes de arquivo no Windows e controles ASCII.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

async function ensureInsideDevice(devicePath: string, destination: string) {
  const resolvedDevice = path.resolve(devicePath)
  const resolvedDestination = path.resolve(destination)
  if (!resolvedDestination.startsWith(resolvedDevice)) {
    throw new Error('Destino fora do dispositivo selecionado.')
  }
}

async function assertReadableFile(sourcePath: string) {
  const stat = await fs.stat(sourcePath)
  if (!stat.isFile()) throw new Error(`Arquivo invalido: ${sourcePath}`)
  return stat
}

async function copyFileWithProgress(source: string, destination: string, label: string) {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const stat = await assertReadableFile(source)

  return new Promise<void>((resolve, reject) => {
    let copied = 0
    const read = createReadStream(source)
    const write = createWriteStream(destination)

    read.on('data', (chunk) => {
      copied += chunk.length
      sendProgress({ label, value: Math.round((copied / stat.size) * 100), detail: path.basename(source) })
    })
    read.on('error', reject)
    write.on('error', reject)
    write.on('finish', resolve)
    read.pipe(write)
  })
}

async function ensureSpace(devicePath: string, sources: string[]) {
  const [deviceStats, sourceStats] = await Promise.all([
    fs.statfs(devicePath),
    Promise.all(sources.map((source) => assertReadableFile(source)))
  ])
  const free = Number(deviceStats.bavail) * Number(deviceStats.bsize)
  const required = sourceStats.reduce((total, stat) => total + stat.size, 0)
  if (required > free) {
    throw new Error('Espaco insuficiente no dispositivo selecionado.')
  }
}

export async function prepareDevice(devicePath: string) {
  try {
    await fs.access(devicePath)
    for (const dir of OPL_DIRS) {
      await fs.mkdir(path.join(devicePath, dir), { recursive: true })
    }
    await fs.writeFile(path.join(devicePath, 'README_OPL_FORGE.txt'), README, 'utf-8')
    sendLog('SUCCESS', 'Estrutura OPL criada com sucesso.')
    return addHistory({
      operation: 'Preparar dispositivo',
      destination: devicePath,
      result: 'success',
      message: 'Estrutura OPL criada.'
    })
  } catch (error) {
    sendLog('ERROR', error instanceof Error ? error.message : 'Falha ao preparar dispositivo.')
    return recordFailure('Preparar dispositivo', error, undefined, devicePath)
  }
}

export async function copyGame(input: GameImportInput) {
  const destinationDir = path.join(input.devicePath, input.mediaType)
  const entries = []

  try {
    await ensureSpace(input.devicePath, input.sourcePaths)
    for (const source of input.sourcePaths) {
      const ext = path.extname(source).toLowerCase()
      if (ext !== '.iso') throw new Error('O importador PS2 aceita apenas arquivos .iso.')
      const baseName = sanitizeSegment(input.name || path.basename(source, ext))
      const code = input.code ? `${sanitizeSegment(input.code)}.` : ''
      const region = input.region ? `.${sanitizeSegment(input.region)}` : ''
      const destination = path.join(destinationDir, `${code}${baseName}${region}${ext}`)
      await ensureInsideDevice(input.devicePath, destination)
      await copyFileWithProgress(source, destination, 'Importando jogo PS2')
      entries.push(
        await addHistory({
          operation: 'Importar jogo PS2',
          origin: source,
          destination,
          result: 'success',
          message: `${input.mediaType} importado.`
        })
      )
      sendLog('SUCCESS', `Jogo PS2 importado: ${path.basename(destination)}`)
    }
    return entries
  } catch (error) {
    const entry = await recordFailure('Importar jogo PS2', error, input.sourcePaths.join(', '), destinationDir)
    sendLog('ERROR', entry.message ?? 'Falha ao importar jogo PS2.')
    return [entry]
  }
}

export async function copyPs1Game(input: Ps1ImportInput) {
  const destinationDir = path.join(input.devicePath, 'PS1')
  const entries = []

  try {
    await ensureSpace(input.devicePath, input.sourcePaths)
    const allowed = ['.bin', '.cue', '.iso']
    for (const source of input.sourcePaths) {
      const ext = path.extname(source).toLowerCase()
      if (!allowed.includes(ext)) throw new Error('O importador PS1 aceita .bin, .cue e .iso.')
      const sourceBase = path.basename(source, ext)
      const name = sanitizeSegment(input.name || sourceBase)
      const destination = path.join(destinationDir, `${name}${ext}`)
      await ensureInsideDevice(input.devicePath, destination)
      await copyFileWithProgress(source, destination, 'Importando jogo PS1')
      entries.push(
        await addHistory({
          operation: 'Importar jogo PS1',
          origin: source,
          destination,
          result: 'success',
          message: 'Arquivo PS1 importado mantendo conjunto BIN/CUE quando selecionado.'
        })
      )
      sendLog('SUCCESS', `Arquivo PS1 importado: ${path.basename(destination)}`)
    }
    return entries
  } catch (error) {
    const entry = await recordFailure('Importar jogo PS1', error, input.sourcePaths.join(', '), destinationDir)
    sendLog('ERROR', entry.message ?? 'Falha ao importar jogo PS1.')
    return [entry]
  }
}

export async function installApp(input: AppInstallInput) {
  const appName = sanitizeSegment(input.appName)
  const destination = path.join(input.devicePath, 'APPS', appName, path.basename(input.sourcePath))

  try {
    await ensureSpace(input.devicePath, [input.sourcePath])
    await ensureInsideDevice(input.devicePath, destination)
    await copyFileWithProgress(input.sourcePath, destination, 'Instalando app')
    sendLog('SUCCESS', `App instalado: ${appName}`)
    return addHistory({
      operation: 'Instalar app',
      origin: input.sourcePath,
      destination,
      result: 'success',
      message: `${appName} instalado.`
    })
  } catch (error) {
    sendLog('ERROR', error instanceof Error ? error.message : 'Falha ao instalar app.')
    return recordFailure('Instalar app', error, input.sourcePath, destination)
  }
}

export async function removeApp(devicePath: string, appName: string) {
  const destination = path.join(devicePath, 'APPS', sanitizeSegment(appName))
  try {
    await ensureInsideDevice(devicePath, destination)
    await fs.rm(destination, { recursive: true, force: true })
    sendLog('WARNING', `App removido: ${appName}`)
    return addHistory({
      operation: 'Remover app',
      destination,
      result: 'success',
      message: `${appName} removido.`
    })
  } catch (error) {
    return recordFailure('Remover app', error, undefined, destination)
  }
}
