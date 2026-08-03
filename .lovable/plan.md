# Plano — Polimento e Meta-Progressão do Elden Hollow

Pacote de expansão média focado em terminar sistemas que já existem nos dados, mas ainda não têm UI, e elevar o polimento visual/sonoro. O jogo permanece 100% offline (localStorage) e jogável ao final.

---

## 1. Hub Roundtable Hold (meta-progressão)

Tela acessível a partir do menu de morte e do menu principal.

- **NPCs e funções**
  - **Ferreiro Hewg** — comprar `hpBonus`, `fpBonus`, `staminaBonus` com `lostRunes`.
  - **Bruxa dos Dedos** — desbloquear novos boons no pool de recompensas (custa runas; aumenta raridade média).
  - **Finger Maiden** — desbloquear classes (Samurai, Bandit, etc.) que começam trancadas.
- Reutilizar `HUB_UPGRADES`, `hubCost` e `purchaseHub` de `src/lib/save.ts`.
- Visual: sala circular escura com 3 NPCs em pedestais dourados, fundo nebuloso, fonte Cinzel para nomes.

## 2. Codex / Bestiário

Painel acessível em jogo pela tecla `J` (já configurada em `Settings.binds.codex`).

- Grid de cartas: silhueta cinza para inimigos nunca mortos; colorida/iluminada após a primeira kill.
- Cada entrada mostra: nome, sprite silhueta, HP, resistências, drops, lore de `src/lib/bestiary.ts`.
- Contador de abates por espécie vindo do `Profile.bestiary`.
- Filtros: Todos / Comuns / Chefes / Descobertos.

## 3. Menu de Pausa e Configurações

Tecla `ESC` abre o painel de pausa durante `screen === "play"`.

- Ações: retomar, rebind de teclas (WASD/movimento, habilidades, inventário, codex, pausa), sliders de volume (música/SFX), brilho, sair para o menu.
- Aplicar `profile.settings.musicVol` e `sfxVol` aos módulos `music.ts` e `audio.ts`.
- Salvar `Profile` ao alterar configurações.

## 4. Ciclo de vida do áudio e persistência

Corrigir gaps identificados na auditoria:

- Parar música ao morrer, vencer ou voltar ao menu (`stopMusic`).
- Aplicar volume da música ao iniciar/continuar uma run.
- Salvar `Profile` também no caminho de vitória: incrementar `runsCompleted`, atualizar `bestDepth`, `totalPlaytimeMs`, `lostRunes`.
- Garantir que `recordKill`/`recordBossKill` e biomas visitados sejam persistidos ao final da run.

## 5. Polimento visual e feedback de combate

Melhorias de apresentação (prioridade alta, escopo médio):

- **Barras de status effects** embaixo da barra de HP dos inimigos (bleed, burn, frost, rot, poison).
- **Tela YOU DIED** com resumo da run: tempo, inimigos abatidos, chefes derrotados, dano causado/recebido, runas perdidas, profundidade.
- **Tela de vitória** com estatísticas e opção de New Game+ (mantém boons? não — runa zerada, mas bônus do Hub permanecem).
- **Screen shake** escalado pelo dano causado/recebido; feedback dedicado para parry e crit.
- **Rastros de arma** nos ataques melee (linha curta que decai rapidamente).
- **Iluminação dinâmica** em salas escuras: gradiente radial ao redor do jogador usando canvas overlay.
- Ajustar o clima para ser mais denso e visível (mais partículas, opacidade maior em Caelid/Farum Azula).

## 6. Tutorial contextual leve

Usar o estado `tutorial` já existente:

- Primeira vez que o jogador abre inventário, skill tree, ferreiro, codex, encontra um boss, usa um Site of Grace — exibe uma dica curta com título, corpo e botão "Entendi".
- Marcar `tutorialSeen` no `Profile` para não repetir.

---

## Detalhes técnicos

- Sem novas dependências.
- Toda persistência continua em `localStorage` (`elden-hollow.save.v2`).
- Manter o canvas como renderer principal; as novas telas são overlays React.
- Reutilizar componentes visuais existentes (`StatBar`, `ClassPortrait`, `AbilitySlot`) quando possível.
- Testar build e gameplay básico ao final.

---

## Entrega

O jogo ficará com: meta-progressão funcional (Hub), bestiário acessível, pausa com configurações, áudio corrigido, telas de morte/vitória com estatísticas, feedback visual mais rico e tutorial contextual. Tudo offline e jogável de ponta a ponta.
