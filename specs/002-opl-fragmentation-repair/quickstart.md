# Quickstart: Validar diagnóstico e correção de fragmentação OPL

Este guia valida a feature depois da implementação. Ele não autoriza testes destrutivos em dispositivos com dados únicos.

## Prerequisites

- Node.js 22 e pnpm 9+.
- Dependências instaladas com `pnpm install`.
- Fixtures sintéticas; nunca use conteúdo protegido ou a única cópia de um jogo.
- Para correção física: volume removível descartável FAT32/exFAT com backup externo e combinação OS/filesystem homologada.
- Linux: `filefrag` disponível e probe aprovado no volume.
- Windows: `fsutil file queryextents` disponível e probe aprovado no volume.
- macOS: esperado `não verificável`; correção deve permanecer bloqueada.

Modelo e contrato: [data-model.md](./data-model.md) e [contracts/fragmentation-repair-ipc.md](./contracts/fragmentation-repair-ipc.md).

## Baseline gates

```bash
pnpm build
pnpm lint
pnpm test:run
```

Expected: typecheck/build, lint e toda a suíte vigente passam antes dos testes em mídia real.

## Focused automated suites

```bash
pnpm vitest run \
  tests/unit/fragmentation-capability.test.ts \
  tests/unit/fragmentation-diagnostic.test.ts \
  tests/unit/fragmentation-plan.test.ts \
  tests/unit/fragmentation-journal.test.ts \
  tests/unit/fragmentation-transaction.test.ts

pnpm vitest run tests/contract/fragmentation-repair-ipc.contract.test.ts

pnpm vitest run \
  tests/integration/fragmentation-diagnosis.test.ts \
  tests/integration/fragmentation-repair.test.ts \
  tests/integration/fragmentation-recovery.test.ts
```

Expected: todas as suítes passam com adapters/ferramentas falsas e fault injection. Testes automatizados não devem depender de um mount pessoal.

## Scenario 1 — Read-only diagnosis

Fixture:

- ISO contígua e ISO fragmentada;
- ZSO válida;
- USBExtreme com múltiplas partes, incluindo apenas uma fragmentada;
- parte ausente, imagem inválida e adapter não verificável;
- dois jogos com o mesmo Game ID em caminhos diferentes;
- ART e CFG associados.

Steps:

1. Capture a árvore, tamanhos, mtimes e hashes de todos os arquivos.
2. Abra a página independente de fragmentação e selecione o dispositivo.
3. Execute apenas o diagnóstico.
4. Compare a árvore e os fingerprints com o snapshot inicial.

Expected:

- seis estados agregados são alcançáveis e possuem evidência;
- USBExtreme com parte afetada é `partially-fragmented`;
- duplicatas permanecem instalações separadas;
- resumo concilia total, estados, espaço e arquivos;
- nenhum arquivo do dispositivo é criado, removido ou modificado.

## Scenario 2 — Plan and explicit confirmation

1. Escolha uma ISO fragmentada e solicite correção individual.
2. Verifique dispositivo, arquivos, riscos, espaço, recuperação e exclusões.
3. Tente confirmar com texto incorreto e revisão stale.
4. Confirme com `CORRIGIR FRAGMENTAÇÃO` e revisão vigente.

Expected:

- texto incorreto retorna `CONFIRMATION_REQUIRED` sem escrita;
- revisão stale retorna `STALE_REVISION` sem escrita;
- plano só pode ser consumido uma vez;
- somente confirmação válida inicia staging.

## Scenario 3 — ISO/ZSO successful repair

1. Use adapter falso que inicialmente retorna fragmentado e retorna contíguo para a candidata/ativo.
2. Corrija uma ISO e depois um ZSO.
3. Observe eventos e relatório.

Expected:

- candidata fica no mesmo filesystem;
- tamanho, SHA-256 e estrutura coincidem antes da promoção;
- original/backup permanece até commit durável;
- ativo é diagnosticado novamente como contíguo;
- ART, CFG e demais auxiliares mantêm hash e mtime;
- relatório registra estado anterior/final, hashes e arquivos realmente modificados.

## Scenario 4 — Persistent fragmentation

Configure o adapter para retornar fragmentado também para a candidata.

Expected:

- candidata nunca recebe o caminho ativo;
- original permanece byte a byte igual;
- outcome é `unchanged` ou `failed` com `STILL_FRAGMENTED`, nunca `corrected`;
- relatório contém orientação acionável.

## Scenario 5 — Sequential batch

1. Planeje três jogos elegíveis.
2. Injete arquivo bloqueado no segundo.
3. Altere o espaço livre antes do terceiro.

Expected:

- no máximo um jogo possui candidato ativo por vez;
- espaço é revalidado antes de cada jogo;
- primeiro pode concluir, segundo falha isoladamente e terceiro é bloqueado por espaço;
- contagens e resultado individual conciliam todos os itens.

## Scenario 6 — Multipart USBExtreme

1. Crie instalação com três partes, duas fragmentadas e `ul.cfg` válido.
2. Confirme a correção.
3. Injete falha após cada possível boundary de journal/rename em execuções separadas.

Expected:

- somente partes fragmentadas são regravadas;
- todas as candidatas são validadas antes da primeira promoção;
- partes contíguas permanecem inalteradas;
- `ul.cfg` permanece inalterado quando nomes/contagem não mudam;
- se indispensável, `ul.cfg` é promovido por último e participa do rollback;
- após recovery, existe conjunto original válido ou estado explícito `recovery-pending`, nunca jogo declarado corrigido parcialmente.

## Scenario 7 — Crash, unplug and restart recovery

Use fault injection/child process para terminar a execução em cada estado do journal e simule remoção do mount.

Expected:

- antes de `commit-intent`, original permanece ativo e nenhuma candidata é promovida;
- entre `commit-intent` e `active-validating`, restart tenta rollback idempotente;
- dispositivo ausente gera `recovery-pending` e instruções;
- reconexão nunca retoma cópia ou promoção;
- nova tentativa exige novo diagnóstico, plano e confirmação;
- journal corrompido não causa remoção automática.

## Scenario 8 — Capability matrix

### Linux

Execute parser contra golden outputs válidos, localizados/malformados, permissão negada e ferramenta ausente. Em volume de teste FAT32/exFAT, valide que sync/close precede o mapeamento e que cobertura/adjacência são verificadas.

### Windows

Valide seleção real do adapter Windows e parser de ranges VCN/LCN completos, gaps, overlaps, permissão negada e filesystem não suportado.

### macOS

Expected: todos os jogos que dependem de extents ficam `unverifiable`; planejar correção retorna `CAPABILITY_UNAVAILABLE` sem escrita.

Uma combinação só entra na allowlist de correção depois dos testes reais documentarem ferramenta/versão, OS, filesystem/driver, flush, rename, unplug e recuperação.

## Scenario 9 — UI and accessibility

```bash
pnpm vitest run src/app/App.test.tsx src/pages/FragmentationRepairPage.test.tsx
```

Expected:

- fluxo completo funciona por teclado;
- estados não dependem apenas de cor e possuem texto acessível;
- foco entra e retorna corretamente nos dialogs;
- progresso possui nome/valor e atualizações não roubam foco;
- mensagens `não verificável`, espaço insuficiente e recuperação indicam causa e próxima ação;
- cancelamento e confirmação são inequívocos.

Depois dos testes automatizados, conduza um estudo moderado com pelo menos 10 usuários representativos usando o mesmo roteiro: selecionar o dispositivo, identificar jogos afetados, revisar o plano e iniciar ou cancelar a ação indicada. Registre a conclusão de cada participante sem ajuda externa e confirme taxa mínima de 90%.

## Final evidence

Anexe ao PR:

- saída de build, lint e testes;
- matriz OS/filesystem homologada e versões das ferramentas;
- relatório sintético de ISO, ZSO, USBExtreme e lote;
- evidência de fault injection em cada boundary;
- comparação de hashes/mtimes dos auxiliares;
- limitações conhecidas, especialmente macOS e durabilidade de caches em mídia removível.
