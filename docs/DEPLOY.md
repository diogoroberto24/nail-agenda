# Publicação na Vercel

Antes de publicar: `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build` precisam passar, e o Supabase precisa estar
configurado (docs/SUPABASE.md). Os nomes de menus da Vercel e do Supabase mudam com o tempo; se algo estiver diferente,
procure o equivalente.

## 1. Criar o projeto na Vercel
Há duas formas:
- **Pela interface:** em vercel.com, **Add New → Project**, importe o repositório (é preciso enviar o código a um repositório
  Git, como o GitHub; hoje o projeto só existe localmente).
- **Pela linha de comando**, sem repositório: `npx vercel` na pasta do projeto, entrando na sua conta quando pedir.
  O framework (Next.js) é detectado sozinho.

Nome sugerido do projeto: `nail-agenda`.

## 2. Variáveis de ambiente
Em **Project Settings → Environment Variables**, cadastre **somente** estas duas, para Production (e Preview, se usar):

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | O endereço do projeto, **só o domínio**: `https://xxxx.supabase.co` (sem `/rest/v1/`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A chave pública (`sb_publishable_...`). |

**Não cadastre** `SUPABASE_SECRET_KEY` nem as `SEED_*`: elas são só para scripts na sua máquina.
Essas duas variáveis públicas são embutidas na compilação: depois de mudá-las, faça um novo deploy.

## 3. Região das funções
O Supabase está em São Paulo. Para o app responder mais rápido, escolha a região **São Paulo (gru1)** em
**Project Settings → Functions → Function Region**, se o seu plano permitir (não verificado para o plano gratuito).

## 4. Ajustar o Supabase ao endereço publicado
No Supabase, **Authentication → URL Configuration**: coloque o endereço publicado (ex.: `https://nail-agenda.vercel.app`)
em **Site URL**. Isso é necessário para o link de confirmação da troca de e-mail abrir no lugar certo.
Confirme também que o **cadastro público continua desligado**.

## 5. Testar o endereço publicado
1. Abra o endereço no celular e entre com uma das contas.
2. Confira Início, Agenda, Clientes e Serviços.
3. Faça um atendimento de teste, confirme e cancele (e apague o cliente de teste arquivando-o).
4. Instale no celular (Menu → Configurações).
5. Em **Menu → Perfil**, teste a troca de e-mail com um endereço seu: o link de confirmação precisa chegar e funcionar.
   O envio de e-mails do plano gratuito do Supabase tem limite baixo por hora (não verificado).

## 6. Depois de publicar
- Faça um `npm run backup` e guarde a pasta em local seguro.
- O plano gratuito do Supabase pode pausar projetos sem uso por cerca de uma semana (não verificado); o uso diário evita isso.
- Para atualizar o app: novo deploy (Git push, se ligou o repositório, ou `npx vercel --prod`).
