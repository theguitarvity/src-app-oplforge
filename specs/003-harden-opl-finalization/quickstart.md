# Quickstart: Validar finalização OPL confiável e resiliente

Este guia valida a feature depois da implementação. Use somente fixtures sintéticas ou backups legalmente autorizados; nunca use a única cópia de um dispositivo.

## Prerequisites

- Node.js 22 e pnpm 9+.
- Dependências instaladas com `pnpm install`.
- Espaço local suficiente para cache de imagens de teste.
- Volumes descartáveis FAT32 e exFAT/NTFS para certificação física.
- Linux: `filefrag` disponível; Windows: ferramenta homologada pela feature 002.
- Servidor HTTP local de fixtures com suporte configurável a Range, ETag, falha e throttling.

Modelo e contratos:

- [data-model.md](./data-model.md)
- [contracts/opl-finalization-ipc.md](./contracts/opl-finalization-ipc.md)
- [research.md](./research.md)

## Baseline gates

```bash
pnpm build
pnpm lint
pnpm test:run
```

Expected: checagem de tipos/build, lint e suíte vigente passam antes dos testes físicos.

## Focused automated suites

Os arquivos abaixo são os alvos previstos pelo plano; `$speckit-tasks` definirá sua ordem de criação.

```bash
pnpm vitest run \
  tests/unit/download-state-machine.test.ts \
  tests/unit/download-scheduler.test.ts \
  tests/unit/http-resume.test.ts \
  tests/unit/usbextreme-compatibility.test.ts \
  tests/unit/opl-canonical-naming.test.ts \
  tests/unit/art-index.test.ts \
  tests/unit/art-cache.test.ts \
  tests/unit/art-sync-job.test.ts

pnpm vitest run tests/contract/opl-finalization-ipc.contract.test.ts

pnpm vitest run \
  tests/integration/durable-download-recovery.test.ts \
  tests/integration/essentials-finalization.test.ts \
  tests/integration/opl-naming-migration.test.ts \
  tests/integration/art-batch-sync.test.ts \
  tests/integration/pipeline-crash-recovery.test.ts
```

Expected: todas as suítes passam com filesystem, HTTP, torrent, dispositivo, fragmentação e relógio controlados; nenhuma depende de mount pessoal.

## Scenario 1 — Reproduzir e eliminar gravação concorrente

Fixture:

- 20 ISOs sintéticas, cinco acima de 4 GiB por sparse fixture/stream controlado;
- mesmo dispositivo descartável;
- scheduler instrumentado para registrar intervalos de escrita por `deviceId`.

Steps:

1. Selecione todos os itens no Essentials.
2. Confirme a autorização legal de cada item.
3. Acompanhe transferências e finalizações.
4. Exporte timeline dos writers e diagnóstico físico final.

Expected:

- concorrência de rede nunca excede o limite configurado;
- exatamente um writer de instalação fica ativo no dispositivo;
- nenhum item aparece `ready` em `downloaded`, `validating` ou `installing`;
- toda instalação verificável pronta termina `contiguous`;
- falha individual não interrompe o restante do lote.

## Scenario 2 — Fronteira FAT32 e USBExtreme

Use imagens sintéticas com `0xffffffff - 1`, `0xffffffff`, `0xffffffff + 1` e tamanho para múltiplas partes.

Steps:

1. Planeje cada imagem para FAT32.
2. Repita em exFAT/NTFS com perfil que suporta arquivo único.
3. Abra o `ul.cfg` e correlacione todas as partes.
4. Compare o resultado com fixtures derivadas da convenção do OPL Manager.

Expected:

- nenhuma tentativa de arquivo único excede o limite FAT32;
- em FAT32, imagem incompatível usa partes de `0x3ff00000` bytes, salvo a última;
- stem usa CRC32 do exato título gravado e Game ID sem os três primeiros caracteres;
- registro tem 64 bytes, bytes desconhecidos existentes são preservados e `ul.cfg` é promovido por último;
- hash concatenado das partes coincide com a origem;
- exFAT/NTFS não converte desnecessariamente quando arquivo único é permitido.

## Scenario 3 — Game ID e nomenclatura canônica

Fixtures:

- `SYSTEM.CNF` em posição fora dos primeiros 4 MiB;
- nome remoto com ID divergente;
- ZSO com nome sem ID e `SYSTEM.CNF` válido;
- títulos Unicode, símbolos, vazio após sanitização e colisões.

Expected:

- parser encontra o boot pela árvore ISO9660 em ISO e ZSO;
- ID interno prevalece e a divergência fica visível;
- nome final segue `SLUS_123.45.Título.iso|zso`;
- título final respeita 32 bytes conservadores;
- item sem ID autoritativo aguarda decisão e não é promovido;
- colisão nunca sobrescreve silenciosamente.

## Scenario 4 — Adequação da biblioteca existente

1. Monte `CD`/`DVD` com nomes canônicos, formato novo, arbitrários, duplicados e conflitantes.
2. Capture hashes, mtimes e evidência de extents.
3. Execute auditoria e cancele o primeiro plano.
4. Confirme um plano sem conflitos.
5. Injete crash antes/depois de cada intent/outcome de rename.

Expected:

- auditoria é somente leitura;
- cancelamento não altera a árvore;
- renames preservam hash e extents;
- duplicatas por Game ID permanecem instalações separadas;
- restart restaura ou conclui somente estado provado pelo journal;
- nenhum nome temporário vira instalação ativa.

## Scenario 5 — HTTP Range e identidade da origem

Execute contra servidor local controlado:

1. `206` correto com ETag estável.
2. Servidor ignora Range e retorna `200`.
3. ETag muda entre tentativas.
4. `Content-Range` possui offset incorreto.
5. Conexão cai após mais de 50%.

Expected:

- `206` reutiliza pelo menos 99% dos bytes confirmados;
- `200`, ETag alterado ou range incoerente nunca faz append;
- somente o item afetado reinicia;
- pause sincroniza parcial e interrompe tráfego;
- cancel realmente aborta HTTP; política `keep` preserva e `discard` exige confirmação;
- credenciais/query sensível não aparecem em logs ou eventos.

## Scenario 6 — Torrent restart

1. Baixe parte de um torrent sintético com seleção de arquivos.
2. Finalize o processo sem shutdown gracioso.
3. Reinicie a aplicação.

Expected:

- tarefa, infoHash, seleção e staging reaparecem;
- WebTorrent revalida peças no mesmo cache antes de avançar;
- tarefa começa pausada/recuperada e o scheduler decide quando continuar;
- arquivos não selecionados permanecem fora da instalação.

## Scenario 7 — Crash recovery em todas as fases

Use child process/fault injection para encerrar em:

- checkpoint de transferência;
- após download, antes da validação;
- staging de instalação;
- candidate verified;
- commit intent;
- promoção de parte USBExtreme;
- troca de `ul.cfg`;
- verificação ativa;
- instalação de arte.

Expected:

- fila reaparece com uma tarefa por item;
- antes de commit, versão ativa permanece inalterada;
- depois de commit intent, recovery restaura a última versão válida ou declara `recovery-pending`;
- nenhum parcial recebe nome final;
- item pronto não é baixado novamente;
- dispositivo ausente produz `waiting-device`, sem redirecionar para volume de mesmo rótulo.

## Scenario 8 — Fragmentação persistente

Configure adapter para retornar fragmentado para candidato e/ou ativo.

Expected:

- candidata comprovadamente fragmentada não é promovida;
- ativo fragmentado após promoção dispara rollback;
- tarefa termina com `STILL_FRAGMENTED`, não `ready`;
- plataforma sem verificação apresenta `not-verified`, nunca `contiguous` inferido;
- ação de reparo aponta para a feature 002 sem iniciar escrita não confirmada.

## Scenario 9 — Índice e sincronização de 500+ jogos

Fixture de artes:

- mais de 500 Game IDs;
- oito tipos;
- ZIP grande com várias artes compartilhadas;
- PNG, JPEG, arte já existente e ausente.

Expected:

- consulta é paginada/em blocos de até 500;
- mesmo ZIP é baixado uma vez por revisão e compartilhado por single-flight;
- RSS fica abaixo de 512 MiB acima da baseline e não acompanha o tamanho total do ZIP;
- PNG válido é preservado; JPEG válido vira PNG canônico;
- `missing-only` preserva arte válida existente;
- todas as saídas seguem `${GAME_ID}_${TYPE}.png`;
- progresso concilia encontrados, instalados, preservados, ausentes e falhos.

## Scenario 10 — Segurança de ZIP e arte

Teste entries com traversal absoluto/relativo, symlink, CRC errado, tamanho declarado falso, razão de compressão extrema, excesso de entries e imagem inválida.

Expected:

- traversal/symlink nunca escreve fora de cache/staging/ART;
- limite real durante stream prevalece sobre header;
- ZIP bomb, CRC e imagem inválida são rejeitados com código específico;
- arte existente permanece intacta;
- falha de uma entry não derruba o processo nem corrompe outros jobs.

## Scenario 11 — IPC, reload e carga

```bash
pnpm vitest run \
  tests/contract/opl-finalization-ipc.contract.test.ts \
  src/pages/DownloadsPage.test.tsx \
  src/pages/ArtManagerPage.test.tsx
```

Expected:

- schemas rejeitam extras, traversal, URLs não permitidas, revisão stale e confirmação errada;
- renderer não recebe paths internos nem API genérica;
- eventos respeitam 4 Hz por operação e sequência monotônica;
- reload reconstrói fila/jobs por snapshot, mesmo com gap de eventos;
- 100 tarefas não congelam a UI por mais de 2 segundos;
- erro de callback é capturado e não gera rejeição não tratada.

## Scenario 12 — Shutdown coordenado

1. Feche normalmente com HTTP e torrent ativos.
2. Repita forçando prazo de shutdown.
3. Reabra.

Expected:

- novas tarefas deixam de iniciar;
- ativos são abortados/pausados, checkpoints são sincronizados e WebTorrent fecha dentro do prazo;
- na reabertura, nenhum item aparece pronto sem prova;
- falha global produz log diagnóstico redigido e shutdown controlado, não continuação em estado desconhecido.

## Cross-platform certification

### Linux

- FAT32 e exFAT removíveis; `filefrag` homologado.
- Validar unplug, remount em path diferente, fsync/rename e AppImage.

### Windows

- FAT32, exFAT e NTFS; volume ID e verificador homologado.
- Validar lock/antivírus, letras diferentes e build NSIS.

### macOS

- exFAT; Intel e Apple Silicon.
- Instalação pode concluir `not-verified`; nenhuma mensagem afirma contiguidade sem prova.

## Final evidence

Anexe ao PR:

- saída de build, lint e testes;
- timeline comprovando um writer por dispositivo;
- relatório das fronteiras FAT32 e fixtures USBExtreme compatíveis;
- evidência de restart em cada fase;
- perfis de memória/rede do lote de artes;
- relatório de segurança ZIP e paths;
- matriz OS/filesystem e limitações de verificação física;
- estudo com dez usuários e taxa mínima de 90% para compreensão dos estados e retry.
