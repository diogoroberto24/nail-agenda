-- Nail Agenda — esquema inicial
-- Execute no SQL Editor do Supabase (uma única vez), antes da migração 0002.
--
-- Convenções:
--  * horários em timestamptz (UTC); o fuso do salão (America/Sao_Paulo) fica em salons.timezone
--  * dinheiro em numeric(10,2)
--  * telefone guardado só com dígitos, com DDI: 55 + DDD + número (12 ou 13 dígitos)
--  * status do atendimento em inglês no banco; a interface traduz
--  * integridade entre salão, profissional, cliente e serviço garantida por chaves estrangeiras compostas
--  * NÃO existe restrição de sobreposição de horários: o sistema apenas AVISA (decisão do produto)

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ------------------------------------------------------------------ salons
create table public.salons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  timezone    text not null default 'America/Sao_Paulo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------- salon_members
create table public.salon_members (
  salon_id    uuid not null references public.salons (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'professional' check (role in ('owner', 'professional')),
  created_at  timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create index salon_members_user_idx on public.salon_members (user_id);

-- ----------------------------------------------------------- professionals
create table public.professionals (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null,
  user_id       uuid not null,
  display_name  text not null check (length(trim(display_name)) > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, salon_id),
  unique (salon_id, user_id),
  foreign key (salon_id, user_id)
    references public.salon_members (salon_id, user_id) on delete restrict
);

-- ----------------------------------------------------------------- clients
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) > 0),
  phone       text not null check (phone ~ '^[0-9]{12,13}$'),
  notes       text,
  archived_at timestamptz,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, salon_id)
);

-- telefone repetido não é bloqueado: a aplicação avisa e oferece abrir o cadastro existente
create index clients_salon_phone_idx on public.clients (salon_id, phone);
create index clients_salon_name_idx on public.clients (salon_id, lower(full_name));

-- ---------------------------------------------------------------- services
-- Serviço pertence a UMA profissional (cada uma define seus serviços e preços).
create table public.services (
  id                        uuid primary key default gen_random_uuid(),
  salon_id                  uuid not null,
  professional_id           uuid not null,
  name                      text not null check (length(trim(name)) > 0),
  description               text,
  default_duration_minutes  integer not null check (default_duration_minutes between 5 and 720),
  default_price             numeric(10, 2) not null check (default_price >= 0),
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (id, professional_id),
  foreign key (professional_id, salon_id)
    references public.professionals (id, salon_id) on delete restrict
);

create index services_professional_idx on public.services (professional_id) where active;

-- ------------------------------------------------------------ appointments
create table public.appointments (
  id                          uuid primary key default gen_random_uuid(),
  salon_id                    uuid not null,
  professional_id             uuid not null,
  client_id                   uuid not null,
  service_id                  uuid not null,
  start_at                    timestamptz not null,
  end_at                      timestamptz not null,
  -- duração e preço são cópias feitas no agendamento; mudar o serviço depois não altera o histórico
  duration_minutes_at_booking integer not null check (duration_minutes_at_booking > 0),
  price_at_booking            numeric(10, 2) not null check (price_at_booking >= 0),
  status                      text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes                       text,
  cancellation_reason         text,
  created_by                  uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (end_at > start_at),
  check (end_at = start_at + make_interval(mins => duration_minutes_at_booking)),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete restrict,
  foreign key (client_id, salon_id)       references public.clients (id, salon_id)       on delete restrict,
  foreign key (service_id, professional_id) references public.services (id, professional_id) on delete restrict
);

create index appointments_salon_start_idx        on public.appointments (salon_id, start_at);
create index appointments_professional_start_idx on public.appointments (professional_id, start_at);
create index appointments_client_start_idx       on public.appointments (client_id, start_at desc);

-- ---------------------------------------------------------- business_hours
-- Disponibilidade OPCIONAL. Várias janelas por dia são permitidas; as pausas são os intervalos entre janelas.
-- weekday: 0 = domingo ... 6 = sábado. Horários no fuso do salão.
create table public.business_hours (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null,
  professional_id  uuid not null,
  weekday          smallint not null check (weekday between 0 and 6),
  start_time       time not null,
  end_time         time not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);

create index business_hours_professional_idx on public.business_hours (professional_id, weekday);

-- ------------------------------------------------------------ blocked_times
create table public.blocked_times (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null,
  professional_id  uuid not null,
  kind             text not null default 'block' check (kind in ('day_off', 'vacation', 'block')),
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  reason           text,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);

create index blocked_times_professional_idx on public.blocked_times (professional_id, start_at);

-- --------------------------------------------------------- updated_at triggers
create trigger set_updated_at before update on public.profiles      for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.salons        for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.professionals for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.clients       for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services      for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_hours for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.blocked_times for each row execute function private.set_updated_at();
