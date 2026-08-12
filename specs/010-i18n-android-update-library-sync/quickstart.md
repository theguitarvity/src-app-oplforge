# Quickstart: Validacao Manual

Pre-requisitos: `pnpm install` na raiz e em `mobile/`; app desktop
rodavel via `pnpm run dev` (Electron); app mobile rodavel via `expo start`
(emulador ou dispositivo Android).

## 1. Primeiro launch — selecao de idioma (User Story 1)

1. Limpar o estado local do app (arquivo de preferencias desktop /
   `AsyncStorage` mobile) para simular primeiro uso.
2. Abrir o app.
3. **Esperado**: tela de selecao de idioma aparece, com um dos 7 idiomas
   pre-selecionado conforme o idioma do SO (ou pt-BR se nao suportado).
4. Escolher um idioma diferente de pt-BR e continuar.
5. **Esperado**: todas as telas seguintes aparecem no idioma escolhido.

## 2. Trocar idioma em Configuracoes (User Story 2)

1. Com o app ja configurado, abrir Configuracoes.
2. Selecionar um idioma diferente do atual.
3. **Esperado**: a propria tela de Configuracoes e qualquer tela aberta
   atualizam instantaneamente, sem reload do app.
4. Fechar e reabrir o app.
5. **Esperado**: o idioma escolhido continua ativo.
6. (Opcional, dev) Remover uma chave do catalogo do idioma ativo e
   verificar que a string cai para pt-BR sem erro visivel.

## 3. Checagem de update no Android (User Story 3)

1. Publicar (ou simular via mock) uma versao mais nova no feed de
   releases GitHub configurado.
2. Abrir o app Android.
3. **Esperado**: Configuracoes mostra indicacao de atualizacao disponivel
   com acao para abrir o link da release.
4. Repetir com o app ja na versao mais recente.
5. **Esperado**: nenhuma acao de update e oferecida.
6. Repetir sem conectividade.
7. **Esperado**: app abre normalmente, sem travar nem exibir erro
   bloqueante.

## 4. Troca de dispositivo/biblioteca (User Story 4)

1. Conectar/selecionar um dispositivo A e deixar a biblioteca carregar.
2. Trocar para um dispositivo/fonte B diferente.
3. **Esperado**: popup de carregamento aparece antes da lista de jogos de
   B.
4. Aguardar o carregamento terminar.
5. **Esperado**: popup da lugar ao conteudo real da biblioteca de B.
6. Reabrir o app com o mesmo dispositivo B da sessao anterior.
7. **Esperado**: popup de "troca" NAO aparece (apenas loading normal de
   inicializacao).
8. Simular falha no carregamento (ex.: desconectar durante a leitura).
9. **Esperado**: popup da lugar a uma mensagem de erro clara, nao a uma
   tela vazia.

## 5. Loading na splash screen (User Story 5)

1. Fechar completamente o app mobile (cold start).
2. Reabrir o app.
3. **Esperado**: a splash screen exibe um indicador visual de loading
   durante toda a inicializacao, ate a UI principal aparecer.
