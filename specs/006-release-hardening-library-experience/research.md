# Phase 0 Research: Release Hardening, OPL Connectivity and Library Experience

## R1. Fonte única e representação da versão

**Decision**: Adotar um manifesto de release versionado contendo versão pública `1.A.B.C`, versão interna SemVer, canal, tag esperada e versão usada nos nomes dos artefatos. A versão interna será o mapeamento reversível `1.A.(B × 1000 + C)`, com `0 ≤ B,C ≤ 999`. Exemplo: `1.2.3.4` → `1.2.3004`.

**Rationale**: `package.json`, npm e o comparador do updater exigem três componentes SemVer; quatro componentes literais são inválidos. Build metadata (`+C`) não altera precedência e prerelease (`-C`) transformaria releases estáveis em prereleases. O mapeamento preserva ordem, unicidade e reversibilidade, enquanto tag, release, artefatos e UI continuam exibindo `1.A.B.C`.

**Alternatives considered**: usar `github.run_number` (não representa versão do produto); tag como única fonte sem manifesto (não resolve a representação interna); truncar o quarto componente (perde unicidade); `1.A.B+C` (sem precedência); `1.A.B-C` (canal prerelease); quatro componentes no `package.json` (inválido).

**Sources**: [npm package version](https://docs.npmjs.com/creating-a-package-json-file/), [npm semantic versioning](https://docs.npmjs.com/about-semantic-versioning/), [Electron app version](https://www.electronjs.org/docs/latest/api/app).

## R2. Pipeline de release e artefatos públicos

**Decision**: Publicar releases somente a partir de tags validadas `v1.A.B.C`. Separar validação, builds multiplataforma, inspeção, agregação por allowlist e publicação. NSIS x64 será o único `.exe` público, acompanhado apenas de `latest.yml` e blockmap quando referenciado. Pushes de branch podem gerar smoke packages, nunca GitHub Releases.

**Rationale**: O workflow atual publica `v${github.run_number}`, agrega `release/*`, omite metadata de update e aceita todo `.exe`. Uma allowlist determinística impede executáveis intermediários e preserva os arquivos que o updater efetivamente referencia.

**Alternatives considered**: manter glob amplo (pode vazar intermediários); publicar portable junto do NSIS (ambiguidade e updater incompatível); publicar diretamente em cada job (risco de release parcial/inconsistente).

**Sources**: [electron-builder GitHub Actions](https://www.electron.build/docs/features/github-actions/), [artifact naming](https://www.electron.build/configuration.html), [GitHub workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts).

## R3. Identidade Windows determinística

**Decision**: Preservar `com.oplforge.app`, usar assets mestres versionados com geração reproduzível dos formatos de plataforma, configurar explicitamente ícones Windows e NSIS e definir o mesmo App User Model ID antes de criar janelas. Validar instalador, executável, atalhos, menu Iniciar, Programs and Features, desinstalador e taskbar em instalação limpa.

**Rationale**: O ícone da janela não corrige recursos do executável/instalador. O builder recomenda que o App User Model ID em runtime corresponda ao `appId`. Os assets atuais têm tamanhos adequados, mas a cadeia completa ainda não é inspecionada nem testada.

**Alternatives considered**: depender apenas do `icon` de topo (fallback implícito); mudar o `appId` (quebra identidade de upgrade); corrigir apenas `BrowserWindow.icon` (não atinge instalador/atalhos).

**Sources**: [electron-builder icons](https://www.electron.build/docs/features/icons-and-images/), [NSIS configuration](https://www.electron.build/nsis/), [builder appId](https://www.electron.build/docs/api/app-builder-lib.interface.configuration/).

## R4. Updater oficial e assinatura

**Decision**: Usar `electron-updater` no processo principal com provider GitHub gerado pelo builder; não usar `setFeedURL` nem permitir origem vinda do renderer. Expor IPC estreito para estado, check, download e instalação explícita. Checks só executam em app empacotado. Releases públicas exigem assinatura por secrets de CI; macOS exige Developer ID/notarização para declarar update funcional. Builds smoke não assinados permanecem privados e identificados.

**Rationale**: A dependência já existe, NSIS é atualizável e o builder gera `app-update.yml`/metadata. Feed controlado pelo renderer viola isolamento. O builder pode produzir pacotes sem assinatura silenciosamente, mas isso não prova update aplicável nos sistemas operacionais.

**Alternatives considered**: Electron core `autoUpdater` com feed customizado (duplicação multiplataforma); consultar GitHub Releases diretamente (contorna metadata/integridade); instalar silenciosamente (viola consentimento); certificados no repositório (exposição de segredo).

**Sources**: [electron-builder auto update](https://www.electron.build/docs/features/auto-update/), [code signing](https://www.electron.build/docs/features/code-signing/), [Windows signing](https://www.electron.build/docs/features/code-signing/code-signing-win/).

## R5. Causa da falha `SESSION_SETUP_ANDX`

**Decision**: Entregar primeiro um perfil compatível de segurança por compartilhamento: anunciar share-level/OEM, aceitar `SESSION_SETUP_ANDX` sem exigir a senha e validar a senha do compartilhamento em `TREE_CONNECT_ANDX`. Guest/anônimo continuam desabilitados salvo perfil explícito. Implementar user-level NTLMv1/LM somente como perfil posterior se o teste físico exigir ou a equipe aceitar a superfície criptográfica adicional.

**Rationale**: O servidor atual anuncia `SecurityMode=0x00` (share-level/plaintext), mas compara usuário/senha no session setup e ignora a senha no tree connect. O código-fonte do OPL faz exatamente o inverso nesse modo: sessão sem senha e senha no tree connect. Isso explica deterministicamente `0xc000006d` com senha configurada.

**Alternatives considered**: manter o comportamento atual (contradiz negociação); user-level plaintext (expõe senha); implementar NTLMv1 imediatamente (maior superfície antes de provar necessidade). Se user-level encrypted for adotado, negociar `0x03`, challenge de 8 bytes, aceitar primeiro resposta NTLMv1 em `UnicodePasswordLength` e retry LM em `AnsiPasswordLength`, sem guest fallback.

**Sources**: [OPL smb.c](https://github.com/ps2homebrew/Open-PS2-Loader/blob/master/modules/iopcore/cdvdman/smb.c), [OPL smbauth.c](https://github.com/ps2homebrew/Open-PS2-Loader/blob/master/modules/network/smbinit/smbauth.c), [MS-CIFS](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cifs/), [MS-NLMP](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/).

## R6. Superfície SMB necessária ao OPL

**Decision**: Evoluir o servidor mínimo existente, guiado por trace real, adicionando `OPEN_ANDX`, `ECHO`, consultas TRANS2 necessárias, paginação limitada e validação de UID/TID. `READ_ANDX`/`WRITE_ANDX` combinarão offsets altos e baixos e respeitarão limites negociados. Manter OEM sem anunciar Unicode no primeiro perfil; non-ASCII fica documentado até implementar code page/Unicode de ponta a ponta.

**Rationale**: O OPL abre ISO/VMC com `OPEN_ANDX`, não apenas `NT_CREATE_ANDX`; a implementação atual falhará após autenticação. Ela também ignora `OffsetHigh`, causando wrap acima de 4 GiB em DVD9, e gera listagens potencialmente maiores que `MaxDataCount`.

**Alternatives considered**: considerar login como compatibilidade (insuficiente); substituir todo servidor antes do trace (escopo desnecessário); anunciar Unicode sem codec/alinhamento completos (respostas inconsistentes); IDs fixos sem validação (mascara erros de sessão).

**Sources**: [OPL SMB client](https://github.com/ps2homebrew/Open-PS2-Loader/blob/master/modules/iopcore/cdvdman/smb.c), [OPL README](https://github.com/ps2homebrew/Open-PS2-Loader/blob/master/README.md), [OPL detailed changelog](https://github.com/ps2homebrew/Open-PS2-Loader/blob/master/OLD_DETAILED_CHANGELOG), [RFC 1002](https://www.rfc-editor.org/rfc/rfc1002).

## R7. Observabilidade e prova em hardware SMB

**Decision**: Emitir eventos estruturados por conexão/fase com correlation ID, dialeto, security mode, auth mechanism, flags, status, UID/TID/FID, offsets/contagens e duração. Remover dumps hex de payload em caminhos de erro. O gate de release exige pcap sanitizado e roteiro em PS2 real cobrindo auth matrix, navegação, `OPEN_ANDX`, leitura sustentada e DVD9 acima de 4 GiB.

**Rationale**: Os 48 bytes atualmente logados em falha podem conter material autenticador. Fonte e testes unitários determinam estrutura, mas somente hardware confirma transporte NBT/direct-host, variantes OPL, parâmetros exatos de listagem e comportamento durante boot.

**Alternatives considered**: logs textuais genéricos (não localizam fase/campo); payload cru (vaza segredo); cliente desktop como prova (não representa OPL).

## R8. Índice local e seleção de artes

**Decision**: Durante o scan, enumerar `ART/` uma vez, validar candidatos e promover um `LocalArtIndexSnapshot` ligado ao snapshot do catálogo. Seleção: `COV` → `COV2`; duplicatas do mesmo tipo usam ordem lexical estável por path relativo normalizado e produzem `ART_AMBIGUOUS` sem alterar prontidão estrutural. Falha/remoção preserva o último snapshot completo.

**Rationale**: Hoje há um `readdir(ART)` por jogo, booleans sem asset selecionado e o card usa o caminho do jogo como imagem. Um join por Game ID é linear, determinístico e separa completude visual de integridade.

**Alternatives considered**: scan por jogo (custo e falta de diagnóstico); índice remoto (autoridade errada para o device); mtime mais recente (instável após cópias).

## R9. Representação segura de imagem local

**Decision**: Servir somente assets promovidos por URL opaca revisionada `opl-art://...` através de protocolo registrado no processo principal. Resolver token/asset ID pelo índice, revalidar identidade da raiz, confinamento em `ART`, symlinks e tipo; responder MIME estrito, `nosniff` e cache privado. CSP permite `opl-art:` apenas em `img-src`.

**Rationale**: `file://` dá capacidade ampla e atualmente aponta para o jogo. Base64/IPC copia imagens e escala mal em 500 itens. O protocolo customizado preserva sandbox e revoga URLs por revisão.

**Alternatives considered**: `file://` (acesso amplo); bytes/base64 por IPC (memória/cópia); IPC genérico de leitura (confused deputy); blob URLs (lifecycle/IPC pesado).

**Sources**: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol).

## R10. Destino local no pipeline de download

**Decision**: Migrar tarefas para schema v2 com união discriminada `DownloadTarget`: `opl-device` ou `local-folder`. Transferência e validação mínima são comuns; o ramo OPL mantém finalização atual, enquanto o ramo local valida autorização/espaço, faz staging dentro do filesystem de destino, preserva nome/formato, promove atomicamente e verifica tamanho/hash. Colisão padrão: falhar ou renomear, nunca sobrescrever implicitamente.

**Rationale**: Um “dispositivo computador” falso contaminaria scheduler e recovery; outro downloader duplicaria retomada robusta. Staging na raiz local permite rename atômico sem copiar o cache inteiro entre volumes.

**Alternatives considered**: fake device; download ad hoc separado; cache da aplicação seguido de cópia não durável; overwrite padrão.

## R11. Importação durável e progresso unificado

**Decision**: Criar `ImportJob`/`ImportItem` persistidos, reutilizando store atômico, eventos, scheduler e safe-path por composição. Não sobrecarregar `DurableDownloadTask`. Checkpoints no máximo a cada 1 s ou ~16 MiB; cancelamento apenas em fases seguras. Activity Drawer consome `OperationSummary`/`OperationEvent` comum a imports e downloads.

**Rationale**: Importação é origem local e lote, com recuperação diferente de download. O progresso legado é efêmero, grava direto no final e não possui abort/journal. Entidade própria preserva invariantes e ainda unifica apresentação.

**Alternatives considered**: estender evento efêmero (sem recovery); forçar import em download task (semântica errada); loop síncrono atual (UI opaca); infraestrutura UI paralela (duplica Activity).

## R12. Cálculo, cancelamento e recuperação de importação

**Decision**: Progresso de item é bytes monotônicos; velocidade usa janela suavizada e ETA só após amostras estáveis. Progresso global é ponderado por bytes conhecidos, com contadores por item. Copiar para staging com journal persistido antes de mutações; revalidar fingerprint da origem antes de retomar/promover. Durante commit atômico, marcar `canCancel=false`; crash é reconciliado idempotentemente.

**Rationale**: Percentuais médios por quantidade distorcem lotes; inferir sucesso por bytes não prova promoção/verificação. O journal e revisão permitem preservar destino anterior em cada boundary de crash.

**Alternatives considered**: ETA desde o primeiro chunk (instável); progresso médio simples (enganoso); cancelamento durante rename/commit (estado ambíguo); declarar completo por tamanho (integridade insuficiente).
