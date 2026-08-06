import { z } from 'zod'

const absolutePath = z
  .string()
  .min(1)
  .refine((value) => /^([A-Za-z]:[\\/]|\/)/.test(value), 'absolute path required')
const gameId = z.string().regex(/^[A-Z]{4}_[0-9]{3}\.[0-9]{2}$/)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i)
const operationId = z.string().min(1).max(128)
const strictId = z.string().min(1).max(128)
const strictOperationReference = z.object({ operationId: strictId }).strict()
const revision = z.number().int().nonnegative()
const pipelinePhase = z.enum([
  'queued',
  'probing',
  'transferring',
  'paused',
  'downloaded',
  'validating',
  'planning',
  'awaiting-confirmation',
  'installing',
  'verifying',
  'cataloging',
  'queueing-art',
  'ready',
  'waiting-device',
  'failed',
  'cancelled',
  'recovery-pending'
])
const artType = z.enum(['ICO', 'COV', 'COV2', 'LAB', 'LGO', 'SCR', 'SCR2', 'BG'])
const pageLimit = z.number().int().min(1).max(500).optional()
const uniqueIds = z
  .array(strictId)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, 'IDs must be unique')
const revisionedTask = z.object({ taskId: strictId, expectedRevision: revision }).strict()
const revisionedJob = z.object({ jobId: strictId, expectedRevision: revision }).strict()

export const schemas = {
  downloadEnqueue: z
    .object({
      source: z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('http'),
            url: z
              .string()
              .url()
              .refine((value) => {
                const parsed = new URL(value)
                return (
                  ['http:', 'https:'].includes(parsed.protocol) &&
                  !parsed.username &&
                  !parsed.password
                )
              }, 'HTTP(S) URL without embedded credentials required'),
            expectedBytes: z.number().int().nonnegative().optional(),
            originalFileName: z.string().min(1).max(255).optional()
          })
          .strict(),
        z
          .object({
            kind: z.literal('torrent'),
            magnet: z.string().startsWith('magnet:').optional(),
            torrentToken: strictId.optional(),
            selectedFiles: z.array(z.string().min(1).max(1024)).max(500).optional()
          })
          .strict()
          .refine(
            (value) => Boolean(value.magnet) !== Boolean(value.torrentToken),
            'Provide exactly one torrent source'
          )
      ]),
      deviceId: strictId,
      profileId: strictId,
      title: z.string().min(1).max(128).optional(),
      mediaHint: z.enum(['CD', 'DVD']).optional(),
      legalReceiptId: strictId.optional()
    })
    .strict(),
  downloadList: z
    .object({
      deviceId: strictId.optional(),
      phases: z.array(pipelinePhase).max(20).optional(),
      cursor: strictId.optional(),
      limit: pageLimit
    })
    .strict(),
  downloadGet: revisionedTask.pick({ taskId: true }).strict(),
  downloadPause: revisionedTask,
  downloadResume: revisionedTask,
  downloadRetry: revisionedTask,
  downloadCancel: z
    .object({
      taskId: strictId,
      expectedRevision: revision,
      partialPolicy: z.enum(['keep-for-resume', 'discard']),
      confirmation: z.literal('DESCARTAR DOWNLOAD PARCIAL').optional()
    })
    .strict()
    .superRefine((value, context) => {
      if (value.partialPolicy === 'discard' && value.confirmation !== 'DESCARTAR DOWNLOAD PARCIAL')
        context.addIssue({
          code: 'custom',
          path: ['confirmation'],
          message: 'Discard confirmation required'
        })
    }),
  downloadRetryFailed: z
    .object({ deviceId: strictId.optional(), expectedQueueRevision: revision })
    .strict(),
  finalizationGetPlan: z.object({ planId: strictId }).strict(),
  finalizationConfirm: z
    .object({
      planId: strictId,
      expectedRevision: revision,
      collisionResolution: z
        .enum(['keep-existing', 'replace-identical', 'replace-authorized'])
        .optional(),
      confirmation: z.literal('FINALIZAR BACKUP PARA OPL')
    })
    .strict(),
  finalizationSetGameId: z
    .object({
      planId: strictId,
      expectedRevision: revision,
      gameId,
      confirmation: z.literal('USAR GAME ID INFORMADO')
    })
    .strict(),
  finalizationCancel: revisionedTask,
  namingAudit: z.object({ deviceId: strictId, profileId: strictId }).strict(),
  namingPlan: z
    .object({ auditId: strictId, expectedRevision: revision, itemIds: uniqueIds.min(1).optional() })
    .strict(),
  namingConfirm: z
    .object({
      planId: strictId,
      expectedRevision: revision,
      confirmation: z.literal('ADEQUAR NOMES OPL')
    })
    .strict(),
  namingGetOperation: strictOperationReference,
  artIndexRefresh: z.object({ force: z.boolean().optional() }).strict(),
  artIndexQuery: z
    .object({
      gameIds: uniqueIds.optional(),
      types: z
        .array(artType)
        .min(1)
        .max(8)
        .refine((types) => new Set(types).size === types.length, 'Art types must be unique')
        .optional(),
      cursor: strictId.optional(),
      limit: pageLimit
    })
    .strict(),
  artSyncPlanV2: z
    .object({
      deviceId: strictId,
      catalogSnapshotId: strictId,
      scope: z.enum(['single', 'selected', 'missing', 'library']),
      gameIds: uniqueIds.optional(),
      types: z
        .array(artType)
        .min(1)
        .max(8)
        .refine((types) => new Set(types).size === types.length, 'Art types must be unique'),
      replacePolicy: z.enum(['missing-only', 'replace-invalid', 'replace-all'])
    })
    .strict()
    .superRefine((value, context) => {
      if (value.scope === 'single' && value.gameIds?.length !== 1)
        context.addIssue({
          code: 'custom',
          path: ['gameIds'],
          message: 'Single scope requires exactly one game ID'
        })
      if (value.scope === 'selected' && !value.gameIds?.length)
        context.addIssue({
          code: 'custom',
          path: ['gameIds'],
          message: 'Selected scope requires game IDs'
        })
    }),
  artSyncStart: z
    .object({
      planId: strictId,
      expectedRevision: revision,
      confirmation: z.literal('SUBSTITUIR ARTES EXISTENTES').optional()
    })
    .strict(),
  artSyncGet: z.object({ jobId: strictId }).strict(),
  artSyncList: z
    .object({
      deviceId: strictId.optional(),
      states: z
        .array(
          z.enum([
            'queued',
            'running',
            'paused',
            'completed',
            'partial',
            'failed',
            'cancelled',
            'recovery-pending'
          ])
        )
        .max(8)
        .optional(),
      cursor: strictId.optional(),
      limit: pageLimit
    })
    .strict(),
  artSyncPause: revisionedJob,
  artSyncResume: revisionedJob,
  artSyncCancel: revisionedJob,
  artSyncRetryFailed: revisionedJob,
  devicePath: z.object({ devicePath: absolutePath }),
  oplProfile: z.object({
    id: z.string().min(1),
    version: z
      .string()
      .min(1)
      .refine((v) => v.toLowerCase() !== 'latest', 'exact version required'),
    commit: z.string().optional(),
    variant: z.string().min(1),
    officialUrl: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://github.com/ps2homebrew/Open-PS2-Loader/')),
    elfSha256: sha256,
    obtainedAt: z.string().datetime(),
    capabilities: z.object({
      iso: z.boolean(),
      zso: z.boolean(),
      usbExtreme: z.boolean(),
      fileSystems: z.array(z.string())
    })
  }),
  oplUpdatePlan: z.object({ profileId: z.string().min(1), memoryCardPath: absolutePath }),
  oplUpdateConfirm: z.object({
    planId: operationId,
    confirmation: z.literal('ATUALIZAR OPL'),
    patchedImagePath: absolutePath
  }),
  installationPlan: z.object({
    sourcePath: absolutePath,
    devicePath: absolutePath,
    oplProfileId: z.string().min(1),
    title: z.string().min(1).max(128)
  }),
  operationConfirm: z.object({
    operationId,
    expectedRevision: z.number().int().nonnegative(),
    confirmation: z.string().min(1)
  }),
  operationCancel: z.object({ operationId }),
  catalogScan: z.object({ devicePath: absolutePath, oplProfileId: z.string().optional() }),
  catalogSnapshot: z.object({ deviceId: z.string().min(1) }),
  catalogOverride: z.object({
    deviceId: z.string().min(1),
    relativePath: z.string().min(1),
    size: z.number().nonnegative(),
    fingerprint: z.string().min(1),
    gameId
  }),
  catalogHash: z.object({ deviceId: z.string().min(1), relativePath: z.string().min(1) }),
  artPlan: z.object({ deviceId: z.string().min(1), snapshotId: z.string().min(1) }),
  validationPlan: z.object({
    deviceId: z.string().min(1),
    snapshotId: z.string().min(1),
    itemId: z.string().min(1),
    profileId: z.string().min(1),
    pcsx2Path: absolutePath,
    biosPath: absolutePath,
    memoryCardPath: absolutePath,
    bootMode: z.enum(['memory-card', 'elf-fallback']),
    elfPath: absolutePath.optional()
  }),
  checkpoint: z.object({
    operationId,
    stage: z.number().int().min(1).max(9),
    result: z.enum(['passed', 'failed', 'not-verified']),
    screenshotPath: absolutePath.optional()
  }),
  reorganizationPlan: z.object({
    deviceId: z.string().min(1),
    devicePath: absolutePath,
    backupPath: absolutePath
  }),
  reportGenerate: z.object({
    deviceId: z.string().min(1),
    snapshotId: z.string().min(1),
    profileId: z.string().min(1),
    validationRunId: z.string().optional()
  }),
  reportExport: z.object({ reportId: z.string().min(1), destinationPath: absolutePath }),
  hardwareSmoke: z.object({
    reportId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
    consoleModel: z.string().min(1),
    adapter: z.string().min(1),
    oplVersion: z.string().min(1),
    detected: z.boolean(),
    artDisplayed: z.boolean(),
    noFragmentationError: z.boolean(),
    milestoneReached: z.boolean()
  }),
  fragmentationInventory: z.object({ devicePath: absolutePath }).strict(),
  fragmentationDiagnose: z
    .object({
      devicePath: absolutePath,
      oplProfileId: strictId.optional(),
      selectionKeys: z
        .array(z.string().min(1).max(1000))
        .min(1)
        .max(500)
        .refine((keys) => new Set(keys).size === keys.length, 'selection keys must be unique')
        .optional()
    })
    .strict(),
  fragmentationGetCurrentDiagnosis: z.object({ devicePath: absolutePath }).strict(),
  fragmentationCancelDiagnosis: strictOperationReference,
  fragmentationPlan: z
    .object({
      diagnosticId: strictId,
      expectedRevision: z.number().int().nonnegative(),
      mode: z.enum(['single', 'batch']),
      installationIds: z
        .array(strictId)
        .min(1)
        .max(500)
        .refine((ids) => new Set(ids).size === ids.length, 'installation IDs must be unique')
        .optional()
    })
    .strict()
    .superRefine((value, context) => {
      if (value.mode === 'single' && value.installationIds?.length !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['installationIds'],
          message: 'single mode requires exactly one installation ID'
        })
      }
    }),
  fragmentationConfirm: z
    .object({
      planId: strictId,
      expectedRevision: z.number().int().nonnegative(),
      confirmation: z.literal('CORRIGIR FRAGMENTAÇÃO')
    })
    .strict(),
  fragmentationCancel: strictOperationReference,
  fragmentationGetOperation: strictOperationReference,
  fragmentationGetReport: z.object({ reportId: strictId }).strict(),
  fragmentationGetReportByOperation: strictOperationReference,
  fragmentationListRecovery: z.object({ deviceId: strictId.optional() }).strict(),
  fragmentationResolveRecovery: z
    .object({
      journalId: strictId,
      expectedRevision: z.number().int().nonnegative(),
      action: z.enum(['restore-original', 'clean-verified-residue']),
      confirmation: z.literal('RECUPERAR JOGO')
    })
    .strict()
}

export function parseInput<K extends keyof typeof schemas>(
  schema: K,
  input: unknown
): z.infer<(typeof schemas)[K]> {
  return schemas[schema].parse(input) as z.infer<(typeof schemas)[K]>
}
