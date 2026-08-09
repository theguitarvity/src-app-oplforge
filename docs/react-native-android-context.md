# Contexto do Projeto OPL Forge — para planejamento de uma versão React Native (Android)

> **Propósito deste documento**: este arquivo é um pacote de contexto autocontido para ser entregue a outro assistente (ex.: GPT) que vai planejar uma **nova spec** de uma versão **React Native para Android** do OPL Forge. Ele documenta o produto atual (desktop, Electron + React), o domínio (PS2/OPL), a arquitetura, o sistema de design, o inventário de features já entregues (specs 001–005) e — na seção final — os pontos que **precisam ser repensados** para uma versão mobile. O objetivo não é portar 1:1, e sim dar contexto suficiente para uma decisão de escopo informada.

---

## 1. O que é o OPL Forge

OPL Forge é uma aplicação **desktop open source** (Windows, macOS, Linux) que ajuda a comunidade de PS2 a preparar, organizar e validar dispositivos de armazenamento (HD/USB) para uso com o **Open PS2 Loader (OPL)** — um homebrew que permite ao PlayStation 2 rodar jogos a partir de mídia USB/HD/rede em vez de DVDs físicos.

**Problema que resolve**: preparar um HD/USB para OPL "na mão" é propenso a erros — nomes de arquivo fora do padrão, jogos fragmentados (o que causa erros de leitura no PS2), estrutura de pastas incorreta, artes/capas ausentes, e falta de validação antes de levar o dispositivo ao console real. O OPL Forge automatiza e valida cada uma dessas etapas.

**Usuário-alvo**: fãs de PS2/retrogaming, geralmente com HDs/USBs de posse de backups próprios (o app exige confirmação de responsabilidade legal do usuário — nunca fornece ROMs).

---

## 2. Stack técnica atual (desktop)

- **Runtime**: Electron 42, Node.js 22 LTS
- **Frontend**: React 19 + TypeScript 6, Vite, React Router (`createHashRouter`)
- **Estado**: Zustand (estado de UI/sessão) + TanStack React Query (estado assíncrono/servidor)
- **Estilo**: Tailwind CSS 4, tema dark fixo, `class-variance-authority` + `clsx`/`tailwind-merge`
- **Componentes base**: Radix UI primitives (`@radix-ui/react-dialog`, `-label`, `-progress`, `-select`, `-separator`, `-slot`) — sem biblioteca de componentes pronta (ex. shadcn), mas seguindo o mesmo padrão de "primitivos Radix + Tailwind"
- **Ícones**: `lucide-react`
- **Formulários**: `react-hook-form` + `@hookform/resolvers` (Zod)
- **Validação/contratos**: `zod` (todo input IPC é validado por schema Zod antes de chegar à lógica de domínio)
- **P2P/torrent**: `webtorrent` (downloads de jogos via torrent)
- **Compartilhamento de rede**: servidor SMB1 próprio (implementado do zero) + `ftp-srv` (FTP), ambos hospedados no processo principal do Electron — ver seção 6.9
- **Build/dist**: `electron-builder` (Windows NSIS, macOS DMG, Linux AppImage/DEB), `tsup` para bundlar `main.ts`/`preload.ts`
- **Testes**: Vitest + React Testing Library, ~99 arquivos de teste / ~284 testes, incluindo testes de integração que sobem servidores TCP reais (não apenas mocks)

### 2.1 Arquitetura de processos (crítico para entender o que NÃO existe em mobile)

```
electron/
├── main.ts        # processo principal: acesso a filesystem, rede, dispositivos, downloads P2P
├── preload.ts      # ponte tipada via contextBridge — expõe window.oplApi
├── ipc/            # um arquivo *.ipc.ts por domínio, registra ipcMain.handle(canal, ...)
│                    # todo input é validado por schema Zod (electron/ipc/schemas.ts) antes de tocar lógica de domínio
└── services/       # lógica de domínio real (I/O, parsing binário, etc.), organizada por feature
    ├── device.service.ts        # descoberta de dispositivos montados (via /proc/mounts, /Volumes, PowerShell Get-Volume)
    ├── fragmentation/           # detecção de fragmentação físisca de arquivos
    ├── fragmentation-repair/    # reparo transacional com journal/staging/rollback
    ├── installation/            # planejamento e execução de instalação de jogos
    ├── downloads/                # fila durável de downloads (torrent + HTTP), staging, retomada
    ├── catalog/                  # varredura/catalogação read-only da biblioteca já existente
    ├── art/                      # indexação e sincronização de capas/artes
    ├── naming/                   # auditoria e correção de nomes no padrão OPL
    ├── pcsx2/                    # detecção e orquestração de validação via PCSX2 (emulador desktop)
    ├── opl/                      # gerenciamento de perfis/versões do OPL (o loader em si)
    ├── network-share/            # servidor SMB1 (do zero) + FTP para compartilhamento de biblioteca via rede
    ├── history.service.ts        # histórico de operações
    └── persistence/              # locks de dispositivo, staging de auditoria
src/
├── app/            # bootstrap + rotas (React Router)
├── components/      # componentes por domínio (device/, library/, network/, tools/, ui/, etc.)
├── pages/           # telas
├── services/api.ts  # `oplApi` — client-side facade; usa window.oplApi (Electron) ou fallback que lança erro
├── stores/           # Zustand: device-store, log-store, network-share-store
└── types/opl.ts     # contratos TypeScript compartilhados entre renderer/preload/main (única fonte de verdade de tipos)
```

**Ponto-chave**: o renderer (React) **nunca** acessa filesystem, rede ou processos do SO diretamente. Toda operação privilegiada passa por `window.oplApi.<método>()` → IPC → processo principal → serviço de domínio. Isso é reforçado por `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` no BrowserWindow.

---

## 3. Constituição do projeto (princípios não-negociáveis)

O projeto opera sob uma "constituição" formal (`.specify/memory/constitution.md`, v1.0.0) que rege toda decisão de produto e arquitetura. Resumo dos 5 princípios:

1. **Segurança em Operações Sensíveis**: toda operação que formata/sobrescreve/remove/move dados MUST exibir o alvo resolvido, validar que é um dispositivo suportado, e exigir confirmação explícita. Formatação real fica bloqueada por uma flag de ambiente além da confirmação de UI. Downloads exigem que o usuário reconheça responsabilidade legal pelo conteúdo.
2. **Isolamento e Menor Privilégio**: renderer sempre `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Acesso a filesystem/dispositivos/rede só no processo principal, exposto por uma API estreita via `contextBridge`. Todo handler IPC valida entrada e retorna erros controlados.
3. **Contratos Tipados e Limites de Camada**: `src/services/api.ts` é o único ponto de acesso da UI a `window.oplApi`; `src/types/opl.ts` define os tipos compartilhados. Componentes React não tocam filesystem/rede diretamente. Lógica de domínio vive nos serviços do processo principal.
4. **Integridade, Rastreabilidade e Recuperação**: operações longas informam progresso/estado observável. Escritas parciais usam staging (`/_OPL_FORGE_STAGING/`) e só artefatos validados são promovidos ao destino final. Histórico persistente sem registrar segredos.
5. **Evolução Incremental Verificada**: mudanças com escopo mínimo, critérios de aceitação verificáveis, testes automatizados proporcionais ao risco. Build, typecheck, lint e testes MUST passar antes de integrar.

**Restrições técnicas explícitas**: estrutura OPL gerada deve respeitar as pastas `DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC`; caminhos fornecidos por usuário/rede MUST ser normalizados e confinados (proteção contra path traversal); downloads MUST ocorrer no processo principal com staging antes de promoção.

> Uma versão React Native precisa decidir explicitamente **quais desses princípios ainda fazem sentido** (ex.: "menor privilégio" se traduz em permissões Android/scoped storage; "staging antes de promoção" ainda vale para downloads mobile) e quais eram específicos da arquitetura Electron.

---

## 4. Glossário de domínio (PS2/OPL) — necessário para quem não conhece a comunidade

| Termo                       | Significado                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OPL (Open PS2 Loader)**   | Homebrew que roda no PS2 (via Free McBoot ou disco de boot) e permite carregar jogos de HD/USB/rede em vez de DVD físico.                                                                                                                         |
| **Game ID**                 | Identificador do jogo no formato `SLUS_212.59` (formato clássico) — usado para nomear arquivos e casar metadados/artes.                                                                                                                           |
| **Estrutura de pastas OPL** | `DVD/` (jogos PS2 em ISO até ~4GB), `CD/` (jogos PS2 em CD), `PS1/` (jogos PS1, `.bin`/`.cue`/`.iso`), `APPS/` (homebrews/ELFs), `ART/` (capas: ICO, COV, COV2, LAB, LGO, SCR, SCR2, BG), `CFG/` (configurações), `VMC/` (memory cards virtuais). |
| **Padrão de nome OPL**      | `<GAME_ID>.<Título>.<extensão>`, ex. `SLUS_212.59.Shadow of the Colossus.iso`. Nomes fora desse padrão o OPL não reconhece corretamente.                                                                                                          |
| **Fragmentação**            | Quando um arquivo (ou parte USBExtreme) está fisicamente espalhado em extents não-contíguos no filesystem — causa falhas de leitura/travamento no PS2, que é muito mais sensível a isso que um PC. É a dor #1 da comunidade.                      |
| **USBExtreme**              | Formato legado que divide jogos grandes em múltiplas partes (`.iso.0`, `.iso.1`...) referenciadas por um arquivo `ul.cfg`, usado quando o filesystem (ex. FAT32) não suporta arquivos >4GB.                                                       |
| **ZSO**                     | Formato de imagem PS2 comprimida (alternativa ao ISO puro).                                                                                                                                                                                       |
| **Free McBoot (FMcB)**      | Exploit/homebrew que permite o PS2 bootar o OPL sem modchip, a partir do Memory Card.                                                                                                                                                             |
| **PCSX2**                   | Emulador de PS2 para desktop — usado neste projeto **não para jogar**, mas para **validar** que um jogo preparado realmente boota, como um teste automatizado antes de levar o dispositivo ao hardware real.                                      |
| **ETH mode / SMB**          | Modo do OPL que carrega jogos via rede local (Ethernet do PS2), usando o protocolo **SMB1** como cliente — não FTP (isso foi uma descoberta desta sessão, ver seção 6.9).                                                                         |
| **Essentials**              | Nome legado (renomeado para "Componentes OPL" na nova IA) da seção que gerencia binários/runtimes/temas necessários pro ecossistema OPL (a própria build do OPL, banco de compatibilidade PCSX2, etc.).                                           |

---

## 5. Sistema de Design (dark theme fixo)

O app usa um tema **dark-only** (não há modo claro), inspirado visualmente em Linear/Raycast/Arc — glassmorphism leve, gradientes discretos, sidebar com blur.

### 5.1 Tokens de cor (HSL, definidos como CSS custom properties)

```css
--background: 246 32% 5% /* ~#0B0B10 */ --foreground: 240 15% 96%
  /* texto principal, quase branco */ --card: 248 26% 10% /* ~#15131F, superfícies elevadas */
  --card-foreground: 240 15% 96% --muted: 248 20% 16% --muted-foreground: 240 8% 66%
  /* texto secundário */ --border: 240 14% 18% /* ~#1F1F2E */ --input: 240 14% 18% --ring: 263 90%
  66% /* foco */ --primary: 263 90% 66% /* roxo — ~#7C3AED / #8B5CF6, cor de marca */
  --primary-foreground: 0 0% 100% --destructive: 0 72% 52% /* vermelho — ações destrutivas */
  --destructive-foreground: 0 0% 100%;
```

- **Cor de marca**: roxo violeta (`#7C3AED`/`#6D28D9` faixa), usado em CTAs primários, glow (`box-shadow: 0 0 60px rgba(139,92,246,0.24)`), ícones ativos, indicadores de progresso.
- **Superfícies**: cards com `rounded-2xl`, `border border-white/10`, `bg-card/75`, `backdrop-blur-xl`, `shadow-2xl shadow-black/20` — cartões "flutuantes" translúcidos sobre o fundo escuro.
- **Tipografia**: Inter (sans-serif), pesos semibold para títulos, texto secundário em `text-muted-foreground`.
- **Estados semânticos**: verde-esmeralda para sucesso/ativo (`emerald-400/500`), âmbar para avisos, vermelho para erro/destrutivo, roxo para "em progresso"/ação primária.
- **Componentes base** (`src/components/ui/`): `Button` (variantes `primary`/`secondary`/`ghost`/`danger`, tamanhos `sm`/`md`/`lg`), `Card`, `Input`, `Label`, `Select` — todos primitivos simples estilizados com Tailwind + `cn()` helper, sem dependência de biblioteca de UI pronta.
- **Ícones**: `lucide-react`, consistentemente `size-4`/`size-5`/`size-6`/`size-7` conforme contexto.

### 5.2 Arquitetura de Informação (IA) atual — 6 itens de navegação primária

Reformulada na spec `004-ia-ux-redesign` (já mesclada/ativa no código atual), consolidando o que antes eram 12+ itens de sidebar dispersos em 6 categorias organizadas pelo modelo mental:

```
DISPOSITIVO → BIBLIOTECA → JOGO → AÇÃO
```

| #   | Item              | Rota        | Conteúdo                                                                                                                                                                                                                                                                          |
| --- | ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Home**          | `/`         | Dashboard: se sem dispositivo → empty state acionável (Detectar/Preparar/Abrir biblioteca local/Explorar catálogo); se com dispositivo → workspace com métricas de espaço, contagem de jogos, alertas de saúde                                                                    |
| 2   | **Dispositivos**  | `/devices`  | Hub multi-aba do dispositivo ativo: Visão Geral, Jogos, Arquivos OPL, Diagnóstico                                                                                                                                                                                                 |
| 3   | **Biblioteca**    | `/library`  | Biblioteca unificada PS2+PS1+Apps, filtros por tipo/status, visão Grid e List, badges de status (`ready`, `needs_attention`, `fragmented`, `invalid_name`, `validation_warning`), drawer de detalhe do jogo com ações contextuais (Validar/Fragmentação/Renomear/Testar no PCSX2) |
| 4   | **Catálogo**      | `/catalog`  | Busca de metadados/capas online (Internet Archive etc.), aplicação de arte a jogos locais                                                                                                                                                                                         |
| 5   | **Ferramentas**   | `/tools`    | Sub-abas: Diagnóstico do Dispositivo, Componentes OPL (ex-"Essentials"), Utilitários/Histórico                                                                                                                                                                                    |
| 6   | **Configurações** | `/settings` | Geral, Fontes de Download, **Rede** (nova aba da spec 005 — compartilhamento SMB/FTP)                                                                                                                                                                                             |

Regra de design explícita: sidebar sem scroll vertical em 1280×720 e 1440×900 — por isso o limite duro de 6 itens primários.

### 5.3 Padrões de interação recorrentes

- **Confirmações destrutivas**: nunca um simples "OK/Cancelar" — exigem digitar um texto literal de confirmação (ex. `"CORRIGIR FRAGMENTAÇÃO"`, `"FINALIZAR BACKUP PARA OPL"`, `"ADEQUAR NOMES OPL"`), reforçando a constituição (Princípio I).
- **Barra de status + drawer de logs**: operações longas mostram uma barra compacta de progresso; detalhes técnicos ficam num drawer expansível, não poluindo a tela principal.
- **Wizards passo-a-passo** para operações de risco (ex. preparação de dispositivo: Seleção → Verificação → Configuração de Formato → Confirmação de Segurança → Execução → Conclusão).
- **Feedback em duas camadas**: mensagem amigável sempre visível + botão "Ver Detalhes Técnicos" para stack trace/erro bruto.

---

## 6. Inventário de features entregues (specs 001–005)

Todas as specs seguem o fluxo Spec-Kit: `spec.md` (requisitos/user stories) → `plan.md` (arquitetura) → `tasks.md` (tarefas rastreáveis) → `research.md`/`data-model.md`/`contracts/`. Diretório: `specs/<NNN>-<slug>/`.

### 6.1 `001-validate-opl-preparation` — Preparação OPL validada

Importação de jogos com garantia de integridade: detecção de formato (ISO9660 direto vs. USBExtreme multi-partes conforme limite do filesystem), normalização de nome pelo Game ID, verificação de contiguidade física pós-gravação, catalogação read-only progressiva da biblioteca existente (até 500 jogos sem degradação), reorganização segura com backup verificável fora do dispositivo.

### 6.2 `002-opl-fragmentation-repair` — Diagnóstico e correção de fragmentação

Diagnóstico 100% read-only primeiro (nunca altera o dispositivo). Classifica cada jogo: `contíguo`, `fragmentado`, `parcialmente fragmentado`, `incompleto`, `inválido`, `não verificável` (quando a plataforma/filesystem não permite verificação física confiável). Reparo transacional processa um jogo por vez, com journal/staging/rollback; nunca retoma automaticamente uma correção interrompida — preserva ou restaura o estado válido e aguarda decisão do usuário.

### 6.3 `003-harden-opl-finalization` — Finalização OPL confiável e resiliente

Trata download como início de uma instalação, não uma cópia simples. Resolve: gravações concorrentes causando fragmentação (agora serializadas por dispositivo), downloads >4GB indo para o formato certo conforme filesystem, nome canônico aplicado de ponta a ponta, fila de downloads durável (sobrevive a crash/restart), sincronização de artes em lote (até 500 jogos) acoplada à instalação. Usa o "OPL Manager V24" como referência funcional de qualidade (sem replicar suas fragilidades de arquitetura).

### 6.4 `004-ia-ux-redesign` — Redesign de IA/UX (já ativa no código)

Consolidação de 12+ itens de sidebar em 6 (ver seção 5.2). Introduz: Empty State orientado a ação, Device Workspace multi-aba, Biblioteca unificada com Grid/List e drawer de detalhe contextual, Wizard de preparação, barra de status + Activity Drawer substituindo painel de log fixo, renomeação "Essentials"→"Componentes OPL".

### 6.5 `005-ps2-network-transfer` — Compartilhamento de biblioteca via rede (mais recente, mais relevante para mobile!)

**Esta é provavelmente a spec mais relevante para uma versão mobile**, porque já resolve "como o PS2 acessa jogos sem cabo USB físico":

- Servidor **SMB1** implementado do zero (subconjunto mínimo do protocolo, validado contra o wire-format oficial MS-CIFS) rodando no processo principal — é o protocolo que o menu de rede nativo do OPL realmente usa para navegar/lançar jogos.
- Servidor **FTP** (via `ftp-srv`) como canal secundário (gerenciamento de arquivos, não boot).
- Confinado à rede local (RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), nunca exposto publicamente.
- Desligado por padrão, exige confirmação explícita separada para permitir escrita (o PS2 pode gravar saves de volta).
- UI: toggle liga/desliga, tutorial guiado mostrando exatamente o que digitar no menu do OPL, indicador de cliente conectado em tempo real.
- **Lição de arquitetura importante**: a v1 tentava "adivinhar" qual dispositivo compartilhar rodando sua própria descoberta no processo principal, ignorando o dispositivo que o usuário já tinha selecionado na tela Dispositivos — corrigido para usar explicitamente o dispositivo ativo escolhido na UI. **Esse padrão (nunca redescobrir contexto que o usuário já escolheu) deve valer também no app mobile.**

---

## 7. Superfície de API atual (contrato `OplApi`, ~90 métodos)

Categorias principais expostas por `window.oplApi` (todas via IPC, processo principal faz o trabalho real):

- **Dispositivos**: `listDevices`, `getDeviceSummary`, `prepareDevice`
- **Jogos/Importação**: `copyGame`, `copyPs1Game`, `installApp`, `listInstalledApps`, `removeApp`, `detectGameId`
- **Downloads (P2P + HTTP)**: `enqueueDownload`, `listDownloads`, `pause/resume/retry/cancelDurableDownload`, `addP2PDownload`, `listTorrentFiles`, `selectTorrentFiles`
- **Finalização**: `getFinalizationPlan`, `confirmFinalization`, `setFinalizationGameId`
- **Catálogo (scan local)**: `scanCatalog`, `getCatalogSnapshot`, `setCatalogGameId`, `hashCatalogFile`
- **Catálogo (fontes remotas/Essentials)**: `listEssentialsCatalog`, `searchRemoteSource`, `addCatalogGamesToQueue`, `createSmartFillPlan`
- **Artes**: `indexArt`, `planArtSync`/`createArtSyncPlan`, `startArtSync`, `queryArtIndex`
- **Nomes OPL**: `auditOplNaming`, `createOplNamingPlan`, `confirmOplNaming`
- **Fragmentação**: `listFragmentationGames`, `diagnoseFragmentation`, `planFragmentationRepair`, `confirmFragmentationRepair`, `listFragmentationRecovery`
- **Validação PCSX2**: `detectPcsx2`, `planValidation`, `startValidation`, `confirmValidationCheckpoint`
- **OPL profiles**: `listOplProfiles`, `registerOfficialOpl`, `planOplUpdate`, `confirmOplUpdate`
- **Rede (spec 005)**: `getNetworkShareConfig`, `saveNetworkShareConfig`, `acknowledgeNetworkShareWriteAccess`, `startNetworkShare`, `stopNetworkShare`, `getNetworkShareStatus`, `getNetworkShareSetupInstructions`
- **Histórico/Relatórios**: `getHistory`, `clearHistory`, `generateReadinessReport`, `recordHardwareSmoke`
- **Eventos push** (padrão `on<Domínio>Event`, unsubscribe function): `onLog`, `onProgress`, `onDownloadProgress`, `onCatalogEvent`, `onFragmentationRepairEvent`, `onValidationEvent`, `onNetworkShareEvent`, etc.

---

## 8. O que NÃO existe hoje (confirmado nesta sessão, não assumir)

- **Nenhuma transferência de rede PC→PS2 dentro do fluxo principal antes da spec 005** — antes disso, o único caminho era mover fisicamente o HD/USB entre PC e PS2.
- **Nenhum backend remoto/nuvem** — tudo roda localmente no processo Electron do usuário; persistência é JSON local (com nota explícita na constituição sobre eventual migração para SQLite).
- **Nenhuma autenticação de usuário/conta** — é uma ferramenta local, sem login.
- **Nenhuma versão mobile/web hoje** — este documento é o ponto de partida para a primeira.

---

## 9. Pontos que precisam ser REPENSADOS para React Native/Android (não copiar 1:1)

Esta seção é a mais importante para quem for planejar a spec nova — lista as premissas da versão desktop que **não se sustentam** em Android e onde decisões novas são necessárias.

1. **Não existe "processo principal privilegiado" em Android.** Toda a separação renderer/main do Electron (Princípio II da constituição) foi desenhada em torno do modelo de processo do Electron. Em React Native, o equivalente é: permissões do Android (Storage Access Framework / Scoped Storage no Android 10+), não um processo separado. A "fronteira de confiança" precisa ser redesenhada.
2. **Acesso a filesystem é MUITO mais restrito no Android moderno.** `device.service.ts` hoje lê `/proc/mounts`, monta lógica arbitrária de USB/HD com letra de unidade (Windows) ou caminho absoluto (Linux/macOS). Em Android 10+, isso não existe da mesma forma — precisa Storage Access Framework (`ACTION_OPEN_DOCUMENT_TREE`) para pastas arbitrárias, ou MTP/USB-OTG para HDs externos (nem sempre suportado nativamente). **Isso pode ser o maior bloqueador de escopo** — vale decidir logo se a v1 mobile foca em gerenciar um cartão SD/pasta local via SAF, ou se foca 100% no fluxo de rede (spec 005), que não depende de acesso bruto a filesystem de um HD USB.
3. **PCSX2 é um emulador desktop — não existe validação "boot real" no Android da mesma forma.** A feature de "validar no PCSX2" (spec 001/003) não tem equivalente direto mobile. Precisa decidir: remover essa capability, ou substituir por outra forma de validação (ex. checagem estrutural apenas, sem emulação real).
4. **O servidor SMB1/FTP da spec 005 é o candidato mais forte para reaproveitar o conceito** (não o código Node — Android não roda o mesmo runtime): a ideia de "o app expõe a biblioteca por SMB pra rede local, o PS2 conecta como cliente" é **plataforma-agnóstica** e é provavelmente a funcionalidade central que faz mais sentido para uma v1 mobile, já que não depende de acesso USB bruto a um HD.
5. **Downloads via WebTorrent** — bibliotecas P2P/torrent em React Native existem mas são bem mais limitadas (geralmente exigem módulos nativos ou bridges); vale avaliar se faz sentido manter torrent no mobile ou focar só em download HTTP direto na v1.
6. **UI desktop assume mouse/teclado e telas ≥1280×720 sem scroll na sidebar.** Todo o sistema de design (drawers laterais, grids densos, sidebar fixa de 6 itens) precisa de tradução para paradigmas mobile (bottom navigation ou drawer, gestos de toque, telas menores, orientação retrato). Reaproveitar os **tokens de cor** (seção 5.1) e a hierarquia de informação (`DISPOSITIVO → BIBLIOTECA → JOGO → AÇÃO`) faz sentido; reaproveitar o layout literal não.
7. **Operações "destrutivas com texto de confirmação literal"** (padrão UX atual) pode ser pesado demais para touch/mobile — vale reconsiderar para um padrão mobile-idiomático (ex. swipe-to-confirm, dois toques com timeout) mantendo a mesma garantia de segurança da constituição (Princípio I), não necessariamente a mesma implementação.
8. **A constituição (seção 3) deveria ganhar uma amenda ou uma constituição-irmã para o app mobile** — decidir explicitamente quais princípios são universais ao produto OPL Forge (ex.: nunca ocultar operação destrutiva, sempre confinar paths, nunca vazar credenciais) vs. quais eram amarrados à arquitetura Electron (isolamento de processo específico).
9. **Convenção de "nunca redescobrir contexto que o usuário já escolheu"** (lição da spec 005, seção 6.5) deve ser um princípio explícito de design desde o início da spec mobile — foi um bug real encontrado em produção nesta sessão.

---

## 10. O que pedir ao planejador da nova spec

Ao usar este documento para planejar a spec React Native/Android, seria útil que o plano resultante:

1. Comece definindo o **escopo mínimo viável** (MVP) explicitamente — recomenda-se fortemente considerar o **compartilhamento de biblioteca via rede (equivalente à spec 005)** como primeira fatia vertical, por não depender de acesso bruto a armazenamento USB no Android.
2. Trate a seção 9 acima como uma lista de **decisões obrigatórias antes de escrever requisitos** (FR-xxx), não como detalhe de implementação a resolver depois.
3. Reaproveite o glossário (seção 4) e os tokens de design (seção 5.1) como vocabulário/paleta compartilhados entre desktop e mobile, para manter identidade de marca consistente entre as duas versões.
4. Siga o mesmo processo de Spec-Kit já usado neste repositório (`spec.md` → `plan.md` → `tasks.md`), já que o repositório já tem essa infraestrutura configurada (`.specify/`, templates, e integrações Claude/Codex/Antigravity já instaladas).
5. Numere a nova feature como próxima sequencial (`006-...` se for adicionada a este mesmo repositório, ou seu próprio contador se for um repositório novo para o app mobile).
