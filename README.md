# OPL Forge

Prepare, organize e gerencie seu HD do PS2 com facilidade.

OPL Forge e uma aplicacao desktop moderna para preparar e gerenciar dispositivos USB usados com Open PS2 Loader, homebrews, jogos PS2, jogos PS1 e aplicativos complementares.

> Utilize apenas backups de jogos que voce possua legalmente ou arquivos distribuidos por seus respectivos autores.

## Requisitos

- Node.js 22 LTS
- pnpm

```bash
nvm install
nvm use
```

## Instalacao

```bash
pnpm install
```

## Desenvolvimento

```bash
pnpm electron:dev
```

No Linux, se o Electron abortar com erro de `chrome-sandbox` sem permissao setuid, use o comando de desenvolvimento abaixo:

```bash
pnpm electron:dev:linux
```

Alternativamente, corrija a permissao do binario baixado pelo Electron:

```bash
sudo chown root:root node_modules/.pnpm/electron@*/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/.pnpm/electron@*/node_modules/electron/dist/chrome-sandbox
```

O script `electron:dev:linux` usa `--no-sandbox` apenas para desenvolvimento local. A janela da aplicacao continua configurada com `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.

## Testes

```bash
pnpm test
```

## Build

```bash
pnpm electron:build
```

## Funcionalidades MVP

- Dashboard com dispositivo ativo, capacidade, espaco livre, jogos, apps e historico recente.
- Gerenciador de dispositivos para Windows, macOS e Linux.
- Preparacao de estrutura OPL: `DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC` e `README_OPL_FORGE.txt`.
- Importador PS2 para ISO unica, multiplas ISOs e pasta local com ISOs.
- Importador PS1 para `.bin`, `.cue` e `.iso`.
- Apps & Homebrews em `/APPS/NOME_APP`.
- Fontes extensivas com `LocalFolderProvider` implementado e providers remotos documentados como TODO.
- Fontes online com Internet Archive, busca remota, detalhes de item e listagem de arquivos.
- Download Manager P2P com torrents, magnet links, progresso em tempo real e staging.
- Essentials Catalog em `/catalog/essentials`, com fonte `playstation2_essentials`, links HTTP diretos por jogo, scoring local, Smart Fill 500GB e confirmação legal por item.
- ART Manager em `/art-manager`, com indexação do pacote `OPLM_ART_2024_09` e cópia de artes OPLM para `/ART`.
- Game ID detection por nome/ISO e biblioteca local em `userData/game-library.json`.
- Historico persistido em `userData/history.json`.
- Painel de logs inferior com INFO, WARNING, ERROR e SUCCESS.
- IPC seguro com `contextIsolation`, `nodeIntegration=false`, `sandbox=true` e `contextBridge`.

## Arquitetura

```txt
electron/
  main.ts
  preload.ts
  ipc/
  services/
src/
  app/
  pages/
  components/
  hooks/
  stores/
  services/
  types/
  utils/
  layouts/
  styles/
```

## Seguranca

OPL Forge nao implementa obtencao nao autorizada de jogos. A aplicacao trabalha apenas com arquivos locais, backups proprios e fontes autorizadas configuradas pelo usuario.

Formatacao real de dispositivos e protegida por ambiente:

```bash
ENABLE_REAL_FORMAT=false
```

Por padrao, a aplicacao nao formata dispositivos.

Downloads P2P sao executados somente no processo main do Electron. O renderer acessa apenas chamadas IPC tipadas, e os arquivos sao salvos primeiro em:

```txt
/_OPL_FORGE_STAGING/
```

Apos a conclusao, o app sugere o destino OPL conforme a extensao detectada: `/DVD` ou `/CD` para `.iso`, `/PS1` para `.bin`/`.cue`, e staging para arquivos compactados.

Downloads iniciados pelo Essentials Catalog exigem confirmação explícita por item:

```txt
Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup.
```

Essa confirmação é persistida no histórico antes de o download entrar na fila.

O Essentials não baixa o torrent único do item. O app gera e reutiliza um índice local em `userData/catalog-source-links.json`, validando links diretos com `HEAD` e baixando somente os arquivos selecionados.

## CI/CD

A pipeline GitHub Actions executa checkout, setup de Node via `.nvmrc`, instalacao, lint, testes e build.

## Build multiplataforma

`electron-builder.yml` esta configurado para:

- Windows x64 e arm64
- macOS Intel e Apple Silicon
- Linux AppImage e DEB
