import { app, ipcMain } from 'electron'
import path from 'node:path'
import type {
  OplProfileRegistration,
  OplUpdateConfirmation,
  OplUpdatePlanInput
} from '../../src/types/opl'
import { OplProfileService } from '../services/opl/opl-profile.service'
import { parseInput } from './schemas'

let service: OplProfileService | undefined
const profiles = () =>
  (service ??= new OplProfileService(path.join(app.getPath('userData'), 'opl-profiles.json')))
export const getOplProfileService = profiles

export function registerOplIpc() {
  ipcMain.handle('opl:profiles:list', () => profiles().list())
  ipcMain.handle('opl:profiles:get', (_event, id: string) => profiles().get(id))
  ipcMain.handle('opl:profiles:register-official', (_event, input: OplProfileRegistration) => {
    const profile = parseInput('oplProfile', input?.profile)
    if (typeof input?.elfPath !== 'string')
      throw Object.assign(new Error('ELF path required'), { code: 'INVALID_INPUT' })
    return profiles().registerOfficial(profile, input.elfPath)
  })
  ipcMain.handle('opl:profiles:update-plan', (_event, input: OplUpdatePlanInput) => {
    const parsed = parseInput('oplUpdatePlan', input)
    return profiles().planUpdate(parsed.profileId, parsed.memoryCardPath)
  })
  ipcMain.handle('opl:profiles:update-confirm', (_event, input: OplUpdateConfirmation) => {
    const parsed = parseInput('oplUpdateConfirm', input)
    return profiles().confirmUpdate(parsed.planId, parsed.confirmation, parsed.patchedImagePath)
  })
}
