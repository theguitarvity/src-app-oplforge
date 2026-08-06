# Finalização OPL confiável

## Fluxo

O Essentials e o Download Manager enfileiram tarefas persistentes. HTTP baixa para `userData/opl-finalization/cache/<task>/payload.part`, com Range/If-Range e checkpoint. Só depois a imagem é inspecionada, planejada e instalada por um único writer para a identidade física do dispositivo.

Uma imagem não fica `ready` ao terminar o download. Ela passa por validação, planejamento, instalação, hash, verificação de fragmentação, catálogo e enfileiramento independente de artes.

## Nomes e USBExtreme

- Game ID vem do `SYSTEM.CNF` encontrado pela árvore ISO9660, inclusive em ZSO por leitura randômica.
- O nome é `GAME_ID.Título.iso|zso`, com título ASCII conservador de até 32 bytes.
- A tela **Nomes OPL** audita a biblioteca existente antes de qualquer mudança. Renomes usam journal, nome temporário, hash e rollback; não reescrevem o conteúdo.
- FAT32 aceita arquivo até `0xffffffff` bytes. ISO maior usa USBExtreme com partes `0x3ff00000`, CRC32 compatível com OPL Manager, suffix do Game ID e `ul.cfg` promovido por último.

## Artes

O índice é persistente e paginado. Downloads usam cache `.part`, single-flight e LRU. ZIP é lido por central directory/Range quando disponível e extraído por entrada. Jobs suportam até 500 jogos, oito tipos (`ICO`, `COV`, `COV2`, `LAB`, `LGO`, `SCR`, `SCR2`, `BG`), concorrência três, pause/retry e estado por asset.

## Recuperação

No startup, journals e tarefas ativas são reconciliados antes dos workers. Dispositivo ausente vira `waiting-device`. No shutdown, novos trabalhos param e checkpoints são sincronizados. `_OPL_FORGE_STAGING` legado é apenas inventariado; limpeza exige `LIMPAR STAGING LEGADO`.

## Execução

Desenvolvimento: `pnpm electron:dev` (ou `pnpm electron:dev:linux` quando o sandbox do host exigir). Build produtiva: `pnpm electron:build`. Artefatos são gravados em `release/` conforme `electron-builder.yml`.
