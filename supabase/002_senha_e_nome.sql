-- =====================================================================
-- Depois Não Reclama | Central de Produção
-- Migração 002: login com senha
--   - a Direção pode redefinir a senha de outra pessoa da equipe
--   - cada pessoa pode atualizar o próprio nome
--
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run.
-- Roda dentro de uma transação e pode ser executado mais de uma vez.
-- =====================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- Direção define uma senha provisória para outra pessoa
create or replace function public.redefinir_senha(p_perfil uuid, p_senha text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.e_direcao() then
    raise exception 'Só a direção pode redefinir senhas.';
  end if;
  if p_perfil = auth.uid() then
    raise exception 'Para trocar a sua própria senha, use Minha conta.';
  end if;
  if coalesce(length(p_senha), 0) < 6 then
    raise exception 'A senha precisa ter pelo menos 6 caracteres.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_perfil;
  if not found then
    raise exception 'Pessoa não encontrada.';
  end if;
end;
$$;

-- Cada pessoa atualiza o próprio nome
create or replace function public.atualizar_meu_nome(p_nome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if nullif(trim(p_nome), '') is null then raise exception 'Informe um nome.'; end if;
  update public.perfis set nome = trim(p_nome) where id = auth.uid();
end;
$$;

revoke all on function public.redefinir_senha(uuid, text) from public, anon;
revoke all on function public.atualizar_meu_nome(text) from public, anon;
grant execute on function public.redefinir_senha(uuid, text), public.atualizar_meu_nome(text) to authenticated;

commit;
