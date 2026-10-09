-- Nail Agenda — permissões do papel de administração (service_role)
-- Execute DEPOIS das migrações 0001 e 0002.
--
-- Com "Automatically expose new tables" desligado, o Supabase não concede privilégios
-- automáticos às tabelas novas, nem para o service_role (chave secreta). O script
-- `npm run seed` e tarefas administrativas usam esse papel (que ignora o RLS), então ele
-- precisa de permissão explícita. O papel anon continua sem nenhum acesso.

grant usage on schema public to service_role;

grant all on public.profiles, public.salons, public.salon_members, public.professionals,
             public.clients, public.services, public.appointments,
             public.business_hours, public.blocked_times
  to service_role;
