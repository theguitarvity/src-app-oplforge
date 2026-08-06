# Quickstart: validar a preparação OPL

Este guia valida o desenho após implementação. Use somente fixtures sintéticas/homebrew e BIOS legalmente extraída. Não coloque jogos comerciais, BIOS ou imagens pessoais no repositório.

## Prerequisites

- Node.js 22 e pnpm disponíveis.
- Dependências do projeto instaladas.
- Dois diretórios/volumes temporários: dispositivo de teste e backup externo distinto.
- Fixtures válidas e inválidas para ISO9660, ZSO, `ul.cfg`, partes USBExtreme e PNG.
- Para o smoke PCSX2: instalação homologada, BIOS própria e memory card de teste com OPL oficial identificado.

Referências: [modelo de dados](data-model.md) e [contrato IPC](contracts/opl-api.md).

## Quality gates

```bash
pnpm lint
pnpm test:run
pnpm build
```

Esperado: lint, testes, typecheck e builds renderer/main/preload concluídos sem exceções.

## 1. Catálogo somente leitura

1. Monte uma árvore de fixture com `DVD`, `CD`, `ART`, ISO/ZSO válidos e inválidos, subdiretórios, link em ciclo e USBExtreme completo/incompleto.
2. Registre hashes e metadados de todos os arquivos antes da leitura.
3. Selecione o dispositivo e observe batches provisórios.
4. Confirme que o snapshot anterior continua atual até `scan:completed`.
5. Compare hashes, nomes, paths e mtimes depois da leitura.

Esperado: nenhum arquivo mudou; jogos válidos e desconhecidos aparecem; subdiretórios são recursivos mas links não escapam; partes UL são consolidadas; erros recebem findings; hash completo aparece `not-calculated`.

## 2. Atualização, falha e override

1. Corrija manualmente o ID de uma fixture sem Game ID.
2. Atualize e reconecte sem alterar o arquivo: a associação permanece.
3. Mude caminho, tamanho ou conteúdo: a associação é invalidada.
4. Adicione/remova um jogo externamente e atualize.
5. Durante outro scan, remova o dispositivo ou torne `DVD` inacessível.

Esperado: diff reflete mudanças externas; scan interrompido não substitui último snapshot; nenhuma mutação ocorre; override alterado exige reconfirmação.

## 3. Escala e responsividade

Execute o catálogo sobre fixture com 500 jogos mistos e exercite busca, seleção e filtros enquanto o scan produz itens provisórios.

Esperado: 95% das interações observadas completam em até 1 s, todos os itens aparecem sem truncamento e hash completo só inicia sob demanda.

## 4. Importação ISO e USBExtreme

1. Planeje uma ISO menor que o limite: confira PVD, `SYSTEM.CNF`, mídia, Game ID, SHA-256, nome e destino.
2. Confirme e induza cancelamento/falha em staging.
3. Repita com imagem maior que o limite FAT32 para selecionar USBExtreme.
4. Simule queda entre promoção das partes e promoção do `ul.cfg`, depois reinicie a recuperação.

Esperado: arquivos parciais nunca ficam visíveis; jogo anterior permanece; hashes conferem; partes precedem `ul.cfg`; journal recupera estado conhecido.

## 5. Fragmentação e reorganização

1. Use fakes determinísticos para os três resultados do adapter: contiguous, fragmented e not-verified.
2. Em plataforma homologada, teste uma fixture deliberadamente fragmentada.
3. Planeje reorganização usando armazenamento externo diferente e induza falha antes/depois do backup verificado.

Esperado: apenas contiguous pode ficar pronto; unknown não vira sucesso; nenhuma reescrita ocorre antes do backup; falhas mantêm dados recuperáveis; formatação nunca inicia implicitamente.

## 6. Artes

Sirva índice/arquivos controlados: PNG válido, HTML, vazio, assinatura inválida, asset em subdiretório e arquivo compactado suportado. Inclua jogo em `DVD`, `CD`, ZSO e USBExtreme.

Esperado: somente PNG válido é promovido como `<GAME_ID>_<TIPO>.png`; arte anterior sobrevive a erro; COV/COV2 define capa; complete usa os tipos disponíveis e não quantidade fixa.

## 7. PCSX2 isolado

1. Selecione executável homologado, BIOS própria e clone de memory card.
2. Revise o plano sanitizado e inicie por memory card.
3. Confirme que foi criado datapath exclusivo e imagem USB mínima com um jogo.
4. Percorra BIOS, OPL, USB, lista, ID/título, capa, seleção, ausência de erro e marco.
5. Use confirmação manual onde automação for inconclusiva; encerre e preserve logs/screenshots imediatamente.

Esperado: originais mantêm hash; relatório contém versão/hash do PCSX2 e OPL, apenas hash/região da BIOS, checkpoints e artefatos; modo ELF fallback é distinguido; imagem emulada não prova fragmentação física.

## 8. Relatório e hardware real

Gere relatório sem teste físico, depois anexe um smoke test manual de PS2 real com modelo, adaptador, OPL, detecção, arte, fragmentação e marco.

Esperado: estrutural, PCSX2 e hardware permanecem independentes; ausência de hardware aparece `not-run`; aprovação PCSX2 nunca garante hardware; relatório não contém BIOS, jogo ou caminhos pessoais desnecessários.

## 9. Atualização oficial do OPL

1. Registre uma release oficial com versão/commit, variante, URL e SHA-256 do ELF.
2. Tente registrar origem não oficial, hash divergente e alias apenas `latest`.
3. Planeje atualização de um clone de memory card, cancele e confirme em execuções separadas.

Esperado: origens ou hashes inválidos são rejeitados; nenhuma modificação ocorre antes da confirmação; cancelamento preserva o cartão anterior; versão e hash exatos aparecem no perfil e relatório.

## 10. Métricas temporizadas e usabilidade

1. Meça as nove etapas PCSX2 do início do perfil ao último checkpoint, pausando o cronômetro apenas para criação/cópia inicial e espera manual solicitada.
2. Execute o fluxo completo de preparação/relatório com pelo menos 20 participantes representativos e sem ajuda do moderador.
3. Em sessão separada, peça a pelo menos 20 participantes que selecionem um dispositivo de até 500 jogos e localizem um título indicado.

Esperado: validação PCSX2 líquida em até 20 minutos; pelo menos 95% concluem o fluxo completo sem intervenção; pelo menos 95% localizam o jogo em até 3 minutos. Registre amostra, ambiente, falhas e tempos anonimizados.

## Evidence to retain

- Saídas dos três quality gates.
- Manifestos/journals anonimizados e resultados de recovery.
- Matriz de adapters/plataformas e casos `not-verified`.
- Relatório sintético completo e hashes dos artefatos PCSX2.
- Exceções documentadas com impacto, responsável e prazo, caso algum gate não passe.
