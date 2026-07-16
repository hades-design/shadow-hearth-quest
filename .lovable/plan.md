# Plano — Grande Expansão do Elden Hollow

Escopo grande. Vou entregar em **6 fases** para manter o jogo jogável a cada passo. Cada fase é um bloco coeso que pode ser validado antes de seguir para a próxima.

---

## Fase 1 — Refatoração do motor (base para tudo)

Quebrar `src/components/EldenGame.tsx` (hoje monolítico) em módulos:

```text
src/game/
  engine/
    loop.ts         → game loop com delta-time real (dt em segundos)
    input.ts        → teclado/mouse, rebind, buffer de inputs
    renderer.ts     → camadas: chão, entidades, partículas, UI
    physics.ts      → colisão AABB, raycasts simples
    pool.ts         → object pooling genérico (projéteis, partículas, damage numbers)
    camera.ts       → screen shake com trauma decay
    rng.ts          → RNG seedado (para daily/seed opcional)
  entities/
    player.ts, enemy.ts, projectile.ts, particle.ts
  systems/
    combat.ts       → dano, crit, status effects
    status.ts       → Bleed/Frost/Poison/Rot/Sleep/Madness (tick + reação)
    loot.ts, save.ts (localStorage)
  content/
    biomes.ts, bestiary.ts, minibosses.ts, rooms.ts, events.ts
  audio/
    music.ts        → trilha ambient procedural + tema de boss
  ui/
    hud.tsx, pauseMenu.tsx, deathScreen.tsx, codex.tsx, hub.tsx
```

`EldenGame.tsx` vira só o mount do canvas + roteamento de telas.

**Delta-time**: todo movimento/cooldown migra de `frames` para `dt*speed`. **Object pooling** para projéteis, partículas, damage numbers e cadáveres.

**Testes** (`vitest`) para funções puras em `gameData.ts` e `combat.ts`: cálculo de dano com afinidade, custo de upgrade, aplicação de status.

---

## Fase 2 — Persistência, Hub e Bestiário

- **Save no localStorage**: classe desbloqueada, bosses derrotados, mortes, entradas do bestiário, moeda persistente ("Runas Perdidas"), upgrades do hub.
- **Roundtable Hold** — cena inicial (não é uma run): renderizada no mesmo canvas como sala calma com 3 NPCs:
  - **Ferreiro Hewg**: +HP base, +vigor, +slots de frasco (custa Runas Perdidas).
  - **Bruxa dos Dedos**: desbloqueia boons novos no pool, aumenta raridade.
  - **Finger Maiden**: desbloqueia classes (Samurai, Bandit já existentes ficam trancadas até serem compradas).
- **Codex/Bestiário** [tecla J]: grid de entradas com silhueta cinza → colorida ao matar. Cada entrada mostra HP, resistências, drops e lore curto.

---

## Fase 3 — Mundo e conteúdo

- **5 biomas** com paleta, tileset procedural, ambient sound e clima próprios:
  - Limgrave (verde/pedra, chuva leve)
  - Caelid (escarlate, tempestade escarlate + partículas de rot)
  - Liurnia (azul, névoa, poças d'água)
  - Mountaintops (branco/gelo, neve caindo, chão escorregadio leve)
  - Farum Azula (dourado, vento com folhas, gravidade quebrada visualmente)
- **Progressão**: 3 andares por bioma → miniboss → boss → próximo bioma.
- **Mini-bosses**: Erdtree Avatar (Limgrave), Tree Sentinel (Liurnia), Black Knife Assassin (Mountaintops), Fallingstar Beast (Caelid), Godskin Apostle (Farum Azula).
- **Salas especiais** (roll ponderado ao gerar andar):
  - Elite Room (3 inimigos raros, drop garantido)
  - Arena de sobrevivência (waves cronometradas)
  - Sala de tesouro com armadilhas (spikes, dart traps)
  - Invocação NPC (Yura, Latenna — companheiro por 1 andar)
- **Eventos aleatórios**: mercador nômade, estátua amaldiçoada (−max HP por buff permanente da run), poço de graça oculto (cura + boon).

---

## Fase 4 — Combate profundo e bosses

- **Status effects visíveis** com barrinhas embaixo do HP do alvo:
  - Bleed (proc em % do HP), Frostbite (lentidão + dano bônus), Poison (DoT lento), Scarlet Rot (DoT rápido), Sleep (stun curto), Madness (dano ao jogador + drena FP).
  - Cada um com cor, ícone e reação visual (partículas de sangue, cristais de gelo, gotas verdes, esporos escarlates, Zs, ondas roxas).
- **Fases múltiplas**:
  - Grafted Scion → fase 2 com braços extra e investida.
  - Margit → fase 2 invoca martelo dourado.
  - Godrick → fase 2 com braço de dragão que cospe fogo.
  - Radahn → fase 2 com chuva de flechas gravitacionais + arena maior.
  - Malenia mantém as duas fases já existentes, adiciona Waterfowl mais legível.
- **Stinger de boss intro**: nome em fonte Cinzel gigante, câmera zoom, silêncio + hit orquestral (WebAudio).

---

## Fase 5 — UX, áudio e feedback

- **Damage numbers flutuantes** (pooled): branco físico, laranja fogo, azul mágico, verde cura, dourado crit (maior + trêmulo).
- **Screen shake** com escala pelo dano; parry e crit têm shake dedicado.
- **YOU DIED**: fade escarlate, texto Cinzel enorme, sub-tela com resumo (tempo, kills, dano causado/recebido, boons, andar).
- **Minimap** no canto: retângulos por sala visitadas + ícone de boss/saída.
- **Tutorial contextual**: `firstTime` flags no save — dicas aparecem na primeira vez que uma mecânica é relevante.
- **Menu de pausa** [ESC]: retomar, rebind de teclas, sliders (música, SFX, brilho), sair.
- **Trilha sonora procedural**: `music.ts` gera drone + coral sintético (osciladores + LFO) para exploração; tema de boss com camada de percussão e brass sintético. Muda dinamicamente ao entrar em sala de boss.

---

## Fase 6 — Efeitos visuais e polimento

- **Partículas**: rastros de arma (linha atrás do swing), sangue persistente no chão (canvas offscreen que decai), folhas/cinzas/neve por bioma.
- **Iluminação dinâmica** em salas escuras: máscara radial ao redor do jogador (radial gradient em modo `destination-in` num canvas de overlay). Tochas nas paredes iluminam também.
- **Clima**: sistema de partículas de fundo por bioma (chuva, tempestade escarlate, neve, folhas douradas).
- **Death animation**: inimigos comuns caem, escurecem e dissolvem em cinzas (spawna 20 partículas pooled). Bosses têm explosão dourada + slow-mo curto.

---

## Detalhes técnicos importantes

- Nenhuma nova dependência necessária, exceto `vitest` para os testes unitários (dev-dep).
- Persistência via `localStorage` com chave versionada (`elden-hollow.save.v1`) e migração se mudarmos schema.
- Todo o áudio continua no `WebAudio` sintetizado — sem arquivos externos.
- Refatoração da Fase 1 é pré-requisito das outras; sem ela o `EldenGame.tsx` fica ingerenciável.
- A cada fase, o jogo permanece jogável ao final.

---

## Como quer prosseguir?

Posso executar **as 6 fases em sequência num único ciclo grande**, ou você prefere que eu pare para você testar depois de cada fase? Se quiser recortar, me diga quais fases priorizar (ex.: "Fase 1 + 2 + 5 primeiro").
