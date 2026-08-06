# Research: Diagnóstico e correção de fragmentação OPL

## R1. Arquitetura da funcionalidade

**Decision**: Criar um contexto dedicado `electron/services/fragmentation-repair/` e IPC próprio. Reutilizar descoberta/parsers do catálogo, `SafeRoot`, locks, SHA-256, `JsonStore`, auditoria e adaptadores de extents, sem reutilizar o executor de reorganização global.

**Rationale**: Os componentes existentes resolvem parsing e segurança, mas `ReorganizationService` inventaria e regrava todo o dispositivo, inclui ART/CFG/VMC/APPS e remove originais antes de validar a nova alocação. Um contexto separado mantém o escopo de escrita mínimo e evita mudar semântica legada.

**Alternatives considered**:

- Estender `ReorganizationService`: rejeitado por violar correção individual, promoção tardia e preservação de auxiliares.
- Incorporar tudo ao catálogo: rejeitado porque diagnóstico somente leitura e transação de escrita possuem ciclos de vida distintos.
- Reutilizar diretamente instalação/importação: rejeitado porque a promoção ocorre antes da prova física final.

## R2. Identidade de instalação

**Decision**: Derivar identidade estável da identidade do dispositivo, formato e conjunto ordenado de caminhos normalizados. Game ID é metadado não exclusivo. Cada preflight revalida caminhos, tamanho, timestamps/assinaturas e SHA-256.

**Rationale**: IDs aleatórios do catálogo mudam entre scans, Game IDs podem duplicar e mount paths podem ser reutilizados depois de reconexão. A combinação física atende à clarificação e impede cruzamento de arquivos.

**Alternatives considered**:

- Game ID como chave: rejeitado por duplicidade válida.
- `CatalogItem.itemId`: rejeitado por não persistir entre scans.
- Caminho do mount isolado: rejeitado porque o dispositivo montado naquele caminho pode mudar.

## R3. Verificação de extents no Linux

**Decision**: Habilitar diagnóstico/correção somente quando uma prova de capacidade no volume executar `filefrag` com locale estável, reconhecer uma tabela completa e produzir mapeamento físico estável após sync/close. O adapter deve validar cobertura lógica e adjacência, não apenas uma frase de resumo.

**Rationale**: `filefrag` usa FIEMAP e pode cair para FIBMAP; suporte, privilégios, driver e formato da saída variam. Uma prova por volume evita assumir que o comportamento de ext4 vale para FAT32/exFAT. Referência: [filefrag(8)](https://man7.org/linux/man-pages/man8/filefrag.8.html).

**Alternatives considered**:

- Contar `N extents found`: rejeitado por parsing frágil e ausência de prova de cobertura/adjacência.
- Considerar Linux sempre suportado: rejeitado por diferenças entre drivers, ferramentas e permissões.
- Ler cadeias FAT diretamente: adiado por privilégio, complexidade e risco de mapear o volume errado.

## R4. Verificação de extents no Windows

**Decision**: Usar `fsutil file queryextents` somente após probe bem-sucedido no volume; analisar ranges VCN/LCN, cobertura completa e adjacência física. Corrigir a seleção de runtime que hoje direciona Windows ao adapter macOS.

**Rationale**: Contar linhas `VCN:` não prova cobertura nem adjacência. O comando pode falhar por filesystem, versão ou permissão. Referência: [Microsoft fsutil file](https://learn.microsoft.com/windows-server/administration/windows-commands/fsutil-file).

**Alternatives considered**:

- Confiar apenas na quantidade de linhas: rejeitado por falsos positivos.
- PowerShell/WMI como prova física: rejeitado por não fornecer o mapa completo necessário.
- Addon nativo imediato: adiado até que as ferramentas do sistema se mostrem insuficientes em volumes homologados.

## R5. macOS e matriz de capacidade

**Decision**: No primeiro release, macOS retorna `não verificável` e bloqueia correção. Linux e Windows só habilitam tentativa nos volumes em que o probe e a homologação FAT32/exFAT confirmem mapeamento confiável. Volumes de rede, virtuais, cloud, sparse, comprimidos, criptografados, COW ou desconhecidos permanecem bloqueados até homologação explícita.

**Rationale**: Não foi identificada API pública estável de usuário no macOS que prove extents físicos de arquivos regulares em volumes removíveis. A especificação proíbe declarar correção sem prova.

**Alternatives considered**:

- Usar tamanho alocado no macOS: rejeitado porque não prova contiguidade.
- API privada/depreciada: rejeitada por instabilidade e distribuição insegura.
- Habilitar por nome do filesystem: rejeitado porque capacidade depende também de OS, driver, ferramenta e permissão.

## R6. Estratégia de regravação

**Decision**: Criar candidata exclusiva no mesmo filesystem e preferencialmente no mesmo diretório lógico do alvo, escrever sequencialmente, sincronizar e fechar, validar tamanho/SHA-256/estrutura e então verificar extents. Fragmentação persistente aborta sem promoção.

**Rationale**: `copyFile`, streaming e preallocation podem tentar uma nova alocação, mas não garantem contiguidade. Uma candidata externa teria seus extents invalidados ao ser copiada de volta. Rename no mesmo filesystem preserva a alocação já verificada.

**Alternatives considered**:

- Candidata em disco externo: rejeitada porque a cópia de retorno realoca o conteúdo.
- Sobrescrever o original: rejeitado porque destrói a última versão válida.
- Preallocation como prova: rejeitada porque reserva espaço sem comprovar adjacência e pode exigir privilégios.
- Desfragmentador genérico: fora de escopo e sem autorização.

## R7. Journal e protocolo transacional

**Decision**: Executar uma transação por jogo com journal durável em app-data, escrito por arquivo temporário + sync + rename + sync do diretório. Estados: `planned → preflight-validated → staging → candidate-verified → commit-intent → promoting → active-validating → committed → cleanup-complete`, com saídas explícitas para aborto, rollback e recuperação pendente.

**Rationale**: O journal fora do dispositivo sobrevive à remoção e respeita o limite de escrita. Cada rename destrutivo possui intenção durável anterior. Transições monotônicas e idempotentes permitem restaurar o original após crash sem inferir promoção.

**Alternatives considered**:

- Journal somente em memória: rejeitado por não sobreviver ao processo.
- Journal no dispositivo: rejeitado por remoção simultânea e escrita fora dos arquivos permitidos.
- Sobrescrever JSON in-place: rejeitado por risco de journal truncado.
- Retomar promoção após crash: rejeitado pela clarificação FR-035.

## R8. Promoção e rollback

**Decision**: Após `commit-intent`, renomear original para backup único e candidata para o caminho ativo, com barreiras duráveis e revalidação do ativo. Até `committed`, pelo menos uma cópia integral validada permanece disponível. Falhas entre commit intent e validação ativa disparam rollback idempotente; ausência do dispositivo resulta em `recovery-pending`.

**Rationale**: Rename individual no mesmo filesystem é a menor troca disponível, mas FAT/exFAT não oferece transação multiarquivo. A segurança do grupo vem do journal, ordenação, backups e recuperação, não de alegação de atomicidade coletiva.

**Alternatives considered**:

- Apagar original antes da candidata: rejeitado por perda de última versão válida.
- Manter somente candidata após rename: rejeitado até a validação final e commit durável.
- Continuar automaticamente na reconexão: rejeitado; recuperação restaura/preserva e exige novo plano.

## R9. USBExtreme multipartes

**Decision**: Preparar e validar todas as partes fragmentadas antes da primeira promoção, manter partes contíguas somente leitura e correlacionar a entrada exata por identidade física, não somente Game ID. `ul.cfg` normalmente não muda; se indispensável, sua candidata e backup entram no mesmo journal e sua promoção ocorre por último.

**Rationale**: Partes novas são byte a byte equivalentes às antigas; durante renames, uma mistura transitória mantém conteúdo consistente, enquanto o lock impede operações concorrentes. Promover `ul.cfg` por último impede que ele anuncie um conjunto incompleto.

**Alternatives considered**:

- Regravar todas as partes: rejeitado por aumentar espaço e superfície de falha.
- Remover entradas por Game ID: rejeitado por colisões de Game ID.
- Atualizar `ul.cfg` sempre: rejeitado porque nomes e contagem são preservados.

## R10. Lote, espaço e concorrência

**Decision**: Processar estritamente um jogo por vez sob lock exclusivo do dispositivo; recalcular espaço antes de cada jogo. Uma falha gera resultado isolado e o lote só continua quando o dispositivo e o journal estão em estado seguro.

**Rationale**: Reflete a clarificação, reduz pico de espaço e simplifica rollback. Revisões de snapshot/plano e fingerprints impedem executar planos obsoletos.

**Alternatives considered**:

- Staging simultâneo do lote: rejeitado por pico de espaço e recuperação complexa.
- Paralelismo por arquivos: rejeitado por fragmentar mais o volume e dificultar ordenação/locks.

## R11. Persistência, observabilidade e privacidade

**Decision**: Persistir diagnósticos, planos confirmados, journals, eventos essenciais e relatórios versionados em app-data. Registrar caminhos relativos/identidades e hashes necessários, com redaction existente; nunca conteúdo de jogos. Eventos usam sequência monotônica por operação.

**Rationale**: Atende rastreabilidade e recuperação sem expor dados desnecessários. JSON versionado integra-se à infraestrutura atual e não justifica nova dependência.

**Alternatives considered**:

- SQLite: rejeitado neste escopo por custo de migração sem necessidade atual.
- Apenas logs textuais: rejeitado por não sustentar recuperação tipada.
- Caminhos absolutos no relatório exportado: evitados quando identidade relativa é suficiente.

## R12. Estratégia de testes e homologação

**Decision**: Combinar parsers com golden fixtures, serviços com fault injection em cada barreira, integração em dispositivos temporários e certificação real de FAT32/exFAT por plataforma. Correção só é habilitada numa combinação homologada e aprovada pelo probe runtime.

**Rationale**: Filesystems temporários comuns não simulam durabilidade, unplug e extents de mídia removível. O gate duplo evita generalizar evidência de uma plataforma.

**Alternatives considered**:

- Apenas mocks: rejeitado porque provaria lógica, não capacidade física.
- Apenas testes manuais: rejeitado por baixa reprodutibilidade.
- Habilitação otimista com aviso: rejeitada porque a spec proíbe alegar ou tentar sem verificação confiável.
