// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [currentRoundData, setCurrentRoundData] = useState<any>(null);
  const [recentRounds, setRecentRounds] = useState<any[]>([]);

  // 新規部屋用フォーム
  const [newMatchCode, setNewMatchCode] = useState('');
  const [newPin, setNewPin] = useState('');

  // 管理者認証チェック（簡易セッションストレージ）
  useEffect(() => {
    if (sessionStorage.getItem('janken_admin_auth') === 'true') {
      setIsAdminAuthed(true);
    }
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // 管理パスワードは環境変数 NEXT_PUBLIC_ADMIN_PASSWORD で設定する（公開用にコード内の初期値は削除）
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

    if (correctPassword !== '' && adminPassInput === correctPassword) {
      sessionStorage.setItem('janken_admin_auth', 'true');
      setIsAdminAuthed(true);
      setAuthError('');
    } else {
      setAuthError('パスワードが正しくありません');
    }
  };

  // セッション一覧の取得
  const fetchSessions = async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      setSessions(data);
      // まだ選択されていない場合はアクティブな部屋、または最新の部屋を選択
      if (!selectedSessionId) {
        const active = data.find((s) => s.is_active) || data[0];
        setSelectedSessionId(active.id);
      }
    }
  };

  useEffect(() => {
    if (!isAdminAuthed) return;
    fetchSessions();

    const channel = supabase
      .channel('admin-global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => {
        if (selectedSessionId && activeSession) {
          loadRoundDetails(selectedSessionId, activeSession.current_round);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminAuthed, selectedSessionId, activeSession?.current_round]);

  // 選択中のセッションが変わった時
  useEffect(() => {
    if (!selectedSessionId || sessions.length === 0) return;
    const current = sessions.find((s) => s.id === selectedSessionId);
    if (current) {
      setActiveSession(current);
      loadRoundDetails(current.id, current.current_round);
    }
  }, [selectedSessionId, sessions]);

  const loadRoundDetails = async (sId: string, roundNum: number) => {
    const { data: cur } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sId)
      .eq('round_number', roundNum)
      .maybeSingle();
    setCurrentRoundData(cur || null);

    const { data: rec } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sId)
      .eq('completed', true)
      .order('round_number', { ascending: false })
      .limit(15);
    setRecentRounds(rec || []);
  };

  // 新規部屋作成
  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchCode) return;

    // 既存のセッションをすべて非アクティブ化
    await supabase.from('sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        match_code: newMatchCode.trim(),
        pin_code: newPin.trim(),
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      setNewMatchCode('');
      await fetchSessions();
      setSelectedSessionId(data.id);
    }
  };

  // 選択中の部屋を「アクティブ（進行対象）」に設定
  const makeCurrentSessionActive = async () => {
    if (!selectedSessionId) return;
    await supabase.from('sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sessions').update({ is_active: true }).eq('id', selectedSessionId);
    await fetchSessions();
  };

  // CSV出力
  const exportCSV = async (format: 'GTP' | '123') => {
    if (!activeSession) return;
    const { data } = await supabase
      .from('rounds')
      .select('round_number, player_a, player_b, player_c, player_d')
      .eq('session_id', activeSession.id)
      .order('round_number', { ascending: true });

    if (!data) return;

    const map: Record<string, string> = { G: '1', T: '2', P: '3' };
    const rows = data.map((r) => [
      r.round_number,
      format === '123' ? map[r.player_a] || '' : r.player_a || '',
      format === '123' ? map[r.player_b] || '' : r.player_b || '',
      format === '123' ? map[r.player_c] || '' : r.player_c || '',
      format === '123' ? map[r.player_d] || '' : r.player_d || '',
    ]);

    const csv = ['回数,A,B,C,D', ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `janken_${activeSession.match_code}_${format}.csv`;
    link.click();
  };

  // 未認証時のログイン画面
  if (!isAdminAuthed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={handleAdminLogin} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-black text-slate-900">管理者ログイン</h1>
            <p className="text-xs text-slate-500 mt-1">管理パスワードを入力してください</p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl text-center">
              {authError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">パスワード</label>
            <input
              type="password"
              required
              autoFocus
              value={adminPassInput}
              onChange={(e) => setAdminPassInput(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-900 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー＆部屋管理バー */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-indigo-400">じゃんけん 1000 モニター</h1>
              {activeSession?.is_active ? (
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
                  進行中 (Active)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-700 text-slate-400 text-xs font-bold rounded-full">
                  過去ログ参照中
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              PIN: <span className="text-white font-bold">{activeSession?.pin_code || '-'}</span> | セッションID:{' '}
              <span className="text-slate-500">{activeSession?.id?.slice(0, 8)}...</span>
            </p>
          </div>

          {/* 部屋切り替えドロップダウン ＆ 新規作成 */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-bold whitespace-nowrap">参照中の部屋:</label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white font-mono text-sm px-3 py-2 rounded-xl outline-none"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.match_code} {s.is_active ? '(現在進行中)' : ''}
                  </option>
                ))}
              </select>
              {!activeSession?.is_active && (
                <button
                  onClick={makeCurrentSessionActive}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl whitespace-nowrap"
                >
                  この部屋を進行中にする
                </button>
              )}
            </div>

            {/* 新規部屋作成ボタンフォーム */}
            <form onSubmit={createSession} className="flex gap-2">
              <input
                type="text"
                placeholder="新部屋名 (例: room2)"
                value={newMatchCode}
                onChange={(e) => setNewMatchCode(e.target.value)}
                className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
              />
              <input
                type="text"
                placeholder="PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-16 px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white text-center outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl whitespace-nowrap"
              >
                作成
              </button>
            </form>
          </div>
        </div>

        {/* メイン進行パネル */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">STATUS MONITOR</span>
                <div className="text-sm font-bold text-slate-300">部屋: {activeSession?.match_code}</div>
              </div>
              <div className="text-right">
                <span className="text-6xl font-black text-emerald-400">{activeSession?.current_round || 1}</span>
                <span className="text-2xl text-slate-600 font-bold"> / 1000 回</span>
              </div>
            </div>

            {/* 4人の手のリアルタイム反映カード */}
            <div className="grid grid-cols-4 gap-4 my-8">
              {(['a', 'b', 'c', 'd'] as const).map((p) => {
                const hand = currentRoundData?.[`player_${p}`];
                return (
                  <div
                    key={p}
                    className={`h-36 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${
                      hand
                        ? 'bg-emerald-950/50 border-emerald-500 scale-[1.03] shadow-lg shadow-emerald-950'
                        : 'bg-slate-800/40 border-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-400 uppercase">Player {p}</span>
                    <span className="text-4xl font-black mt-2 text-white">
                      {hand ? hand : <span className="text-xs text-slate-500 font-normal">選択中...</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-500 text-center">
              ※4人全員の手が送信されると、約0.8秒後に自動的に次ラウンドへカウントアップします。
            </div>
          </div>

          {/* 集計データ出力パネル */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-200">集計データ出力</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                現在選択中の部屋（<span className="text-indigo-400 font-bold">{activeSession?.match_code}</span>）の全試行データをCSVでダウンロードします。
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => exportCSV('GTP')}
                className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-lg transition-transform active:scale-95"
              >
                CSV出力 (G / T / P)
              </button>
              <button
                onClick={() => exportCSV('123')}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg transition-transform active:scale-95"
              >
                CSV出力 (1 / 2 / 3)
              </button>
            </div>
          </div>
        </div>

        {/* 履歴テーブル */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-slate-200">直近の完了履歴 (原本記入の確認用)</h2>
            <span className="text-xs text-slate-500">最新15件を表示中</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center font-mono text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="py-2.5">回数</th>
                  <th>Player A</th>
                  <th>Player B</th>
                  <th>Player C</th>
                  <th>Player D</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recentRounds.map((r) => (
                  <tr key={r.round_number}>
                    <td className="py-2 font-bold text-emerald-400">{r.round_number}</td>
                    <td className="text-slate-200">{r.player_a}</td>
                    <td className="text-slate-200">{r.player_b}</td>
                    <td className="text-slate-200">{r.player_c}</td>
                    <td className="text-slate-200">{r.player_d}</td>
                  </tr>
                ))}
                {recentRounds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-slate-600 text-xs">
                      まだ完了したラウンドデータはありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
