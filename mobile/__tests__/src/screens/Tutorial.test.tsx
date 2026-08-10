import { render, waitFor } from '@testing-library/react-native'

jest.mock('../../../src/native/SharingModule', () => ({
  __esModule: true,
  getSession: jest.fn(),
  saveCredentials: jest.fn(),
  acknowledgeWriteAccess: jest.fn(),
  startSharing: jest.fn(),
  stopSharing: jest.fn(),
  getConnectionInstructions: jest.fn(),
  onSharingSessionEvent: jest.fn().mockReturnValue(() => undefined)
}))

import { useSharingStore } from '../../../src/stores/sharing-store'
import { TutorialScreen } from '../../../src/screens/Tutorial/TutorialScreen'
import * as SharingModule from '../../../src/native/SharingModule'

const mockSharingModule = SharingModule as unknown as Record<string, jest.Mock>

describe('TutorialScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSharingStore.setState({ session: undefined, status: 'idle', errorMessage: undefined })
  })

  it('shows a prompt to start sharing when not yet sharing', async () => {
    useSharingStore.setState({
      session: { state: 'off', shareName: 'OPLFORGE', hasCredentials: false }
    })

    const { getByText } = await render(<TutorialScreen />)

    expect(getByText(/Inicie o compartilhamento primeiro/)).toBeTruthy()
  })

  it('renders steps in the order returned by the native module (matching OPL menu order)', async () => {
    mockSharingModule.getConnectionInstructions.mockResolvedValue([
      { field: 'Endereço IP', value: '192.168.1.42', order: 0 },
      { field: 'Porta', value: '1445', order: 1 },
      { field: 'Nome do compartilhamento', value: 'OPLFORGE', order: 2 },
      { field: 'Usuário', value: 'opl', order: 3 }
    ])
    useSharingStore.setState({
      session: {
        state: 'running-idle',
        boundAddress: '192.168.1.42',
        port: 1445,
        shareName: 'OPLFORGE',
        hasCredentials: true
      }
    })

    const { getByText } = await render(<TutorialScreen />)

    await waitFor(() => expect(getByText('192.168.1.42')).toBeTruthy())
    expect(getByText('Endereço IP')).toBeTruthy()
    expect(getByText('1445')).toBeTruthy()
    expect(getByText('OPLFORGE')).toBeTruthy()
    expect(getByText('opl')).toBeTruthy()
  })

  it('shows a distinct connected state once the PS2 connects', async () => {
    mockSharingModule.getConnectionInstructions.mockResolvedValue([])
    useSharingStore.setState({
      session: {
        state: 'running-connected',
        boundAddress: '192.168.1.42',
        port: 1445,
        shareName: 'OPLFORGE',
        hasCredentials: true
      }
    })

    const { getByText } = await render(<TutorialScreen />)

    await waitFor(() => expect(getByText('PS2 conectado')).toBeTruthy())
  })
})
