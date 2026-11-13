// app/play/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function PlayComponent() {
  const searchParams = useSearchParams();
  const matchCode = searchParams.get('match') || '';
  const player = (searchParams.get('player') || 'A').toUpperCase();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [recentRounds, setRecentRounds] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('待機中');

  useEffect(() => {
    // 試合情報を取得
    const initSession = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('match_code', matchCode)
        .maybeSingle();

      if (data) {
        setSessionId(data.id);
        setCurrentRound(data.current_round);
        fetchRecent(data.id);
        checkCurrentRoundHand(data.id, data.current_round);
      }
    };
    initSession();

    // リアルタイムリスナー
    const channel = supabase
      .channel(`play-room-${matchCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload: any) => {
          if (payload.new && payload.new.match_code === matchCode) {
            const nextRound = payload.new.current_round;
            setCurrentRound(nextRound);
            setSelectedHand(null); // 次の回に進んだら選択を即時クリア
            setStatusMsg('手を選択してください');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rounds' },
        () => {
          if (sessionId) {
            fetchRecent(sessionId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchCode, sessionId]);

  // すでに現在の回で手を出しているか確認
  const checkCurrentRoundHand = async (sId: string, roundNum: number) => {
    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sId)
      .eq('round_number', roundNum)
      .maybeSingle();

    const col = `player_${player.toLowerCase()}`;
    if (data && data[col]) {
      setSelectedHand(data[col]);
      setStatusMsg('送信完了。他のプレイヤーを待機中...');
    } else {
      setSelectedHand(null);
      setStatusMsg('手を選択してください');
    }
  };

  const fetchRecent = async (sId: string) => {
    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('session_id', sId)
      .eq('completed', true)
      .order('round_number', { ascending: false })
      .limit(10);
    if (data) setRecentRounds(data);
  };

  const sendHand = async (hand: 'G' | 'T' | 'P') => {
    if (selectedHand || !sessionId) return;
    setSelectedHand(hand);
    setStatusMsg('送信中...');

    const col = `player_${player.toLowerCase()}`;
    await supabase.rpc('submit_player_hand', {
      p_session_id: sessionId,
      p_round: currentRound,
      p_col: col,
      p_hand: hand,
    });
    setStatusMsg('送信完了！待機中...');
  };

  return (
    <div className="flex flex-col h-screen max-w-sm mx-auto p-3 select-none bg-slate-950 text-slate-100 justify-between">
      {/* 1. 上部：ステータスバー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex justify-between items-center shadow">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Player</div>
          <div className="text-2xl font-black text-indigo-400">担当: {player}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">進捗状況</div>
          <div className="text-xl font-black">
            第 <span className="text-2xl text-emerald-400">{currentRound}</span> / 1000 回
          </div>
        </div>
      </div>

      {/* ガイダンスメッセージ */}
      <div className="text-center py-1">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
          {statusMsg}
        </span>
      </div>

      {/* 2. 中央：3択ボタン */}
      <div className="grid grid-rows-3 gap-2.5 my-1 flex-shrink-0 h-[48vh]">
        {[
          { key: 'G', label: 'グー (G / 1)', bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700' },
          { key: 'T', label: 'チョキ (T / 2)', bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600' },
          { key: 'P', label: 'パー (P / 3)', bg: 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700' },
        ].map((btn) => (
          <button
            key={btn.key}
            disabled={!!selectedHand}
            onClick={() => sendHand(btn.key as any)}
            className={`w-full rounded-2xl font-black text-2xl shadow-md flex items-center justify-center transition-all ${
              btn.bg
            } ${
              selectedHand === btn.key
                ? 'ring-4 ring-emerald-400 scale-[1.01] brightness-110'
                : ''
            } ${selectedHand && selectedHand !== btn.key ? 'opacity-25 grayscale' : ''}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* 3. 下部：直近10回履歴（実験ノートへの記入用） */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow h-[26vh] flex flex-col">
        <div className="text-[11px] font-bold text-slate-400 mb-1 flex justify-between items-center border-b border-slate-800 pb-1">
          <span>直近10回の記録 (原本記入用)</span>
          <span className="text-[10px] text-slate-500">最新が一番上</span>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-center text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-1">回</th><th>A</th><th>B</th><th>C</th><th>D</th>
              </tr>
            </thead>
            <tbody>
              {recentRounds.map((r) => (
                <tr key={r.round_number} className="border-b border-slate-800/40">
                  <td className="py-1 font-bold text-slate-400">{r.round_number}</td>
                  <td className={r.player_a ? 'text-white font-bold' : 'text-slate-600'}>{r.player_a || '-'}</td>
                  <td className={r.player_b ? 'text-white font-bold' : 'text-slate-600'}>{r.player_b || '-'}</td>
                  <td className={r.player_c ? 'text-white font-bold' : 'text-slate-600'}>{r.player_c || '-'}</td>
                  <td className={r.player_d ? 'text-white font-bold' : 'text-slate-600'}>{r.player_d || '-'}</td>
                </tr>
              ))}
              {recentRounds.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-600 text-center">まだ完了した手はありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="text-white p-4">読み込み中...</div>}>
      <PlayComponent />
    </Suspense>
  );
}
