# OPL Forge — Mapa de Funcionalidades

## Visão do mapa

Este arquivo serve como inventário funcional orientado à inicialização de planejamento com Speckit. O mapa é organizado por áreas de produto, com foco em funcionalidades já presentes no repositório e em extensões naturais.

## 1. Dashboard e visão geral

### Funcionalidades existentes

- painel de status do dispositivo ativo;
- resumo de capacidade, espaço livre e uso;
- contagem de jogos PS2, PS1 e apps;
- histórico recente;
- indicadores de operação sistemática.

### Objetivo funcional

Dar ao usuário uma visão imediata e segura da saúde e do estado do dispositivo preparado.

## 2. Gestão de dispositivos

### Funcionalidades existentes

- listagem de dispositivos disponíveis;
- seleção do dispositivo ativo;
- resumo do dispositivo junto a estrutura OPL;
- diagnóstico de readiness/estrutura ausente/readonly.

### Objetivo funcional

Permitir a organização do hardware e a definição clara do alvo de operações.

## 3. Preparação de dispositivo

### Funcionalidades existentes

- preparação de árvore de diretórios OPL;
- criação de arquivos de referência e estrutura mínima.

### Objetivo funcional

Garantir que o dispositivo esteja pronto para uso em OPL com padronização.

## 4. Importação de jogos

### Funcionalidades existentes

- importação de PS2 via ISO simples, múltiplas ISOs e diretório local;
- importação de PS1 via `.bin`, `.cue` e `.iso`;
- copia controlada para o dispositivo alvo.

### Objetivo funcional

Transformar o disco local em biblioteca organizável para o console.

## 5. App & Homebrew management

### Funcionalidades existentes

- instalação de apps em diretórios de `/APPS`;
- remoção de apps;
- rastreio histórico de operação.

### Objetivo funcional

Dar suporte à extensão do console com aplicativos e homebrews.

## 6. Fontes locais e remotas

### Funcionalidades existentes

- `LocalFolderProvider` implementado;
- gerenciamento de fontes configuráveis;
- listagem de arquivos de fontes;
- importação de arquivos da fonte para o dispositivo;
- busca e detalhes em providers remotos.

### Objetivo funcional

Ampliar a biblioteca de entrada de mídia e arquivos além do local manual.

## 7. Download Manager P2P

### Funcionalidades existentes

- download por torrent/magnet;
- fila de downloads;
- pausa, retomada e cancelamento;
- monitoramento de progresso;
- seleção de arquivos de torrent;
- staging antes do destino final.

### Objetivo funcional

Permitir aquisição de conteúdo com rastreio e controle de destino.

## 8. Essentials Catalog

### Funcionalidades existentes

- catálogo curado com scoring local;
- filtros por tier, mídia e prioridade;
- inspeção de links diretos;
- refresh de links locais;
- smart fill de target bytes;
- confirmação explícita legal por item antes da fila.

### Objetivo funcional

Organizar descarregamento de conteúdo com critérios de qualidade e conformidade legal.

## 9. ART Manager

### Funcionalidades existentes

- indexação do pacote OPLM ART;
- instalação de arte por jogo;
- sincronização de artes para DVD;
- suporte a múltiplos tipos de asset.

### Objetivo funcional

Dar acabamento visual e compatibilidade gráfica ao setup do dispositivo.

## 10. Game ID detection e biblioteca local

### Funcionalidades existentes

- detecção de ID por nome ou caminho;
- persistência de biblioteca local;
- armazenamento de entradas na biblioteca.

### Objetivo funcional

Manter um mapa interno de identificação de jogos e reduzir ambiguidade de importação.

## 11. Histórico e logs

### Funcionalidades existentes

- histórico persistido de ações;
- painel de logs em tempo real;
- níveis de log e eventos de operação.

### Objetivo funcional

Dar observabilidade e auditoria ao uso do app.

## 12. Configurações e extensões futuras

### Funcionalidades existentes

- página de configurações;
- gestão de fontes;
- possibilidades preparadas para SQLite e providers remotos.

### Objetivo funcional

Ajustar comportamento local e preparar a plataforma para evolução estrutural.

## Mapa funcional por objetivo de produto

### Núcleo estável

- preparar dispositivo;
- importar jogos;
- gerenciar apps;
- manter histórico;
- exibir e controlar downloads.

### Núcleo de diferenciação

- catálogo Essentials com curadoria local;
- smart fill com target de espaço;
- ART Manager especializado em OPLM;
- modelo de fontes locais/remotas integradas.

### Áreas de expansão natural

- persistência relacional com SQLite;
- providers remotos mais robustos;
- cache e sincronização de fontes e metadados;
- UX mais assistiva para detecção de compatibilidade e organização.

## Resumo executivo para Speckit

O produto já possui uma base funcional de desktop para organização e preparação de mídia PS2/PS1. A arquitetura atual favorece desenvolvimento incremental com baixo acoplamento entre a UI e os serviços do processo principal. O maior valor percebido do produto está na combinação de:

- estrutura OPL correta;
- catálogo curado com regras e confirmação legal;
- download P2P controlado;
- gerenciamento de arte e integridade do dispositivo.
