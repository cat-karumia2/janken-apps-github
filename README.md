# 4人じゃんけん実験用 Webアプリ

情報学実験入門（4人じゃんけんの勝率の収束）で使用した2つのWebアプリのソースコードです。
どちらも Gemini を用いて作成し、Vercel で公開して使用しました。

| フォルダ | 使った実験 | 内容 |
| --- | --- | --- |
| `experiment1-input-app/` | 実験1（人が手を選ぶじゃんけん） | 4人がスマートフォンで手を入力し、リアルタイムで記録するアプリ |
| `experiment2-pattern-simulator/` | 実験2（手のパターンを決めたじゃんけん） | 4人の手のパターンを登録し、各回の手を並べて出力するシミュレーター |

## experiment1-input-app（実験1）

- 構成：Next.js（App Router）＋ Tailwind CSS ＋ Supabase（データベースとリアルタイム同期）
- 画面
  - `/`：参加画面。部屋名・PIN・担当（A〜D）を入力して入室する
  - `/play`：入力画面。グー・チョキ・パーのボタンと直近10回の記録を表示する
  - `/admin`：管理画面。部屋の作成、4人の入力状況の表示、CSV出力（G/T/P 表記と 1/2/3 表記）
- 4人全員の手がそろうと、データベース側の関数 `submit_player_hand` が次の回へ進める

### 動かし方

1. Supabase でプロジェクトを作り、SQL Editor で `supabase/schema.sql` を実行する
2. `.env.example` をコピーして `.env.local` を作り、Supabase の URL と anon key、管理パスワードを書く
3. 次のコマンドで起動する

```bash
cd experiment1-input-app
npm install
npm run dev
```

## experiment2-pattern-simulator（実験2）

- 構成：Next.js（App Router）＋ Tailwind CSS ＋ lucide-react（データベースは使わず、ブラウザ内で完結）
- 機能
  - 手のパターンの登録（3〜200手、`GTP` 表記と `123` 表記のどちらでも入力できる）
  - プレイヤー A〜D へのパターンの割り当てと、指定した回数分の手の一覧表示
  - CSV出力（G/T/P 表記と 1/2/3 表記）
  - 実験ノートへ書き写すときに、書き終えた行をタップして暗くする機能

### 動かし方

1. `.env.example` をコピーして `.env.local` を作り、画面を開くときのパスコードを書く
2. 次のコマンドで起動する

```bash
cd experiment2-pattern-simulator
npm install
npm run dev
```

## Vercel で公開する場合

1つのリポジトリに2つのアプリが入っているため、Vercel ではアプリごとにプロジェクトを作り、
Settings → Build and Deployment の **Root Directory** にそれぞれ
`experiment1-input-app` または `experiment2-pattern-simulator` を指定する。
環境変数は `.env.example` と同じ名前で Vercel の Environment Variables に登録する。

## 実験2の勝敗判定に使った Excel の式

シミュレーターから出力した 1/2/3 表記の CSV を Excel に読み込み、次の式で各プレイヤーの勝敗を判定した
（B〜E列が A〜D の手、`B3` の部分を判定したいプレイヤーの列に変える）。
4人の手 h について 10^h を足すと、10の位・100の位・1000の位にそれぞれグー・チョキ・パーを出した人数が入ることを利用している。

```
=LET(
  total, SUM(10^$B3:$E3),
  g, INT(MOD(total, 100)/10),
  t, INT(MOD(total, 1000)/100),
  p, INT(total/1000),
  types, (g>0) + (t>0) + (p>0),
  IF(OR(types=1, types=3), "あいこ",
    IF(OR(AND(B3=1, t>0), AND(B3=2, p>0), AND(B3=3, g>0)), "勝ち", "負け")
  )
)
```

## 注意

- このリポジトリのコードは、作成時の Gemini との会話記録から、実験で使用した時点の版を取り出して整理したものである。
- 公開にあたり、Supabase の接続情報やパスワードなどはコードから取り除き、環境変数で設定する形に変更した。
  - 実験1：管理パスワードの初期値をコードから削除（`NEXT_PUBLIC_ADMIN_PASSWORD` で設定）、部屋作成時の PIN の初期値を空欄に変更
  - 実験2：パスコードをコードから削除（`NEXT_PUBLIC_ACCESS_CODE` で設定）
- パスワードやパスコードの確認はブラウザ側で行っているだけなので、意図しない人が開くのを防ぐ程度の仕組みである。
- `package.json` などの設定ファイルは、会話記録に残っていなかったため新たに用意した。ライブラリのバージョンは実験時と異なる場合がある。
