-- Nail Agenda — recorrência de atendimentos
-- Execute DEPOIS da migração 20261011000001.
--
-- Uma recorrência é uma REGRA da profissional ("toda terça às 10:00", "todo dia 15", "a cada 10 dias") que o app
-- transforma em atendimentos reais, até 6 meses à frente (e repõe quando a profissional abre o app).
--  * a recorrência é PRIVADA da profissional, como a agenda: só a dona lê e altera;
--  * cada atendimento gerado guarda a série e a data da ocorrência; o par (série, data) é ÚNICO, então
--    repor ou gerar duas vezes (dois celulares abertos) nunca duplica, e um dia cancelado nunca volta;
--  * sem DELETE: a recorrência é encerrada (ended_at), nunca apagada.
-- Esta migração é idempotente: pode ser executada de novo sem efeito colateral.

create table if not exists public.recurrences (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null,
  professional_id  uuid not null,
  client_id        uuid not null,
  service_id       uuid not null,
  -- semanal (a cada 7 dias), mensal (mesmo dia do mês; 29/30/31 usam o último dia dos meses curtos) ou a cada X dias
  frequency        text not null check (frequency in ('weekly', 'monthly', 'every_days')),
  interval_days    integer check (interval_days between 1 and 365),
  start_date       date not null,            -- data do primeiro atendimento (dia local do salão)
  start_time       time not null,            -- horário local do salão
  duration_minutes integer not null check (duration_minutes > 0),
  price            numeric(10, 2) not null check (price >= 0),
  notes            text,
  end_date         date,                     -- vazio = segue repondo 6 meses à frente
  skipped_dates    date[] not null default '{}',  -- datas puladas ao criar (a reposição não recria)
  ended_at         timestamptz,              -- preenchido quando a recorrência é encerrada
  created_by       uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((frequency = 'every_days') = (interval_days is not null)),
  check (end_date is null or end_date >= start_date),
  unique (id, professional_id),
  foreign key (professional_id, salon_id)   references public.professionals (id, salon_id) on delete restrict,
  foreign key (client_id, salon_id)         references public.clients (id, salon_id)       on delete restrict,
  foreign key (service_id, professional_id) references public.services (id, professional_id) on delete restrict
);

create index if not exists recurrences_professional_idx on public.recurrences (professional_id) where ended_at is null;
create index if not exists recurrences_client_idx on public.recurrences (client_id);

drop trigger if exists set_updated_at on public.recurrences;
create trigger set_updated_at before update on public.recurrences for each row execute function private.set_updated_at();

-- ligação do atendimento com a série
alter table public.appointments
  add column if not exists recurrence_id   uuid,
  add column if not exists occurrence_date date;

alter table public.appointments drop constraint if exists appointments_recurrence_pair;
alter table public.appointments add constraint appointments_recurrence_pair
  check ((recurrence_id is null) = (occurrence_date is null));

-- a série precisa ser da MESMA profissional do atendimento
alter table public.appointments drop constraint if exists appointments_recurrence_fk;
alter table public.appointments add constraint appointments_recurrence_fk
  foreign key (recurrence_id, professional_id) references public.recurrences (id, professional_id) on delete restrict;

-- (série, data) único: reposição idempotente e sem duplicar entre aparelhos
create unique index if not exists appointments_recurrence_occurrence_uniq
  on public.appointments (recurrence_id, occurrence_date) where recurrence_id is not null;

-- ---------------------------------------------------------------- segurança
alter table public.recurrences enable row level security;

revoke all on public.recurrences from anon, authenticated;
grant select, insert on public.recurrences to authenticated;
-- só o que muda depois de criada: encerrar, trocar o fim, pular datas e observações
grant update (end_date, skipped_dates, ended_at, notes) on public.recurrences to authenticated;
grant all on public.recurrences to service_role;

drop policy if exists recurrences_select on public.recurrences;
drop policy if exists recurrences_insert on public.recurrences;
drop policy if exists recurrences_update on public.recurrences;

create policy recurrences_select on public.recurrences for select to authenticated
  using (private.owns_professional(professional_id));
create policy recurrences_insert on public.recurrences for insert to authenticated
  with check (private.is_salon_member(salon_id)
              and private.owns_professional(professional_id)
              and created_by = (select auth.uid()));
create policy recurrences_update on public.recurrences for update to authenticated
  using (private.owns_professional(professional_id))
  with check (private.owns_professional(professional_id));
