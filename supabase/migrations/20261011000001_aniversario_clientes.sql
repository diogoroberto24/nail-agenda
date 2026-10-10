-- Nail Agenda — aniversário da cliente
-- Execute DEPOIS da migração 20261010000002.
--
-- Guarda dia e mês do aniversário (o ano é opcional). Tudo opcional: cliente sem aniversário continua válida.
-- Vale para as clientes já cadastradas (ficam sem aniversário até alguém preencher).
-- Esta migração é idempotente: pode ser executada de novo sem efeito colateral.

alter table public.clients
  add column if not exists birth_day   smallint,
  add column if not exists birth_month smallint,
  add column if not exists birth_year  smallint;

alter table public.clients drop constraint if exists clients_birthday_valid;
alter table public.clients add constraint clients_birthday_valid check (
  -- sem aniversário: os três vazios
  (birth_day is null and birth_month is null and birth_year is null)
  or (
    -- com aniversário: dia e mês obrigatórios, o ano é opcional
    birth_day is not null
    and birth_month is not null
    and birth_month between 1 and 12
    and birth_day >= 1
    -- 29/02 vale (quem nasce em ano bissexto); os demais dias respeitam o tamanho do mês
    and birth_day <= case birth_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end
    and (birth_year is null or birth_year between 1900 and 2100)
    -- com ano informado, 29/02 só em ano bissexto
    and not (
      birth_year is not null and birth_month = 2 and birth_day = 29
      and not ((birth_year % 4 = 0 and birth_year % 100 <> 0) or birth_year % 400 = 0)
    )
  )
);

-- as colunas novas entram na lista do que as profissionais podem editar
grant update (birth_day, birth_month, birth_year) on public.clients to authenticated;
