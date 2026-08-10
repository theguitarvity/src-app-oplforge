import { create } from 'zustand'
import { useSharingStore } from './sharing-store'

interface ConnectionFeedbackState {
  toast?: { id: number; message: string; kind: 'connected' | 'disconnected' }
  dismiss: () => void
}

/**
 * Toast feed for PS2 connect/disconnect over SMB — mirrors desktop's
 * `download-feedback-store.ts` pattern. Derived from `sharing-store`'s live
 * session state rather than owning any state itself: watches for the
 * `running-connected` transition (edges only, not level — a toast per
 * connect/disconnect event, not one per state read).
 */
export const useConnectionFeedbackStore = create<ConnectionFeedbackState>((set) => ({
  toast: undefined,
  dismiss: () => set({ toast: undefined })
}))

let previousState: string | undefined
useSharingStore.subscribe((state) => {
  const current = state.session?.state
  if (current === previousState) return
  const wasConnected = previousState === 'running-connected'
  const isConnected = current === 'running-connected'
  previousState = current

  if (isConnected && !wasConnected) {
    useConnectionFeedbackStore.setState({
      toast: { id: Date.now(), message: 'O PS2 se conectou à biblioteca.', kind: 'connected' }
    })
  } else if (wasConnected && !isConnected) {
    // Fires whether the PS2 itself dropped off the network or sharing was
    // stopped locally — the server-side event doesn't distinguish the two,
    // on either platform, so the message stays neutral rather than guessing.
    useConnectionFeedbackStore.setState({
      toast: { id: Date.now(), message: 'Conexão com o PS2 encerrada.', kind: 'disconnected' }
    })
  }
})
