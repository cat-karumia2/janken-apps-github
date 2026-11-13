// app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function JoinPage() {
  const router = useRouter();
  const [matchCode, setMatchCode] = useState('');
  const [pin, setPin] = useState('');
  const [player, setPlayer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: fetchErr } = await supabase
      .from('sessions')
      .select('id, pin_code, is_active')
      .eq('match_code', matchCode.trim())
      .maybeSingle();

    if (fetchErr || !data) {
      setError('指定された試合IDが見つかりません');
      setLoading(false);
      return;
    }

    if (data.pin_code !== pin.trim()) {
      setError('PINコードが違います');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('janken_session_id', data.id);
    router.push(`/play?match=${encodeURIComponent(matchCode.trim())}&player=${player}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">じゃんけん 1000</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">参加情報を入力してください</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">試合ID (部屋番号)</label>
            <input
              type="text"
              required
              value={matchCode}
              onChange={(e) => setMatchCode(e.target.value)}
              placeholder="例: room1"
              className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-mono text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">参加PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PINを入力"
              className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-mono text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">あなたの担当</label>
            <div className="grid grid-cols-4 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPlayer(p)}
                  className={`py-3 rounded-xl font-black text-lg border-2 transition-all ${
                    player === p
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-lg rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {loading ? '確認中...' : '入室する'}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100">
          <Link href="/admin" className="text-xs text-slate-400 hover:text-indigo-600 font-medium">
            管理者画面（モニター）はこちら →
          </Link>
        </div>
      </div>
    </div>
  );
}
