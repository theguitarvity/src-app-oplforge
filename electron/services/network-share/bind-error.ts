/**
 * Maps a raw Node.js `net`/`tls` listen error into a human-readable message
 * (FR-008/SC-004 — no raw technical errors surfaced to the user). EACCES on
 * ports below 1024 is the single most common failure mode here (SMB/FTP
 * default to the privileged ports 445/21 — see README), so it gets its own
 * actionable message instead of falling into the generic case.
 */
export function friendlyBindError(
  error: NodeJS.ErrnoException,
  port: number
): { code: 'PORT_IN_USE' | 'BIND_FAILED'; message: string } {
  if (error.code === 'EADDRINUSE') {
    return {
      code: 'PORT_IN_USE',
      message: `A porta ${port} já está em uso por outro programa. Altere a porta em Configurações → Rede e tente novamente.`
    }
  }
  if (error.code === 'EACCES') {
    return {
      code: 'BIND_FAILED',
      message: `Sem permissão para usar a porta ${port} — portas abaixo de 1024 exigem privilégios de administrador, e o app não deve rodar como root. Altere a porta em Configurações → Rede para um valor acima de 1024 (ex.: 4450) e informe essa mesma porta no menu Servidor SMB/FTP do PS2 (o campo Porta é editável).`
    }
  }
  return {
    code: 'BIND_FAILED',
    message: `Não foi possível iniciar o servidor na porta ${port}: ${error.message}`
  }
}
