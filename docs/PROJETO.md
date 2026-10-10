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

## Etapa 3 — arquitetura de autenticação e dados
- Supabase Auth (e-mail e senha) com `@supabase/ssr`; `src/proxy.ts` renova a sessão (`getClaims`) e redireciona sem login (checagem otimista).
- Autorização real no servidor: `getCurrentProfessional()` (`src/lib/auth/session.ts`) + `AuthGate` no layout; conta sem vínculo com salão é deslogada em `/auth/acesso-negado`.
- "Lembrar de mim": cookie `na-remember`; desmarcado, os cookies de sessão do Supabase viram cookies de sessão do navegador (sem maxAge).
- Migrações em `supabase/migrations/` (9 tabelas, FKs compostas para integridade salão/profissional/cliente/serviço, RLS, grants por coluna). Aplicadas manualmente pelo SQL Editor.
- Migração 0003 concede acesso ao `service_role` (necessária porque "Automatically expose new tables" está desligado).
- Contas criadas por `npm run seed` (chave secreta, só local). Cadastro público desligado no painel.
- Formulários: React Hook Form + Zod; validação repetida no servidor.

## Etapa 4 — clientes e serviços
- Clientes (cadastro compartilhado): lista com busca por nome/telefone (URL ?q=), alternância ativas/arquivadas (?arquivadas=1), ficha com histórico (data, profissional, serviço, duração, preço registrado, status), cadastro e edição, atalho wa.me. Arquivar (reversível, com confirmação na tela) em vez de apagar.
- Telefone: guardado como 55+DDD+número (12–13 dígitos); aceita (11) 99999-8888, +55, 011 etc.; celular precisa começar com 9. Telefone repetido AVISA (ao sair do campo e ao salvar) e oferece abrir o cadastro existente ou "cadastrar mesmo assim".
- Serviços: cada profissional gerencia só os seus (criar, editar, desativar/reativar). Duração padrão (5–720 min) e preço (R$ 0–99.999,99, aceita "50", "50,5", "1.234,56"). Desativado some dos novos agendamentos (Etapa 5) e continua no histórico. A colega pode ver, não editar.
- Toda Server Action revalida a sessão (getCurrentProfessional), valida com Zod no servidor e usa o cliente Supabase da usuária (RLS como segunda barreira). Mensagens de erro genéricas.
- Layout: BottomNav e botão flutuante ficam em Suspense (usePathname em rotas dinâmicas [id] exige, com Cache Components).
- Busca não ignora acentos (ilike); melhoria possível com a extensão unaccent. Tipos das consultas do Supabase são escritos à mão (sem types gerados).
- Testes: Vitest + Testing Library (npm test): lógica de telefone/dinheiro/schemas, formulários, status e WhatsApp.

## Etapa 5 — agenda e agendamentos
- Agenda (/agenda): lista vertical do dia ordenada por horário; navegação dia anterior/seguinte, "Hoje" e seletor de data nativo; faixa semanal compacta (dom–sáb, com contagem escrita em cada dia) como visão semanal; filtro Todas / cada profissional (nome escrito, não só cor); cancelados ficam fora da lista; "Horário sobreposto" nos cartões da mesma profissional; destaque e aviso após salvar (?destaque=).
- Cartão: horário início–fim, cliente, serviço, profissional, status, atalhos (detalhes, editar, WhatsApp simples). Detalhe em /agendamentos/[id].
- Novo agendamento e edição/remarcação: cliente (busca nome/telefone + cadastro rápido com aviso de telefone repetido), serviço da própria profissional (preenche duração e preço; ambos ajustáveis só no atendimento), data, horário, observações, resumo ao vivo com término calculado, aviso de sobreposição em tempo real. Salvar com conflito exige "Agendar mesmo assim" (aviso, não bloqueio). Um atendimento só pode ser criado/editado pela dona; só aguardando confirmação/confirmado são editáveis.
- Idempotência: o formulário gera o id do atendimento; reenvio (toque repetido, rede ruim) não duplica.
- Fuso: instantes em UTC no banco; data/hora locais via src/lib/timezone.ts (America/Sao_Paulo; testado inclusive com horário de verão histórico). O fuso está fixo em código (SALON_TIMEZONE), não lido de salons.timezone.
- Regras em src/lib/appointments/service.ts (sem dependência do Next) para testar contra o banco real.
- Cancelado e "não compareceu" liberam o horário; concluído ainda ocupa.
- Testes: npm test (120), npm run test:integration (32, Supabase real, datas em 2031, limpa o que cria), test:supabase (56), test:db (78).
- Decidido: remarcar (mudar data ou horário de início) um atendimento CONFIRMADO o devolve para "aguardando confirmação"; a agenda avisa. Mudar só observação, preço ou duração não altera o status.
- Decidido (2026-10-10): a tela de Disponibilidade (expediente, pausas, folgas, bloqueios) e os horários livres NÃO serão feitos por enquanto. A tela e o item do menu foram removidos; as tabelas `business_hours` e `blocked_times` e suas regras de segurança continuam no banco para uso futuro.

## Etapa 6 — status, WhatsApp e Início
- Status (src/lib/appointments/transitions.ts): aguardando → confirmar, concluir, não compareceu ou cancelar; confirmado → concluir, não compareceu ou cancelar; concluído e não compareceu podem ser REABERTOS (voltam para confirmado, para corrigir toque errado); cancelado é definitivo. Tudo manual; o horário passar não muda nada e abrir o WhatsApp não muda o status. Só a dona altera.
- Cartão da agenda: ação principal (Confirmar / Concluir) + menu "Mais"; cancelar pede confirmação na própria tela, libera o horário, tira o atendimento da agenda (continua no banco/histórico) e volta à agenda com aviso. Detalhe do atendimento mostra todas as ações.
- Dois celulares: a mudança de status só é aplicada se o status ainda for o que a tela mostrava (senão avisa e recarrega); cliques simultâneos: só um vence.
- WhatsApp: mensagem de confirmação no modelo definido (primeiro nome da cliente; dd/MM; HH:mm; serviço; "Manicure: profissional"), codificada no wa.me; botão no cartão (ícone) e no detalhe ("Enviar confirmação no WhatsApp"). Para concluídos/cancelados/não compareceu o link abre a conversa sem mensagem.
- Início (/): saudação por hora do salão e data, filtro por profissional, tiles "atendimentos hoje" e "confirmações pendentes" (todas as pendentes de hoje em diante), contagem por status do dia, próximos atendimentos (cartões com data) e atalho para a agenda de hoje. Tudo calculado dos dados reais.
- Correções visuais da conferência: título da data com maiúscula só na primeira letra; células do cartão sem traço curvo; faixa semanal com alvos de 44 px (rola um pouco na horizontal em 320 px).
- Conferência visual feita com os componentes reais renderizados com dados de exemplo (arquivo temporário, removido) em 390 e 320 px: sem rolagem horizontal da página; alvos de toque de 44 px.
- Testes: npm test (125), test:integration (35, Supabase real), test:supabase (56), test:db (78).
- Reabrir (pedido pela usuária em 2026-10-09): botão "Reabrir atendimento" em concluído e não compareceu; volta para CONFIRMADO e volta a ser editável. Cancelado não reabre. Observação: um não compareceu libera o horário; se outro atendimento for marcado nele, reabrir pode gerar sobreposição, que aparece como "Horário sobreposto" (aviso, não bloqueio).

## Etapa 7 — perfil, PWA, E2E, backup e publicação
- Perfil (/perfil): nome de exibição, trocar senha (exige a senha atual) e pedir troca de e-mail (exige a senha atual; o Supabase envia link de confirmação). Lógica em src/lib/profile/service.ts, testada contra o Supabase real com conta descartável. NÃO verificado: o envio real do e-mail de confirmação (o teste não dispara e-mail de verdade).
- Sair agora encerra só ESTE aparelho (signOut scope local), coerente com "lembrar de mim neste aparelho".
- PWA: manifest.webmanifest (standalone, cores da marca, ícones 192/512 e maskable), ícone do iPhone, favicon; ícones gerados por scripts/generate-icons.mjs. Sem service worker (sem modo offline, como decidido). O proxy deixa manifesto e ícones públicos. Configurações traz o passo a passo de instalação. NÃO verificado: instalação em aparelho real.
- E2E (Playwright, npm run test:e2e): usa o Microsoft Edge instalado (nenhum navegador baixado); compila o app e usa o Supabase real; a sessão é criada pela API com a conta do seed (não se digita senha em formulário, então a TELA de login só é testada até a validação e o botão Entrar não é submetido); dados marcados com __e2e__ e apagados no fim. Projetos: visitante (rotas protegidas, login, manifesto), fluxo-390 (20 testes de uso completo) e layout em 320, 360, 390, 430, tablet e desktop (14 telas cada: sem rolagem horizontal, alvos de toque de 44 px, barra e botão flutuante sem cobrir conteúdo, sem erros no console).
- Backup/restauração (scripts/backup.mjs e restore.mjs): exporta as 9 tabelas e as contas (sem senhas), confere contagens; restaura só o que falta (nunca altera nem apaga); testado contra o banco real. A pasta backups/ é ignorada pelo git.
- Bugs achados pelos testes E2E e corrigidos: (1) o Next 16 mantém telas visitadas montadas e escondidas: ids fixos de campos duplicavam (rótulo apontava para o campo escondido) → useFormIds; (2) por isso cadastros novos reabriam preenchidos e o novo agendamento reaproveitava o identificador de tentativa (seria engolido como reenvio) → formulário zera e gera tentativa nova após salvar; (3) botões da ficha da cliente com 23 px de altura no celular (flex-1 em coluna); (4) link do cliente no detalhe com alvo pequeno; (5) busca trocava _ e % por espaço → agora escapa; (6) avisos de Date.now() na pré-renderização → await connection() em createClient.
- Documentação: README.md (instalação, comandos, backup, segurança), docs/SUPABASE.md, docs/DEPLOY.md.

## Etapas
1. Fundação — CONCLUÍDA
2. Identidade visual e casca mobile — CONCLUÍDA (aguardando validação)
3. Banco (Supabase) e login — CONCLUÍDA no servidor (migrações 0001–0003 aplicadas, seed ok, `npm run test:supabase` 42/42 contra o Supabase real); falta só a validação MANUAL do login pelo navegador/celular (lembrar de mim, sair)
4. Clientes e serviços — CONCLUÍDA no código e nos testes automáticos; falta a validação visual/manual da usuária
5. Agenda e agendamentos (com aviso de conflito) — CONCLUÍDA no código e nos testes automáticos; falta validação visual/manual da usuária. NÃO inclui horários livres (dependem da tela de Disponibilidade, ainda não construída) nem ações de status (Etapa 6)
6. Status, WhatsApp e tela Início — CONCLUÍDA no código e nos testes automáticos; falta a validação manual da usuária (a tela Início e as páginas dinâmicas não foram vistas no navegador)
7. Perfil, PWA, E2E, backup e publicação — CÓDIGO, TESTES E DOCUMENTAÇÃO PRONTOS; falta a publicação na Vercel (aguarda autorização) e a validação manual (troca real de e-mail, instalação no celular)

## Pendências e observações
- `npm audit` reporta 5 vulnerabilidades "high" em `braces`/`micromatch`/`fast-glob`, todas dentro da cadeia de `eslint-config-next` (ferramenta de lint, só desenvolvimento). A correção sugerida (`--force`) faria downgrade para eslint-config-next 14, por isso NÃO foi aplicada. Reavaliar quando houver versão corrigida.
- Após a Etapa 2 o `npm audit` mostra 9 "high" (eram 5). Mesma causa raiz: `braces`/`micromatch`/`fast-glob` (ReDoS), agora também dentro do pacote `shadcn` (CLI, listado em `dependencies` porque `globals.css` importa `shadcn/tailwind.css`) e `ts-morph`. Esse código é de ferramentas de build/CLI e não roda no servidor nem no navegador. Não corrigido; reavaliar a cada atualização.
- `npx tsc --noEmit` só funciona depois de um `next build`/`next dev` (os tipos de rota são gerados por eles).
- Conflitos do prompt principal RESOLVIDOS em 2026-10-09: (1) sobreposição da mesma profissional só AVISA, não bloqueia (vale também no banco: sem exclusion constraint); (2) `cancellation_reason` opcional e sem pedir na tela; (3) quinto status "não compareceu"; (4) disponibilidade opcional, como acima; (5) serviços individuais por profissional (serviço pertence a uma profissional; a tabela `professional_services` do prompt não é necessária); (6) manter `salons` e `salon_members`, mesmo com um salão só.
- Ainda a decidir: calendário diário próprio em lista vertical (sugerido) no lugar de FullCalendar; quando instalar React Hook Form, Zod, Vitest e Playwright (sugerido: quando a etapa precisar).
- Saudação e data na tela Início ficam para a etapa do dashboard (a data atual exige tratamento específico com Cache Components).
- O login pela tela (formulário, cookie de lembrar de mim, Sair) ainda não foi exercitado com sucesso no navegador: o agente não digita senhas de contas reais em formulários de serviço remoto; a usuária valida manualmente.
- Testes: `npm test` (Vitest, componentes e lógica). `npm run test:integration` (Vitest contra o Supabase real). `npm run test:supabase` (contra o Supabase real, 56 verificações; cria e apaga dados marcados com __teste__; usa as contas do seed). `npm run test:db` (PGlite, 65 verificações de esquema e RLS, com stubs do ambiente Supabase — não substitui testar no Supabase real). Playwright (E2E em viewport móvel) ainda não instalado.
- Hipótese de trabalho a confirmar: qualquer profissional do salão pode criar e alterar atendimentos de qualquer uma (ex.: marcar concluído pela colega). Serviços, expediente e bloqueios só pela dona.
- Telefone repetido não é bloqueado no banco (a tela avisará). Sem DELETE em clientes, serviços e atendimentos.
- Texto da mensagem de WhatsApp (definido pela usuária em 2026-10-09; usar exatamente este modelo na Etapa 6; [dia/mês] = dd/MM, [horário] = HH:mm no fuso do salão):

```text
Olá [nome da cliente], tudo bem? 🤍

Passando para confirmar seu agendamento!

📅 Data: [dia/mês]
⏰ Horário: [horário]
💅 Procedimento: [nome do serviço]
Manicure: [nome da profissional]

Está tudo certinho para você?

Caso precise cancelar ou remarcar, pedimos que nos avise com antecedência.

Aguardamos você! Será um prazer te atender.
```
- Limites do plano gratuito do Supabase (pausa por inatividade, backups): não verificados; conferir na Etapa 3/7.

## Próximo passo
Aguardar validação da Etapa 1 e autorização para a Etapa 2.
