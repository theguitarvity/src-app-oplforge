# Matriz de compatibilidade de validação

| Plataforma | Contiguidade               | Evidência                               | PCSX2                          | Imagem USB                                   | Limitação segura                                                       |
| ---------- | -------------------------- | --------------------------------------- | ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------- |
| Linux      | `filefrag -v`              | contagem de extents por arquivo         | PCSX2 2.x e 1.7 Qt por adapter | `mkfs.fat` + `mcopy`                         | Sem `filefrag`/mtools: `not-verified`; nunca pronto por presunção      |
| Windows    | `fsutil file queryextents` | VCN/extents; pode exigir permissão      | PCSX2 2.x e 1.7 Qt por adapter | requer ferramentas FAT homologadas no pacote | Permissão negada ou saída desconhecida: `not-verified`                 |
| macOS      | não homologada             | nenhuma API pública estável configurada | PCSX2 2.x e 1.7 Qt por adapter | requer ferramentas FAT homologadas no pacote | Contiguidade permanece `not-verified`; hardware real continua separado |

O executável PCSX2 é aceito apenas pela allowlist de nomes/adapters, passa por `-version`, SHA-256 e `-testconfig`, e executa com `-datapath` isolado. BIOS é sempre fornecida pelo usuário e registrada somente por hash, tamanho e região inferida. O resultado PCSX2 nunca substitui o smoke test em PS2 real.

ZSO depende da capability do perfil OPL exato. FAT32 usa USBExtreme para imagens acima de 4 GiB. Falta de ferramenta, permissão ou evidência produz `not-verified`, não sucesso.
