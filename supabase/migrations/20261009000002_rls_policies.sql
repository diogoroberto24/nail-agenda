-- Nail Agenda — segurança (RLS e permissões)
-- Execute DEPOIS da migração 0001.
--
-- Modelo:
--  * ninguém sem login (role anon) acessa nada
--  * membro do salão (authenticated) lê todos os dados do salão (agenda compartilhada)
--  * escrita: regras por tabela abaixo; sem DELETE em clientes, serviços e atendimentos
--    (cliente é arquivado, serviço é desativado, atendimento é cancelado)
--  * salons, salon_members e professionals são gerenciados pelo administrador (script de seed / service_role)
--  * como "Automatically expose new tables" está desligado, as permissões são concedidas explicitamente aqui

-- ------------------------------------------------------- funções auxiliares
create or replace function private.is_salon_member(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members m
    where m.salon_id = p_salon_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_professional(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.professionals p
    where p.id = p_professional_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_salon_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members a
    join public.salon_members b on b.salon_id = a.salon_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

revoke all on function private.is_salon_member(uuid)    from public;
revoke all on function private.owns_professional(uuid)  from public;
revoke all on function private.shares_salon_with(uuid)  from public;
grant usage on schema private to authenticated;
grant execute on function private.is_salon_member(uuid)   to authenticated;
grant execute on function private.owns_professional(uuid) to authenticated;
grant execute on function private.shares_salon_with(uuid) to authenticated;

-- ------------------------------------------------------------- RLS ligado
alter table public.profiles       enable row level security;
alter table public.salons         enable row level security;
alter table public.salon_members  enable row level security;
alter table public.professionals  enable row level security;
alter table public.clients        enable row level security;
alter table public.services       enable row level security;
alter table public.appointments   enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_times  enable row level security;

-- ---------------------------------------------------- permissões de tabela
revoke all on public.profiles, public.salons, public.salon_members, public.professionals,
              public.clients, public.services, public.appointments,
              public.business_hours, public.blocked_times
  from anon, authenticated;

grant select on public.salons, public.salon_members to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.professionals to authenticated;
grant update (display_name) on public.professionals to authenticated;

grant select, insert on public.clients to authenticated;
grant update (full_name, phone, notes, archived_at) on public.clients to authenticated;

grant select, insert on public.services to authenticated;
grant update (name, description, default_duration_minutes, default_price, active) on public.services to authenticated;

grant select, insert on public.appointments to authenticated;
grant update (professional_id, client_id, service_id, start_at, end_at,
              duration_minutes_at_booking, price_at_booking, status, notes, cancellation_reason)
  on public.appointments to authenticated;

grant select, insert, delete on public.business_hours, public.blocked_times to authenticated;
grant update (weekday, start_time, end_time) on public.business_hours to authenticated;
grant update (kind, start_at, end_at, reason) on public.blocked_times to authenticated;

-- ---------------------------------------------------------------- políticas
-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_salon_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- salons / salon_members: somente leitura para membros
create policy salons_select on public.salons for select to authenticated
  using (private.is_salon_member(id));
create policy salon_members_select on public.salon_members for select to authenticated
  using (private.is_salon_member(salon_id));

-- professionals: todos os membros leem; cada uma altera só o próprio nome de exibição
create policy professionals_select on public.professionals for select to authenticated
  using (private.is_salon_member(salon_id));
create policy professionals_update_own on public.professionals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- clients: cadastro compartilhado; sem delete (arquivar via archived_at)
create policy clients_select on public.clients for select to authenticated
  using (private.is_salon_member(salon_id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.is_salon_member(salon_id) and created_by = (select auth.uid()));
create policy clients_update on public.clients for update to authenticated
  using (private.is_salon_member(salon_id)) with check (private.is_salon_member(salon_id));

-- services: todos veem; cada profissional só cria e altera os próprios; sem delete (desativar)
create policy services_select on public.services for select to authenticated
  using (private.is_salon_member(salon_id));
create policy services_insert on public.services for insert to authenticated
  with check (private.is_salon_member(salon_id) and private.owns_professional(professional_id));
create policy services_update on public.services for update to authenticated
  using (private.owns_professional(professional_id))
  with check (private.owns_professional(professional_id));

-- appointments: agenda compartilhada para LEITURA; cada profissional cria e altera só os PRÓPRIOS atendimentos.
-- Sem delete (cancelar via status). Não é possível passar um atendimento para a colega (o with check bloqueia).
create policy appointments_select on public.appointments for select to authenticated
  using (private.is_salon_member(salon_id));
create policy appointments_insert on public.appointments for insert to authenticated
  with check (private.is_salon_member(salon_id)
              and private.owns_professional(professional_id)
              and created_by = (select auth.uid()));
create policy appointments_update on public.appointments for update to authenticated
  using (private.owns_professional(professional_id))
  with check (private.is_salon_member(salon_id) and private.owns_professional(professional_id));

-- business_hours e blocked_times: todas leem; cada profissional gerencia só os próprios
create policy business_hours_select on public.business_hours for select to authenticated
  using (private.is_salon_member(salon_id));
create policy business_hours_insert on public.business_hours for insert to authenticated
  with check (private.is_salon_member(salon_id) and private.owns_professional(professional_id));
create policy business_hours_update on public.business_hours for update to authenticated
  using (private.owns_professional(professional_id)) with check (private.owns_professional(professional_id));
create policy business_hours_delete on public.business_hours for delete to authenticated
  using (private.owns_professional(professional_id));

create policy blocked_times_select on public.blocked_times for select to authenticated
  using (private.is_salon_member(salon_id));
create policy blocked_times_insert on public.blocked_times for insert to authenticated
  with check (private.is_salon_member(salon_id) and private.owns_professional(professional_id));
create policy blocked_times_update on public.blocked_times for update to authenticated
  using (private.owns_professional(professional_id)) with check (private.owns_professional(professional_id));
create policy blocked_times_delete on public.blocked_times for delete to authenticated
  using (private.owns_professional(professional_id));
