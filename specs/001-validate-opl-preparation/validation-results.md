# Resultados de validação — preparação OPL

Data: 2026-08-02 (America/Sao_Paulo)

## Gates automatizados

| Gate            | Resultado | Evidência                                     |
| --------------- | --------- | --------------------------------------------- |
| `pnpm lint`     | aprovado  | ESLint sem erros                              |
| `pnpm test:run` | aprovado  | 32 arquivos, 70 testes na rodada final        |
| `pnpm build`    | aprovado  | TypeScript, renderer Vite, main/preload tsup  |
| Linux unpacked  | aprovado  | `release/linux-unpacked`, Electron 42.4.1 x64 |

O build emitiu aviso não bloqueante de chunk renderer acima de 500 kB (aprox. 564 kB). Impacto: carregamento inicial; responsável: frontend; prazo recomendado: antes de uma otimização de distribuição, usando code splitting.

## Fluxos 1–9

Os fluxos foram cobertos por fixtures sintéticas e fakes, sem BIOS ou jogos comerciais:

1. catálogo read-only, recursão, symlink e preservação de snapshot;
2. override por identidade, refresh, remoção externa e diretório inacessível;
3. benchmark de 500 itens;
4. staging/promoção/rollback de ISO e USBExtreme;
5. adapters de fragmentação e reorganização com backup/hash/recovery;
6. índice aninhado/ZIP, PNG/HTML/vazio e promoção transacional de artes;
7. PCSX2 fake com datapath, imagem mínima, nove checkpoints e logs;
8. relatório sanitizado e smoke físico manual modelado;
9. origem/hash exatos do OPL e preservação do memory card anterior.

Não foi executado smoke com BIOS, PCSX2 real ou PS2 real neste ambiente. Esses resultados permanecem `not-run`/`not-verified`, nunca aprovados por inferência.

## Operações longas

| Operação      | Progresso/cancelamento               | Persistência/recuperação                               |
| ------------- | ------------------------------------ | ------------------------------------------------------ |
| Importação    | plan/confirm/cancel                  | manifest+journal, staging, rollback e startup recovery |
| Catálogo      | provisional/complete/failed e cancel | snapshot atômico; último completo preservado           |
| Artes         | plan/confirm e erros por arquivo     | staging; arte válida anterior preservada               |
| PCSX2         | nove checkpoints e stop/timeout      | datapath, stdout/stderr, screenshots e hashes          |
| Reorganização | plan/confirm/cancel                  | backup externo, journal e registry de startup recovery |
| Relatório     | revision e stale check               | JSON versionado e export sanitizado                    |

Logs, progresso e eventos usam o audit JSONL persistente; histórico usa escrita temporária, fsync e rename.

## Plataformas e empacotamento

- Linux x64: empacotamento unpacked executado com sucesso.
- Windows x64/arm64: configuração NSIS presente; execução deve ocorrer em runner Windows. Contiguidade depende de `fsutil`; falha de permissão produz `not-verified`.
- macOS x64/arm64: configuração DMG presente; assinatura/empacotamento deve ocorrer em runner macOS. Contiguidade física permanece `not-verified`.
- A imagem USB de teste requer `mkfs.fat` e `mcopy`; ausência de qualquer ferramenta impede o plano em vez de presumir sucesso.

Detalhes: [matriz de compatibilidade](../../docs/compatibility-validation.md).

## Validação humana pendente (SC-006/SC-017)

Os dois estudos moderados com pelo menos 20 participantes cada não foram executados. Não há participantes ou resultados disponíveis neste ambiente, e evidência não foi simulada.

- Impacto: as metas de 95% sem ajuda e 95% de localização em até 3 minutos ainda não estão comprovadas.
- Responsável sugerido: pesquisa de produto/UX.
- Prazo: antes de declarar os critérios SC-006 e SC-017 aprovados para release.
- Protocolo: seguir o fluxo 10 de `quickstart.md`, registrar amostra, ambiente, tempos e falhas anonimizados.
