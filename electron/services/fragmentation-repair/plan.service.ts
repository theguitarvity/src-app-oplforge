import type {
  FragmentationDiagnostic,
  FragmentationRepairPlanInput,
  GameDiagnostic,
  PlanExclusion,
  RepairPlan,
  RepairPlanItem
} from '../../../src/types/opl'

export const MINIMUM_OPERATIONAL_MARGIN_BYTES = 64 * 1024 * 1024

export function operationalMarginBytes(candidateBytes: number): number {
  if (!Number.isSafeInteger(candidateBytes) || candidateBytes < 0)
    throw new TypeError('candidateBytes must be a non-negative safe integer')
  return Math.max(MINIMUM_OPERATIONAL_MARGIN_BYTES, Math.ceil(candidateBytes * 0.02))
}

interface ReadStore<T> {
  get(id: string): Promise<T | undefined>
}
interface WriteStore<T> {
  put(value: T): Promise<unknown>
}
interface PlanStores {
  diagnostics: ReadStore<FragmentationDiagnostic>
  plans: WriteStore<RepairPlan>
}
interface IdSource {
  create(): string
}
interface Clock {
  now(): Date
}

function planError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

function exclusion(game: GameDiagnostic, code: string, explanation: string): PlanExclusion {
  return { installation: game.identity, code, explanation }
}

function assess(
  game: GameDiagnostic,
  order: number,
  freeBytes: number
): RepairPlanItem | PlanExclusion {
  if (game.state !== 'fragmented' && game.state !== 'partially-fragmented') {
    return exclusion(game, 'INELIGIBLE_STATE', `Estado ${game.state} não permite correção.`)
  }
  const fragmentedFiles = game.files.filter(
    (file) => file.role !== 'ul-cfg' && file.extentState === 'fragmented'
  )
  const ulCfg = game.files.find((file) => file.role === 'ul-cfg')
  const requiresUlCfg =
    game.identity.format === 'USBExtreme' &&
    Boolean(ulCfg?.findings.some(({ code }) => code === 'UL_CFG_REWRITE_REQUIRED'))
  const filesToRewrite = requiresUlCfg && ulCfg ? [...fragmentedFiles, ulCfg] : fragmentedFiles
  if (filesToRewrite.length === 0)
    return exclusion(
      game,
      'NO_FRAGMENTED_FILES',
      'Nenhum arquivo possui fragmentação física comprovada.'
    )
  const fingerprintable = game.files.filter((file) => file.sizeBytes !== undefined)
  if (fingerprintable.some((file) => !file.sha256 || !file.modifiedAt)) {
    return exclusion(
      game,
      'SOURCE_FINGERPRINT_MISSING',
      'Fingerprint completo da origem não está disponível; execute novo diagnóstico.'
    )
  }
  if (filesToRewrite.some((file) => file.sizeBytes === undefined)) {
    return exclusion(
      game,
      'SOURCE_SIZE_MISSING',
      'Tamanho de arquivo candidato não está disponível; execute novo diagnóstico.'
    )
  }
  const candidateBytes = filesToRewrite.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0)
  const margin = operationalMarginBytes(candidateBytes)
  const temporaryBytes = candidateBytes + margin
  const risks = [
    'A nova alocação pode permanecer fragmentada e será rejeitada antes da promoção.',
    'Remoção do dispositivo durante a promoção pode exigir recuperação.'
  ]
  if (freeBytes < temporaryBytes)
    risks.unshift(
      `Espaço insuficiente: requer ${temporaryBytes} bytes e há ${freeBytes} bytes livres; a confirmação será bloqueada.`
    )
  return {
    installation: game.identity,
    sourceFingerprints: fingerprintable.map((file) => ({
      relativePath: file.relativePath,
      sizeBytes: file.sizeBytes!,
      modifiedAt: file.modifiedAt,
      sha256: file.sha256!
    })),
    filesToRewrite: filesToRewrite.map((file) => file.relativePath),
    ulCfgAction: requiresUlCfg ? 'replace' : 'none',
    ulCfgJustification: requiresUlCfg
      ? 'A correção do conjunto exige atualizar referências verificadas; ul.cfg será validado e promovido por último.'
      : undefined,
    candidateBytes,
    operationalMarginBytes: margin,
    temporaryBytes,
    risks,
    order
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export class FragmentationPlanService {
  constructor(
    private readonly stores: PlanStores,
    private readonly ids: IdSource,
    private readonly clock: Clock
  ) {}

  async create(input: FragmentationRepairPlanInput): Promise<RepairPlan> {
    const diagnostic = await this.stores.diagnostics.get(input.diagnosticId)
    if (!diagnostic) throw planError('DIAGNOSTIC_NOT_FOUND', 'Diagnóstico não encontrado.')
    if (diagnostic.revision !== input.expectedRevision || diagnostic.status !== 'complete')
      throw planError('STALE_REVISION', 'Diagnóstico não está completo ou sua revisão mudou.')
    if (!diagnostic.device.homologated || diagnostic.device.extentVerification !== 'supported')
      throw planError(
        'CAPABILITY_UNAVAILABLE',
        'O volume não possui verificação física homologada.'
      )
    if (input.mode === 'single' && input.installationIds?.length !== 1)
      throw planError('INVALID_SELECTION', 'Modo individual requer exatamente uma instalação.')
    if (
      input.installationIds &&
      new Set(input.installationIds).size !== input.installationIds.length
    )
      throw planError('INVALID_SELECTION', 'A seleção contém instalações duplicadas.')

    const byId = new Map(
      diagnostic.installations.map((game) => [game.identity.installationId, game])
    )
    const selectedIds =
      input.installationIds ?? diagnostic.installations.map((game) => game.identity.installationId)
    if (selectedIds.some((id) => !byId.has(id)))
      throw planError('INVALID_SELECTION', 'A seleção não pertence ao diagnóstico vigente.')
    const selected = selectedIds
      .map((id) => byId.get(id)!)
      .sort((left, right) =>
        left.identity.installationId.localeCompare(right.identity.installationId)
      )
    const items: RepairPlanItem[] = []
    const exclusions: PlanExclusion[] = []
    for (const game of selected) {
      const assessed = assess(game, items.length, diagnostic.device.freeBytes)
      if ('code' in assessed) exclusions.push(assessed)
      else items.push(assessed)
    }
    if (items.length === 0)
      throw planError(
        'NO_ELIGIBLE_GAMES',
        'Nenhuma instalação selecionada é elegível para correção.'
      )

    const plan: RepairPlan = {
      planId: this.ids.create(),
      revision: 0,
      diagnosticId: diagnostic.diagnosticId,
      diagnosticRevision: diagnostic.revision,
      deviceId: diagnostic.device.deviceId,
      mode: input.mode,
      status: 'awaiting-confirmation',
      items,
      exclusions,
      peakTemporaryBytes: items.reduce((peak, item) => Math.max(peak, item.temporaryBytes), 0),
      freeBytesObserved: diagnostic.device.freeBytes,
      confirmationText: 'CORRIGIR FRAGMENTAÇÃO',
      recoveryStrategy:
        'Criar e validar candidata no mesmo filesystem; manter a origem recuperável até commit e executar rollback seguro em falha.',
      createdAt: this.clock.now().toISOString()
    }
    await this.stores.plans.put(plan)
    return deepFreeze(plan)
  }
}
