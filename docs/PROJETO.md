# Nail Agenda — Documentação do projeto

Última atualização: 2026-10-08 (fim da Etapa 1)

## Objetivo
Sistema web mobile-first de agenda para um salão de unhas, usado por duas profissionais
(cada uma com seus atendimentos; ambas veem a agenda compartilhada). Área privada, sem
agendamento público na v1.

## Requisitos decididos
- Acesso pelo celular das duas profissionais; mobile-first (não apenas responsivo); PWA instalável.
- Login por e-mail e senha, com "lembrar de mim". Cadastro público desligado; contas criadas pelo administrador.
- Agenda compartilhada mostra todos os dados (nome e telefone da cliente) das duas profissionais.
- Profissionais diferentes podem atender no mesmo horário (sem bloqueio nem aviso entre elas).
- A mesma profissional não pode ter dois atendimentos sobrepostos: o sistema AVISA (mostrando a outra cliente e o horário), sem bloquear.
- Não existe horário de expediente padrão. Disponibilidade (dias, horários, pausas, folgas, férias, bloqueios) é OPCIONAL por profissional: se cadastrada, a agenda mostra horários livres e avisa fora dela; se não, qualquer horário é aceito.
- Clientes: cadastro compartilhado.
- Serviços: individuais por profissional (nome, preço, duração padrão).
- Duração e preço são copiados para o agendamento e editáveis só nele; o serviço não muda.
- Status: aguardando confirmação, confirmado, concluído, cancelado e não compareceu. Cancelado fica no banco e é ocultado da agenda. Cancelamento libera o horário. Coluna `cancellation_reason` existe, é opcional e a tela não pede o motivo.
- Confirmação manual: botão que abre WhatsApp (`wa.me`) com mensagem pré-preenchida. Texto definitivo ainda a definir; usar texto provisório em um único lugar do código.
- Idioma pt-BR, moeda R$, fuso America/Sao_Paulo (horários em UTC no banco).
- Identidade visual: sofisticada, feminina, minimalista — off-white, nude, rosa queimado, marrom profundo.
- Fora da v1: relatórios, comissões, lembretes automáticos, agendamento público.

## Decisões técnicas
- Next.js (App Router) + TypeScript + Tailwind CSS, npm.
- Banco e login: Supabase (Postgres, Auth, RLS), plano gratuito, região São Paulo.
  - Configuração escolhida: Data API ligada, "Automatically expose new tables" DESLIGADO, "Enable automatic RLS" LIGADO.
- Hospedagem: Vercel (plano gratuito).
- Segredos só em `.env.local` (ignorado pelo git). Chave service_role nunca no navegador.
- Contas de teste na fase de construção; troca para e-mails pessoais por tela de perfil depois.

## Versões instaladas (verificadas em 2026-10-08)
Node 22.19.0 · npm 10.9.3 · Next 16.4.0 · React 19.3.0 · Tailwind 4 · TypeScript 5.
O Next.js 16.4 tem mudanças em relação a versões antigas: consultar `node_modules/next/dist/docs/` antes de escrever código (ver `AGENTS.md`).
O `next.config.ts` gerado já ativa `cacheComponents` e `partialPrefetching`; mantidos como gerados.

## Design system (Etapa 2)
- Tokens em `src/app/globals.css`: paleta do briefing (off-white #FAF8F5, nude #E9DDD2, rosa queimado #C58F96, marrom #51413E, cinza quente #8B817C, branco) mapeada para as variáveis do shadcn/ui. Somente tema claro.
- Tons derivados só para texto, por contraste AA: `rose-deep` #9C616B (4.6:1) e `taupe-soft` #6F6560 (5.3:1). O rosa e o cinza originais não passam AA em texto pequeno (2.6:1 e 3.6:1).
- Botão primário = marrom com texto off-white (9.1:1). Rosa queimado fica para destaque (botão flutuante, ícones).
- Tipografia: Cormorant Garamond (títulos) + Inter (texto); inputs a 16px para evitar zoom no iOS.
- Navegação: barra inferior fixa (Início, Agenda, Clientes, Menu) com safe area; botão flutuante "Agendar" em Início e Agenda.
- shadcn/ui inicializado (`components.json`, estilo base-nova, usa `@base-ui/react`); só o `Button` foi gerado até agora. Ícones: lucide-react. `cn` vem do pacote `cn` (oficial do shadcn).
- Rotas esqueleto em `src/app/(app)/`: `/`, `/agenda`, `/clientes`, `/menu`, `/servicos`, `/disponibilidade`, `/configuracoes`, `/perfil`, `/agendamentos/novo` (telas vazias, sem dados).

## Etapas
1. Fundação — CONCLUÍDA
2. Identidade visual e casca mobile — CONCLUÍDA (aguardando validação)
3. Banco (Supabase) e login — pendente
4. Clientes e serviços — pendente
5. Agenda e agendamentos (com aviso de conflito) — pendente
6. Status e atalho WhatsApp — pendente
7. Perfil, PWA, teste em celular real, publicação e backup — pendente

## Pendências e observações
- `npm audit` reporta 5 vulnerabilidades "high" em `braces`/`micromatch`/`fast-glob`, todas dentro da cadeia de `eslint-config-next` (ferramenta de lint, só desenvolvimento). A correção sugerida (`--force`) faria downgrade para eslint-config-next 14, por isso NÃO foi aplicada. Reavaliar quando houver versão corrigida.
- Após a Etapa 2 o `npm audit` mostra 9 "high" (eram 5). Mesma causa raiz: `braces`/`micromatch`/`fast-glob` (ReDoS), agora também dentro do pacote `shadcn` (CLI, listado em `dependencies` porque `globals.css` importa `shadcn/tailwind.css`) e `ts-morph`. Esse código é de ferramentas de build/CLI e não roda no servidor nem no navegador. Não corrigido; reavaliar a cada atualização.
- `npx tsc --noEmit` só funciona depois de um `next build`/`next dev` (os tipos de rota são gerados por eles).
- Conflitos do prompt principal RESOLVIDOS em 2026-10-09: (1) sobreposição da mesma profissional só AVISA, não bloqueia (vale também no banco: sem exclusion constraint); (2) `cancellation_reason` opcional e sem pedir na tela; (3) quinto status "não compareceu"; (4) disponibilidade opcional, como acima; (5) serviços individuais por profissional (serviço pertence a uma profissional; a tabela `professional_services` do prompt não é necessária); (6) manter `salons` e `salon_members`, mesmo com um salão só.
- Ainda a decidir: calendário diário próprio em lista vertical (sugerido) no lugar de FullCalendar; quando instalar React Hook Form, Zod, Vitest e Playwright (sugerido: quando a etapa precisar).
- Saudação e data na tela Início ficam para a etapa do dashboard (a data atual exige tratamento específico com Cache Components).
- "Sair" no menu está desabilitado até existir login.
- Testes automatizados (Vitest/Playwright) ainda não instalados.
- Texto da mensagem de WhatsApp: a definir.
- Limites do plano gratuito do Supabase (pausa por inatividade, backups): não verificados; conferir na Etapa 3/7.

## Próximo passo
Aguardar validação da Etapa 1 e autorização para a Etapa 2.
