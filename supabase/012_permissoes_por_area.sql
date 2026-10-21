-- 012: as funções de área passam a liberar o trabalho de cada um
--   Financeiro .................................. Orçamento
--   Divulgação, Social Media, Fotografia, Vídeo . Divulgação
--   Figurino, Adereços, Direção de arte, Técnico  Necessidades de cena e Checklist Final
--   Assistente de produção ...................... Demandas da Produção e Checklist Final
--   Convidado ................................... só consulta
-- Direção e Produção continuam podendo tudo isso. Aprovações seguem com a Direção.
-- Rode depois do 006.

create or replace function public.tem_alguma_funcao(p_nomes text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.aprovado() and exists (
    select 1 from public.perfil_funcoes pf
    join public.funcoes f on f.id = pf.funcao_id
    where pf.perfil_id = auth.uid() and f.ativo and f.nome = any (p_nomes)
  );
$$;

create or replace function public.pode_area(p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_gestao() or public.tem_alguma_funcao(case p_area
    when 'orcamento'  then array['Financeiro']
    when 'divulgacao' then array['Divulgação', 'Social Media', 'Fotografia', 'Vídeo']
    when 'cena'       then array['Figurino', 'Adereços', 'Direção de arte', 'Técnico']
    when 'checklist'  then array['Figurino', 'Adereços', 'Direção de arte', 'Técnico', 'Assistente de produção']
    when 'tarefas'    then array['Assistente de produção']
    else array[]::text[] end);
$$;
grant execute on function public.tem_alguma_funcao(text[]), public.pode_area(text) to authenticated;

-- Regras das tabelas
drop policy if exists "gestao orcamento" on public.orcamento;
drop policy if exists "area altera" on public.orcamento;
create policy "area altera" on public.orcamento for all to authenticated
  using (public.pode_area('orcamento')) with check (public.pode_area('orcamento'));

drop policy if exists "gestao altera" on public.divulgacao;
drop policy if exists "area altera" on public.divulgacao;
create policy "area altera" on public.divulgacao for all to authenticated
  using (public.pode_area('divulgacao')) with check (public.pode_area('divulgacao'));

drop policy if exists "gestao altera" on public.tarefas_producao;
drop policy if exists "area altera" on public.tarefas_producao;
create policy "area altera" on public.tarefas_producao for all to authenticated
  using (public.pode_area('tarefas')) with check (public.pode_area('tarefas'));

drop policy if exists "gestao altera" on public.esquete_itens;
drop policy if exists "area altera" on public.esquete_itens;
create policy "area altera" on public.esquete_itens for all to authenticated
  using (public.pode_area('cena')) with check (public.pode_area('cena'));

drop policy if exists "gestao altera" on public.checklist;
drop policy if exists "area altera" on public.checklist;
create policy "area altera" on public.checklist for all to authenticated
  using (public.pode_area('checklist')) with check (public.pode_area('checklist'));

-- Pedidos de aprovação: quem trabalha na área envia; vê e cancela os próprios
create or replace function public.solicitar_aprovacao(p_tipo text, p_ref text, p_titulo text,
  p_descricao text default null, p_valor numeric default null, p_link text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evento jsonb;
begin
  if not (public.e_gestao()
          or (p_tipo = 'Orçamento' and public.pode_area('orcamento'))
          or (p_tipo = 'Divulgação' and public.pode_area('divulgacao'))
          or (p_tipo = 'Tarefa' and public.pode_area('tarefas'))) then
    raise exception 'Você não pode enviar este pedido de aprovação.';
  end if;
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

create or replace function public.cancelar_aprovacao(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.aprovacoes;
begin
  select * into a from public.aprovacoes where id = p_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not (public.e_direcao() or a.solicitado_por = auth.uid()) then
    raise exception 'Só quem enviou ou a direção pode cancelar.';
  end if;
  if a.status not in ('pendente', 'ajustes') then raise exception 'Este pedido já foi encerrado.'; end if;
  update public.aprovacoes set status = 'cancelado',
    historico = historico || jsonb_build_object('acao', 'cancelado', 'por', public.nome_de(auth.uid()), 'em', now())
  where id = p_id;
  perform public.marcar_item(a.tipo, a.ref_id, null);
end;
$$;

drop policy if exists "gestao le" on public.aprovacoes;
drop policy if exists "gestao ou quem pediu le" on public.aprovacoes;
create policy "gestao ou quem pediu le" on public.aprovacoes for select to authenticated
  using (public.e_gestao() or solicitado_por = auth.uid());
