export interface FinalizationRuntimeComponent {
  initialize?(): void | Promise<void>
  reconcile?(): void | Promise<void>
  start?(): void | Promise<void>
  stop?(): void | Promise<void>
}

export interface FinalizationRuntimeOptions {
  userDataPath: string
  components?: FinalizationRuntimeComponent[]
}

export class FinalizationRuntime {
  private state: 'new' | 'initialized' | 'reconciled' | 'started' | 'stopped' = 'new'
  private lifecycle: Promise<void> = Promise.resolve()

  constructor(readonly options: FinalizationRuntimeOptions) {}

  get status(): typeof this.state {
    return this.state
  }

  initialize(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state !== 'new') return
      for (const component of this.options.components ?? []) await component.initialize?.()
      this.state = 'initialized'
    })
  }

  reconcile(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state === 'new') await this.initializeComponents()
      if (this.state !== 'initialized') return
      for (const component of this.options.components ?? []) await component.reconcile?.()
      this.state = 'reconciled'
    })
  }

  start(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state === 'new') await this.initializeComponents()
      if (this.state === 'initialized') await this.reconcileComponents()
      if (this.state !== 'reconciled') return
      for (const component of this.options.components ?? []) await component.start?.()
      this.state = 'started'
    })
  }

  stop(): Promise<void> {
    return this.enqueue(async () => {
      if (this.state === 'stopped') return
      for (const component of [...(this.options.components ?? [])].reverse())
        await component.stop?.()
      this.state = 'stopped'
    })
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const result = this.lifecycle.then(action)
    this.lifecycle = result.catch(() => undefined)
    return result
  }

  private async initializeComponents(): Promise<void> {
    for (const component of this.options.components ?? []) await component.initialize?.()
    this.state = 'initialized'
  }

  private async reconcileComponents(): Promise<void> {
    for (const component of this.options.components ?? []) await component.reconcile?.()
    this.state = 'reconciled'
  }
}

let singleton: FinalizationRuntime | undefined

export function createFinalizationRuntime(
  options: FinalizationRuntimeOptions
): FinalizationRuntime {
  if (singleton) {
    if (singleton.options.userDataPath !== options.userDataPath) {
      throw Object.assign(
        new Error('Finalization runtime already belongs to another user data path'),
        { code: 'RUNTIME_ALREADY_CREATED' }
      )
    }
    return singleton
  }
  singleton = new FinalizationRuntime(options)
  return singleton
}

export function resetFinalizationRuntimeForTests(): void {
  singleton = undefined
}
