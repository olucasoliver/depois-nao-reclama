-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 004: ensaios
--   - tipo do ensaio, convocar o elenco todo, relatório e pendências
--   - cada integrante do elenco pode ser ligado à sua conta na plataforma
--   - presenças: resposta do ator (vou / não vou) e registro de quem foi
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda dentro de uma transação e pode ser executado mais de uma vez.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Campos novos
-- ---------------------------------------------------------------------
alter table public.ensaios add column if not exists tipo text;
alter table public.ensaios add column if not exists convocar_todos boolean not null default false;
alter table public.ensaios add column if not exists relatorio text;
alter table public.ensaios add column if not exists pendencias text;

alter table public.elenco add column if not exists perfil_id uuid references public.perfis(id) on delete set null;
create unique index if not exists elenco_perfil_unico on public.elenco (perfil_id) where perfil_id is not null;

-- ---------------------------------------------------------------------
-- 2. Presenças (o tipo das chaves acompanha os ids já existentes)
-- ---------------------------------------------------------------------
do $$
declare t_ens text; t_el text;
begin
  select format_type(atttypid, atttypmod) into t_ens
    from pg_attribute where attrelid = 'public.ensaios'::regclass and attname = 'id';
  select format_type(atttypid, atttypmod) into t_el
    from pg_attribute where attrelid = 'public.elenco'::regclass and attname = 'id';
  execute format($f$
    create table if not exists public.ensaio_presencas (
      ensaio_id %s not null references public.ensaios(id) on delete cascade,
      elenco_id %s not null references public.elenco(id) on delete cascade,
      resposta text check (resposta in ('vou', 'nao_vou')),
      motivo text,
      respondido_em timestamptz,
      presente boolean,
      primary key (ensaio_id, elenco_id)
    )$f$, t_ens, t_el);
end $$;

-- ---------------------------------------------------------------------
-- 3. O próprio ator responde à convocação
-- ---------------------------------------------------------------------
create or replace function public.responder_convocacao(p_ensaio text, p_resposta text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_elenco text;
begin
  if not public.aprovado() then raise exception 'Acesso não aprovado.'; end if;
  if p_resposta is not null and p_resposta not in ('vou', 'nao_vou') then
    raise exception 'Resposta inválida.';
  end if;
  select id::text into v_elenco from public.elenco where perfil_id = auth.uid() limit 1;
  if v_elenco is null then
    raise exception 'Sua conta ainda não está ligada a um integrante do elenco. Fale com a produção.';
  end if;
  insert into public.ensaio_presencas (ensaio_id, elenco_id, resposta, motivo, respondido_em)
  select e.id, el.id, p_resposta, nullif(trim(p_motivo), ''), now()
  from public.ensaios e, public.elenco el
  where e.id::text = p_ensaio and el.id::text = v_elenco
  on conflict (ensaio_id, elenco_id) do update
    set resposta = excluded.resposta, motivo = excluded.motivo, respondido_em = excluded.respondido_em;
  if not found then raise exception 'Ensaio não encontrado.'; end if;
end;
$$;

revoke all on function public.responder_convocacao(text, text, text) from public, anon;
grant execute on function public.responder_convocacao(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Regras de acesso: equipe lê; Direção e Produção alteram
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'ensaio_presencas'
  loop
    execute format('drop policy %I on public.ensaio_presencas', r.policyname);
  end loop;
end $$;

alter table public.ensaio_presencas enable row level security;
create policy "equipe le" on public.ensaio_presencas for select to authenticated using (public.aprovado());
create policy "gestao altera" on public.ensaio_presencas for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());
grant select, insert, update, delete on public.ensaio_presencas to authenticated;

commit;

-- Avisa a API do Supabase que existem tabelas novas
notify pgrst, 'reload schema';
