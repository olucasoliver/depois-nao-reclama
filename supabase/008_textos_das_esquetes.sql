-- 008: anexar o texto da esquete (PDF ou Word) no Banco de Esquetes
-- Os arquivos ficam numa pasta privada do Supabase Storage ("esquetes-textos").
-- Toda a equipe aprovada pode abrir; só a Direção envia, troca ou remove.

alter table public.esquetes add column if not exists texto_arquivo text;  -- caminho do arquivo na pasta
alter table public.esquetes add column if not exists texto_nome text;     -- nome original, para mostrar e baixar

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('esquetes-textos', 'esquetes-textos', false, 20971520, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%esquetes-textos%' or coalesce(with_check, '') ilike '%esquetes-textos%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "equipe le textos das esquetes" on storage.objects for select to authenticated
  using (bucket_id = 'esquetes-textos' and public.aprovado());
create policy "direcao envia textos das esquetes" on storage.objects for insert to authenticated
  with check (bucket_id = 'esquetes-textos' and public.e_direcao());
create policy "direcao altera textos das esquetes" on storage.objects for update to authenticated
  using (bucket_id = 'esquetes-textos' and public.e_direcao());
create policy "direcao remove textos das esquetes" on storage.objects for delete to authenticated
  using (bucket_id = 'esquetes-textos' and public.e_direcao());
