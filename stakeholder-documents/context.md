# OPL Forge — Contexto Geral do Repositório

## Visão resumida

OPL Forge é um aplicativo desktop moderno para preparar, organizar e gerenciar dispositivos USB/HD usados com Open PS2 Loader (OPL), com foco em PS2, PS1, apps/homebrews, arte OPLM, catálogo curado e downloads P2P. O produto tem uma postura de ferramenta pragmática para usuários que já possuem backups legais de jogos e querem organizar o suporte físico/virtual do console em um fluxo guiado.

## Propósito do software

A aplicação tem como objetivo central:

- preparar o disco/USB para uso com OPL;
- importar jogos PS2 e PS1 e instalar apps/homebrews;
- gerenciar artes do OPLM no diretório de arte do dispositivo;
- consumir fontes locais e online para busca de arquivos;
- orquestrar downloads por torrent/magnet e catálogo seletivo;
- manter histórico de operações e logs de execução.

## Perfil do usuário

O usuário típico é alguém que:

- possui um HD/USB para uso em PS2;
- organiza jogos e apps em estrutura OPL;
- usa backups próprios, arquivos autorizados e fontes declaradas como válidas;
- deseja um fluxo visual, com monitoração de progresso e confirmação em pontos legais ou sensíveis.

## Modelo de operação

O produto combina duas camadas bem definidas:

1. Frontend renderizado em React dentro do Electron.
2. Backend de domínio com IPC seguro e serviços locais no processo principal do Electron.

A interface trabalha com rotas de navegação em hash e usa React Query para sincronização de estado assíncrono, Zustand para estado de UI global e um conjunto de serviços tipados em TypeScript.

## Arquitetura geral

A organização é a seguinte:

- `electron/`: processo principal, IPC, serviços de sistema e orquestração de I/O.
- `src/`: frontend React, páginas, componentes, hooks, stores, serviços web, tipos e utilitários.
- `src/services/api.ts`: camada de acesso ao mundo Electron via `window.oplApi`.
- `src/types/opl.ts`: contrato central da API e tipos compartilhados.

## Fluxos principais do produto

### 1. Preparação de dispositivo

O usuário seleciona um dispositivo e a aplicação prepara a estrutura esperada:

- `DVD`
- `CD`
- `PS1`
- `APPS`
- `ART`
- `CFG`
- `VMC`
- `README_OPL_FORGE.txt`

### 2. Importação de jogos

Suporte para:

- PS2: ISO unica, várias ISOs e pasta local com ISOs;
- PS1: `.bin`, `.cue` e `.iso`.

### 3. Apps e homebrews

A aplicação instala apps e homebrews dentro do diretório `/APPS/<NOME_APP>`.

### 4. Arte OPLM

A solução indexa o pacote OPLM ART e copia artes compatíveis para `/ART`, respeitando tipos como ICO, SCR, SCR2, BG, LGO, COV, LAB e COV2.

### 5. Fontes local e online

Há suporte para:

- fontes locais via `LocalFolderProvider` (implementado);
- fontes remotas documentadas e parcialmente preparadas para extensão futura;
- internet archive e listagem detalhada de arquivos.

### 6. Downloads e catálogo

O produto suporta:

- download P2P com torrents/magnet;
- monitoramento em tempo real de progresso;
- seleção de arquivos dentro de torrents;
- staging em `/_OPL_FORGE_STAGING/`;
- catálogo Essentials com links diretos, scoring local e Smart Fill.

### 7. Persistência e observabilidade

O app persiste:

- histórico em `userData/history.json`;
- biblioteca de IDs de jogos em `userData/game-library.json`;
- links de catálogo em `userData/catalog-source-links.json`.

Também há um painel de logs com níveis INFO, WARNING, ERROR e SUCCESS.

## Segurança e boas práticas

O projeto adota várias medidas de segurança e design:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC tipado e controlado pelo processo principal
- downloads P2P no processo principal do Electron
- confirmação explícita para downloads do Essentials Catalog
- proteção de formatação real do dispositivo por flag de ambiente

## Estado atual do repositório

O projeto já possui uma base funcional de produto desktop com áreas bem definidas de navegação e domínio. O foco atual é o gerenciamento de dispositivos e mídia para PS2/PS1, com extensão em fontes, catálogo e downloads.

## Nota de estratégia para Speckit

Este repositório deve ser tratado como um produto com:

- forte domínio de operação local de arquivos e dispositivos;
- arquitetura desktop com separação clara entre UI e serviços;
- foco em segurança, observabilidade e fluxos guiados;
- possibilidade de evolução para SQLite, providers remotos, e melhorias de UX/telemetria.
