-- Nail Agenda — cadastro de novas profissionais com código de convite
-- Execute DEPOIS da migração 20261010000001.
--
-- Como funciona:
--  * a tela /cadastro chama o Supabase Auth (signUp) enviando nome e código de convite nos metadados;
--  * este trigger (no banco, onde ninguém consegue burlar) confere o código:
--      - código CERTO  → a pessoa entra no salão e ganha o perfil de profissional, com o nome informado;
--      - código ERRADO → o cadastro é recusado (nada é criado);
--      - SEM código    → a conta nasce sem acesso a nada (não é membra de salão alguma): é o caso do
--        script de seed, que liga as contas ao salão por conta própria, e de quem chamar a API direto;
--  * o código NUNCA fica em texto puro: só o hash (sha256) em private.invite_codes, tabela que nenhum
--    papel do app (anon/authenticated) consegue ler;
--  * sem código configurado, TODO cadastro com código é recusado (falha fechada).
--
-- Depois de rodar esta migração, defina o seu código (só você sabe), no SQL Editor:
--     select private.set_invite_code('escolha-um-codigo-com-8-ou-mais-caracteres');
-- Para trocar o código mais tarde, rode o mesmo comando com outro valor.
-- Esta migração é idempotente: pode ser executada de novo sem efeito colateral.

create table if not exists private.invite_codes (
  id          smallint primary key default 1 check (id = 1),  -- um único código vigente
  code_hash   text not null,
  updated_at  timestamptz not null default now()
);
revoke all on private.invite_codes from public, anon, authenticated;
-- segunda camada de proteção: RLS ligado e nenhuma política = nenhum papel do app lê a tabela
-- (as funções abaixo são security definer e rodam como dono, que não é barrado pelo RLS)
alter table private.invite_codes enable row level security;

create or replace function private.hash_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(btrim(coalesce(p_code, ''))), 'utf8')), 'hex');
$$;
revoke all on function private.hash_invite_code(text) from public, anon, authenticated;

-- define (ou troca) o código de convite; só quem tem acesso direto ao banco (você, no SQL Editor) executa
create or replace function private.set_invite_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_code, ''))) < 8 then
    raise exception 'O código de convite precisa ter pelo menos 8 caracteres.';
  end if;
  insert into private.invite_codes (id, code_hash)
  values (1, private.hash_invite_code(p_code))
  on conflict (id) do update set code_hash = excluded.code_hash, updated_at = now();
end;
$$;
revoke all on function private.set_invite_code(text) from public, anon, authenticated;

-- substitui o trigger de novas contas: além do profile, faz a matrícula no salão quando o código confere
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code  text := new.raw_user_meta_data ->> 'invite_code';
  v_name  text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_salon uuid;
begin
  insert into public.profiles (id, full_name) values (new.id, v_name);

  -- sem código: conta sem acesso (seed e chamadas diretas à API)
  if v_code is null then
    return new;
  end if;

  if not exists (select 1 from private.invite_codes c where c.code_hash = private.hash_invite_code(v_code)) then
    raise exception 'invalid_invite_code';
  end if;
  if length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'invalid_name';
  end if;

  select s.id into v_salon from public.salons s order by s.created_at asc limit 1;
  if v_salon is null then
    raise exception 'no_salon';
  end if;

  insert into public.salon_members (salon_id, user_id, role) values (v_salon, new.id, 'professional');
  insert into public.professionals (salon_id, user_id, display_name) values (v_salon, new.id, v_name);
  return new;
end;
$$;
