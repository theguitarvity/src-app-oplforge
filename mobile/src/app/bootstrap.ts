/**
 * App bootstrap sequence, run once on launch before Home renders anything
 * state-dependent. Each step is optional and additive — later phases (US1's
 * library revalidation, US2's catalog reload, US3's sharing-state reset)
 * register themselves here rather than each screen re-implementing its own
 * "what happened before I mounted" logic.
 */
export type BootstrapStep = () => Promise<void>

const steps: BootstrapStep[] = []

/** Registers a step to run during `runBootstrap()`. Order of registration is execution order. */
export function registerBootstrapStep(step: BootstrapStep): void {
  steps.push(step)
}

/**
 * Runs all registered steps sequentially. A single step failing is logged and
 * does not block the others — bootstrap must never leave the app stuck on a
 * blank screen because one subsystem (e.g. library revalidation) failed.
 */
export async function runBootstrap(): Promise<void> {
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      console.warn('[bootstrap] step failed', error)
    }
  }
}
