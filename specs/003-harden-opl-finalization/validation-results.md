# Resultados de validação — finalização OPL

Data: 2026-08-06. Host disponível: Linux x86_64, kernel 7.0.0-29-generic.

## Gates executados

| Comando                                | Resultado                                                           |
| -------------------------------------- | ------------------------------------------------------------------- |
| `pnpm build`                           | PASS — TypeScript, renderer Vite e main/preload Electron compilados |
| `pnpm lint`                            | PASS — zero erros                                                   |
| `pnpm test:run`                        | PASS — 84 arquivos, 216 testes                                      |
| `pnpm electron:build`                  | PASS — AppImage e pacote Debian x64                                 |
| suíte focada de segurança e desempenho | PASS — 2 arquivos, 5 testes                                         |

A primeira execução completa revelou e permitiu corrigir três regressões: contrato de IPC de arte com nomenclatura antiga, persistência excessiva no lote de 500 artes e fixture USBExtreme com CRC incompatível. A primeira tentativa do `.deb` também revelou a ausência do mantenedor obrigatório; o manifesto foi corrigido e o empacotamento repetido com sucesso.

## Cobertura dos cenários do quickstart

Os cenários automatizáveis 1–12 foram exercitados pela suíte integral, incluindo exclusão mútua por dispositivo, limites FAT32/USBExtreme, ISO/ZSO, nomenclatura, migração transacional, HTTP Range, recuperação de download/finalização, fragmentação desconhecida ou comprovada, lote de 500 artes, ZIP hostil, IPC/reload/carga e shutdown. O teste de desempenho manteve RSS abaixo do teto de 512 MiB e limitou progresso a no máximo um evento imediato e um coalescido por operação.

As etapas que exigem mídia física, encerramento manual do aplicativo ou hardware PS2 permanecem explicitamente fora da automação. Não havia neste host um volume removível descartável FAT32/exFAT/NTFS; portanto, esses casos são `not-verified`, nunca promovidos a sucesso. A evidência e os limites estão em `docs/opl-finalization-platform-matrix.md`.

## Artefatos produtivos

| Artefato                            | Tamanho aproximado | SHA-256                                                            |
| ----------------------------------- | -----------------: | ------------------------------------------------------------------ |
| `release/OPL Forge-0.1.0.AppImage`  |            138 MiB | `d0612ac740a7225f0871dc870673c33098658c2953cc53392dee4dd39ce3ae7c` |
| `release/opl-forge_0.1.0_amd64.deb` |            105 MiB | `74b0f10dbc43fa116022e6daec484b06a7003bf75962c07549b2a7166acb47a9` |

Advertências não bloqueantes: o renderer possui um chunk minificado de 596 KiB e, sem asset de marca fornecido, o Electron usa o ícone padrão.
