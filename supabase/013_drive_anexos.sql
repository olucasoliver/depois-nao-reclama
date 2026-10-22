-- 013: aba DRIVE/ANEXOS (kit de marca, materiais do espetáculo, links do Google Drive)
-- Regras:
--   - Toda a equipe aprovada vê, baixa, envia arquivos e adiciona links
--   - Só a Direção apaga itens e cria, renomeia ou apaga pastas
-- Arquivos ficam numa pasta privada do Supabase Storage ("drive"), até 50 MB cada.

create table if not exists public.drive_pastas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer,
  created_at timestamptz not null default now()
);

create table if not exists public.drive_itens (
  id uuid primary key default gen_random_uuid(),
  pasta_id uuid not null references public.drive_pastas(id) on delete cascade,
  tipo text not null default 'arquivo' check (tipo in ('arquivo', 'link')),
  nome text not null,
  descricao text,
  caminho text,          -- arquivo: caminho na pasta "drive"
  url text,              -- link: endereço (Google Drive, Canva...)
  mime text,
  tamanho bigint,
  enviado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists drive_itens_pasta on public.drive_itens (pasta_id);

alter table public.drive_pastas enable row level security;
alter table public.drive_itens enable row level security;

drop policy if exists "equipe le" on public.drive_pastas;
drop policy if exists "direcao altera" on public.drive_pastas;
create policy "equipe le" on public.drive_pastas for select to authenticated using (public.aprovado());
create policy "direcao altera" on public.drive_pastas for all to authenticated using (public.e_direcao()) with check (public.e_direcao());

drop policy if exists "equipe le" on public.drive_itens;
drop policy if exists "equipe envia" on public.drive_itens;
drop policy if exists "direcao altera" on public.drive_itens;
drop policy if exists "direcao apaga" on public.drive_itens;
create policy "equipe le" on public.drive_itens for select to authenticated using (public.aprovado());
create policy "equipe envia" on public.drive_itens for insert to authenticated
  with check (public.aprovado() and enviado_por = auth.uid());
create policy "direcao altera" on public.drive_itens for update to authenticated using (public.e_direcao()) with check (public.e_direcao());
create policy "direcao apaga" on public.drive_itens for delete to authenticated using (public.e_direcao());

grant select, insert, update, delete on public.drive_pastas, public.drive_itens to authenticated;

-- Pastas iniciais (só se ainda não houver nenhuma)
insert into public.drive_pastas (nome, ordem)
select n, o from (values ('Kit de marca Arcana', 1), ('Kit do espetáculo', 2), ('Fotos', 3), ('Divulgação', 4), ('Documentos', 5)) as v(n, o)
where not exists (select 1 from public.drive_pastas);

-- Pasta privada dos arquivos
insert into storage.buckets (id, name, public, file_size_limit)
values ('drive', 'drive', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%''drive''%' or coalesce(with_check, '') ilike '%''drive''%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "equipe le o drive" on storage.objects for select to authenticated
  using (bucket_id = 'drive' and public.aprovado());
create policy "equipe envia ao drive" on storage.objects for insert to authenticated
  with check (bucket_id = 'drive' and public.aprovado());
create policy "direcao apaga do drive" on storage.objects for delete to authenticated
  using (bucket_id = 'drive' and public.e_direcao());
