# Segurança da finalização OPL

## Dependência ZIP

`yauzl` 3.4.0 e `@types/yauzl` 3.4.0 estão fixados no lockfile. A biblioteca é MIT e foi escolhida por oferecer `lazyEntries` e streams por entrada. A extração rejeita paths absolutos, traversal, symlinks, entradas acima de 16 MiB, total acima de 2 GiB e razão de compressão acima de 200:1. O arquivo sai por `.part` e só é promovido depois da validação.

## Fronteiras de confiança

- O renderer envia IDs, filtros e decisões; cache, staging, partes, backups e destinos são derivados no processo principal.
- URLs de download aceitam apenas HTTP(S) sem credenciais embutidas.
- Eventos, histórico e logs removem URLs, tokens e paths internos.
- Cache e staging usam roots capturados, identidade de volume e bloqueio contra symlink/traversal.
- Colisão, descarte, substituição e adequação de nomes exigem literais explícitos.

## Auditoria de dependências

Em 2026-08-06, `pnpm audit --prod` manteve dois advisories transitivos sem atualização compatível publicada: `ip@2.0.1` via WebTorrent (o advisory declara 2.0.2, inexistente no registry) e React Router 7 no modo RSC. O Forge não usa React Server Components, roda `createHashRouter` sobre arquivos locais e não usa `ip` como decisão de autorização. `ip-address`, `fast-uri` e `js-yaml` foram sobrescritos para versões corrigidas em `pnpm-workspace.yaml`.

## Limitações

Contiguidade só é afirmada quando o adapter da plataforma retorna evidência verificável. Resultado desconhecido aparece como `not-verified`; candidata comprovadamente fragmentada não é promovida. O worker torrent durável preserva metadata/seleção e rechecagem, mas a execução produtiva de novos torrents permanece desabilitada quando o adapter não está disponível, retornando erro retryable em vez de escrever diretamente no USB.
