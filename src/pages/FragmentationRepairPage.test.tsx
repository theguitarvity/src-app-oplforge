// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FragmentationRepairPage } from './FragmentationRepairPage'
import { RepairProgress } from '@/components/fragmentation-repair'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type {
  DiagnosticState,
  FragmentationDiagnostic,
  FragmentationDiagnosisActivity,
  RepairEvent,
  RepairOperation,
  RepairPlan,
  RepairReport
} from '@/types/opl'

const states: DiagnosticState[] = [
  'contiguous',
  'fragmented',
  'partially-fragmented',
  'incomplete',
  'invalid',
  'unverifiable'
]

function diagnostic(): FragmentationDiagnostic {
  return {
    diagnosticId: 'diagnostic-1',
    revision: 1,
    status: 'complete',
    startedAt: '2026-08-02T12:00:00.000Z',
    completedAt: '2026-08-02T12:00:01.000Z',
    device: {
      deviceId: 'device-1',
      mountPath: '/media/opl',
      realPath: '/media/opl',
      fileSystem: 'exFAT',
      totalBytes: 32 * 1024 ** 3,
      freeBytes: 8 * 1024 ** 3,
      extentVerification: 'supported',
      method: 'filefrag -v',
      homologated: true,
      limitations: [],
      observedAt: '2026-08-02T12:00:00.000Z'
    },
    installations: states.map((state, index) => ({
      identity: {
        installationId: `game-${index}`,
        deviceId: 'device-1',
        format: index === 2 ? 'USBExtreme' : 'ISO',
        relativePaths: [`DVD/GAME_${index}.iso`],
        gameId: `SLUS_000.0${index}`,
        title: `Jogo ${state}`,
        media: 'DVD'
      },
      state,
      totalBytes: 1024 ** 3,
      temporaryBytes: state === 'fragmented' ? 1024 ** 3 : 0,
      findings: [
        {
          code: `STATE_${index}`,
          severity: state === 'invalid' ? 'error' : 'info',
          state: 'verified',
          message: `Motivo ${state}`
        }
      ],
      files: [
        {
          relativePath: `DVD/GAME_${index}.iso`,
          role: 'game',
          sizeBytes: 1024 ** 3,
          structuralState: state === 'invalid' ? 'invalid' : 'valid',
          extentState:
            state === 'unverifiable'
              ? 'unverifiable'
              : state === 'fragmented'
                ? 'fragmented'
                : 'contiguous',
          extentCount: state === 'fragmented' ? 3 : 1,
          verificationMethod: 'filefrag -v',
          findings: []
        }
      ]
    })),
    summary: {
      total: 6,
      byState: Object.fromEntries(states.map((state) => [state, 1])) as Record<
        DiagnosticState,
        number
      >,
      eligibleGames: 2,
      affectedFiles: 2,
      freeBytes: 8 * 1024 ** 3,
      peakTemporaryBytes: 2 * 1024 ** 3
    }
  }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return render(
    <QueryClientProvider client={client}>
      <FragmentationRepairPage />
    </QueryClientProvider>
  )
}

const plan: RepairPlan = {
  planId: 'plan-1',
  revision: 3,
  diagnosticId: 'diagnostic-1',
  diagnosticRevision: 1,
  deviceId: 'device-1',
  mode: 'single',
  status: 'awaiting-confirmation',
  items: [
    {
      installation: diagnostic().installations[1].identity,
      sourceFingerprints: [],
      filesToRewrite: ['DVD/GAME_1.iso'],
      ulCfgAction: 'none',
      candidateBytes: 1024 ** 3,
      operationalMarginBytes: 64 * 1024 ** 2,
      temporaryBytes: 1088 * 1024 ** 2,
      risks: ['Dispositivo removido durante a cópia'],
      order: 1
    }
  ],
  exclusions: [],
  peakTemporaryBytes: 1088 * 1024 ** 2,
  freeBytesObserved: 8 * 1024 ** 3,
  confirmationText: 'CORRIGIR FRAGMENTAÇÃO',
  recoveryStrategy: 'A versão original permanece ativa até a promoção validada.',
  createdAt: '2026-08-02T12:01:00.000Z'
}

const operation: RepairOperation = {
  operationId: 'operation-1',
  planId: 'plan-1',
  expectedDeviceRevision: 1,
  status: 'running',
  items: [],
  lastSequence: 0,
  startedAt: '2026-08-02T12:02:00.000Z'
}

const report: RepairReport = {
  reportId: 'report-1',
  operationId: 'operation-1',
  planId: 'plan-1',
  diagnosticId: 'diagnostic-1',
  device: {
    deviceId: 'device-1',
    fileSystem: 'exFAT',
    totalBytes: 32 * 1024 ** 3,
    freeBytes: 8 * 1024 ** 3,
    extentVerification: 'supported',
    method: 'filefrag -v',
    homologated: true,
    limitations: [],
    observedAt: '2026-08-02T12:03:00.000Z'
  },
  result: 'completed',
  counts: {
    corrected: 1,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
    'recovery-pending': 0
  },
  games: [
    {
      installation: diagnostic().installations[1].identity,
      previousState: 'fragmented',
      finalState: 'contiguous',
      outcome: 'corrected',
      sourceFingerprints: [],
      candidateFingerprints: [],
      finalFingerprints: [],
      modifiedFiles: ['DVD/GAME_1.iso'],
      failures: [],
      rollbackDecisions: [],
      recoveryInstructions: []
    }
  ],
  startedAt: operation.startedAt,
  completedAt: '2026-08-02T12:03:00.000Z',
  limitations: []
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useDeviceStore.setState({ activeDevice: null, selectionRevision: 0 })
})

describe('FragmentationRepairPage', () => {
  it('requires an explicit device selection and shows diagnosis progress', async () => {
    const pending = new Promise<FragmentationDiagnostic>(() => undefined)
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockReturnValue(pending)
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Diagnóstico de fragmentação' })
    ).toBeInTheDocument()
    const start = await screen.findByRole('button', { name: 'Iniciar diagnóstico' })
    expect(start).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Dispositivo'), 'device-1')
    expect(start).toBeEnabled()
    await userEvent.click(start)
    expect(screen.getByRole('status')).toHaveTextContent('Diagnosticando')
  })

  it('recovers visible diagnosis progress after leaving and returning to the page', async () => {
    const device = {
      id: 'device-1',
      name: 'HD OPL',
      path: '/media/opl',
      total: 1,
      free: 1,
      used: 0,
      fileSystem: 'exFAT',
      status: 'ready' as const
    }
    const activity: { current?: FragmentationDiagnosisActivity } = {}
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([device])
    vi.spyOn(oplApi, 'getCurrentFragmentationDiagnosis').mockImplementation(
      async () => activity.current
    )
    const pending = new Promise<FragmentationDiagnostic>(() => undefined)
    const startDiagnosis = vi.spyOn(oplApi, 'diagnoseFragmentation').mockReturnValue(pending)
    const cancelDiagnosis = vi.spyOn(oplApi, 'cancelFragmentationDiagnosis').mockResolvedValue()

    const firstView = renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), device.id)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    activity.current = {
      diagnosticId: 'diagnostic-running',
      devicePath: device.path,
      deviceId: device.id,
      status: 'running',
      processedItems: 7,
      totalItems: 20,
      progress: 0.35,
      currentItem: 'DVD/SLUS_123.45.iso',
      message: 'Analisado 7 de 20',
      startedAt: '2026-08-02T12:00:00.000Z'
    }

    expect(
      await screen.findByText('7 de 20 jogos analisados', {}, { timeout: 2_000 })
    ).toBeInTheDocument()
    expect(screen.getByText('Arquivo atual: DVD/SLUS_123.45.iso')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresso do diagnóstico' })).toHaveAttribute(
      'aria-valuenow',
      '35'
    )
    firstView.unmount()

    renderPage()
    expect(await screen.findByText('7 de 20 jogos analisados')).toBeInTheDocument()
    expect(screen.getByText(/continuará em segundo plano/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar diagnóstico' })).toBeDisabled()
    expect(startDiagnosis).toHaveBeenCalledTimes(1)
    expect(cancelDiagnosis).not.toHaveBeenCalled()
  })

  it('loads a diagnosis that completed while the user was on another page', async () => {
    const completed = diagnostic()
    const device = {
      id: 'device-1',
      name: 'HD OPL',
      path: '/media/opl',
      total: 1,
      free: 1,
      used: 0,
      fileSystem: 'exFAT',
      status: 'ready' as const
    }
    useDeviceStore.setState({ activeDevice: device, selectionRevision: 1 })
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([device])
    vi.spyOn(oplApi, 'getCurrentFragmentationDiagnosis').mockResolvedValue({
      diagnosticId: completed.diagnosticId,
      devicePath: device.path,
      deviceId: device.id,
      status: 'complete',
      processedItems: completed.summary.total,
      totalItems: completed.summary.total,
      progress: 1,
      message: 'Diagnóstico concluído',
      startedAt: completed.startedAt,
      completedAt: completed.completedAt,
      diagnostic: completed
    })
    const startDiagnosis = vi.spyOn(oplApi, 'diagnoseFragmentation')

    renderPage()

    expect(await screen.findByRole('region', { name: 'Resumo do diagnóstico' })).toBeInTheDocument()
    expect(screen.getByText('Jogo fragmented')).toBeInTheDocument()
    expect(startDiagnosis).not.toHaveBeenCalled()
  })

  it('renders empty results and actionable failures', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockRejectedValue(
      new Error('Ferramenta sem permissão')
    )
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ferramenta sem permissão')
  })

  it('shows all six states, filters with the keyboard and reveals file evidence', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(diagnostic())
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))

    const summary = await screen.findByRole('region', { name: 'Resumo do diagnóstico' })
    for (const state of states) expect(within(summary).getByText(state)).toBeInTheDocument()
    expect(within(summary).getByText('8.0 GB')).toBeInTheDocument()
    expect(within(summary).getByText('2.0 GB')).toBeInTheDocument()

    const filter = screen.getByLabelText('Filtrar por estado')
    filter.focus()
    await userEvent.selectOptions(filter, 'fragmented')
    expect(screen.getByText('Jogo fragmented')).toBeInTheDocument()
    expect(screen.queryByText('Jogo contiguous')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ver arquivos de Jogo fragmented' }))
    expect(screen.getByText('DVD/GAME_1.iso')).toBeInTheDocument()
    expect(screen.getByText(/3 extents/)).toBeInTheDocument()
  })

  it('requires the literal confirmation after presenting files, risk, space and recovery', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(diagnostic())
    const planSpy = vi.spyOn(oplApi, 'planFragmentationRepair').mockResolvedValue(plan)
    const confirmSpy = vi.spyOn(oplApi, 'confirmFragmentationRepair').mockResolvedValue(operation)
    vi.spyOn(oplApi, 'onFragmentationRepairEvent').mockReturnValue(() => undefined)
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir Jogo fragmented' }))

    expect(planSpy).toHaveBeenCalledWith({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 1,
      mode: 'single',
      installationIds: ['game-1']
    })
    const dialog = await screen.findByRole('dialog', { name: 'Plano de correção' })
    expect(within(dialog).getByText('DVD/GAME_1.iso')).toBeInTheDocument()
    expect(within(dialog).getByText(/Dispositivo removido/)).toBeInTheDocument()
    expect(within(dialog).getByText(/versão original permanece ativa/)).toBeInTheDocument()
    const confirmation = within(dialog).getByLabelText(
      'Digite CORRIGIR FRAGMENTAÇÃO para confirmar'
    )
    expect(confirmation).toHaveFocus()
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar correção' })
    expect(confirm).toBeDisabled()
    await userEvent.type(confirmation, 'CORRIGIR FRAGMENTAÇÃO')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(confirmSpy).toHaveBeenCalledWith({
      planId: 'plan-1',
      expectedRevision: 3,
      confirmation: 'CORRIGIR FRAGMENTAÇÃO'
    })
    expect(await screen.findByRole('region', { name: 'Progresso da correção' })).toBeInTheDocument()
  })

  it('orders progress events and displays the terminal report', async () => {
    let listener: ((event: RepairEvent) => void) | undefined
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(diagnostic())
    vi.spyOn(oplApi, 'planFragmentationRepair').mockResolvedValue(plan)
    vi.spyOn(oplApi, 'confirmFragmentationRepair').mockResolvedValue(operation)
    vi.spyOn(oplApi, 'onFragmentationRepairEvent').mockImplementation((callback) => {
      listener = callback
      return () => undefined
    })
    vi.spyOn(oplApi, 'getFragmentationRepairReportByOperation').mockResolvedValue(report)
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir Jogo fragmented' }))
    await userEvent.type(
      await screen.findByLabelText('Digite CORRIGIR FRAGMENTAÇÃO para confirmar'),
      'CORRIGIR FRAGMENTAÇÃO'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar correção' }))
    const event = (
      sequence: number,
      message: string,
      phase: RepairEvent['phase']
    ): RepairEvent => ({
      operationId: 'operation-1',
      sequence,
      installationId: 'game-1',
      phase,
      progress: sequence * 10,
      message,
      timestamp: `2026-08-02T12:02:0${sequence}.000Z`
    })
    listener?.(event(2, 'Candidata validada', 'candidate-verified'))
    listener?.(event(1, 'Copiando candidata', 'staging'))
    listener?.(event(3, 'Correção concluída', 'cleanup-complete'))
    expect(await screen.findByText('Copiando candidata')).toBeInTheDocument()
    expect(screen.getByText('Candidata validada')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Relatório da correção' })).toHaveTextContent(
      'corrected'
    )
  })

  it('offers a new diagnosis when the plan becomes stale', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(diagnostic())
    vi.spyOn(oplApi, 'planFragmentationRepair').mockRejectedValue(
      Object.assign(new Error('A origem mudou'), { code: 'STALE_PLAN' })
    )
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Corrigir Jogo fragmented' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('A origem mudou')
    expect(screen.getByRole('button', { name: 'Diagnosticar novamente' })).toBeInTheDocument()
  })

  it('shows recovery instructions and requires literal confirmation for authorized actions', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'listFragmentationRecovery').mockResolvedValue([
      {
        journalId: 'journal-1',
        operationId: 'operation-old',
        installationId: 'game-1',
        deviceId: 'device-1',
        state: 'recovery-pending',
        instructions: [
          'Reconecte o mesmo dispositivo.',
          'Restaure a versão original antes de corrigir novamente.'
        ],
        updatedAt: '2026-08-02T12:00:00.000Z',
        revision: 4
      }
    ])
    const resolve = vi.spyOn(oplApi, 'resolveFragmentationRecovery').mockResolvedValue({
      journalId: 'journal-1',
      operationId: 'operation-old',
      installationId: 'game-1',
      deviceId: 'device-1',
      revision: 5,
      state: 'restored',
      instructions: [],
      updatedAt: '2026-08-02T12:01:00.000Z'
    })
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    const banner = await screen.findByRole('region', { name: 'Recuperação pendente' })
    expect(within(banner).getByText('Reconecte o mesmo dispositivo.')).toBeInTheDocument()
    expect(oplApi.listFragmentationRecovery).toHaveBeenCalledWith('device-1')
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar original' }))
    const confirmation = screen.getByLabelText('Digite RECUPERAR JOGO para confirmar')
    expect(confirmation).toHaveFocus()
    const authorize = screen.getByRole('button', { name: 'Autorizar recuperação' })
    expect(authorize).toBeDisabled()
    await userEvent.type(confirmation, 'RECUPERAR JOGO')
    await userEvent.click(authorize)
    expect(resolve).toHaveBeenCalledWith({
      journalId: 'journal-1',
      expectedRevision: 4,
      action: 'restore-original',
      confirmation: 'RECUPERAR JOGO'
    })
  })

  it('authorizes cleanup only through the verified-residue action', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'listFragmentationRecovery').mockResolvedValue([
      {
        journalId: 'journal-1',
        operationId: 'operation-old',
        installationId: 'game-1',
        deviceId: 'device-1',
        revision: 7,
        state: 'cleanup-pending',
        instructions: ['A versão original já foi restaurada.'],
        updatedAt: '2026-08-02T12:00:00.000Z'
      }
    ])
    const resolve = vi.spyOn(oplApi, 'resolveFragmentationRecovery').mockResolvedValue({
      journalId: 'journal-1',
      operationId: 'operation-old',
      installationId: 'game-1',
      deviceId: 'device-1',
      revision: 8,
      state: 'restored',
      instructions: [],
      updatedAt: '2026-08-02T12:01:00.000Z'
    })
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    const banner = await screen.findByRole('region', { name: 'Recuperação pendente' })
    await userEvent.click(within(banner).getByRole('button', { name: 'Limpar resíduo verificado' }))
    await userEvent.type(
      screen.getByLabelText('Digite RECUPERAR JOGO para confirmar'),
      'RECUPERAR JOGO'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar recuperação' }))
    expect(resolve).toHaveBeenCalledWith({
      journalId: 'journal-1',
      expectedRevision: 7,
      action: 'clean-verified-residue',
      confirmation: 'RECUPERAR JOGO'
    })
  })

  it('creates a consolidated batch plan with selection, order, exclusions and per-item outcomes', async () => {
    const batchPlan: RepairPlan = {
      ...plan,
      planId: 'batch-plan',
      mode: 'batch',
      items: [
        plan.items[0],
        {
          ...plan.items[0],
          installation: diagnostic().installations[2].identity,
          filesToRewrite: ['ul.ABCDEF.SLUS_000.02.00'],
          order: 2
        }
      ],
      exclusions: [
        {
          installation: diagnostic().installations[4].identity,
          code: 'INVALID_INSTALLATION',
          explanation: 'Estrutura inválida não pode ser corrigida.'
        }
      ]
    }
    const batchOperation: RepairOperation = {
      ...operation,
      operationId: 'batch-operation',
      planId: 'batch-plan'
    }
    let listener: ((event: RepairEvent) => void) | undefined
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(diagnostic())
    const planning = vi.spyOn(oplApi, 'planFragmentationRepair').mockResolvedValue(batchPlan)
    vi.spyOn(oplApi, 'confirmFragmentationRepair').mockResolvedValue(batchOperation)
    vi.spyOn(oplApi, 'onFragmentationRepairEvent').mockImplementation((callback) => {
      listener = callback
      return () => undefined
    })
    vi.spyOn(oplApi, 'getFragmentationRepairReportByOperation').mockResolvedValue({
      ...report,
      operationId: 'batch-operation',
      planId: 'batch-plan',
      result: 'partial',
      counts: {
        corrected: 1,
        unchanged: 0,
        skipped: 0,
        failed: 1,
        cancelled: 0,
        'recovery-pending': 0
      },
      games: [
        report.games[0],
        {
          ...report.games[0],
          installation: diagnostic().installations[2].identity,
          outcome: 'failed',
          finalState: 'partially-fragmented',
          failures: [{ code: 'FILE_LOCKED', message: 'Parte bloqueada', retryable: true }]
        }
      ]
    })
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Corrigir todos os 2 jogos elegíveis' })
    )
    expect(planning).toHaveBeenCalledWith({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 1,
      mode: 'batch',
      installationIds: ['game-1', 'game-2']
    })
    const dialog = await screen.findByRole('dialog', { name: 'Plano de correção' })
    expect(within(dialog).getByText('Ordem 1')).toBeInTheDocument()
    expect(within(dialog).getByText('Ordem 2')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Estrutura inválida não pode ser corrigida/)
    ).toBeInTheDocument()
    await userEvent.type(
      within(dialog).getByLabelText('Digite CORRIGIR FRAGMENTAÇÃO para confirmar'),
      'CORRIGIR FRAGMENTAÇÃO'
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar correção' }))
    listener?.({
      operationId: 'batch-operation',
      installationId: 'game-1',
      sequence: 1,
      phase: 'staging',
      progress: 10,
      message: 'Copiando primeiro jogo',
      timestamp: '2026-08-02T12:02:01.000Z'
    })
    listener?.({
      operationId: 'batch-operation',
      installationId: 'game-2',
      sequence: 2,
      phase: 'cleanup-complete',
      progress: 100,
      message: 'Segundo jogo falhou isoladamente',
      timestamp: '2026-08-02T12:02:02.000Z'
    })
    const progress = await screen.findByRole('region', { name: 'Progresso da correção' })
    expect(within(progress).getByText(/game-1/)).toBeInTheDocument()
    expect(within(progress).getByText(/game-2/)).toBeInTheDocument()
    const batchReport = await screen.findByRole('region', { name: 'Relatório da correção' })
    expect(batchReport).toHaveTextContent('corrected')
    expect(batchReport).toHaveTextContent('failed')
    expect(batchReport).toHaveTextContent('Parte bloqueada')
  })

  it('renders all USBExtreme parts and the justified ul.cfg plan action', async () => {
    const usbDiagnostic = diagnostic()
    usbDiagnostic.installations[2] = {
      ...usbDiagnostic.installations[2],
      files: [
        {
          relativePath: 'ul.ABCDEF.SLUS_000.02.00',
          role: 'usb-part',
          sizeBytes: 1024,
          structuralState: 'valid',
          extentState: 'fragmented',
          extentCount: 2,
          verificationMethod: 'filefrag -v',
          findings: []
        },
        {
          relativePath: 'ul.ABCDEF.SLUS_000.02.01',
          role: 'usb-part',
          sizeBytes: 1024,
          structuralState: 'valid',
          extentState: 'contiguous',
          extentCount: 1,
          verificationMethod: 'filefrag -v',
          findings: []
        },
        {
          relativePath: 'ul.cfg',
          role: 'ul-cfg',
          sizeBytes: 64,
          structuralState: 'valid',
          extentState: 'not-applicable',
          findings: []
        }
      ]
    }
    const usbPlan: RepairPlan = {
      ...plan,
      items: [
        {
          ...plan.items[0],
          installation: usbDiagnostic.installations[2].identity,
          filesToRewrite: ['ul.ABCDEF.SLUS_000.02.00'],
          ulCfgAction: 'replace',
          ulCfgJustification: 'Atualizar atomicamente a entrada após promover todas as partes.'
        }
      ]
    }
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    vi.spyOn(oplApi, 'diagnoseFragmentation').mockResolvedValue(usbDiagnostic)
    vi.spyOn(oplApi, 'planFragmentationRepair').mockResolvedValue(usbPlan)
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar diagnóstico' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver arquivos de Jogo partially-fragmented' })
    )
    expect(screen.getByText('ul.ABCDEF.SLUS_000.02.00')).toBeInTheDocument()
    expect(screen.getByText('ul.ABCDEF.SLUS_000.02.01')).toBeInTheDocument()
    expect(screen.getByText('ul.cfg')).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 partes afetadas/)).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Corrigir Jogo partially-fragmented' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Plano de correção' })
    expect(within(dialog).getByText('Substituir ul.cfg')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Atualizar atomicamente a entrada após promover todas as partes.')
    ).toBeInTheDocument()
  })

  it('orders and deduplicates renderer events by sequence', () => {
    let listener: ((event: RepairEvent) => void) | undefined
    vi.spyOn(oplApi, 'onFragmentationRepairEvent').mockImplementation((callback) => {
      listener = callback
      return () => undefined
    })
    render(<RepairProgress operation={operation} onTerminal={() => undefined} />)
    const send = (sequence: number, message: string) =>
      listener?.({
        operationId: operation.operationId,
        installationId: 'game-1',
        sequence,
        phase: 'staging',
        progress: sequence * 10,
        message,
        timestamp: `2026-08-02T12:00:0${sequence}.000Z`
      })
    act(() => {
      send(3, 'terceiro')
      send(1, 'primeiro')
      send(2, 'segundo')
      send(2, 'duplicado')
    })
    const items = within(
      screen.getByRole('region', { name: 'Progresso da correção' })
    ).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '#1 · game-1 primeiro',
      '#2 · game-1 segundo',
      '#3 · game-1 terceiro'
    ])
    expect(screen.queryByText('duplicado')).not.toBeInTheDocument()
  })

  it('refreshes recovery state after the renderer reconnects', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 1,
        free: 1,
        used: 0,
        fileSystem: 'exFAT',
        status: 'ready'
      }
    ])
    const recovery = vi.spyOn(oplApi, 'listFragmentationRecovery').mockResolvedValue([])
    renderPage()
    await userEvent.selectOptions(await screen.findByLabelText('Dispositivo'), 'device-1')
    await waitFor(() => expect(recovery).toHaveBeenCalledTimes(1))
    act(() => {
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(recovery).toHaveBeenCalledTimes(2))
  })

  it('calls the exact listener cleanup on operation change and unmount', () => {
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    vi.spyOn(oplApi, 'onFragmentationRepairEvent')
      .mockReturnValueOnce(firstCleanup)
      .mockReturnValueOnce(secondCleanup)
    const view = render(<RepairProgress operation={operation} onTerminal={() => undefined} />)
    const nextOperation = { ...operation, operationId: 'operation-2' }
    view.rerender(<RepairProgress operation={nextOperation} onTerminal={() => undefined} />)
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).not.toHaveBeenCalled()
    view.unmount()
    expect(firstCleanup).toHaveBeenCalledTimes(1)
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })
})
