# Research: Finalização OPL confiável e resiliente

## 1. Causa da fragmentação criada pelo Essentials

**Decision**: Separar transferência de rede de instalação física. Transferências usam cache durável local sob limites globais; toda cópia, divisão USBExtreme, promoção, rename e escrita de arte no mesmo dispositivo passa por um coordenador com exatamente um writer por identidade física do volume. A candidata é verificada antes e depois da promoção quando o filesystem permite prova de extents.

**Rationale**: O fluxo atual cria um staging por tarefa dentro do próprio dispositivo e inicia todas as URLs diretas imediatamente. As streams concorrentes podem intercalar clusters. O rename para `DVD`/`CD` não realoca dados e preserva os extents. Serializar apenas o rename não resolve a causa. O lock existente protege importações, mas não os downloads.

**Alternatives considered**:

- Continuar baixando em paralelo no USB e corrigir depois: duplica I/O, exige mais espaço, aumenta desgaste e transforma reparo em rotina.
- Manter staging no USB e serializar downloads: reduz o risco, mas impossibilita uma imagem bruta acima de 4 GiB em FAT32 e ocupa espaço necessário à transação.
- Confiar apenas no rename: rejeitado porque rename no mesmo filesystem não altera extents.

## 2. Persistência da fila e checkpoints

**Decision**: Usar JSON versionado e escrito atomicamente em `app.getPath('userData')`, reutilizando `JsonStore` e uma fila de escrita serial. Persistir transições imediatamente e checkpoints de bytes com coalescência de no máximo 1 segundo ou 16 MiB. Na inicialização, reconciliar snapshot, cache parcial, journals de instalação e identidade do dispositivo antes de liberar o scheduler.

**Rationale**: A escala prevista é de até 500 itens e não exige um banco nativo. JSON mantém compatibilidade com a constituição, o empacotamento multiplataforma e os padrões já usados por catálogo e reparo. O tamanho real do parcial é reavaliado após crash, portanto a janela coalescida não perde bytes válidos.

**Alternatives considered**:

- SQLite: oferece transações e consultas melhores em escala muito maior, mas adiciona dependência nativa, rebuild, migração e risco de distribuição sem benefício proporcional neste escopo.
- Append-only sem compactação: simplifica commits, mas cresce indefinidamente e torna recovery mais complexo.
- Manter estado só em memória: rejeitado por não suportar restart nem reconciliação.

## 3. Scheduler e reserva de recursos

**Decision**: Criar um coordenador singleton no processo principal com concorrência de rede padrão igual a 2, configurável dentro de limite seguro, um writer por `deviceId`, reserva agregada de espaço e contrapressão. Eventos de progresso são coalescidos em até 4 Hz por tarefa; transições de fase são imediatas.

**Rationale**: O loop atual aparenta ser sequencial, mas cada URL é disparada em background e todas começam juntas. Reservas individuais também podem prometer o mesmo espaço livre para várias tarefas. Limites explícitos evitam exaustão de memória, descritores, banda e volume.

**Alternatives considered**:

- `Promise.all` ou concorrência ilimitada: reproduz o problema.
- Tudo estritamente serial: seguro, mas desperdiça rede e impede paralelismo entre dispositivos.
- Lock por mount path: aliases e remounts podem contorná-lo; a chave deve ser a identidade estável do volume.

## 4. Retomada HTTP e torrent

**Decision**: Para HTTP, gravar `payload.part` por stream, controlar com `AbortController` e persistir URL final sanitizada, tamanho, ETag e Last-Modified. Retomar com `Range` e `If-Range`; anexar somente diante de `206` e `Content-Range` coerente. Resposta `200`, identidade alterada ou offset inválido reinicia apenas a tarefa. Para torrent, persistir magnet ou cópia do `.torrent`, infoHash quando conhecido, arquivos selecionados e cache path; readicionar pausado no mesmo path para rechecagem de peças.

**Rationale**: `fetch` direto atual não pausa nem cancela e sobrescreve desde o início. WebTorrent pode revalidar peças existentes, mas hoje seus metadados morrem com o processo.

**Alternatives considered**:

- Persistir objetos WebTorrent: não serializáveis e acoplados ao processo.
- Aceitar append após qualquer resposta: pode combinar versões diferentes e corromper conteúdo.
- Reiniciar todo o lote: viola isolamento de falhas e desperdiça progresso válido.

## 5. Finalização única para Essentials e importação

**Decision**: Remover a movimentação ad hoc do Essentials e encaminhar toda imagem concluída à mesma pipeline: inspeção autoritativa → plano revisionado → confirmação aplicável → instalação transacional → verificação física → catálogo → job de arte. O pipeline reutiliza `InstallationPlannerService`, `GameInstallationService`, `DeviceLockService` e a feature de fragmentação, corrigindo suas lacunas em vez de criar um segundo instalador.

**Rationale**: O planner já contém parte da seleção ISO/ZSO/USBExtreme e o instalador já possui staging, hash, journal e rollback. O fluxo atual de download os contorna, criando regras divergentes.

**Alternatives considered**:

- Corrigir somente `finalizeOplFiles`: continuaria duplicando regras e recuperação.
- Fazer o renderer orquestrar fases: quebra isolamento e perde autoridade após reload.
- Reutilizar a reorganização global: escopo destrutivo e semântica diferentes.

## 6. FAT32 e formato USBExtreme

**Decision**: Identificar o filesystem real antes do plano. Em FAT32, imagens acima de `0xffffffff` bytes são divididas em partes de `0x3ff00000` bytes. Implementar um único codec USBExtreme compatível: título sanitizado/truncado antes do CRC; CRC32 exato do título gravado no registro; partes `ul.<CRC8>.<GAME_ID sem os três primeiros caracteres>.<NN>`; registro de 64 bytes; preservação dos 15 bytes desconhecidos; `ul.cfg` promovido por último.

**Rationale**: O código atual usa MD5 parcial e Game ID completo no nome da parte, enquanto o OPL Manager calcula CRC32 do título e procura o ID sem prefixo. Essa divergência pode produzir partes invisíveis ao OPL. O planner também presume limitação FAT quando o filesystem não é informado, convertendo desnecessariamente.

**Alternatives considered**:

- Usar ZSO para contornar 4 GiB: compressão não garante tamanho abaixo do limite e depende do perfil.
- Manter MD5 do Forge: incompatível com a convenção de referência.
- Atualizar `ul.cfg` antes das partes: pode deixar catálogo apontando para conjunto incompleto.

## 7. Game ID autoritativo e nome canônico

**Decision**: Ler a árvore ISO9660, localizar `SYSTEM.CNF` e extrair o executável de boot tanto em ISO quanto em ZSO por leitor randômico. Nome e catálogo remoto são hints. O nome final padrão é `AAAA_999.99.Título.iso|zso`, com ID uppercase, título conservador de até 32 bytes após sanitização OPL e colisões tratadas no plano. A adequação de biblioteca usa prévia, journal e rename no mesmo filesystem.

**Rationale**: O Forge atual varre apenas os primeiros MiB brutos e pode perder o arquivo ou encontrar falso positivo; ZSO depende do nome. O OPL Manager lê `SYSTEM.CNF` via filesystem. O formato antigo com ID foi explicitamente solicitado e oferece associação determinística de CFG/ART.

**Alternatives considered**:

- Formato novo `<título>.iso`: reconhecido por OPL moderno, mas contraria o padrão requerido e dificulta associação visual.
- Unicode amplo e limite próximo de 80 bytes: menos compatível com versões/temas/filesystems antigos.
- Confiar no ID do filename: vulnerável a divergências da origem.

## 8. Verificação e rollback de fragmentação

**Decision**: Verificar a candidata sincronizada antes da promoção e o caminho ativo depois dela. Candidata fragmentada não é promovida. Se o ativo divergir ou ficar fragmentado após a promoção, executar rollback pelo journal e reportar `STILL_FRAGMENTED`; ausência de verificador produz `not-verified`, nunca `contiguous`.

**Rationale**: O instalador atual verifica somente após a promoção e retorna falha sem restaurar, deixando um jogo fragmentado ativo.

**Alternatives considered**:

- Apenas relatório pós-instalação: mantém o defeito no dispositivo.
- Inferir contiguidade por escrita serial: melhora probabilidade, mas não constitui prova.
- Bloquear todas as plataformas sem verificador: excessivo; instalação pode terminar como não verificável com limitação explícita, sem falsa alegação.

## 9. Índice e cache de artes

**Decision**: Criar índice persistente, versionado e paginado por `(gameId, type)`, com revisão da fonte, arquivo/entry, tamanhos e CRC/hash conhecido. Preferir metadata/manifesto. Para ZIP remoto, ler EOCD/diretório central por Range quando suportado; fallback baixa o arquivo uma vez para cache em disco. Usar single-flight por chave de cache, TTL, ETag/Last-Modified e stale-if-error.

**Rationale**: O código atual baixa cada ZIP inteiro para indexar e volta a baixá-lo para cada arte. O cache é só memória e o filtro por jogo percorre todo o catálogo.

**Alternatives considered**:

- Cache só em memória: perde trabalho e revisão no restart.
- Baixar todos os ZIPs em cada refresh: custo e risco de OOM inaceitáveis.
- Retornar todo o índice ao renderer: payload desnecessário e superfície maior.

## 10. Extração de ZIP e formato de arte

**Decision**: Adotar `yauzl` com leitura lazy/streaming, arquivo de cache em disco e limites estritos de tamanho comprimido/descomprimido, número de entries, path e CRC. A nova dependência deve ser fixada, auditada e coberta por testes de zip-slip/zip-bomb. Saída canônica permanece PNG; JPEG válido é convertido fora da thread principal. Cada arte usa staging no mesmo filesystem, fsync e rename recuperável.

**Rationale**: O parser manual atual recebe um Buffer completo e usa inflate síncrono, duplicando memória e bloqueando o processo principal. Implementar um parser ZIP robusto próprio aumenta risco de segurança. PNG único preserva o contrato atual e simplifica validação.

**Alternatives considered**:

- Manter parser manual adaptado a arquivo: custo alto para ZIP64, CRC, data descriptors e segurança.
- `unzipper`: streaming possível, mas a API lazy e validações explícitas de `yauzl` se ajustam melhor ao acesso por entry.
- Copiar JPG sem conversão: OPL Manager aceita, mas amplia o contrato atual e as variantes a validar.

## 11. Job durável de artes

**Decision**: Persistir `ArtSyncJob` e itens por jogo/tipo, consultar IDs em lotes de até 500, baixar com concorrência global padrão 3 e serializar promoções por dispositivo. Fazer checkpoint por asset. Políticas: `missing-only` padrão, `replace-invalid` e `replace-all` confirmada. Falha de arte é isolada e não rebaixa instalação íntegra.

**Rationale**: O OPL Manager fornece a semântica desejada de oito tipos, batch de 500 e política por categoria, mas seu processamento síncrono/byte-array não é modelo de robustez. Planos atuais do Forge são voláteis e não expõem cancelamento ou progresso.

**Alternatives considered**:

- `Promise.all` de todas as artes: pressão de rede/memória.
- Totalmente serial: seguro, porém lento sem necessidade.
- Resultado apenas agregado: não permite retomada seletiva.

## 12. IPC, shutdown e observabilidade

**Decision**: Todos os novos comandos usam objetos strict Zod e IDs opacos; paths internos são resolvidos no main. Snapshots revisionados são a autoridade; eventos possuem sequence/revision e podem ser perdidos sem perder estado. `before-quit` para scheduler, força checkpoint e encerra WebTorrent dentro de prazo. Todo callback assíncrono captura falhas. Falhas globais registram diagnóstico e iniciam shutdown controlado.

**Rationale**: Os IPCs de download atuais não validam runtime, callbacks `void` podem rejeitar sem tratamento e eventos por chunk pressionam main/renderer. O renderer deve se reconstruir por snapshot após reload.

**Alternatives considered**:

- Eventos como fonte de verdade: reload perde eventos.
- Expor paths e filesystem genérico: viola menor privilégio.
- Continuar após `uncaughtException`: estado do processo pode estar corrompido.

## 13. Portabilidade

**Decision**: Manter TypeScript/Node 22/Electron e APIs portáveis de filesystem/stream. Verificação física segue a matriz da feature 002: Linux e Windows quando homologados; macOS pode instalar e marcar `not-verified`, mas não afirmar contiguidade. Renames nunca atravessam volumes; transferência local → candidato do dispositivo é copy/stream + fsync + validação.

**Rationale**: O produto distribui Windows, Linux e macOS. Dependências WinForms/x86 e SOAP do OPL Manager não são portáveis nem necessárias.

**Alternatives considered**:

- Limitar a Windows: viola estratégia de distribuição.
- Executáveis auxiliares do OPL Manager: supply-chain e plataforma incompatíveis.
- Assumir atomicidade cross-volume: não suportada.
