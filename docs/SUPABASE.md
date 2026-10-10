# Configuração do Supabase — passo a passo

Os nomes de menus do Supabase mudam com frequência. Os passos abaixo foram escritos sem abrir o painel agora:
se algum nome estiver diferente, procure o equivalente ou mande um print.

**Regra de ouro:** nenhuma chave, senha ou token vai para o chat, para o git ou para a Vercel (exceto as duas variáveis
públicas listadas no passo 3). Se uma chave secreta vazar, gere uma nova no painel.

## 1. Projeto (já criado)
Confirme que o projeto `nail-agenda` existe, no plano Free, com região São Paulo, e que na criação você deixou:
Data API **ligada**, "Automatically expose new tables" **desligado** e "Enable automatic RLS" **ligado**.

## 2. Autenticação
No painel: **Authentication**.
1. **Sign In / Providers → Email:** mantenha o provedor Email ligado.
2. Procure **Allow new users to sign up** e **ligue** (necessário para a tela de cadastro). Quem pode de fato entrar no salão é decidido pelo **código de convite**, conferido no banco (passo 5b); sem o código, a conta nasce sem acesso a nada.
3. Não ative nenhum outro provedor (Google etc.).
4. **Confirm email: desligue**, para a pessoa entrar logo depois de se cadastrar. (Se ficar ligada, o cadastro avisa a administradora e a pessoa não consegue entrar.) No plano gratuito o envio de e-mails do Supabase é bem limitado, por isso não dependemos dele.
5. **Password → Minimum password length:** 8.

## 3. Pegar as chaves
**Project Settings → API Keys** (ou **API**).

| O que | Onde usar | Pode ir ao navegador? |
|---|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` | Sim |
| **Publishable key** (`sb_publishable_...`) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim |
| **Secret key** (`sb_secret_...`) | `SUPABASE_SECRET_KEY` | **NUNCA** |

Se o painel só mostrar as chaves antigas, a *publishable* equivale à **anon key** e a *secret* à **service_role key**
(aba "Legacy API Keys"). Funcionam do mesmo jeito neste projeto.

A chave secreta ignora todas as regras de segurança. Ela só é usada pelo `npm run seed`, na sua máquina.
Não a cadastre na Vercel.

## 4. Criar o `.env.local`
Na pasta do projeto, copie o exemplo e preencha:

```bash
cp .env.local.example .env.local
```

Abra o `.env.local` no editor e preencha as 3 chaves do passo 3. O arquivo já é ignorado pelo git.

## 5. Criar as tabelas e as regras de segurança
**SQL Editor → New query.**
1. Abra `supabase/migrations/20261009000001_schema.sql`, copie **todo** o conteúdo, cole no editor e clique em **Run**.
   Deve terminar com "Success. No rows returned".
2. Nova query: repita com `supabase/migrations/20261009000002_rls_policies.sql`.
3. Nova query: repita com `supabase/migrations/20261009000003_service_role_grants.sql` (dá ao script de seed permissão nas tabelas; necessário porque "Automatically expose new tables" está desligado).

Rode **uma vez cada, nesta ordem**. Se rodar de novo, dará erro de "já existe" (isso é esperado e não danifica nada).

4. Nova query: `supabase/migrations/20261010000001_agenda_privada.sql` (cada profissional passa a ver só os próprios atendimentos).

## 5c. Aniversário da cliente
Nova query: `supabase/migrations/20261011000001_aniversario_clientes.sql`. **Rode antes de publicar o código novo**: o app passa a ler as colunas de aniversário, e sem a migração as telas de clientes e o Início dão erro.

## 5b. Cadastro com código de convite
1. Nova query: `supabase/migrations/20261010000002_cadastro_convite.sql`.
2. Nova query, com o código que **você** escolher (8 caracteres ou mais; só você e quem receber o convite sabem):
   `select private.set_invite_code('escolha-um-codigo-aqui');`
   Para trocar o código mais tarde, rode o mesmo comando com outro valor. O banco guarda só o hash: ninguém consegue ler o código depois.
3. Quem se cadastra informa nome, e-mail, senha e esse código. Código errado: cadastro recusado. Sem código (chamando a API direto): a conta nasce sem acesso a nada.
4. Opcional, para os testes automáticos do cadastro com código certo: coloque `SIGNUP_TEST_INVITE_CODE=...` no `.env.local` (nunca na Vercel nem no Git).

Se algum passo der erro, copie a mensagem **sem incluir chaves** e me envie.

## 6. Conferir
**Table Editor:** devem aparecer 9 tabelas (`profiles`, `salons`, `salon_members`, `professionals`, `clients`, `services`,
`appointments`, `business_hours`, `blocked_times`), todas com o selo de **RLS ativado**.

## 7. Criar o salão e as duas profissionais de teste
No `.env.local`, preencha os campos `SEED_*`: nome do salão, nome, e-mail e senha de cada profissional
(e-mails de teste; as profissionais trocam depois). Use senhas com pelo menos 8 caracteres.

```bash
npm run seed
```

Deve imprimir `OK: <nome> <e-mail>` para cada uma e `Seed concluído.`. Pode rodar de novo sem duplicar nada.
Em **Authentication → Users** devem aparecer as 2 contas.

## 8. Rodar o app

```bash
npm run dev
```

Abra http://localhost:3000, entre com uma das contas de teste. Teste também o "Lembrar de mim" e o botão **Sair** (Menu).

## 9. Publicação (Etapa 7)
Na Vercel, cadastre **somente** `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Depois, em **Authentication → URL Configuration**, ajuste o Site URL para o endereço publicado.

## Observações do plano gratuito (não verificadas agora)
- O Supabase Free costuma pausar projetos sem atividade por cerca de uma semana. O uso diário evita isso; confirme nos termos atuais.
- Os backups do plano gratuito são limitados. Vamos definir uma rotina de exportação na Etapa 7.
