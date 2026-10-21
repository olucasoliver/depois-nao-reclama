-- 009: aba "Produção/Técnica e Staff" (equipe que não está no elenco)
-- Toda a equipe aprovada vê; Direção e Produção cadastram, editam e inativam.

create table if not exists public.equipe_tecnica (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null default 'Produção' check (grupo in ('Produção', 'Técnica', 'Staff')),
  funcao text,
  contato text,
  foto_url text,
  observacoes text,
  perfil_id uuid references public.perfis(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists equipe_tecnica_perfil_unico on public.equipe_tecnica (perfil_id) where perfil_id is not null;

alter table public.equipe_tecnica enable row level security;
drop policy if exists "equipe le" on public.equipe_tecnica;
drop policy if exists "gestao altera" on public.equipe_tecnica;
create policy "equipe le" on public.equipe_tecnica for select to authenticated using (public.aprovado());
create policy "gestao altera" on public.equipe_tecnica for all to authenticated using (public.e_gestao()) with check (public.e_gestao());
