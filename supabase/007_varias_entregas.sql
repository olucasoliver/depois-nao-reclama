-- 007: várias datas de entrega numa mesma demanda da Produção
-- Cada entrega: {"data": "2026-10-30", "nome": "Teaser 1", "feito": false}
-- A coluna "prazo" continua existindo e passa a guardar a próxima entrega pendente,
-- para que filtros, atrasos e pendências sigam funcionando.

alter table public.tarefas_producao add column if not exists prazos jsonb not null default '[]'::jsonb;

begin;
-- Não aciona as travas de aprovação ao copiar as datas antigas
select set_config('app.aprovacao_sistema', '1', true);

-- Demandas que já têm um prazo ganham essa data como primeira entrega
update public.tarefas_producao
   set prazos = jsonb_build_array(jsonb_build_object('data', prazo::text, 'nome', '', 'feito', status = 'Concluído'))
 where prazo is not null and prazos = '[]'::jsonb;

select set_config('app.aprovacao_sistema', '', true);
commit;
