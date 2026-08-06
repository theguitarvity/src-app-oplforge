# Matriz de plataforma da finalização OPL

| Plataforma/filesystem                      |                         Build |                Testes sintéticos |                                                  Contiguidade real | Estado                           |
| ------------------------------------------ | ----------------------------: | -------------------------------: | -----------------------------------------------------------------: | -------------------------------- |
| Linux x86_64 atual / filesystem temporário |   AppImage e `.deb` aprovados |                216/216 aprovados | Adapter FIEMAP/filefrag coberto por fixtures; sem volume removível | `not-verified` fora das fixtures |
| Linux / FAT32 removível                    | Não disponível neste ambiente | Fronteiras e USBExtreme cobertos |                                   Requer volume descartável físico | Não certificado aqui             |
| Windows / FAT32, exFAT, NTFS               |             Cross-configurado |     Contratos portáveis cobertos |                                         Requer host/volume Windows | Não certificado aqui             |
| macOS / exFAT                              |             Cross-configurado |     Contratos portáveis cobertos |                                           Requer host/volume macOS | Não certificado aqui             |

Ausência de certificação não é convertida em sucesso: o resultado operacional permanece `not-verified`.

## Evidências do host disponível

- `filefrag` disponível em `/usr/sbin/filefrag`.
- Build Electron Linux x64 concluída em 2026-08-06.
- Testes cobrem FAT32 nas fronteiras `0xffffffff`, divisão USBExtreme em `0x3ff00000`, exFAT/NTFS como perfis de arquivo grande e adapters Linux/Windows/macOS.
- Nenhum volume removível descartável FAT32, exFAT ou NTFS estava montado. Por segurança, o filesystem de desenvolvimento não foi formatado nem usado como substituto para certificação física.
- Hardware real PS2/OPL não estava conectado; a validação de console continua sendo um checkpoint manual obrigatório.
