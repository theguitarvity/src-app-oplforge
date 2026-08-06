# OPL Forge — Tech Stack

## Visão geral

OPL Forge é um aplicativo desktop escrito em TypeScript com arquitetura Electron + React + Vite. A solução combina UI moderna, serviços de sistema locais e fluxo de IPC seguro entre renderer e processo principal.

## Stack principal

### Frontend

- React 18+
- React Router DOM
- TanStack React Query
- Zustand
- Tailwind CSS
- Radix UI (dialog, label, progress, select, slot, separator)
- Lucide React
- clsx + tailwind-merge

### Desktop runtime

- Electron
- Electron Builder
- Electron Updater

### Build e tooling

- Vite
- TypeScript
- tsup
- ESLint
- Prettier
- Vitest
- Testing Library
- PostCSS
- Autoprefixer
- concurrently
- wait-on
- cross-env

### Domínio e infraestrutura de downloads

- WebTorrent
- Node.js runtime (versão alvo compatível com Node 22)
- IPC typed bridge via `contextBridge` e `ipcRenderer`

## Arquitetura técnica

### Camadas

1. Renderer
   - React pages/components
   - state local e global
   - navegação hash-router
   - integração em `window.oplApi`

2. Preload bridge
   - `electron/preload.ts`
   - expõe API de IPC no renderer com `contextBridge`

3. Main process
   - `electron/main.ts`
   - criação da janela principal
   - registro de handlers IPC
   - orquestração de downloads e I/O de arquivos

4. Serviços de domínio
   - `electron/services/`
   - serviços de device, file, history, source, catalog, downloads, art, game

## Padrões de estado

- `React Query` para dados assíncronos vindos do Electron
- `Zustand` para estado reativo de dispositivos, downloads e logs
- `router` baseado em hash para melhor encaixe em desktop

## Segurança do IPC

A arquitetura é alinhada a uma política de menor privilégio:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

Isso reduz a superfície de execução direta do renderer e mantém o acesso a operações sensíveis no processo principal.

## Persistência atual

Em sua fase atual, o projeto usa arquivos locais em JSON/estrutura de diretórios como mecanismo principal de persistência.

A estrutura de dados atualmente apontada no código e documentação sugere:

- `userData/history.json`
- `userData/game-library.json`
- `userData/catalog-source-links.json`

## Testes

- `vitest` para suíte de testes
- `@testing-library/react` para componentes e UI
- `jsdom` para ambiente de teste do navegador em Node

## Build e distribuição

O sistema é preparado para build desktop multiplataforma com `electron-builder`, cobrindo:

- Windows x64 e arm64
- macOS Intel e Apple Silicon
- Linux AppImage e DEB

## Observações de stack para Speckit

A stack do projeto já está madura o suficiente para expansão incremental. O principal fator estratégico é manter:

- TypeScript forte
- separação clara de responsabilidades
- acesso de arquivos e downloads no processo principal
- UI declarativa e testável com React

A evolução futura mais provável é a introdução de camada de persistência mais robusta (por exemplo SQLite) sem quebrar o modelo atual.
