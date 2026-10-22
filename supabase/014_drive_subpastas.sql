-- 014: DRIVE/ANEXOS com pastas dentro de pastas e envio de pastas inteiras
-- Rode depois do 013.
--   - Toda a equipe aprovada cria pastas (inclusive ao enviar uma pasta do computador)
--   - Só a Direção renomeia ou apaga pastas

alter table public.drive_pastas add column if not exists pai_id uuid references public.drive_pastas(id) on delete cascade;
create index if not exists drive_pastas_pai on public.drive_pastas (pai_id);
alter table public.drive_pastas add column if not exists criado_por uuid references public.perfis(id) on delete set null default auth.uid();

drop policy if exists "direcao altera" on public.drive_pastas;
drop policy if exists "equipe cria" on public.drive_pastas;
drop policy if exists "direcao renomeia" on public.drive_pastas;
drop policy if exists "direcao apaga" on public.drive_pastas;
create policy "equipe cria" on public.drive_pastas for insert to authenticated with check (public.aprovado());
create policy "direcao renomeia" on public.drive_pastas for update to authenticated using (public.e_direcao()) with check (public.e_direcao());
create policy "direcao apaga" on public.drive_pastas for delete to authenticated using (public.e_direcao());
