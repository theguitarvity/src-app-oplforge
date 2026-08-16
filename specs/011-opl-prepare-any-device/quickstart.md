# Quickstart: Preparar OPL em qualquer dispositivo ou pasta local

1. Rodar o app em dev: `pnpm run dev`.
2. Abrir a tela de preparação de dispositivo.
3. Clicar em "Escolher pasta local" (nova ação) — deve abrir o diálogo nativo do SO.
4. Escolher uma pasta local vazia fora de dispositivos auto-detectados → deve avançar pelo wizard
   normalmente (estrutura ausente → oferece preparar).
5. Repetir a seleção da mesma pasta após o preparo → deve mostrar "pronto" sem passar pelas
   etapas de confirmação de gravação.
6. Tentar selecionar a raiz do disco (`/` ou `C:\`) → deve ser bloqueado com mensagem.
7. Selecionar uma pasta fora da home do usuário e acionar "preparar" → deve pedir confirmação
   extra antes de criar a estrutura.
8. Conferir que a pasta preparada contém todas as 10 pastas: `DVD, CD, PS1, APPS, ART, CFG, VMC,
CHT, LNG, THM`.
9. Rodar `pnpm run test`, `pnpm run lint`, `pnpm run build` — todos devem passar.
