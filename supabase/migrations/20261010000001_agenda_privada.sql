-- Nail Agenda — agenda privada
-- Execute DEPOIS das migrações 0001 a 0003.
--
-- Mudança de regra: cada profissional passa a ver SOMENTE os próprios atendimentos.
-- Clientes e serviços continuam compartilhados (todo membro do salão lê).
-- Os atendimentos da colega continuam guardados; apenas deixam de ser visíveis para quem não é a dona.
-- Esta migração é idempotente: pode ser executada de novo sem efeito colateral.

drop policy if exists appointments_select on public.appointments;

create policy appointments_select on public.appointments for select to authenticated
  using (private.owns_professional(professional_id));
