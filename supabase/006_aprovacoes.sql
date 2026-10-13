-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 006: aprovações da Direção
--   - a Produção envia itens para aprovação (orçamento, divulgação,
--     tarefas) ou decisões avulsas
--   - a Direção aprova, recusa ou pede ajustes, com comentário
--   - travas no banco:
--       * gasto (despesa) só fica Aprovado ou Pago depois de aprovado
--       * divulgação só fica Aprovada, Agendada ou Publicada depois de aprovada
--       * tarefa marcada como "precisa de aprovação" só é concluída depois
--   - itens que já estavam aprovados, pagos ou publicados contam como aprovados
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda dentro de uma transação e pode ser executado mais de uma vez.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Situação da aprovação em cada item
-- ---------------------------------------------------------------------
alter table public.orcamento add column if not exists aprovacao text;
alter table public.divulgacao add column if not exists aprovacao text;
alter table public.tarefas_producao add column if not exists aprovacao text;
alter table public.tarefas_producao add column if not exists precisa_aprovacao boolean not null default false;

update public.orcamento set aprovacao = 'aprovado'
 where aprovacao is null and coalesce(tipo, 'Despesa') = 'Despesa' and status in ('Aprovado', 'Pago');
update public.divulgacao set aprovacao = 'aprovado'
 where aprovacao is null and status in ('Aprovado', 'Agendado', 'Publicado');

-- ---------------------------------------------------------------------
-- 2. Pedidos de aprovação
-- ---------------------------------------------------------------------
create table if not exists public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Orçamento', 'Divulgação', 'Tarefa', 'Decisão')),
  ref_id text,
  titulo text not null,
  descricao text,
  valor numeric,
  link text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'ajustes', 'cancelado')),
  solicitado_por uuid references public.perfis(id) on delete set null,
  solicitado_em timestamptz not null default now(),
  resposta text,
  respondido_por uuid references public.perfis(id) on delete set null,
  respondido_em timestamptz,
  historico jsonb not null default '[]'::jsonb
);
create index if not exists aprovacoes_ref_idx on public.aprovacoes (tipo, ref_id);

-- ---------------------------------------------------------------------
-- 3. Travas
-- ---------------------------------------------------------------------
create or replace function public.trava_aprovacao()
returns trigger language plpgsql set search_path = public as $$
declare
  sistema boolean := coalesce(current_setting('app.aprovacao_sistema', true), '') = '1';
begin
  if sistema then return new; end if;

  -- A Direção pode tudo; quando ela mesma marca como aprovado, conta como aprovado
  if public.e_direcao() then
    if tg_table_name = 'orcamento' then
      if coalesce(new.tipo, 'Despesa') = 'Despesa' and new.status in ('Aprovado', 'Pago') then new.aprovacao := 'aprovado'; end if;
    elsif tg_table_name = 'divulgacao' then
      if new.status in ('Aprovado', 'Agendado', 'Publicado') then new.aprovacao := 'aprovado'; end if;
    elsif tg_table_name = 'tarefas_producao' then
      if coalesce(new.precisa_aprovacao, false) and new.status = 'Concluído' then new.aprovacao := 'aprovado'; end if;
    end if;
    return new;
  end if;

  -- Quem não é da Direção não mexe na situação da aprovação
  if tg_op = 'INSERT' then new.aprovacao := null; else new.aprovacao := old.aprovacao; end if;

  if tg_table_name = 'orcamento' then
    if coalesce(new.tipo, 'Despesa') = 'Despesa' then
      if tg_op = 'UPDATE' and old.aprovacao = 'aprovado' and new.valor is distinct from old.valor then
        if new.status = 'Pago' then
          raise exception 'O valor deste gasto já pago mudou. Peça para a direção ajustar ou envie de novo para aprovação.';
        end if;
        new.aprovacao := null;
        if new.status = 'Aprovado' then new.status := 'Previsto'; end if;
      end if;
      if new.status in ('Aprovado', 'Pago') and coalesce(new.aprovacao, '') <> 'aprovado' then
        raise exception 'Este gasto precisa ser aprovado pela direção antes de ficar como "%". Envie para aprovação.', new.status;
      end if;
    end if;

  elsif tg_table_name = 'divulgacao' then
    if new.status in ('Aprovado', 'Agendado', 'Publicado') and coalesce(new.aprovacao, '') <> 'aprovado' then
      raise exception 'Esta peça precisa ser aprovada pela direção antes de ficar como "%". Envie para aprovação.', new.status;
    end if;

  elsif tg_table_name = 'tarefas_producao' then
    if tg_op = 'UPDATE' and old.precisa_aprovacao and not coalesce(new.precisa_aprovacao, false) then
      new.precisa_aprovacao := true;
    end if;
    if coalesce(new.precisa_aprovacao, false) and new.status = 'Concluído' and coalesce(new.aprovacao, '') <> 'aprovado' then
      raise exception 'Esta tarefa precisa da aprovação da direção antes de ser concluída. Envie para aprovação.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trava_aprovacao on public.orcamento;
drop trigger if exists trava_aprovacao on public.divulgacao;
drop trigger if exists trava_aprovacao on public.tarefas_producao;
create trigger trava_aprovacao before insert or update on public.orcamento for each row execute function public.trava_aprovacao();
create trigger trava_aprovacao before insert or update on public.divulgacao for each row execute function public.trava_aprovacao();
create trigger trava_aprovacao before insert or update on public.tarefas_producao for each row execute function public.trava_aprovacao();

-- ---------------------------------------------------------------------
-- 4. Funções do fluxo
-- ---------------------------------------------------------------------
create or replace function public.nome_de(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nome, email) from public.perfis where id = p;
$$;

create or replace function public.marcar_item(p_tipo text, p_ref text, p_situacao text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ref is null then return; end if;
  perform set_config('app.aprovacao_sistema', '1', true);
  if p_tipo = 'Orçamento' then
    update public.orcamento set aprovacao = p_situacao,
      status = case when p_situacao = 'aprovado' and status = 'Previsto' then 'Aprovado' else status end
    where id::text = p_ref;
  elsif p_tipo = 'Divulgação' then
    update public.divulgacao set aprovacao = p_situacao,
      status = case
        when p_situacao = 'pendente' and status in ('Planejado', 'Em produção') then 'Aguardando aprovação'
        when p_situacao = 'aprovado' and status in ('Planejado', 'Em produção', 'Aguardando aprovação') then 'Aprovado'
        when p_situacao in ('ajustes', 'recusado') and status = 'Aguardando aprovação' then 'Em produção'
        else status end
    where id::text = p_ref;
  elsif p_tipo = 'Tarefa' then
    update public.tarefas_producao set aprovacao = p_situacao, precisa_aprovacao = true where id::text = p_ref;
  end if;
  perform set_config('app.aprovacao_sistema', '', true);
end;
$$;

create or replace function public.solicitar_aprovacao(p_tipo text, p_ref text, p_titulo text,
  p_descricao text default null, p_valor numeric default null, p_link text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evento jsonb;
begin
  if not public.e_gestao() then raise exception 'Só Direção e Produção enviam pedidos de aprovação.'; end if;
  if p_tipo not in ('Orçamento', 'Divulgação', 'Tarefa', 'Decisão') then raise exception 'Tipo inválido.'; end if;
  if nullif(trim(p_titulo), '') is null then raise exception 'Informe o título do pedido.'; end if;

  if p_ref is not null then
    select id into v_id from public.aprovacoes
     where tipo = p_tipo and ref_id = p_ref and status in ('pendente', 'ajustes')
     order by solicitado_em desc limit 1;
  end if;

  v_evento := jsonb_build_object('acao', case when v_id is null then 'enviado' else 'reenviado' end,
    'por', public.nome_de(auth.uid()), 'em', now(), 'comentario', nullif(trim(p_descricao), ''));

  if v_id is null then
    insert into public.aprovacoes (tipo, ref_id, titulo, descricao, valor, link, solicitado_por, historico)
    values (p_tipo, p_ref, trim(p_titulo), nullif(trim(p_descricao), ''), p_valor, nullif(trim(p_link), ''), auth.uid(), jsonb_build_array(v_evento))
    returning id into v_id;
    -- decisão avulsa aponta para si mesma, para poder ser reenviada mantendo o histórico
    if p_tipo = 'Decisão' and p_ref is null then
      update public.aprovacoes set ref_id = v_id::text where id = v_id;
    end if;
  else
    update public.aprovacoes set status = 'pendente', titulo = trim(p_titulo), descricao = nullif(trim(p_descricao), ''),
      valor = p_valor, link = nullif(trim(p_link), ''), solicitado_em = now(), historico = historico || v_evento
    where id = v_id;
  end if;

  perform public.marcar_item(p_tipo, p_ref, 'pendente');
  return v_id;
end;
$$;

create or replace function public.responder_aprovacao(p_id uuid, p_decisao text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes;
begin
  if not public.e_direcao() then raise exception 'Só a direção responde aos pedidos de aprovação.'; end if;
  if p_decisao not in ('aprovado', 'recusado', 'ajustes') then raise exception 'Decisão inválida.'; end if;
  if p_decisao = 'ajustes' and nullif(trim(p_comentario), '') is null then
    raise exception 'Diga o que precisa ser ajustado.';
  end if;
  select * into a from public.aprovacoes where id = p_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if a.status not in ('pendente', 'ajustes') then raise exception 'Este pedido já foi respondido.'; end if;

  update public.aprovacoes set status = p_decisao, resposta = nullif(trim(p_comentario), ''),
    respondido_por = auth.uid(), respondido_em = now(),
    historico = historico || jsonb_build_object('acao', p_decisao, 'por', public.nome_de(auth.uid()), 'em', now(),
                                                'comentario', nullif(trim(p_comentario), ''))
  where id = p_id;

  perform public.marcar_item(a.tipo, a.ref_id, p_decisao);
end;
$$;

create or replace function public.cancelar_aprovacao(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes;
begin
  select * into a from public.aprovacoes where id = p_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not (public.e_direcao() or (public.e_gestao() and a.solicitado_por = auth.uid())) then
    raise exception 'Só quem enviou ou a direção pode cancelar.';
  end if;
  if a.status not in ('pendente', 'ajustes') then raise exception 'Este pedido já foi encerrado.'; end if;
  update public.aprovacoes set status = 'cancelado',
    historico = historico || jsonb_build_object('acao', 'cancelado', 'por', public.nome_de(auth.uid()), 'em', now())
  where id = p_id;
  perform public.marcar_item(a.tipo, a.ref_id, null);
end;
$$;

revoke all on function public.marcar_item(text, text, text) from public, anon, authenticated;
revoke all on function public.solicitar_aprovacao(text, text, text, text, numeric, text) from public, anon;
revoke all on function public.responder_aprovacao(uuid, text, text) from public, anon;
revoke all on function public.cancelar_aprovacao(uuid) from public, anon;
grant execute on function public.solicitar_aprovacao(text, text, text, text, numeric, text),
  public.responder_aprovacao(uuid, text, text), public.cancelar_aprovacao(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Quem vê os pedidos: Direção e Produção (só leitura; mudanças pelas funções)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'aprovacoes'
  loop
    execute format('drop policy %I on public.aprovacoes', r.policyname);
  end loop;
end $$;
alter table public.aprovacoes enable row level security;
create policy "gestao le" on public.aprovacoes for select to authenticated using (public.e_gestao());
grant select on public.aprovacoes to authenticated;

commit;

notify pgrst, 'reload schema';
