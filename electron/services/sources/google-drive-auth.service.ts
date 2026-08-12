import { randomBytes, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { app, shell } from 'electron'
import {
  decryptSecret,
  encryptSecret,
  isSecretStorageAvailable
} from '../network-share/credential-store'

/**
 * Authorization Code + PKCE OAuth flow against a Google Cloud OAuth Client
 * (type "Desktop app") — no client secret needed or stored, matching
 * Google's own recommendation for installed apps
 * (https://developers.google.com/identity/protocols/oauth2/native-app).
 * Redirect goes to a loopback HTTP server this process starts on an
 * ephemeral port; Google's Desktop-app client type accepts any
 * http://127.0.0.1:<port>/* redirect without pre-registering the exact
 * port. Scope is drive.readonly — only enough to list/download the user's
 * own files, never write access.
 *
 * No Client ID is bundled with this app (registering a Google Cloud OAuth
 * client is a manual, external, per-deployer step — see
 * GoogleDriveSetupInstructions in the UI) — until one is configured via
 * saveClientConfig(), every method here rejects with NOT_CONFIGURED.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export class GoogleDriveAuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
}

interface ClientConfig {
  clientId: string
}

const clientConfigPath = () => path.join(app.getPath('userData'), 'google-drive-config.json')
const tokensPath = () => path.join(app.getPath('userData'), 'google-drive-tokens.enc')

async function readClientConfig(): Promise<ClientConfig | undefined> {
  try {
    return JSON.parse(await fs.readFile(clientConfigPath(), 'utf-8')) as ClientConfig
  } catch {
    return undefined
  }
}

export async function getGoogleDriveStatus(): Promise<{
  configured: boolean
  connected: boolean
  clientId?: string
}> {
  const config = await readClientConfig()
  const tokens = await readTokens()
  return {
    configured: Boolean(config?.clientId),
    connected: Boolean(tokens),
    clientId: config?.clientId
  }
}

export async function saveGoogleDriveClientId(clientId: string): Promise<void> {
  const trimmed = clientId.trim()
  if (!trimmed) throw new GoogleDriveAuthError('INVALID_INPUT', 'Client ID não pode ser vazio.')
  await fs.mkdir(path.dirname(clientConfigPath()), { recursive: true })
  await fs.writeFile(clientConfigPath(), JSON.stringify({ clientId: trimmed }, null, 2), 'utf-8')
}

async function readTokens(): Promise<StoredTokens | undefined> {
  try {
    const encoded = await fs.readFile(tokensPath(), 'utf-8')
    return JSON.parse(decryptSecret(encoded)) as StoredTokens
  } catch {
    return undefined
  }
}

async function writeTokens(tokens: StoredTokens): Promise<void> {
  if (!isSecretStorageAvailable()) {
    throw new GoogleDriveAuthError(
      'SECRET_STORAGE_UNAVAILABLE',
      'Este sistema não tem um cofre de credenciais seguro disponível.'
    )
  }
  await fs.mkdir(path.dirname(tokensPath()), { recursive: true })
  await fs.writeFile(tokensPath(), encryptSecret(JSON.stringify(tokens)), 'utf-8')
}

export async function disconnectGoogleDrive(): Promise<void> {
  await fs.rm(tokensPath(), { force: true })
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Opens the consent screen in the user's default browser (not an embedded
 * BrowserWindow — Google blocks OAuth from unrecognized embedded webviews
 * for security, "disallowed_useragent") and waits for the loopback redirect.
 */
export async function connectGoogleDrive(): Promise<void> {
  const config = await readClientConfig()
  if (!config?.clientId) {
    throw new GoogleDriveAuthError(
      'NOT_CONFIGURED',
      'Configure o Client ID do Google Drive antes de conectar.'
    )
  }

  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  const state = base64url(randomBytes(16))

  // Bind the loopback server first so we know the real port before building
  // the authorize URL's redirect_uri.
  const port = await new Promise<number>((resolve, reject) => {
    const probe = http.createServer()
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const boundPort = address && typeof address === 'object' ? address.port : undefined
      probe.close(() =>
        boundPort ? resolve(boundPort) : reject(new Error('Failed to bind loopback port'))
      )
    })
    probe.on('error', reject)
  })
  const redirectUri = `http://127.0.0.1:${port}/callback`

  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  const codePromise = waitForAuthorizationCodeOnPort(port, state)
  await shell.openExternal(authUrl.toString())
  const { code } = await codePromise

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  })
  if (!tokenResponse.ok) {
    throw new GoogleDriveAuthError(
      'AUTH_FAILED',
      `Falha ao trocar código por token (${tokenResponse.status}).`
    )
  }
  const payload = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  if (!payload.refresh_token) {
    // Google only returns a refresh_token on the FIRST consent for a given
    // client+account, or when prompt=consent forces re-consent (set above) —
    // if this still happens, the user likely has a stale grant from testing;
    // surfacing a clear error beats silently storing a session that dies in an hour.
    throw new GoogleDriveAuthError(
      'NO_REFRESH_TOKEN',
      'O Google não retornou um refresh token. Revogue o acesso em myaccount.google.com/permissions e tente novamente.'
    )
  }
  await writeTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  })
}

function waitForAuthorizationCodeOnPort(
  port: number,
  expectedState: string
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (error || !code || state !== expectedState) {
        res.end(
          '<html><body>Falha ao conectar ao Google Drive. Pode fechar esta janela.</body></html>'
        )
        server.close()
        reject(
          new GoogleDriveAuthError('AUTH_FAILED', error || 'Resposta de autorização inválida.')
        )
        return
      }
      res.end(
        '<html><body>Google Drive conectado! Pode fechar esta janela e voltar ao OPL Forge.</body></html>'
      )
      server.close()
      resolve({ code })
    })
    server.listen(port, '127.0.0.1')
    server.on('error', reject)
    // Bound wait — if the user abandons the browser tab, don't hang forever.
    setTimeout(() => {
      server.close()
      reject(
        new GoogleDriveAuthError(
          'AUTH_TIMEOUT',
          'Tempo esgotado aguardando a autorização do Google.'
        )
      )
    }, 5 * 60_000).unref()
  })
}

async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens> {
  const config = await readClientConfig()
  if (!config?.clientId)
    throw new GoogleDriveAuthError('NOT_CONFIGURED', 'Client ID do Google Drive não configurado.')
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    })
  })
  if (!response.ok) {
    throw new GoogleDriveAuthError(
      'REFRESH_FAILED',
      `Falha ao renovar o acesso ao Google Drive (${response.status}).`
    )
  }
  const payload = (await response.json()) as { access_token: string; expires_in: number }
  const next: StoredTokens = {
    accessToken: payload.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000
  }
  await writeTokens(next)
  return next
}

/** Returns a valid access token, refreshing first if it's expired (or close to it). Throws NOT_CONNECTED if the user never completed the flow. */
export async function getValidGoogleDriveAccessToken(): Promise<string> {
  const tokens = await readTokens()
  if (!tokens)
    throw new GoogleDriveAuthError('NOT_CONNECTED', 'Conecte sua conta do Google Drive primeiro.')
  const expiringSoonMs = 60_000
  if (Date.now() < tokens.expiresAt - expiringSoonMs) return tokens.accessToken
  const refreshed = await refreshAccessToken(tokens)
  return refreshed.accessToken
}
