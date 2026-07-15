# Relatório Técnico — Elden Hollow

## 1. Identificação do software

| Campo | Valor |
|-------|-------|
| Nome do software | Elden Hollow |
| Versão atual | *(não versionada no package.json — sugerir 0.1.0)* |
| Data da atualização | 15/07/2026 |
| Categoria / tipo | Web / Jogo 2D roguelike no navegador |
| Descrição resumida | Jogo roguelike 2D de dark fantasy inspirado na atmosfera e mitologia de Elden Ring. O jogador desce câmaras procedurais, enfrenta inimigos e bosses nomeados (Grafted Scion, Crucible Knight, Margit, Godrick, Malenia, Radahn), coleta armas, armaduras e materiais, equipa itens, gasta pontos em uma árvore de habilidades e escolhe bônus estilo Hades após derrotar chefes. Controles: WASD mover, LMB atacar, Space magia, Shift esquivar, E interagir, I inventário, K habilidades, M mutar. |

## 2. Ambiente de desenvolvimento e tecnologias

| Campo | Valor |
|-------|-------|
| Linguagem de programação | TypeScript 5.8.3 |
| Framework / bibliotecas principais | TanStack Start v1.168.26 (full-stack React), React 19.2.0, TanStack Router, TanStack Query 5.101.1, Vite 8.0.16, Tailwind CSS v4.2.1, Radix UI (componentes de acessibilidade), React Hook Form 7.71.2 + Zod 3.24.2, Lucide React (ícones), Recharts, Embla Carousel, Sonner (toasts) |
| Arquitetura | Aplicação web monolítica com file-based routing (TanStack Router). Renderização SSR/SSG via TanStack Start. Build direcionado a serverless Worker (Cloudflare Workers / Nitro). Lógica do jogo totalmente client-side em canvas + WebAudio. |
| Gerenciador de pacotes | Bun (presença de `bunfig.toml` com política de idade mínima de pacotes) |

## 3. Infraestrutura e hospedagem

| Campo | Valor |
|-------|-------|
| Servidor / cloud | Lovable Cloud (hospedagem gerenciada pela Lovable; backend roda sobre Supabase quando ativado) |
| Sistema operacional do servidor | Linux / Cloudflare workerd (runtime serverless Worker) |
| Requisitos mínimos de hardware | Navegador moderno com suporte a HTML5 Canvas, WebAudio API e ES2022; conexão com a internet para carregar fontes (Google Fonts) e assets. Não há requisitos de servidor dedicado. |
| Ambiente de homologação (staging) | https://id-preview--67c966bf-afb1-4e8e-854e-262b637de1d5.lovable.app |
| Ambiente de produção | https://shadow-hearth-quest.lovable.app |

## 4. Banco de dados

| Campo | Valor |
|-------|-------|
| SGBD | N/A — o jogo não utiliza banco de dados persistente nesta versão. Todo o estado (partida, inventário, habilidades) é mantido em memória durante a sessão. |
| Versão | — |
| Tipo de banco | — |
| Ferramenta de migração | — |

*Nota: caso seja necessário persistir progresso, scores ou contas de jogador, a arquitetura recomendada é ativar o Lovable Cloud (PostgreSQL + autenticação Supabase) e adicionar tabelas com RLS.*

## 5. Integrações

| Tipo | Integração |
|------|------------|
| API de autenticação | Nenhuma |
| Gateway de pagamento | Nenhum |
| Outras APIs / serviços | Google Fonts CDN (Cinzel e EB Garamond); WebAudio API nativa do navegador para efeitos sonoros sintetizados. Nenhuma outra API externa. |

## 6. Documentação e repositório

| Item | Valor |
|------|-------|
| Repositório de código | Gerenciado pela Lovable (projeto conectado ao Git; branch sincronizada automaticamente). Link público não disponível neste contexto. |
| Link para documentação da API | N/A — não há API pública documentada. |
| Manual do usuário | Instruções embutidas no próprio jogo. Controles principais: WASD (mover), LMB (atacar), Space (magia principal), RMB / Q (habilidade de classe), Shift (esquiva / i-frames), E (interagir com Sites of Grace e baús), I (inventário), K (árvore de habilidades), M (mutar áudio). |

## 7. Contatos e suporte

| Papel | Nome / Contato |
|-------|----------------|
| Gerente de produto / PO | *(preencher)* |
| Tech lead / desenvolvedor principal | *(preencher)* |
| Time de suporte | *(preencher)* |

---

**Observações técnicas adicionais**

- O projeto nasceu a partir do template `tanstack_start_ts_current` da Lovable.
- O build é orquestrado por `@lovable.dev/vite-tanstack-config`, que já inclui os plugins de TanStack Start, React, Tailwind CSS, paths aliases e Nitro para Worker.
- Não há uso de `src/pages/` — o roteamento segue a convenção file-based de `src/routes/`.
- O componente principal do jogo é `src/components/EldenGame.tsx`; dados de classes, itens, inimigos, habilidades, upgrades e drops estão centralizados em `src/lib/gameData.ts`; efeitos sonoros estão em `src/lib/audio.ts`.
- Todo o conteúdo visual é renderizado via `<canvas>` 2D; não há sprites externos — modelos são desenhados proceduralmente no canvas.