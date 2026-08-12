# Context Input — i18n, Auto-Update, Library Sync Feature

Data: 2026-08-12

## Solicitação original (verbatim, PT-BR)

Aproveitando agora, vamos internacionalizar o app, vamos traduzir todos os
elementos visuais e textuais do app android e desktop, vamos propor aqui o
idioma ptbr, ingles, espanhol, alemao, russo, mandarin, japones a principio,
o setup deve ter a opcao do idioma e ele deve ser configuravel no primeiro
launch ou em configuracoes, quero essa feature implementada como um todo.

Outro ponto de evolucao do app, quando abrir no android, verificar se existe
uma nova versao disponivel e ter a opcao de atualizacao em configuracoes.

E adicione tambem um mecanismo de reconhecimento de mudanca de biblioteca,
quando eu trocar o dispositivo ele subir um popup carregando a biblioteca
pra nao ter carregamento tardio e iludir o usuario, e coloque um loading na
spash screen do app.

## Features identificadas (a serem confirmadas/refinadas pelo Spec Kit)

1. **Internacionalização (i18n)** — Traduzir toda a UI (textual e visual,
   onde aplicável) do app Android e Desktop. Idiomas propostos: pt-BR
   (padrão), en, es, de, ru, zh (mandarim), ja. Seleção de idioma disponível
   no setup/primeiro launch e em Configurações.
2. **Verificação de atualização (Android)** — Ao abrir o app no Android,
   verificar se há nova versão disponível; opção de atualização disponível
   em Configurações.
3. **Reconhecimento de troca de biblioteca/dispositivo** — Ao detectar
   mudança de dispositivo/biblioteca, exibir popup informando que a
   biblioteca está carregando, evitando estado enganoso de "vazio" para o
   usuário (tela ilude o usuário pensando que não há conteúdo). Adicionar
   indicador de loading na splash screen do app.

## Escopo

- Plataformas: Android e Desktop (Electron, conforme estrutura do repo:
  `electron/`, `mobile/`, `src/`).
- Não foram fornecidos: strings de tradução prontas, provedor de update
  (ex.: GitHub Releases, servidor próprio), mecanismo de detecção de
  "biblioteca" (fonte de dados atual do app precisa ser inspecionada no
  código).
