-- 011: o elenco também pode anexar o texto das esquetes
-- Regras:
--   - Direção: anexa, troca e remove qualquer texto (como antes)
--   - Elenco: anexa em qualquer esquete que ainda não tem texto,
--     e troca ou remove apenas o texto que ele mesmo enviou
-- Rode depois do 008.

-- Se uma versão anterior destas funções existir com outro tipo de parâmetro
drop function if exists public.anexar_texto_esquete(uuid, text, text);
drop function if exists public.remover_texto_esquete(uuid);

alter table public.esquetes add column if not exists texto_enviado_por uuid references public.perfis(id) on delete set null;

-- Quem pode enviar textos
create or replace function public.pode_enviar_texto()
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_direcao() or public.tem_funcao('Elenco');
$$;

-- Anexa (ou troca) o texto de uma esquete. Devolve o caminho do arquivo anterior, para ser apagado.
create or replace function public.anexar_texto_esquete(p_esquete text, p_caminho text, p_nome text)
returns text language plpgsql security definer set search_path = public as $$
declare v_antigo text; v_dono uuid;
begin
  if not public.pode_enviar_texto() then
    raise exception 'Você não tem permissão para anexar textos.';
  end if;
  if split_part(p_caminho, '/', 1) <> p_esquete or split_part(p_caminho, '/', 2) <> auth.uid()::text then
    raise exception 'Caminho de arquivo inválido.';
  end if;
  select texto_arquivo, texto_enviado_por into v_antigo, v_dono from public.esquetes where id::text = p_esquete for update;
  if not found then raise exception 'Esquete não encontrada.'; end if;
  if v_antigo is not null and not public.e_direcao() and v_dono is distinct from auth.uid() then
    raise exception 'Esta esquete já tem um texto enviado por outra pessoa. Só quem enviou ou a Direção pode trocar.';
  end if;
  update public.esquetes set texto_arquivo = p_caminho, texto_nome = p_nome, texto_enviado_por = auth.uid() where id::text = p_esquete;
  return v_antigo;
end $$;

-- Remove o texto de uma esquete. Devolve o caminho do arquivo, para ser apagado.
create or replace function public.remover_texto_esquete(p_esquete text)
returns text language plpgsql security definer set search_path = public as $$
declare v_antigo text; v_dono uuid;
begin
  select texto_arquivo, texto_enviado_por into v_antigo, v_dono from public.esquetes where id::text = p_esquete for update;
  if not found then raise exception 'Esquete não encontrada.'; end if;
  if v_antigo is null then return null; end if;
  if not public.e_direcao() and (v_dono is distinct from auth.uid() or not public.pode_enviar_texto()) then
    raise exception 'Só quem enviou o texto ou a Direção pode remover.';
  end if;
  update public.esquetes set texto_arquivo = null, texto_nome = null, texto_enviado_por = null where id::text = p_esquete;
  return v_antigo;
end $$;

revoke all on function public.anexar_texto_esquete(text, text, text), public.remover_texto_esquete(text), public.pode_enviar_texto() from public, anon;
grant execute on function public.anexar_texto_esquete(text, text, text), public.remover_texto_esquete(text), public.pode_enviar_texto() to authenticated;

-- Pasta dos arquivos: cada pessoa envia dentro de <esquete>/<seu id>/...
drop policy if exists "direcao envia textos das esquetes" on storage.objects;
drop policy if exists "direcao altera textos das esquetes" on storage.objects;
drop policy if exists "direcao remove textos das esquetes" on storage.objects;
drop policy if exists "equipe envia textos das esquetes" on storage.objects;
drop policy if exists "dono ou direcao remove textos das esquetes" on storage.objects;

create policy "equipe envia textos das esquetes" on storage.objects for insert to authenticated
  with check (bucket_id = 'esquetes-textos' and public.pode_enviar_texto()
              and (public.e_direcao() or split_part(name, '/', 2) = auth.uid()::text));
create policy "direcao altera textos das esquetes" on storage.objects for update to authenticated
  using (bucket_id = 'esquetes-textos' and public.e_direcao());
create policy "dono ou direcao remove textos das esquetes" on storage.objects for delete to authenticated
  using (bucket_id = 'esquetes-textos' and (public.e_direcao() or split_part(name, '/', 2) = auth.uid()::text));
