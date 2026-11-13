-- Supabase の SQL Editor で実行する初期設定

-- 1. 試合（部屋）の管理テーブル
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  match_code text not null unique,
  pin_code text not null,
  current_round int default 1,
  total_rounds int default 1000,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. 各回の手の記録テーブル
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round_number int not null,
  player_a text,
  player_b text,
  player_c text,
  player_d text,
  completed boolean default false,
  created_at timestamptz default now(),
  unique(session_id, round_number)
);

-- 3. リアルタイム配信を有効化
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table rounds;

-- 4. 手を送信する関数（4人分そろったら次の回へ進める）
create or replace function submit_player_hand(
  p_session_id uuid,
  p_round int,
  p_col text,
  p_hand text
) returns void as $$
declare
  r record;
begin
  insert into rounds (session_id, round_number)
  values (p_session_id, p_round)
  on conflict (session_id, round_number) do nothing;

  execute format('update rounds set %I = $1 where session_id = $2 and round_number = $3', p_col)
  using p_hand, p_session_id, p_round;

  select * into r from rounds where session_id = p_session_id and round_number = p_round;
  if r.player_a is not null and r.player_b is not null and r.player_c is not null and r.player_d is not null then
    update rounds set completed = true where id = r.id;
    update sessions set current_round = p_round + 1 where id = p_session_id;
  end if;
end;
$$ language plpgsql;

-- 5. 実験時は RLS を無効化して使用した
--    （部屋のPINはアプリ側で確認しているだけなので、公開環境で使う場合は RLS ポリシーの設定を推奨）
alter table sessions disable row level security;
alter table rounds disable row level security;
