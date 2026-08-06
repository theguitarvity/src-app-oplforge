<!--
Sync Impact Report
- Version change: template (unversioned) -> 1.0.0
- Modified principles:
  - Template placeholder -> I. Segurança em Operações Sensíveis
  - Template placeholder -> II. Isolamento e Menor Privilégio
  - Template placeholder -> III. Contratos Tipados e Limites de Camada
  - Template placeholder -> IV. Integridade, Rastreabilidade e Recuperação
  - Template placeholder -> V. Evolução Incremental Verificada
- Added sections:
  - Restrições Técnicas e de Produto
  - Fluxo de Desenvolvimento e Portões de Qualidade
- Removed sections: none
- Follow-up TODOs: none
-->

# OPL Forge Constitution

## Core Principles

### I. Segurança em Operações Sensíveis

Toda operação que possa formatar, sobrescrever, remover ou mover dados em um dispositivo MUST
exibir o alvo resolvido, validar que ele é um dispositivo suportado e exigir confirmação explícita
antes da execução. A formatação real MUST permanecer bloqueada por uma proteção deliberada, como
uma flag de ambiente, além da confirmação na interface. Downloads e importações MUST exigir que o
usuário reconheça sua responsabilidade por possuir ou estar autorizado a usar o conteúdo; o produto
MUST NOT contornar proteções, fornecer conteúdo não autorizado ou ocultar a origem dos arquivos.
Falhas de validação MUST interromper a operação sem alterar o destino. Essas regras protegem dados do
usuário e sustentam a postura legal e pragmática do produto.

### II. Isolamento e Menor Privilégio

O renderer MUST operar com `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.
Acesso ao sistema de arquivos, dispositivos, downloads P2P e demais recursos privilegiados MUST
permanecer no processo principal do Electron. O preload MUST expor somente operações explicitamente
permitidas por uma API estreita via `contextBridge`; nenhum recurso genérico do Node.js ou canal IPC
arbitrário pode ser exposto à UI. Todo handler IPC MUST validar entradas e retornar erros controlados.
Exceções a esse modelo exigem emenda constitucional, pois ampliam diretamente a superfície de ataque.

### III. Contratos Tipados e Limites de Camada

Interfaces entre renderer, preload, processo principal e serviços MUST possuir contratos TypeScript
explícitos e compartilhados. `src/services/api.ts` MUST ser o ponto de acesso da UI a `window.oplApi`,
e `src/types/opl.ts`, ou um módulo de contrato dedicado que o substitua formalmente, MUST definir os
tipos compartilhados. Componentes React MUST NOT acessar diretamente sistema de arquivos, WebTorrent
ou APIs privilegiadas. Lógica de domínio e I/O MUST residir nos serviços do processo principal;
React Query MUST representar estado assíncrono externo e Zustand MUST ser reservado a estado global
de UI e sessões reativas. Essa separação mantém o produto evolutivo, testável e auditável.

### IV. Integridade, Rastreabilidade e Recuperação

Operações longas ou compostas MUST informar estado, progresso, sucesso e falha de forma observável.
Importações e downloads MUST usar staging quando a escrita parcial puder deixar o destino inconsistente,
e somente artefatos validados podem ser promovidos ao local final. Operações relevantes MUST produzir
histórico persistente e logs com nível apropriado, sem registrar segredos ou dados pessoais
desnecessários. Cancelamento, pausa e retomada MUST preservar um estado conhecido; em caso de falha,
o sistema MUST manter os dados preexistentes intactos ou explicar claramente qualquer recuperação
necessária. Persistência em JSON ou futura migração para SQLite MUST conservar os contratos de dados
ou incluir migração explícita e testada.

### V. Evolução Incremental Verificada

Cada mudança MUST ter escopo mínimo coerente, critérios de aceitação verificáveis e evidência de
validação proporcional ao risco. Regras de domínio, contratos IPC, manipulação de caminhos, seleção de
arquivos e cálculos de capacidade MUST possuir testes automatizados. Fluxos críticos de preparação,
importação, download, catálogo e instalação de arte MUST incluir testes de integração nos limites entre
UI, bridge e serviços quando esses limites forem alterados. Correções de defeitos MUST adicionar teste
de regressão quando reproduzíveis. Build, checagem de tipos, lint e testes afetados MUST passar antes
da integração; uma exceção MUST ser documentada com impacto, responsável e prazo de correção.

## Restrições Técnicas e de Produto

- A aplicação MUST permanecer compatível com a arquitetura Electron + React + TypeScript e com o
  runtime Node.js 22 adotado, salvo plano de migração aprovado.
- A estrutura OPL gerada MUST respeitar os diretórios `DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG` e
  `VMC`; mudanças nesse contrato exigem compatibilidade retroativa ou migração documentada.
- Caminhos fornecidos pelo usuário ou por fontes remotas MUST ser normalizados, confinados ao destino
  autorizado e protegidos contra traversal, colisões e escrita fora do dispositivo selecionado.
- Downloads MUST ocorrer no processo principal, permitir inspeção e seleção de arquivos e usar
  `/_OPL_FORGE_STAGING/` antes da promoção quando houver risco de conteúdo incompleto.
- O Essentials Catalog MUST manter confirmação legal explícita por item antes do enfileiramento.
- Dependências novas e mudanças estruturais, inclusive adoção de SQLite ou providers remotos, MUST
  apresentar motivação, impacto de segurança, estratégia de migração e cobertura de testes.
- Builds distribuíveis MUST considerar Windows x64/arm64, macOS Intel/Apple Silicon e Linux
  AppImage/DEB; limitações deliberadas de plataforma MUST ser documentadas na especificação da mudança.

## Fluxo de Desenvolvimento e Portões de Qualidade

Toda funcionalidade começa por uma especificação com cenários de usuário, critérios de aceitação,
riscos de dados e limites legais. O plano MUST identificar as camadas afetadas, alterações de contrato
IPC, persistência e estratégia de teste. A implementação MUST manter commits e tarefas pequenos o
suficiente para revisão independente.

Revisões MUST verificar, conforme aplicável:

1. confirmação e validação para qualquer operação destrutiva ou legalmente sensível;
2. preservação do isolamento Electron e validação dos contratos IPC;
3. tratamento seguro de caminhos, staging, falhas e recuperação;
4. atualização de tipos, testes, logs e documentação afetados;
5. execução bem-sucedida de checagem de tipos, lint, testes e build relevantes.

Mudanças que não atendam a um portão MUST NOT ser integradas sem uma exceção registrada. A exceção
MUST explicar por que a conformidade imediata é inviável, limitar duração e alcance e indicar a tarefa
de regularização. Complexidade adicional MUST ser justificada por um requisito atual, não apenas por
uma possibilidade futura.

## Governance

Esta constituição prevalece sobre práticas informais, documentos de planejamento e convenções locais
quando houver conflito. Uma emenda MUST ser proposta em revisão explícita, descrever motivação e
impacto, atualizar o Sync Impact Report e incluir plano de migração quando alterar obrigações existentes.
A aprovação exige anuência dos mantenedores responsáveis pelo projeto; mudanças de aplicação não podem
alterar implicitamente estas regras.

O versionamento segue SemVer: MAJOR para remoção ou redefinição incompatível de princípios; MINOR para
novo princípio, seção ou ampliação material de obrigações; PATCH para esclarecimentos sem mudança de
sentido. A data de ratificação permanece a da adoção inicial e `Last Amended` MUST refletir a data da
última mudança normativa.

Cada especificação e plano MUST incluir uma verificação de conformidade constitucional antes da
implementação. Cada revisão de código MUST avaliar os princípios atingidos e registrar desvios. Os
mantenedores MUST revisar esta constituição ao menos uma vez por ciclo de release relevante ou quando
uma mudança de arquitetura, segurança, persistência ou distribuição for proposta.

**Version**: 1.0.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-01
