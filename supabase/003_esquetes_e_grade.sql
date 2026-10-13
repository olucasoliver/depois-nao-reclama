-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 003: ficha completa das esquetes
--   - duração, sinopse, link do texto e notas da direção
--   - personagens de cada esquete, com o ator ou atriz que faz
--   - necessidades de cena (figurino, adereços, cenário, som, luz...)
--   - quem já estava marcado numa esquete vira um personagem "a definir"
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda dentro de uma transação e pode ser executado mais de uma vez.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Novos campos da esquete
-- ---------------------------------------------------------------------
alter table public.esquetes add column if not exists duracao_min integer;
alter table public.esquetes add column if not exists sinopse text;
alter table public.esquetes add column if not exists texto_url text;
alter table public.esquetes add column if not exists notas_direcao text;

-- ---------------------------------------------------------------------
-- 2. Personagens e necessidades de cena
--    (o tipo das chaves acompanha o tipo do id já usado nas tabelas)
-- ---------------------------------------------------------------------
do $$
declare t_esq text; t_el text;
begin
  select format_type(atttypid, atttypmod) into t_esq
    from pg_attribute where attrelid = 'public.esquetes'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into t_el
    from pg_attribute where attrelid = 'public.elenco'::regclass and attname = 'id';

  execute format($f$
    create table if not exists public.personagens (
      id uuid primary key default gen_random_uuid(),
      esquete_id %s not null references public.esquetes(id) on delete cascade,
      nome text not null,
      elenco_id %s references public.elenco(id) on delete set null,
      ordem integer,
      observacoes text,
      created_at timestamptz not null default now()
    )$f$, t_esq, t_el);

  execute format($f$
    create table if not exists public.esquete_itens (
      id uuid primary key default gen_random_uuid(),
      esquete_id %s not null references public.esquetes(id) on delete cascade,
      tipo text not null default 'Outros',
      descricao text not null,
      responsavel text,
      pronto boolean not null default false,
      created_at timestamptz not null default now()
    )$f$, t_esq);
end $$;

create index if not exists personagens_esquete_idx on public.personagens (esquete_id);
create index if not exists esquete_itens_esquete_idx on public.esquete_itens (esquete_id);

-- ---------------------------------------------------------------------
-- 3. Quem já estava marcado em uma esquete vira personagem "a definir"
-- ---------------------------------------------------------------------
insert into public.personagens (esquete_id, nome, elenco_id)
select ee.esquete_id, 'Personagem a definir', ee.elenco_id
from public.esquete_elenco ee
where not exists (
  select 1 from public.personagens p
  where p.esquete_id = ee.esquete_id and p.elenco_id = ee.elenco_id
);

-- ---------------------------------------------------------------------
-- 4. Regras de acesso
--    personagens: equipe lê, Direção altera
--    necessidades de cena: equipe lê, Direção e Produção alteram
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('personagens', 'esquete_itens')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.personagens enable row level security;
alter table public.esquete_itens enable row level security;

create policy "equipe le" on public.personagens for select to authenticated using (public.aprovado());
create policy "direcao altera" on public.personagens for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());

create policy "equipe le" on public.esquete_itens for select to authenticated using (public.aprovado());
create policy "gestao altera" on public.esquete_itens for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

grant select, insert, update, delete on public.personagens, public.esquete_itens to authenticated;

commit;
