-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 005: orçamento e divulgação
--   - orçamento: tipo (despesa ou receita) e data de vencimento/pagamento
--   - divulgação: fase da campanha e link da arte
--   Lançamentos antigos do orçamento passam a contar como despesa.
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda dentro de uma transação e pode ser executado mais de uma vez.
-- =====================================================================

begin;

alter table public.orcamento add column if not exists tipo text not null default 'Despesa';
alter table public.orcamento add column if not exists data date;

alter table public.divulgacao add column if not exists fase text;
alter table public.divulgacao add column if not exists link text;

commit;

notify pgrst, 'reload schema';
