-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 001: login, perfis com várias funções, permissões e sessões
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda inteiro dentro de uma transação: se qualquer parte falhar,
-- nada é alterado. Pode ser executado mais de uma vez.
--
-- Perfis de acesso (uma pessoa pode ter vários):
--   Direção   tudo, inclusive aprovar pessoas e montar o repertório
--   Produção  ensaios, tarefas, divulgação, orçamento, checklist,
--             ficha técnica, elenco e sessões
--   Elenco    consulta
-- Quem não está logado ou ainda não foi aprovado não vê nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Perfis, funções e vínculo pessoa x função
-- ---------------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.perfis add column if not exists nome text;
alter table public.perfis add column if not exists email text;
alter table public.perfis add column if not exists status text not null default 'pendente';
alter table public.perfis add column if not exists created_at timestamptz not null default now();

create table if not exists public.funcoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);
alter table public.funcoes add column if not exists ativo boolean not null default true;

-- Nome antigo usado no código anterior
update public.funcoes set nome = 'Direção'
 where nome in ('Diretor', 'Diretora', 'Direcao')
   and not exists (select 1 from public.funcoes where nome = 'Direção');

insert into public.funcoes (nome)
select x.nome from (values ('Direção'), ('Produção'), ('Elenco')) as x(nome)
where not exists (select 1 from public.funcoes f where f.nome = x.nome);

update public.funcoes set ativo = true where nome in ('Direção', 'Produção', 'Elenco');

create table if not exists public.perfil_funcoes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  funcao_id uuid not null references public.funcoes(id) on delete cascade,
  principal boolean not null default false,
  primary key (perfil_id, funcao_id)
);

-- ---------------------------------------------------------------------
-- 2. Sessões do espetáculo
-- ---------------------------------------------------------------------
create table if not exists public.sessoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  abertura time,
  inicio time,
  local text,
  endereco text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Funções auxiliares de permissão
-- ---------------------------------------------------------------------
create or replace function public.aprovado()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado');
$$;

create or replace function public.tem_funcao(p_nome text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.aprovado() and exists (
    select 1 from public.perfil_funcoes pf
    join public.funcoes f on f.id = pf.funcao_id
    where pf.perfil_id = auth.uid() and f.nome = p_nome and f.ativo
  );
$$;

create or replace function public.e_direcao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_funcao('Direção');
$$;

create or replace function public.e_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_funcao('Direção') or public.tem_funcao('Produção');
$$;

-- Primeiro acesso: a pessoa informa o nome e fica aguardando aprovação
drop function if exists public.solicitar_acesso();
create or replace function public.solicitar_acesso(p_nome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  insert into public.perfis (id, nome, email, status)
  values (auth.uid(), nullif(trim(p_nome), ''), (select email from auth.users where id = auth.uid()), 'pendente')
  on conflict (id) do update set nome = coalesce(nullif(trim(excluded.nome), ''), public.perfis.nome),
                                 email = excluded.email;
end;
$$;

grant execute on function public.aprovado(), public.tem_funcao(text), public.e_direcao(),
  public.e_gestao(), public.solicitar_acesso(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Remove as regras antigas (inclusive acesso aberto) e liga o RLS
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'elenco','esquetes','esquete_elenco','ensaios','ensaio_esquetes','tarefas_producao',
      'ficha_tecnica','divulgacao','orcamento','checklist','perfis','funcoes','perfil_funcoes','sessoes')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['elenco','esquetes','esquete_elenco','ensaios','ensaio_esquetes',
    'tarefas_producao','ficha_tecnica','divulgacao','orcamento','checklist','perfis','funcoes',
    'perfil_funcoes','sessoes']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Novas regras
-- ---------------------------------------------------------------------

-- Leitura para toda a equipe aprovada
do $$
declare t text;
begin
  foreach t in array array['elenco','esquetes','esquete_elenco','ensaios','ensaio_esquetes',
    'tarefas_producao','ficha_tecnica','divulgacao','checklist','sessoes','funcoes','perfil_funcoes']
  loop
    execute format('create policy "equipe le" on public.%I for select to authenticated using (public.aprovado())', t);
  end loop;
end $$;

-- Repertório: só a Direção altera
do $$
declare t text;
begin
  foreach t in array array['esquetes','esquete_elenco']
  loop
    execute format('create policy "direcao altera" on public.%I for all to authenticated using (public.e_direcao()) with check (public.e_direcao())', t);
  end loop;
end $$;

-- Produção e Direção alteram o restante da montagem
do $$
declare t text;
begin
  foreach t in array array['elenco','ensaios','ensaio_esquetes','tarefas_producao','ficha_tecnica',
    'divulgacao','checklist','sessoes']
  loop
    execute format('create policy "gestao altera" on public.%I for all to authenticated using (public.e_gestao()) with check (public.e_gestao())', t);
  end loop;
end $$;

-- Orçamento: só Direção e Produção veem e alteram
create policy "gestao orcamento" on public.orcamento for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- Perfis: cada um vê o próprio; a equipe aprovada vê todos; só a Direção aprova e altera
create policy "ve o proprio perfil" on public.perfis for select to authenticated using (id = auth.uid());
create policy "equipe ve perfis" on public.perfis for select to authenticated using (public.aprovado());
create policy "direcao altera perfis" on public.perfis for update to authenticated
  using (public.e_direcao()) with check (public.e_direcao());
create policy "direcao remove perfis" on public.perfis for delete to authenticated using (public.e_direcao());

-- Funções de cada pessoa: só a Direção altera
create policy "direcao altera funcoes da equipe" on public.perfil_funcoes for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());
create policy "direcao altera funcoes" on public.funcoes for all to authenticated
  using (public.e_direcao()) with check (public.e_direcao());

-- ---------------------------------------------------------------------
-- 6. Fotos do elenco: leitura pública do bucket, envio só pela gestão
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%elenco-fotos%' or coalesce(with_check, '') ilike '%elenco-fotos%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "gestao le fotos do elenco" on storage.objects for select to authenticated
  using (bucket_id = 'elenco-fotos' and public.e_gestao());
create policy "gestao envia fotos do elenco" on storage.objects for insert to authenticated
  with check (bucket_id = 'elenco-fotos' and public.e_gestao());
create policy "gestao altera fotos do elenco" on storage.objects for update to authenticated
  using (bucket_id = 'elenco-fotos' and public.e_gestao());
create policy "gestao remove fotos do elenco" on storage.objects for delete to authenticated
  using (bucket_id = 'elenco-fotos' and public.e_gestao());

commit;
