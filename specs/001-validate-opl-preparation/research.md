# Research: Preparação OPL validada

## R1 — Arquitetura e fronteiras de privilégio

**Decision**: Manter Electron/React/TypeScript e executar scanner, parsers, filesystem, downloads, hashes, comandos de plataforma e PCSX2 no processo principal. Expor requests e eventos nominados pelo preload; usar React Query para snapshots e Zustand somente para seleção/eventos efêmeros.

**Rationale**: É a arquitetura atual e a única compatível com sandbox, contratos tipados e menor privilégio da constituição.

**Alternatives considered**: Scanner no renderer (rejeitado por segurança); servidor local separado (complexidade sem benefício atual); canal IPC genérico (superfície excessiva).

## R2 — Persistência do catálogo e relatórios

**Decision**: Usar JSON versionado, escrita em temporário + fsync + rename, sob `userData`, separando snapshots, overrides de Game ID, perfis, journals e relatórios. Identificar arquivos por dispositivo + caminho normalizado + tamanho + mtime + assinatura estrutural; adicionar SHA-256 quando calculado.

**Rationale**: Coerente com o baseline e suficiente para 500 jogos, auditável e migrável. Permite invalidar overrides quando o arquivo muda.

**Alternatives considered**: SQLite (adiado até consultas/volume justificarem migração); catálogo gravado no USB (violaria leitura inicial e portabilidade); somente memória (perde correções e último snapshot).

## R3 — ISO9660, mídia e Game ID

**Decision**: Validar PVD ISO9660 (`CD001`), árvore raiz e `SYSTEM.CNF`; extrair `BOOT2` e normalizar serial como `AAAA_000.00`. Classificar CD/DVD por evidência estrutural suportada; quando inconclusivo, usar `not-verified` e correção explícita.

**Rationale**: Nome e tamanho isolados não provam estrutura, mídia ou identidade.

**Alternatives considered**: Regex apenas no nome/primeiro MiB; seleção manual como autoridade; tamanho como regra única. Todos podem produzir falsos positivos.

## R4 — ZSO e capabilities OPL

**Decision**: Validar cabeçalho, índices e blocos ZSO e ler os setores ISO necessários por acesso lógico. Habilitar ZSO e filesystems somente por perfil OPL imutável identificado por versão/commit/hash.

**Rationale**: Suporte varia entre releases e variantes; extensão não é prova de arquivo válido.

**Alternatives considered**: Regra global por “latest”; converter tudo para ZSO; rejeitar ZSO. As duas primeiras são instáveis e a última elimina requisito explícito.

## R5 — USBExtreme e `ul.cfg`

**Decision**: Implementar codec binário isolado e testado por golden fixtures reconhecidas. Validar registros, encoding, ID, mídia, quantidade/ordem/tamanho das partes e órfãos. Em mutações, promover partes antes de um `ul.cfg` completo gerado em staging, preservando registros válidos desconhecidos.

**Rationale**: `ul.cfg` não é texto e a consistência abrange vários arquivos; rename isolado não forma transação multi-arquivo.

**Alternatives considered**: Editar bytes ad hoc; recriar catálogo descartando entradas desconhecidas; publicar `ul.cfg` antes das partes.

## R6 — Seleção de formato e nomes

**Decision**: Escolher ISO/ZSO/USBExtreme pela matriz do perfil, filesystem e limite real. Usar nome determinístico `<GAME_ID>.<Título>.iso|zso` com sanitização conservadora e limite definido pelo perfil. FAT32 acima do limite usa USBExtreme; filesystem compatível pode manter ISO grande.

**Rationale**: Evita decisões baseadas em extensão ou defaults mutáveis e respeita OPL/filesystem.

**Alternatives considered**: Sempre USBExtreme; sempre ISO; compressão automática. Todas perdem compatibilidade ou previsibilidade.

## R7 — Contiguidade multiplataforma

**Decision**: Definir adapter que retorna `verified-contiguous`, `verified-fragmented` ou `not-verified`, com método, extents e evidência. Linux usa FIEMAP; Windows usa retrieval pointers; macOS só declara resultado quando houver provedor homologado. Nova instalação pronta exige um extent físico por arquivo/parte.

**Rationale**: Ordem de cópia não prova alocação. A spec proíbe prontidão quando a plataforma não consegue verificar.

**Alternatives considered**: Inferir pelo término da cópia; chamar defrag genérico; usar somente tolerância do OPL a fragmentos. Todas conflitam com os critérios de segurança.

## R8 — Instalação e substituição transacionais

**Decision**: Usar staging invisível ao OPL, manifest/journal por operação, streaming SHA-256, fsync, validação estrutural e promoção no mesmo volume. Substituição preserva o anterior até o novo ser válido; USBExtreme promove partes antes do catálogo. Recuperação na inicialização resolve journals incompletos.

**Rationale**: Queda, cancelamento e falha multi-arquivo não podem publicar jogo parcial ou remover o funcional.

**Alternatives considered**: Cópia direta; staging externo para promoção final; rename sem journal. Não oferecem atomicidade ou preservação suficiente.

## R9 — Reorganização segura

**Decision**: Criar inventário imutável e backup completo verificado em outro armazenamento antes de remover qualquer conteúdo. Reescrever sequencialmente com journal, validar hash/estrutura/contiguidade e manter backup até auditoria final. Se o filesystem não permitir contiguidade, falhar com segurança e oferecer formatação/recriação como fluxo separado.

**Rationale**: Backup no mesmo dispositivo não protege contra falha do alvo; desfragmentação in-place viola a constituição.

**Alternatives considered**: Defrag genérico; mover arquivos no próprio volume; apagar após copiar sem verificar.

## R10 — Scanner e snapshots

**Decision**: Scanner recursivo somente leitura, confinado por `realpath`, sem seguir ciclos, links externos ou outro mount. Emitir itens provisórios por `scanId`; somente snapshot completo substitui o último vigente. Validar estrutura inicialmente e calcular hash completo sob demanda.

**Rationale**: Dá feedback em coleções grandes sem publicar catálogo parcial e preserva desempenho.

**Alternatives considered**: Resultado monolítico ao final; publicar parcial como atual; hash de todos os jogos a cada conexão.

## R11 — Artes OPLM

**Decision**: Indexar assets inclusive em subdiretórios/arquivos suportados; baixar para staging; validar status, tamanho, extensão e assinatura PNG; promover como `<GAME_ID>_<TIPO>.png`. Calcular completude pelo conjunto disponível na fonte, com COV/COV2 como capa.

**Rationale**: Corrige escrita direta, falso PNG e regra fixa de seis assets da implementação atual.

**Alternatives considered**: Confiar em extensão/HTTP; sobrescrever direto; usar contagem fixa.

## R12 — PCSX2 isolado e reproduzível

**Decision**: Detectar executável suportado, registrar versão e SHA-256, e lançar cada execução com `-datapath` exclusivo após `-testconfig`. Usar clone do memory card e imagem USB mínima com um jogo; suportar boot por memory card e ELF como fallback distintamente registrado.

**Rationale**: Não altera o perfil global nem os originais e preserva provenance. O modo ELF não prova a cadeia de boot do memory card.

**Alternatives considered**: `-portable` junto ao executável; cópia distribuída do PCSX2; anexar USB real; clone integral por padrão.

## R13 — BIOS, checkpoints e evidências

**Decision**: BIOS é selecionada pelo usuário; somente hash/região entram no relatório. Capturar stdout/stderr, log do emulador, timestamps, exit code e screenshots com hash. Checkpoints usam `passed|failed|not-verified`, ator `automatic|manual` e razão. Toda etapa obrigatória deve passar para aprovação PCSX2.

**Rationale**: Automação visual e configuração USB variam por versão. Evidência manual explícita é melhor que inferência.

**Alternatives considered**: Baixar/copiar BIOS; automação visual como única fonte; marcar sucesso na ausência de observação.

## R14 — Testes e adapters

**Decision**: Parsers e regras puras recebem testes unitários com fixtures; filesystem/journals recebem testes de integração em diretórios temporários; IPC/preload recebe testes de contrato; fragmentação e PCSX2 são adapters injetáveis com fakes, mantendo smoke tests reais condicionais.

**Rationale**: Cobertura determinística dos riscos sem exigir hardware/emulador em toda execução de CI.

**Alternatives considered**: Somente testes end-to-end; mocks de todos os parsers; testes manuais exclusivos.

## Sources

- [Open PS2 Loader repository](https://github.com/ps2homebrew/Open-PS2-Loader)
- [OPL USB mode documentation](https://github.com/ps2homebrew/Open-PS2-Loader/wiki/usb-mode)
- [PCSX2 command line](https://pcsx2.net/docs/advanced/cli/)
- [PCSX2 BIOS setup](https://pcsx2.net/docs/setup/bios/)
- [PCSX2 memory cards](https://pcsx2.net/docs/configuration/memcards/)
- [PCSX2 troubleshooting and logs](https://pcsx2.net/docs/troubleshooting/identify/)
