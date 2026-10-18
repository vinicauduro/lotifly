-- =====================================================================
--  Gestão de Loteamento — esquema do banco (Supabase / Postgres)
--  Cole este arquivo inteiro no SQL Editor do Supabase e execute.
--  Pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- id curto gerado no banco (para registros criados pelas funções)
create or replace function public.gl_novo_id() returns text language sql volatile as $$ select substr(md5(random()::text || clock_timestamp()::text), 1, 16) $$;

-- ---------------------------------------------------------------------
-- 1. Empresas (organizações), membros e convites
-- ---------------------------------------------------------------------
create table if not exists public.organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  config      jsonb not null default '{}'::jsonb,
  plano       text not null default 'gratuito',
  criado_em   timestamptz not null default now()
);

create table if not exists public.membros (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  papel       text not null check (papel in ('dono','admin','financeiro','corretor')),
  nome        text not null default '',
  telefone    text not null default '',
  creci       text not null default '',
  email       text not null default '',
  imobiliaria text not null default '',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists membros_user_idx on public.membros(user_id);

create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  codigo      text not null unique,
  papel       text not null default 'corretor' check (papel in ('admin','financeiro','corretor')),
  descricao   text not null default '',
  usos        integer not null default 0,
  max_usos    integer not null default 100,
  expira_em   timestamptz,
  criado_por  uuid,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Dados do loteamento (todas as tabelas têm chave (org_id, id);
--    o id é gerado pelo aplicativo)
-- ---------------------------------------------------------------------
create table if not exists public.loteamentos (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  nome        text not null,
  cidade      text not null default '',
  endereco    text not null default '',
  descricao   text not null default '',
  cond        jsonb not null default '{}'::jsonb,
  orcamento   jsonb not null default '{}'::jsonb,
  planta      jsonb,
  criado_em   timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.categorias (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  nome        text not null,
  cor         text not null default '#64748b',
  primary key (org_id, id)
);

create table if not exists public.lotes (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  loteamento_id text not null,
  quadra        text not null,
  numero        text not null,
  area          double precision not null default 0,
  frente        double precision,
  fundos        double precision,
  preco         double precision not null default 0,
  tipo          text not null default 'residencial',
  status        text not null default 'disponivel' check (status in ('disponivel','reservado','vendido','bloqueado')),
  obs           text not null default '',
  matricula     text not null default '',
  pts           jsonb,
  reserva_id    text,
  venda_id      text,
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists lotes_loteamento_idx on public.lotes(org_id, loteamento_id);

create table if not exists public.reservas (
  org_id           uuid not null references public.organizacoes(id) on delete cascade,
  id               text not null,
  loteamento_id    text not null,
  lote_id          text not null,
  corretor         jsonb not null default '{}'::jsonb,
  corretor_user_id uuid,
  cliente          jsonb not null default '{}'::jsonb,
  data_reserva     date not null default current_date,
  validade         date,
  status           text not null default 'pendente' check (status in ('pendente','aprovada','recusada','cancelada','expirada','convertida')),
  proposta         jsonb,
  obs              text not null default '',
  motivo           text not null default '',
  aprovada_em      date,
  encerrada_em     timestamptz,
  criado_em        timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists reservas_lote_idx on public.reservas(org_id, lote_id);
create index if not exists reservas_corretor_idx on public.reservas(corretor_user_id);

create table if not exists public.vendas (
  org_id              uuid not null references public.organizacoes(id) on delete cascade,
  id                  text not null,
  loteamento_id       text not null,
  lote_id             text not null,
  reserva_id          text,
  cliente             jsonb not null default '{}'::jsonb,
  corretor            jsonb not null default '{}'::jsonb,
  corretor_user_id    uuid,
  data_venda          date not null default current_date,
  valor_total         double precision not null default 0,
  entrada             double precision not null default 0,
  data_entrada        date,
  n_parcelas          integer not null default 0,
  juros_mes           double precision not null default 0,
  valor_parcela       double precision not null default 0,
  primeiro_vencimento date,
  baloes              jsonb not null default '[]'::jsonb,
  comissao_pct        double precision not null default 0,
  comissao_valor      double precision not null default 0,
  comissao_paga       boolean not null default false,
  comissao_data       date,
  status              text not null default 'ativa' check (status in ('ativa','quitada','distrato')),
  obs                 text not null default '',
  motivo              text not null default '',
  distrato_em         date,
  criado_em           timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists vendas_corretor_idx on public.vendas(corretor_user_id);

create table if not exists public.recebiveis (
  org_id         uuid not null references public.organizacoes(id) on delete cascade,
  id             text not null,
  loteamento_id  text not null,
  venda_id       text not null,
  tipo           text not null default 'parcela',
  numero         integer not null default 0,
  descricao      text not null default '',
  vencimento     date not null,
  valor          double precision not null default 0,
  valor_pago     double precision not null default 0,
  data_pagamento date,
  forma          text,
  obs_pagamento  text not null default '',
  primary key (org_id, id)
);
create index if not exists recebiveis_venda_idx on public.recebiveis(org_id, venda_id);

create table if not exists public.custos (
  org_id           uuid not null references public.organizacoes(id) on delete cascade,
  id               text not null,
  loteamento_id    text not null,
  lote_id          text,
  descricao        text not null,
  categoria_id     text,
  fornecedor       text not null default '',
  valor            double precision not null default 0,
  forma_pagamento  text not null default '',
  data_competencia date not null,
  vencimento       date,
  status           text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento   date,
  obs              text not null default '',
  criado_em        timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.log (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  id          text not null,
  ts          timestamptz not null default now(),
  who         text not null default '',
  msg         text not null,
  primary key (org_id, id)
);
create index if not exists log_ts_idx on public.log(org_id, ts);

-- Erros que aconteceram no aparelho de alguém da equipe (mensagem, onde, quem, versão do app).
-- Qualquer membro grava os seus; só dono e administrador leem e apagam. Antes de escolher a
-- empresa (tela de entrada) o erro vai sem empresa e só aparece no painel do Supabase.
create table if not exists public.erros (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizacoes(id) on delete cascade,
  user_id     uuid default auth.uid(),
  quem        text not null default '' check (length(quem) <= 120),
  ts          timestamptz not null default now(),
  versao      text not null default '' check (length(versao) <= 40),
  tela        text not null default '' check (length(tela) <= 120),
  mensagem    text not null check (length(mensagem) between 1 and 1000),
  pilha       text not null default '' check (length(pilha) <= 4000),
  navegador   text not null default '' check (length(navegador) <= 300),
  vezes       int  not null default 1 check (vezes between 1 and 100000)
);
create index if not exists erros_org_ts_idx on public.erros(org_id, ts desc);

-- ---------------------------------------------------------------------
-- 3. Funções de apoio (usadas nas políticas de acesso)
-- ---------------------------------------------------------------------
create or replace function public.papel_na_org(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select papel from public.membros where org_id = p_org and user_id = auth.uid() and ativo limit 1
$$;

create or replace function public.eh_membro(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid() and ativo)
$$;

-- Dono e administrador: mandam em tudo, inclusive planta, equipe e configuração.
create or replace function public.eh_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid() and ativo and papel in ('dono','admin'))
$$;

-- Financeiro entra junto onde o assunto é dinheiro, venda e cobrança.
-- Não cria nem edita lote, não mexe na planta, não convida ninguém.
create or replace function public.eh_financeiro(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid() and ativo and papel in ('dono','admin','financeiro'))
$$;

-- membro comum pode editar os próprios dados, mas não o próprio papel/ativo
create or replace function public.membros_protege_papel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.papel is distinct from old.papel or new.ativo is distinct from old.ativo or new.org_id <> old.org_id or new.user_id <> old.user_id)
     and not public.eh_admin(old.org_id) then
    raise exception 'Sem permissão para alterar papel ou situação do membro';
  end if;
  if old.papel = 'dono' and new.papel <> 'dono'
     and not exists (select 1 from public.membros where org_id = old.org_id and papel = 'dono' and id <> old.id) then
    raise exception 'A empresa precisa ter pelo menos um dono';
  end if;
  return new;
end $$;
drop trigger if exists membros_protege_papel on public.membros;
create trigger membros_protege_papel before update on public.membros
  for each row execute function public.membros_protege_papel();

-- ---------------------------------------------------------------------
-- 4. Políticas de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.organizacoes enable row level security;
alter table public.membros      enable row level security;
alter table public.convites     enable row level security;
alter table public.loteamentos  enable row level security;
alter table public.categorias   enable row level security;
alter table public.lotes        enable row level security;
alter table public.reservas     enable row level security;
alter table public.vendas       enable row level security;
alter table public.recebiveis   enable row level security;
alter table public.custos       enable row level security;
alter table public.log          enable row level security;
alter table public.erros        enable row level security;

drop policy if exists org_select on public.organizacoes;
drop policy if exists org_update on public.organizacoes;
create policy org_select on public.organizacoes for select to authenticated using (public.eh_membro(id));
create policy org_update on public.organizacoes for update to authenticated using (public.eh_admin(id)) with check (public.eh_admin(id));

drop policy if exists membros_select on public.membros;
drop policy if exists membros_update on public.membros;
drop policy if exists membros_delete on public.membros;
create policy membros_select on public.membros for select to authenticated using (public.eh_membro(org_id));
create policy membros_update on public.membros for update to authenticated
  using (public.eh_admin(org_id) or user_id = auth.uid()) with check (public.eh_admin(org_id) or user_id = auth.uid());
create policy membros_delete on public.membros for delete to authenticated using (public.eh_admin(org_id) or user_id = auth.uid());

drop policy if exists convites_all on public.convites;
create policy convites_all on public.convites for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- tabelas que todo membro lê; a escrita muda conforme o assunto
do $$
declare t text;
begin
  -- loteamento e planta: só dono e administrador
  foreach t in array array['loteamentos'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.eh_membro(org_id))', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id))', t, t);
  end loop;
  -- categorias de despesa e lotes: o financeiro também escreve.
  -- No caso dos lotes, o gatilho logo abaixo só deixa ele mexer na situação do lote
  -- (vendido, reservado, disponível), nunca na planta, no preço ou nas medidas.
  foreach t in array array['categorias','lotes'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (public.eh_membro(org_id))', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id))', t, t);
  end loop;
  -- dinheiro: administração e financeiro
  foreach t in array array['recebiveis','custos'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format('create policy %I_all on public.%I for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id))', t, t);
  end loop;
end $$;

-- O financeiro registra venda e distrato, e isso muda a situação do lote.
-- Mas ele não desenha, não renomeia, não mexe em preço, área nem matrícula.
create or replace function public.lotes_protege_planta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if not public.eh_admin(old.org_id) then raise exception 'Somente o administrador pode excluir lotes'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    -- o aplicativo grava com upsert: quando a linha já existe é edição, não criação
    if not public.eh_admin(new.org_id)
       and not exists (select 1 from public.lotes where org_id = new.org_id and id = new.id) then
      raise exception 'Somente o administrador pode criar lotes';
    end if;
    return new;
  end if;
  if not public.eh_admin(new.org_id) then
    if new.loteamento_id is distinct from old.loteamento_id
       or new.quadra    is distinct from old.quadra
       or new.numero    is distinct from old.numero
       or new.area      is distinct from old.area
       or new.frente    is distinct from old.frente
       or new.fundos    is distinct from old.fundos
       or new.preco     is distinct from old.preco
       or new.tipo      is distinct from old.tipo
       or new.matricula is distinct from old.matricula
       or new.obs       is distinct from old.obs
       or new.pts::text is distinct from old.pts::text then
      raise exception 'Seu perfil pode mudar a situação do lote, mas não a planta, o preço nem as medidas';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists lotes_protege_planta on public.lotes;
create trigger lotes_protege_planta before insert or update or delete on public.lotes
  for each row execute function public.lotes_protege_planta();

-- reservas e vendas: admin vê tudo; corretor vê só as suas
drop policy if exists reservas_select on public.reservas;
drop policy if exists reservas_write on public.reservas;
create policy reservas_select on public.reservas for select to authenticated using (public.eh_financeiro(org_id) or corretor_user_id = auth.uid());
create policy reservas_write on public.reservas for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

drop policy if exists vendas_select on public.vendas;
drop policy if exists vendas_write on public.vendas;
create policy vendas_select on public.vendas for select to authenticated using (public.eh_financeiro(org_id) or corretor_user_id = auth.uid());
create policy vendas_write on public.vendas for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

drop policy if exists log_select on public.log;
drop policy if exists log_insert on public.log;
create policy log_select on public.log for select to authenticated using (public.eh_financeiro(org_id));
create policy log_insert on public.log for insert to authenticated with check (public.eh_membro(org_id));

drop policy if exists erros_insert on public.erros;
drop policy if exists erros_select on public.erros;
drop policy if exists erros_delete on public.erros;
create policy erros_insert on public.erros for insert to authenticated
  with check (user_id = auth.uid() and (org_id is null or public.eh_membro(org_id)));
create policy erros_select on public.erros for select to authenticated using (public.eh_admin(org_id));
create policy erros_delete on public.erros for delete to authenticated using (public.eh_admin(org_id));

-- Guarda 90 dias: a cada erro novo, os da mesma empresa com mais de 90 dias saem.
create or replace function public.erros_limpar_antigos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.erros where org_id is not distinct from new.org_id and ts < now() - interval '90 days';
  return new;
end $$;
drop trigger if exists erros_limpar on public.erros;
create trigger erros_limpar after insert on public.erros for each row execute function public.erros_limpar_antigos();

-- ---------------------------------------------------------------------
-- 5. Funções chamadas pelo aplicativo (RPC)
-- ---------------------------------------------------------------------

-- Cria a empresa do usuário logado e o torna dono.
create or replace function public.criar_organizacao(p_nome text, p_usuario_nome text default '', p_telefone text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome da empresa'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.organizacoes (nome, config)
    values (trim(p_nome), jsonb_build_object('empresa', trim(p_nome), 'reservaDias', 7, 'multaPct', 2, 'jurosMesPct', 1, 'comissaoPct', 5, 'mostrarPrecoVendido', true))
    returning id into v_org;
  insert into public.membros (org_id, user_id, papel, nome, telefone, email)
    values (v_org, auth.uid(), 'dono', coalesce(p_usuario_nome, ''), coalesce(p_telefone, ''), coalesce(v_email, ''));
  insert into public.categorias (org_id, id, nome, cor) values
    (v_org, 'administrativo', 'Administrativo', '#6366f1'),
    (v_org, 'agua', 'Água', '#06b6d4'),
    (v_org, 'cartorio', 'Cartório', '#b91c1c'),
    (v_org, 'documentacao', 'Documentação', '#ef4444'),
    (v_org, 'drenagem', 'Drenagem', '#0284c7'),
    (v_org, 'esgoto', 'Esgoto', '#0e7490'),
    (v_org, 'impostos', 'Impostos', '#64748b'),
    (v_org, 'licencas', 'Licenças', '#0f766e'),
    (v_org, 'mao-de-obra', 'Mão de Obra', '#8b5cf6'),
    (v_org, 'marketing', 'Marketing', '#22c55e'),
    (v_org, 'materiais', 'Materiais', '#f97316'),
    (v_org, 'outros', 'Outros', '#94a3b8'),
    (v_org, 'pavimentacao', 'Pavimentação', '#0ea5e9'),
    (v_org, 'projetos', 'Projetos', '#14b8a6'),
    (v_org, 'rede-eletrica', 'Rede Elétrica / Iluminação', '#eab308'),
    (v_org, 'taxas', 'Taxas', '#475569'),
    (v_org, 'terraplanagem', 'Terraplanagem', '#92400e'),
    (v_org, 'terreno', 'Aquisição do Terreno', '#a16207'),
    (v_org, 'vendas', 'Vendas', '#15803d');
  insert into public.log (org_id, id, who, msg) values (v_org, public.gl_novo_id(), coalesce(p_usuario_nome, 'Dono'), 'Empresa criada: ' || trim(p_nome));
  return v_org;
end $$;

-- Entra numa empresa usando um código de convite (corretores e outros papéis).
create or replace function public.entrar_com_convite(p_codigo text, p_nome text default '', p_telefone text default '', p_creci text default '', p_imobiliaria text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv public.convites%rowtype; v_email text; v_membro_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_conv from public.convites where upper(codigo) = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Código de convite inválido'; end if;
  if v_conv.expira_em is not null and v_conv.expira_em < now() then raise exception 'Este convite expirou'; end if;
  if v_conv.usos >= v_conv.max_usos then raise exception 'Este convite já atingiu o limite de usos'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select id into v_membro_id from public.membros where org_id = v_conv.org_id and user_id = auth.uid();
  if v_membro_id is not null then
    update public.membros set ativo = true,
      nome = coalesce(nullif(trim(p_nome), ''), nome), telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
      creci = coalesce(nullif(trim(p_creci), ''), creci), imobiliaria = coalesce(nullif(trim(p_imobiliaria), ''), imobiliaria)
      where id = v_membro_id;
  else
    insert into public.membros (org_id, user_id, papel, nome, telefone, creci, imobiliaria, email)
      values (v_conv.org_id, auth.uid(), v_conv.papel, coalesce(p_nome, ''), coalesce(p_telefone, ''), coalesce(p_creci, ''), coalesce(p_imobiliaria, ''), coalesce(v_email, ''));
    update public.convites set usos = usos + 1 where id = v_conv.id;
    insert into public.log (org_id, id, who, msg) values (v_conv.org_id, public.gl_novo_id(), coalesce(p_nome, ''), 'Novo membro (' || v_conv.papel || '): ' || coalesce(p_nome, v_email, ''));
  end if;
  return v_conv.org_id;
end $$;

-- Pedido de reserva feito por um corretor: cria a reserva e marca o lote
-- de forma atômica (dois corretores não conseguem reservar o mesmo lote).
create or replace function public.solicitar_reserva(p_org uuid, p_reserva jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_lote public.lotes%rowtype; v_id text; v_membro public.membros%rowtype; v_dias integer;
begin
  select * into v_membro from public.membros where org_id = p_org and user_id = auth.uid() and ativo;
  if not found then raise exception 'Você não faz parte desta empresa'; end if;
  select * into v_lote from public.lotes where org_id = p_org and id = (p_reserva->>'lote_id') for update;
  if not found then raise exception 'Lote não encontrado'; end if;
  if v_lote.status <> 'disponivel' then raise exception 'Este lote não está mais disponível'; end if;
  v_id := coalesce(nullif(p_reserva->>'id', ''), public.gl_novo_id());
  select coalesce((config->>'reservaDias')::integer, 7) into v_dias from public.organizacoes where id = p_org;
  insert into public.reservas (org_id, id, loteamento_id, lote_id, corretor, corretor_user_id, cliente, data_reserva, validade, status, proposta, obs)
  values (p_org, v_id, v_lote.loteamento_id, v_lote.id,
          coalesce(p_reserva->'corretor', '{}'::jsonb) || jsonb_build_object('userId', auth.uid()),
          auth.uid(), coalesce(p_reserva->'cliente', '{}'::jsonb),
          current_date, current_date + v_dias, 'pendente', p_reserva->'proposta', coalesce(p_reserva->>'obs', ''));
  update public.lotes set status = 'reservado', reserva_id = v_id where org_id = p_org and id = v_lote.id;
  insert into public.log (org_id, id, who, msg) values (p_org, public.gl_novo_id(), coalesce(p_reserva->'corretor'->>'nome', v_membro.nome),
    'Reserva solicitada: Quadra ' || v_lote.quadra || ' · Lote ' || v_lote.numero || ' — cliente ' || coalesce(p_reserva->'cliente'->>'nome', ''));
  return v_id;
end $$;

-- Corretor cancela o próprio pedido enquanto ainda está pendente.
create or replace function public.cancelar_minha_reserva(p_org uuid, p_id text, p_motivo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_res public.reservas%rowtype;
begin
  select * into v_res from public.reservas where org_id = p_org and id = p_id and corretor_user_id = auth.uid() for update;
  if not found then raise exception 'Reserva não encontrada'; end if;
  if v_res.status <> 'pendente' then raise exception 'Só é possível cancelar pedidos ainda pendentes'; end if;
  update public.reservas set status = 'cancelada', encerrada_em = now(), motivo = coalesce(p_motivo, '') where org_id = p_org and id = p_id;
  update public.lotes set status = 'disponivel', reserva_id = null where org_id = p_org and id = v_res.lote_id and reserva_id = p_id;
  insert into public.log (org_id, id, who, msg) values (p_org, public.gl_novo_id(), coalesce(v_res.corretor->>'nome', ''), 'Reserva cancelada pelo corretor — ' || coalesce(v_res.cliente->>'nome', ''));
end $$;

-- Corretor atualiza os próprios dados de perfil (nome, telefone, CRECI, imobiliária).
create or replace function public.atualizar_meu_perfil(p_org uuid, p_nome text, p_telefone text, p_creci text, p_imobiliaria text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.membros set nome = coalesce(p_nome, nome), telefone = coalesce(p_telefone, telefone), creci = coalesce(p_creci, creci), imobiliaria = coalesce(p_imobiliaria, imobiliaria)
  where org_id = p_org and user_id = auth.uid();
end $$;

-- Apaga todos os dados operacionais da empresa (backup/importação e "apagar tudo"). Só dono/admin.
create or replace function public.limpar_dados_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin(p_org) then raise exception 'Sem permissão'; end if;
  delete from public.recebiveis where org_id = p_org;
  delete from public.vendas where org_id = p_org;
  delete from public.reservas where org_id = p_org;
  delete from public.custos where org_id = p_org;
  delete from public.lotes where org_id = p_org;
  delete from public.leads where org_id = p_org;
  delete from public.indices where org_id = p_org;
  delete from public.cobrancas where org_id = p_org;
  delete from public.remessas where org_id = p_org;
  delete from public.contas_banco where org_id = p_org;
  delete from public.modelos where org_id = p_org;
  delete from public.vendedores where org_id = p_org;
  delete from public.clientes where org_id = p_org;
  delete from public.contratos_seq where org_id = p_org;
  delete from public.categorias where org_id = p_org;
  delete from public.vitrines where org_id = p_org;
  delete from public.loteamentos where org_id = p_org;
  delete from public.log where org_id = p_org;
end $$;

-- ---------------------------------------------------------------------
-- 4b. Índices de correção (IGP-M, INPC, IPCA, CUB…) e campos de correção
-- ---------------------------------------------------------------------
create table if not exists public.indices (
  org_id    uuid not null references public.organizacoes(id) on delete cascade,
  id        text not null,
  codigo    text not null,
  nome      text not null,
  tipo      text not null default 'percentual' check (tipo in ('percentual','pontos')),
  valores   jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.indices enable row level security;
drop policy if exists indices_select on public.indices;
drop policy if exists indices_write on public.indices;
create policy indices_select on public.indices for select to authenticated using (public.eh_membro(org_id));
create policy indices_write on public.indices for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

alter table public.vendas add column if not exists indice_id text;
alter table public.vendas add column if not exists indice_base text;
alter table public.recebiveis add column if not exists valor_corrigido double precision;

-- ---------------------------------------------------------------------
-- 4d. Conta de cobrança (convênio bancário da empresa)
-- ---------------------------------------------------------------------
create table if not exists public.contas_banco (
  org_id            uuid not null references public.organizacoes(id) on delete cascade,
  id                text not null,
  loteamento_id     text not null default '',
  banco             text not null default '001',
  carteira          text not null default '',
  variacao          text not null default '',
  agencia           text not null default '',
  agencia_dv        text not null default '',
  conta             text not null default '',
  conta_dv          text not null default '',
  convenio          text not null default '',
  nosso_numero_atual bigint not null default 1,
  remessa_seq       integer not null default 1,
  multa_pct         double precision not null default 0,
  juros_dia         double precision not null default 0,
  desconto_pct      double precision not null default 0,
  protesto_dias     integer not null default 0,
  baixa_dias        integer not null default 0,
  especie           text not null default 'DM',
  aceite            text not null default 'N',
  mensagem1         text not null default '',
  mensagem2         text not null default '',
  criado_em         timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.contas_banco enable row level security;
drop policy if exists contas_banco_select on public.contas_banco;
drop policy if exists contas_banco_write on public.contas_banco;
create policy contas_banco_select on public.contas_banco for select to authenticated using (public.eh_financeiro(org_id));
create policy contas_banco_write on public.contas_banco for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

alter table public.recebiveis add column if not exists nosso_numero text;
alter table public.recebiveis add column if not exists remessa_em date;
-- o que foi registrado no banco; se a parcela mudar depois, a remessa precisa avisar o banco
alter table public.recebiveis add column if not exists banco_valor double precision;
alter table public.recebiveis add column if not exists banco_venc date;
-- Qual conta bancária numerou este título: o nosso número é único por convênio, e trocar a
-- conta de um empreendimento não pode reatribuir números já emitidos.
alter table public.recebiveis add column if not exists conta_id text;
-- marca d'água do nosso número: o maior que já saiu para o banco, para nunca repetir
alter table public.contas_banco add column if not exists nn_max bigint not null default 0;
-- códigos de instrução da remessa: só o que o usuário copiar do manual do banco dele
alter table public.contas_banco add column if not exists instrucao1 text not null default '';
alter table public.contas_banco add column if not exists instrucao2 text not null default '';
-- juros do contrato em % ao mês; o arquivo do banco recebe o equivalente ao dia
alter table public.contas_banco add column if not exists juros_mes_pct double precision;

-- Empreendimento: 'loteamento' (planta e lotes) ou 'carteira' (só agrupa vendas avulsas)
alter table public.loteamentos add column if not exists tipo text not null default 'loteamento';
-- Venda sem lote: o imóvel é descrito na própria venda
alter table public.vendas add column if not exists imovel jsonb;

-- Qualificação das partes e do imóvel: sem estes campos não sai contrato nem escritura.
alter table public.vendas add column if not exists vendedor_id text;
alter table public.vendas add column if not exists vendedor jsonb;
-- Mais de um comprador (irmãos, sócios) e mais de um vendedor (empresas do mesmo grupo).
alter table public.vendas add column if not exists compradores_extras jsonb not null default '[]'::jsonb;
alter table public.vendas add column if not exists vendedores_extras jsonb not null default '[]'::jsonb;
alter table public.lotes add column if not exists descricao_matricula text not null default '';
alter table public.lotes add column if not exists logradouro text not null default '';
alter table public.lotes add column if not exists numero_end text not null default '';
alter table public.lotes add column if not exists bairro text not null default '';
alter table public.lotes add column if not exists cep text not null default '';
alter table public.loteamentos add column if not exists logradouro text not null default '';
alter table public.loteamentos add column if not exists numero_end text not null default '';
alter table public.loteamentos add column if not exists bairro text not null default '';
alter table public.loteamentos add column if not exists cep text not null default '';
alter table public.loteamentos add column if not exists uf text not null default '';
alter table public.loteamentos add column if not exists codigo_ibge text not null default '';
alter table public.loteamentos add column if not exists cartorio text not null default '';
alter table public.loteamentos add column if not exists matricula_mae text not null default '';
-- Imóvel de terceiro (tipo 'carteira'): um imóvel só, com valor de venda e registro próprios
alter table public.loteamentos add column if not exists categoria text not null default '';  -- apartamento, casa, galpao, lote, sala, sitio
alter table public.loteamentos add column if not exists preco numeric(14,2);
alter table public.loteamentos add column if not exists area numeric(12,2);
alter table public.loteamentos add column if not exists matricula text not null default '';
alter table public.loteamentos add column if not exists descricao_matricula text not null default '';
-- numa carteira a venda não aponta para lote
alter table public.vendas alter column lote_id drop not null;
-- Despesa da empresa (escritório, contabilidade) não pertence a empreendimento,
-- e a despesa de um imóvel avulso da carteira aponta para o contrato.
alter table public.custos alter column loteamento_id drop not null;
alter table public.custos add column if not exists venda_id text;
-- Cessão de direitos: o histórico de quem cedeu para quem fica no próprio contrato.
alter table public.vendas add column if not exists cessoes jsonb not null default '[]'::jsonb;
-- Distrato (16/10): retenção, devolução e as parcelas da devolução ficam no próprio contrato.
alter table public.vendas add column if not exists distrato jsonb;

-- ---------------------------------------------------------------------
-- 4c. Cobranças registradas (régua de inadimplência)
-- ---------------------------------------------------------------------
create table if not exists public.cobrancas (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  venda_id      text not null,
  loteamento_id text not null default '',
  data          date not null default current_date,
  canal         text not null default 'whatsapp',
  faixa         text not null default '',
  dias          integer not null default 0,
  valor         double precision not null default 0,
  obs           text not null default '',
  quem          text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists cobrancas_venda_idx on public.cobrancas (org_id, venda_id);
alter table public.cobrancas enable row level security;
drop policy if exists cobrancas_select on public.cobrancas;
drop policy if exists cobrancas_write on public.cobrancas;
create policy cobrancas_select on public.cobrancas for select to authenticated using (public.eh_financeiro(org_id));
create policy cobrancas_write on public.cobrancas for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

-- ---------------------------------------------------------------------
-- 4d. Remessas geradas para o banco (histórico e sequencial do arquivo)
-- ---------------------------------------------------------------------
create table if not exists public.remessas (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  loteamento_id text not null,
  conta_id      text not null default '',
  sequencial    integer not null default 1,
  data          date not null default current_date,
  arquivo       text not null default '',
  qtd           integer not null default 0,
  baixas        integer not null default 0,
  valor         double precision not null default 0,
  rec_ids       jsonb not null default '[]'::jsonb,
  primeiro_nn   text not null default '',
  ultimo_nn     text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.remessas enable row level security;
drop policy if exists remessas_select on public.remessas;
drop policy if exists remessas_write on public.remessas;
create policy remessas_select on public.remessas for select to authenticated using (public.eh_financeiro(org_id));
create policy remessas_write on public.remessas for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

-- ---------------------------------------------------------------------
-- 5a. Modelos de documento (proposta e contrato da própria empresa)
-- ---------------------------------------------------------------------
create table if not exists public.modelos (
  org_id    uuid not null references public.organizacoes(id) on delete cascade,
  id        text not null,
  nome      text not null,
  tipo      text not null default 'contrato' check (tipo in ('proposta','contrato')),
  corpo     text not null default '',
  criado_em timestamptz not null default now(),
  primary key (org_id, id)
);
-- Modelo de cessão de direitos (15/10): o tipo novo entra na lista aceita.
alter table public.modelos drop constraint if exists modelos_tipo_check;
alter table public.modelos add constraint modelos_tipo_check check (tipo in ('proposta','contrato','cessao','distrato'));
alter table public.modelos enable row level security;
drop policy if exists modelos_select on public.modelos;
drop policy if exists modelos_write on public.modelos;
create policy modelos_select on public.modelos for select to authenticated using (public.eh_membro(org_id));
create policy modelos_write on public.modelos for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- ---------------------------------------------------------------------
-- 5a2. Vendedores (outorgantes): quem assina a venda no contrato
--      A incorporadora costuma ter um CNPJ por empreendimento e às vezes vende
--      imóvel que está no nome de outra empresa do grupo, então quem vende não é
--      sempre a empresa do cadastro.
-- ---------------------------------------------------------------------
create table if not exists public.vendedores (
  org_id             uuid not null references public.organizacoes(id) on delete cascade,
  id                 text not null,
  tipo               text not null default 'pj' check (tipo in ('pf','pj')),
  nome               text not null,
  cpf                text not null default '',
  inscricao_estadual text not null default '',
  representante      jsonb,
  telefone           text not null default '',
  email              text not null default '',
  cep                text not null default '',
  logradouro         text not null default '',
  numero_end         text not null default '',
  complemento        text not null default '',
  bairro             text not null default '',
  cidade             text not null default '',
  uf                 text not null default '',
  endereco           text not null default '',
  obs                text not null default '',
  criado_em          timestamptz not null default now(),
  primary key (org_id, id)
);
alter table public.vendedores enable row level security;
drop policy if exists vendedores_select on public.vendedores;
drop policy if exists vendedores_write on public.vendedores;
create policy vendedores_select on public.vendedores for select to authenticated using (public.eh_membro(org_id));
create policy vendedores_write on public.vendedores for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- ---------------------------------------------------------------------
-- 5a3. Clientes: a ficha de quem compra, com a qualificação completa
--      Guarda CPF, RG, estado civil e endereço, então é do escritório: dono,
--      administrador e financeiro. O corretor não lê — ele vê os próprios
--      clientes pelas reservas e vendas dele, como antes.
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  org_id             uuid not null references public.organizacoes(id) on delete cascade,
  id                 text not null,
  tipo               text not null default 'pf' check (tipo in ('pf','pj')),
  genero             text not null default 'm',
  nome               text not null,
  cpf                text not null default '',
  rg                 text not null default '',
  rg_orgao           text not null default '',
  nacionalidade      text not null default '',
  profissao          text not null default '',
  estado_civil       text not null default '',
  regime_bens        text not null default '',
  conjuge            jsonb,
  inscricao_estadual text not null default '',
  representante      jsonb,
  telefone           text not null default '',
  email              text not null default '',
  cep                text not null default '',
  logradouro         text not null default '',
  numero_end         text not null default '',
  complemento        text not null default '',
  bairro             text not null default '',
  cidade             text not null default '',
  uf                 text not null default '',
  endereco           text not null default '',
  obs                text not null default '',
  criado_em          timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists clientes_cpf_idx on public.clientes (org_id, cpf);
alter table public.clientes enable row level security;
drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_write on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (public.eh_financeiro(org_id));
create policy clientes_write on public.clientes for all to authenticated using (public.eh_financeiro(org_id)) with check (public.eh_financeiro(org_id));

-- ---------------------------------------------------------------------
-- 5b. Vitrine pública (link do loteamento para o cliente final) e leads
-- ---------------------------------------------------------------------
create table if not exists public.vitrines (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  loteamento_id text not null,
  slug          text not null,
  ativa         boolean not null default true,
  mostrar_preco boolean not null default false,   -- por decisão de uso: 'valor sob consulta'
  titulo        text not null default '',
  chamada       text not null default '',
  whatsapp      text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, loteamento_id)
);
create unique index if not exists vitrines_slug_idx on public.vitrines (lower(slug));

create table if not exists public.leads (
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  id            text not null,
  loteamento_id text not null default '',
  lote_id       text,
  nome          text not null,
  telefone      text not null default '',
  email         text not null default '',
  msg           text not null default '',
  origem        text not null default 'vitrine',
  status        text not null default 'novo' check (status in ('novo','contatado','convertido','descartado')),
  obs           text not null default '',
  criado_em     timestamptz not null default now(),
  primary key (org_id, id)
);
create index if not exists leads_org_idx on public.leads (org_id, criado_em desc);

alter table public.vitrines enable row level security;
alter table public.leads    enable row level security;

drop policy if exists vitrines_select on public.vitrines;
drop policy if exists vitrines_write on public.vitrines;
create policy vitrines_select on public.vitrines for select to authenticated using (public.eh_membro(org_id));
create policy vitrines_write on public.vitrines for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- leads: toda a equipe vê (corretor precisa atender), só admin altera
drop policy if exists leads_select on public.leads;
drop policy if exists leads_write on public.leads;
create policy leads_select on public.leads for select to authenticated using (public.eh_membro(org_id));
create policy leads_write on public.leads for all to authenticated using (public.eh_admin(org_id)) with check (public.eh_admin(org_id));

-- A vitrine pública saiu do produto em 23/09/2026: a empresa administra o comercial, quem
-- vende é o corretor. As duas funções que o visitante sem login podia chamar deixam de
-- existir, e com elas a única porta de entrada anônima no banco. As tabelas vitrines e
-- leads ficam onde estão, sem uso, para não apagar dado de ninguém.
drop function if exists public.vitrine_dados(text);
drop function if exists public.registrar_lead(text, jsonb);

-- ---------------------------------------------------------------------
-- 5d. Número do contrato: sequencial por ano (0041/2026)
--     O número é dado pelo banco, numa função que trava a linha do contador do ano:
--     duas pessoas registrando venda ao mesmo tempo nunca recebem o mesmo número.
--     O contador nunca fica abaixo do maior número já usado no ano, então um número
--     digitado à mão (contrato antigo, que já tinha número no papel) não se repete.
-- ---------------------------------------------------------------------
alter table public.vendas add column if not exists numero_contrato text not null default '';
create unique index if not exists vendas_numero_contrato_idx on public.vendas (org_id, numero_contrato) where numero_contrato <> '';

create table if not exists public.contratos_seq (
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  ano    int  not null,
  ultimo int  not null default 0,
  primary key (org_id, ano)
);
alter table public.contratos_seq enable row level security;
-- sem política: ninguém lê nem escreve direto, só pela função abaixo

create or replace function public.proximo_numero_contrato(p_org uuid, p_ano int)
returns int language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int;
begin
  if not public.eh_financeiro(p_org) then raise exception 'Sem permissão'; end if;
  if p_ano is null or p_ano < 1900 or p_ano > 2999 then raise exception 'Ano inválido'; end if;
  select coalesce(max(split_part(numero_contrato, '/', 1)::int), 0) into v_max
    from public.vendas
   where org_id = p_org and numero_contrato ~ '^[0-9]{1,6}/[0-9]{4}$' and split_part(numero_contrato, '/', 2) = p_ano::text;
  insert into public.contratos_seq (org_id, ano, ultimo) values (p_org, p_ano, v_max + 1)
  on conflict (org_id, ano) do update set ultimo = greatest(public.contratos_seq.ultimo, v_max) + 1
  returning ultimo into v_n;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 6. Permissões de execução
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;


-- ---------------------------------------------------------------------
-- 7. Tempo real (Supabase Realtime) e Storage (imagem da planta)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['organizacoes','membros','loteamentos','categorias','lotes','reservas','vendas','recebiveis','custos','log','vitrines','leads','modelos','indices','cobrancas','contas_banco','remessas','vendedores','clientes'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- linhas completas nos eventos de tempo real (necessário para DELETE trazer org_id)
alter table public.lotes replica identity full;
alter table public.reservas replica identity full;
alter table public.vendas replica identity full;
alter table public.recebiveis replica identity full;
alter table public.leads replica identity full;
alter table public.custos replica identity full;
alter table public.loteamentos replica identity full;
alter table public.categorias replica identity full;
alter table public.log replica identity full;
alter table public.membros replica identity full;
alter table public.clientes replica identity full;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    /* Plantas fechadas (15/10): o bucket deixa de ser público e o arquivo só abre para quem é
       membro ativo da empresa dona da pasta — quem entrou pelo convite dela. O app pede um
       link assinado, que vence em uma hora; link público antigo deixa de abrir. */
    insert into storage.buckets (id, name, public) values ('plantas', 'plantas', false) on conflict (id) do update set public = false;
    execute 'drop policy if exists plantas_leitura on storage.objects';
    execute 'drop policy if exists plantas_escrita on storage.objects';
    execute 'drop policy if exists plantas_update on storage.objects';
    execute 'drop policy if exists plantas_delete on storage.objects';
    execute $p$create policy plantas_leitura on storage.objects for select to authenticated using (bucket_id = 'plantas' and public.eh_membro(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end))$p$;
    execute $p$create policy plantas_escrita on storage.objects for insert to authenticated with check (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy plantas_update on storage.objects for update to authenticated using (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy plantas_delete on storage.objects for delete to authenticated using (bucket_id = 'plantas' and public.eh_admin(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. Permissões pessoa a pessoa também no banco (Fase 6)
--    O papel continua sendo a primeira barreira (políticas acima). Em cima dele, o dono ajusta
--    cada pessoa no app (organizacoes.config -> 'permissoesPessoas'), e o padrão de cada função
--    pode ser mudado (config -> 'permissoes'). Aqui o banco confere essas mesmas regras nas ações
--    que mexem com dinheiro, contratos, despesas, equipe e configuração: quem tiver uma permissão
--    desligada é recusado mesmo que tente gravar por fora do aplicativo.
--    Ordem: ajuste da pessoa > padrão da função salvo > padrão de fábrica. O dono pode tudo.
-- ---------------------------------------------------------------------

-- Padrão de fábrica de cada função. Precisa ficar igual a PERM_PADRAO em permissoes.js
-- (o teste testes/permissoes-banco.test.mjs confere).
create or replace function public.permissao_padrao(p_papel text, p_chave text)
returns boolean language sql immutable as $$
  select case p_papel
    when 'dono' then true
    when 'admin' then true
    when 'financeiro' then coalesce(('{
      "lotes.editar": false, "planta.editar": false, "lotes.preco": false, "reservas.aprovar": false,
      "vendas.criar": true, "vendas.editar": true, "vendas.distrato": false, "comissao.gerenciar": true,
      "financeiro.ver": true, "financeiro.baixar": true, "financeiro.antecipar": true,
      "cobranca.ver": true, "cobranca.registrar": true, "custos.ver": true, "custos.editar": true,
      "relatorios.ver": true, "documentos.editar": false, "indices.editar": true,
      "equipe.gerenciar": false, "config.editar": false, "backup.usar": false
    }'::jsonb ->> p_chave)::boolean, false)
    else false
  end
$$;

-- A pessoa logada tem esta permissão nesta empresa?
create or replace function public.tem_permissao(p_org uuid, p_chave text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_papel text; v_cfg jsonb; v jsonb;
begin
  select papel into v_papel from public.membros where org_id = p_org and user_id = auth.uid() and ativo limit 1;
  if v_papel is null then return false; end if;
  if v_papel = 'dono' then return true; end if;
  select coalesce(config, '{}'::jsonb) into v_cfg from public.organizacoes where id = p_org;
  v := v_cfg -> 'permissoesPessoas' -> (auth.uid()::text);
  if v ? p_chave then return coalesce((v ->> p_chave)::boolean, false); end if;
  v := v_cfg -> 'permissoes' -> v_papel;
  if v ? p_chave then return coalesce((v ->> p_chave)::boolean, false); end if;
  return public.permissao_padrao(v_papel, p_chave);
end $$;

-- Recusa se a pessoa não tiver nenhuma das permissões pedidas.
create or replace function public.exigir_permissao(p_org uuid, p_chaves text[], p_acao text)
returns void language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  foreach k in array p_chaves loop
    if public.tem_permissao(p_org, k) then return; end if;
  end loop;
  raise exception 'Sem permissão para %. Fale com o dono da empresa.', p_acao using errcode = '42501';
end $$;

-- Colunas que mudaram de uma versão da linha para a outra.
create or replace function public.colunas_mudadas(p_new jsonb, p_old jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(n.key), '{}') from jsonb_each(p_new) n join jsonb_each(p_old) o using (key)
  where n.value is distinct from o.value
$$;

-- "Limpar dados" (restaurar backup) apaga tudo de uma vez; essa operação tem a própria
-- permissão e não passa pelas travas de cada linha.
create or replace function public.limpando_dados() returns boolean language sql stable as $$
  select coalesce(current_setting('lotifly.limpando', true), '') = 'on'
$$;

-- Parcelas (recebíveis)
create or replace function public.recebiveis_permissoes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid := coalesce(new.org_id, old.org_id); m text[];
begin
  if public.limpando_dados() or auth.uid() is null then return coalesce(new, old); end if;   -- limpeza autorizada ou rotina interna do banco
  if tg_op = 'INSERT' then
    -- upsert de linha que já existe é edição: quem confere é o gatilho de UPDATE
    if exists (select 1 from public.recebiveis where org_id = new.org_id and id = new.id) then return new; end if;
    perform public.exigir_permissao(v_org, array['vendas.criar','vendas.editar','financeiro.antecipar'], 'criar parcelas');
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.exigir_permissao(v_org, array['vendas.editar','vendas.distrato','financeiro.antecipar'], 'apagar parcelas');
    return old;
  end if;
  m := public.colunas_mudadas(to_jsonb(new), to_jsonb(old));
  if m && array['valor_pago','data_pagamento','forma','obs_pagamento'] then
    perform public.exigir_permissao(v_org, array['financeiro.baixar','financeiro.antecipar'], 'registrar ou estornar pagamentos');
  end if;
  if m && array['valor','vencimento','descricao','numero','tipo','valor_corrigido','venda_id'] then
    perform public.exigir_permissao(v_org, array['financeiro.baixar','vendas.editar','financeiro.antecipar','indices.editar'], 'alterar parcelas');
  end if;
  return new;
end $$;
drop trigger if exists recebiveis_permissoes on public.recebiveis;
create trigger recebiveis_permissoes before insert or update or delete on public.recebiveis
  for each row execute function public.recebiveis_permissoes();

-- Contratos (vendas)
create or replace function public.vendas_permissoes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid := coalesce(new.org_id, old.org_id); m text[]; resto text[];
begin
  if public.limpando_dados() or auth.uid() is null then return coalesce(new, old); end if;   -- limpeza autorizada ou rotina interna do banco
  if tg_op = 'INSERT' then
    if exists (select 1 from public.vendas where org_id = new.org_id and id = new.id) then return new; end if;
    perform public.exigir_permissao(v_org, array['vendas.criar'], 'registrar vendas');
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.exigir_permissao(v_org, array['vendas.distrato'], 'excluir contratos');
    return old;
  end if;
  m := public.colunas_mudadas(to_jsonb(new), to_jsonb(old));
  if new.status = 'distrato' and old.status is distinct from 'distrato' or m && array['distrato_em','motivo','distrato'] then
    perform public.exigir_permissao(v_org, array['vendas.distrato'], 'fazer distrato');
  elsif 'status' = any(m) then
    -- ativa <-> quitada acontece sozinho ao registrar pagamento ou antecipar
    perform public.exigir_permissao(v_org, array['financeiro.baixar','financeiro.antecipar','vendas.editar'], 'mudar a situação do contrato');
  end if;
  if m && array['comissao_paga','comissao_data'] then
    perform public.exigir_permissao(v_org, array['comissao.gerenciar'], 'marcar comissões');
  end if;
  resto := array(select unnest(m) except select unnest(array['status','distrato_em','motivo','distrato','comissao_paga','comissao_data']));
  if cardinality(resto) > 0 then
    if resto <@ array['valor_parcela','indice_base'] then
      perform public.exigir_permissao(v_org, array['financeiro.antecipar','vendas.editar'], 'recalcular o contrato');
    else
      perform public.exigir_permissao(v_org, array['vendas.editar'], 'editar contratos');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists vendas_permissoes on public.vendas;
create trigger vendas_permissoes before insert or update or delete on public.vendas
  for each row execute function public.vendas_permissoes();

-- Despesas (custos)
create or replace function public.custos_permissoes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid := coalesce(new.org_id, old.org_id);
begin
  if public.limpando_dados() or auth.uid() is null then return coalesce(new, old); end if;   -- limpeza autorizada ou rotina interna do banco
  if tg_op = 'INSERT' and exists (select 1 from public.custos where org_id = new.org_id and id = new.id) then return new; end if;
  if tg_op = 'UPDATE' and public.colunas_mudadas(to_jsonb(new), to_jsonb(old)) = '{}' then return new; end if;
  perform public.exigir_permissao(v_org, array['custos.editar'], 'lançar ou editar despesas');
  return coalesce(new, old);
end $$;
drop trigger if exists custos_permissoes on public.custos;
create trigger custos_permissoes before insert or update or delete on public.custos
  for each row execute function public.custos_permissoes();

-- Configuração da empresa: permissões pedem "gerenciar a equipe"; o resto, "alterar
-- configurações". Ninguém além do dono muda o próprio ajuste (não se dá mais poder).
create or replace function public.organizacoes_permissoes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_new jsonb := coalesce(new.config, '{}'::jsonb); c_old jsonb := coalesce(old.config, '{}'::jsonb);
  eu text := auth.uid()::text;
begin
  if auth.uid() is null then return new; end if;   -- rotinas internas do banco
  if (c_new -> 'permissoes') is distinct from (c_old -> 'permissoes')
     or (c_new -> 'permissoesPessoas') is distinct from (c_old -> 'permissoesPessoas') then
    perform public.exigir_permissao(new.id, array['equipe.gerenciar'], 'mudar permissões');
    if (c_new -> 'permissoesPessoas' -> eu) is distinct from (c_old -> 'permissoesPessoas' -> eu)
       and coalesce(public.papel_na_org(new.id), '') <> 'dono' then
      raise exception 'Ninguém ajusta as próprias permissões. Fale com o dono da empresa.' using errcode = '42501';
    end if;
  end if;
  if (c_new - 'permissoes' - 'permissoesPessoas') is distinct from (c_old - 'permissoes' - 'permissoesPessoas')
     or new.nome is distinct from old.nome then
    perform public.exigir_permissao(new.id, array['config.editar'], 'alterar configurações da empresa');
  end if;
  return new;
end $$;
drop trigger if exists organizacoes_permissoes on public.organizacoes;
create trigger organizacoes_permissoes before update on public.organizacoes
  for each row execute function public.organizacoes_permissoes();

-- Equipe: mudar papel/situação de alguém, editar ou remover outro membro e mexer em convites
-- pedem "gerenciar a equipe". Cada um continua podendo editar o próprio perfil.
create or replace function public.membros_protege_papel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.papel is distinct from old.papel or new.ativo is distinct from old.ativo or new.org_id <> old.org_id or new.user_id <> old.user_id)
     and not (public.eh_admin(old.org_id) and public.tem_permissao(old.org_id, 'equipe.gerenciar')) then
    raise exception 'Sem permissão para alterar papel ou situação do membro' using errcode = '42501';
  end if;
  if old.papel = 'dono' and new.papel <> 'dono'
     and not exists (select 1 from public.membros where org_id = old.org_id and papel = 'dono' and id <> old.id) then
    raise exception 'A empresa precisa ter pelo menos um dono';
  end if;
  return new;
end $$;
drop policy if exists membros_update on public.membros;
drop policy if exists membros_delete on public.membros;
create policy membros_update on public.membros for update to authenticated
  using ((public.eh_admin(org_id) and public.tem_permissao(org_id, 'equipe.gerenciar')) or user_id = auth.uid())
  with check ((public.eh_admin(org_id) and public.tem_permissao(org_id, 'equipe.gerenciar')) or user_id = auth.uid());
create policy membros_delete on public.membros for delete to authenticated
  using ((public.eh_admin(org_id) and public.tem_permissao(org_id, 'equipe.gerenciar')) or user_id = auth.uid());
drop policy if exists convites_all on public.convites;
create policy convites_all on public.convites for all to authenticated
  using (public.eh_admin(org_id) and public.tem_permissao(org_id, 'equipe.gerenciar'))
  with check (public.eh_admin(org_id) and public.tem_permissao(org_id, 'equipe.gerenciar'));

-- Limpar dados (usado ao restaurar backup) pede "fazer backup e restaurar" e marca a
-- transação para as travas de linha não barrarem a limpeza que ela mesma autorizou.
create or replace function public.limpar_dados_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin(p_org) then raise exception 'Sem permissão'; end if;
  perform public.exigir_permissao(p_org, array['backup.usar'], 'restaurar backup');
  perform set_config('lotifly.limpando', 'on', true);
  delete from public.recebiveis where org_id = p_org;
  delete from public.vendas where org_id = p_org;
  delete from public.reservas where org_id = p_org;
  delete from public.custos where org_id = p_org;
  delete from public.lotes where org_id = p_org;
  delete from public.leads where org_id = p_org;
  delete from public.indices where org_id = p_org;
  delete from public.cobrancas where org_id = p_org;
  delete from public.remessas where org_id = p_org;
  delete from public.contas_banco where org_id = p_org;
  delete from public.modelos where org_id = p_org;
  delete from public.vendedores where org_id = p_org;
  delete from public.clientes where org_id = p_org;
  delete from public.contratos_seq where org_id = p_org;
  delete from public.categorias where org_id = p_org;
  delete from public.vitrines where org_id = p_org;
  delete from public.loteamentos where org_id = p_org;
  delete from public.log where org_id = p_org;
  perform set_config('lotifly.limpando', '', true);
end $$;

-- ---------------------------------------------------------------------
-- 9. Tranca final: quem não entrou na conta (anon) não executa nada
-- ---------------------------------------------------------------------
-- Fica no fim do arquivo para pegar todas as funções acima. Todas já se protegem sozinhas
-- (pedem login ou que a pessoa seja da empresa); esta é a segunda tranca. No Postgres, função
-- nova nasce executável por qualquer um (PUBLIC), e no Supabase o anon ganha tudo o que é
-- criado no public: fecha as de hoje e as que vierem depois. Quem está logado continua
-- executando (as regras de acesso e os gatilhos usam estas funções).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on all functions in schema public to service_role';
  end if;
end $$;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public grant execute on functions to authenticated;

-- 10. Reserva vencida liberada sozinha (Configurações › Geral › Reservas)
-- ---------------------------------------------------------------------
-- Na empresa que marcou "liberar o lote sozinho" (config.reservaLiberaSozinha), a reserva
-- pendente ou aprovada cujo prazo acabou vira "expirada" e o lote volta a ficar disponível.
-- Roda no próprio banco a cada 30 minutos (pg_cron), sem depender de alguém abrir o app. O dia
-- é o de Brasília: a reserva vale até o fim do último dia do prazo.
create or replace function public.liberar_reservas_vencidas()
returns int language plpgsql security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n int := 0; r record;
begin
  for r in
    select rs.org_id, rs.id, rs.lote_id, coalesce(rs.cliente->>'nome', '') as cliente,
           coalesce('Quadra ' || l.quadra || ' · Lote ' || l.numero, 'lote') as lote
      from public.reservas rs
      join public.organizacoes o on o.id = rs.org_id
      left join public.lotes l on l.org_id = rs.org_id and l.id = rs.lote_id
     where rs.status in ('pendente', 'aprovada') and rs.validade is not null and rs.validade < v_hoje
       and coalesce(o.config->>'reservaLiberaSozinha', '') = 'true'
     for update of rs skip locked
  loop
    update public.reservas set status = 'expirada', encerrada_em = now(), motivo = 'Prazo vencido: lote liberado sozinho'
     where org_id = r.org_id and id = r.id;
    update public.lotes set status = 'disponivel', reserva_id = null
     where org_id = r.org_id and id = r.lote_id and status = 'reservado' and reserva_id = r.id;
    insert into public.log (org_id, id, who, msg)
      values (r.org_id, public.gl_novo_id(), 'Sistema', 'Reserva expirada: ' || r.lote || ' — ' || r.cliente || ' (Prazo vencido: lote liberado sozinho)');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
-- Só o banco chama (pelo agendamento): ninguém do app, logado ou não.
revoke execute on function public.liberar_reservas_vencidas() from public, anon, authenticated;

-- O agendamento a cada 30 minutos. Sem o pg_cron (banco fora do Supabase, ou extensão
-- indisponível), segue sem ele: o app libera quando o dono ou o administrador abre.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível (%); a liberação fica por conta do app', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lotifly-liberar-reservas', '*/30 * * * *', 'select public.liberar_reservas_vencidas()');
  end if;
exception when others then
  raise notice 'agendamento da liberação de reservas não criado (%)', sqlerrm;
end $$;
