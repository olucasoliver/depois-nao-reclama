-- 010: contatos (telefone, e-mail e rede social) no Elenco e em Técnica e Staff

alter table public.elenco add column if not exists telefone text;
alter table public.elenco add column if not exists email text;
alter table public.elenco add column if not exists rede_social text;

alter table public.equipe_tecnica add column if not exists telefone text;
alter table public.equipe_tecnica add column if not exists email text;
alter table public.equipe_tecnica add column if not exists rede_social text;

-- Em Técnica e Staff havia um campo único "Contato": distribui o que já foi escrito
update public.equipe_tecnica set email = trim(contato)
 where email is null and contato ~* '^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$';
update public.equipe_tecnica set rede_social = trim(contato)
 where rede_social is null and email is distinct from trim(contato)
   and (contato ~ '^\s*@' or contato ~* '(instagram|tiktok|facebook|linkedin|youtube|x\.com|twitter|https?://)');
update public.equipe_tecnica set telefone = trim(contato)
 where telefone is null and email is distinct from trim(contato) and rede_social is distinct from trim(contato)
   and regexp_replace(contato, '\D', '', 'g') ~ '^\d{8,13}$';
