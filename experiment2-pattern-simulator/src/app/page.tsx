"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Download, Check, RefreshCw, Lock, Users, FileSpreadsheet, Eye, Shuffle } from "lucide-react";

// 手の定義
type Hand = "G" | "T" | "P";

interface Pattern {
  id: string;
  name: string;
  sequence: Hand[];
}

const HAND_LABELS_ALPHA: Record<Hand, string> = { G: "G", T: "T", P: "P" };
const HAND_LABELS_NUM: Record<Hand, string> = { G: "1", T: "2", P: "3" };
const HAND_NAMES: Record<Hand, string> = { G: "グー", T: "チョキ", P: "パー" };

// 4人の勝敗判定
// 勝者なし(あいこ): []
// 勝者あり: 勝ったプレイヤー名の配列
function evaluateRound(hands: { player: string; hand: Hand }[]): string[] {
  const uniqueHands = Array.from(new Set(hands.map((h) => h.hand)));
  // 全員同じ、または3種すべて出ている場合はあいこ
  if (uniqueHands.length === 1 || uniqueHands.length === 3) {
    return [];
  }
  // 2種類の場合
  let winningHand: Hand;
  if (uniqueHands.includes("G") && uniqueHands.includes("T")) winningHand = "G";
  else if (uniqueHands.includes("T") && uniqueHands.includes("P")) winningHand = "T";
  else winningHand = "P";

  return hands.filter((h) => h.hand === winningHand).map((h) => h.player);
}

export default function JankenSimulator() {
  // --- 1. 初見アクセス制限 (パスコード) ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState("");
  const [passError, setPassError] = useState(false);
  // パスコードは環境変数 NEXT_PUBLIC_ACCESS_CODE で設定する（公開用にコード内の値は削除）
  const SECRET_KEY = process.env.NEXT_PUBLIC_ACCESS_CODE || "";

  useEffect(() => {
    if (sessionStorage.getItem("janken_auth") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (SECRET_KEY !== "" && passcode === SECRET_KEY) {
      setIsAuthenticated(true);
      sessionStorage.setItem("janken_auth", "true");
    } else {
      setPassError(true);
    }
  };

  // --- 2. パターン管理ステート ---
  const [patterns, setPatterns] = useState<Pattern[]>([
    { id: "1", name: "パターン1 (標準)", sequence: ["G", "T", "P", "G", "P", "T"] },
    { id: "2", name: "パターン2 (変則)", sequence: ["P", "P", "G", "T", "G", "T", "P"] },
    { id: "3", name: "パターン3 (短期)", sequence: ["T", "G", "P", "T"] },
    { id: "4", name: "パターン4 (バランス)", sequence: ["G", "G", "T", "P", "P", "T"] },
  ]);

  const [newPatternName, setNewPatternName] = useState("");
  const [newPatternInput, setNewPatternInput] = useState("");

  // --- 3. プレイヤー設定 ---
  const [playerAssignments, setPlayerAssignments] = useState({
    A: "1",
    B: "2",
    C: "3",
    D: "4",
  });

  const [totalRounds, setTotalRounds] = useState(50);
  const [displayMode, setDisplayMode] = useState<"alpha" | "num">("alpha");

  // iPadノート転記補助用ステート (行のタップで完了状態トグル)
  const [completedRows, setCompletedRows] = useState<Record<number, boolean>>({});

  // パターンのバランス自動生成ヘルパー
  const generateBalancedPattern = (length: number): Hand[] => {
    const hands: Hand[] = ["G", "T", "P"];
    const result: Hand[] = [];
    for (let i = 0; i < length; i++) {
      result.push(hands[Math.floor(Math.random() * hands.length)]);
    }
    return result;
  };

  const handleAddPattern = () => {
    const rawHands = newPatternInput.toUpperCase().replace(/[^GTP123]/g, "");
    if (!newPatternName.trim()) return alert("パターン名を入力してください");

    // 1->G, 2->T, 3->P にも変換対応
    const parsedSequence: Hand[] = rawHands.split("").map((char) => {
      if (char === "1") return "G";
      if (char === "2") return "T";
      if (char === "3") return "P";
      return char as Hand;
    });

    if (parsedSequence.length < 3 || parsedSequence.length > 200) {
      return alert("手数は3手以上200手以下で設定してください。");
    }

    const newPat: Pattern = {
      id: Date.now().toString(),
      name: newPatternName,
      sequence: parsedSequence,
    };

    setPatterns([...patterns, newPat]);
    setNewPatternName("");
    setNewPatternInput("");
  };

  // --- シミュレーション計算 ---
  const simulationResults = useMemo(() => {
    const results = [];
    const patA = patterns.find((p) => p.id === playerAssignments.A)?.sequence || ["G"];
    const patB = patterns.find((p) => p.id === playerAssignments.B)?.sequence || ["G"];
    const patC = patterns.find((p) => p.id === playerAssignments.C)?.sequence || ["G"];
    const patD = patterns.find((p) => p.id === playerAssignments.D)?.sequence || ["G"];

    for (let round = 0; round < totalRounds; round++) {
      const handA = patA[round % patA.length];
      const handB = patB[round % patB.length];
      const handC = patC[round % patC.length];
      const handD = patD[round % patD.length];

      const roundHands = [
        { player: "A", hand: handA },
        { player: "B", hand: handB },
        { player: "C", hand: handC },
        { player: "D", hand: handD },
      ];

      const winners = evaluateRound(roundHands);

      results.push({
        round: round + 1,
        A: handA,
        B: handB,
        C: handC,
        D: handD,
        winners,
      });
    }
    return results;
  }, [patterns, playerAssignments, totalRounds]);

  // CSVダウンロード
  const downloadCSV = () => {
    const headers = ["回数", "プレイヤーA", "プレイヤーB", "プレイヤーC", "プレイヤーD", "勝者"];
    const rows = simulationResults.map((r) => {
      const formatHand = (h: Hand) => (displayMode === "alpha" ? HAND_LABELS_ALPHA[h] : HAND_LABELS_NUM[h]);
      const winnerStr = r.winners.length === 0 ? "あいこ" : r.winners.join("・");
      return [r.round, formatHand(r.A), formatHand(r.B), formatHand(r.C), formatHand(r.D), `"${winnerStr}"`];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `janken_simulation_${displayMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 行完了トグル
  const toggleRow = (idx: number) => {
    setCompletedRows((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // 最も若い未記入行を計算
  const currentActiveRowIndex = useMemo(() => {
    for (let i = 0; i < simulationResults.length; i++) {
      if (!completedRows[i]) return i;
    }
    return -1;
  }, [completedRows, simulationResults.length]);

  // 認証画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-sm border border-slate-700">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-indigo-600 rounded-full">
              <Lock className="text-white w-6 h-6" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center text-white mb-4">シミュレーター保護</h2>
          <input
            type="password"
            placeholder="パスコードを入力"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-3 focus:outline-none focus:border-indigo-500"
          />
          {passError && <p className="text-rose-400 text-xs mb-3">パスコードが違います</p>}
          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition">
            解除
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">4人じゃんけんシミュレーター</h1>
          <p className="text-slate-400 text-sm mt-1">iPad手書き転記最適化モード搭載</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDisplayMode(displayMode === "alpha" ? "num" : "alpha")}
            className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-sm flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            表示切替: {displayMode === "alpha" ? "G / T / P" : "1 / 2 / 3"}
          </button>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg"
          >
            <Download className="w-4 h-4" />
            CSVエクスポート
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左カラム: 設定・パターン登録 */}
        <div className="space-y-6">
          {/* パターン割り当て */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-200">
              <Users className="w-5 h-5 text-indigo-400" /> プレイヤー設定
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["A", "B", "C", "D"] as const).map((p) => (
                <div key={p}>
                  <label className="text-xs text-slate-400 mb-1 block">プレイヤー {p}</label>
                  <select
                    value={playerAssignments[p]}
                    onChange={(e) => setPlayerAssignments({ ...playerAssignments, [p]: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  >
                    {patterns.map((pat) => (
                      <option key={pat.id} value={pat.id}>
                        {pat.name} ({pat.sequence.length}手)
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">シミュレーション総手数</label>
              <input
                type="number"
                value={totalRounds}
                onChange={(e) => setTotalRounds(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </section>

          {/* 新規パターン登録 */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-200">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" /> パターン新規作成
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">パターン名</label>
                <input
                  type="text"
                  placeholder="例: パターン5 (乱数)"
                  value={newPatternName}
                  onChange={(e) => setNewPatternName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  手の配列 (3〜200手 / GTP または 123)
                </label>
                <textarea
                  rows={3}
                  placeholder="例: GTPGPTTP または 12312321"
                  value={newPatternInput}
                  onChange={(e) => setNewPatternInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase"
                />
              </div>

              {/* クイックバランス生成ボタン */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rnd = generateBalancedPattern(12);
                    setNewPatternInput(rnd.join(""));
                    if (!newPatternName) setNewPatternName("自動生成バランス12");
                  }}
                  className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs flex items-center justify-center gap-1 text-slate-300"
                >
                  <Shuffle className="w-3.5 h-3.5" /> 12手自動生成
                </button>
                <button
                  type="button"
                  onClick={handleAddPattern}
                  className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white"
                >
                  登録する
                </button>
              </div>
            </div>

            {/* 登録済みパターンリスト */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-400 mb-2">登録済みパターン一覧:</div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {patterns.map((p) => {
                  const gCount = p.sequence.filter((x) => x === "G").length;
                  const tCount = p.sequence.filter((x) => x === "T").length;
                  const pCount = p.sequence.filter((x) => x === "P").length;
                  return (
                    <div key={p.id} className="p-2 bg-slate-800/60 rounded text-xs border border-slate-800">
                      <div className="font-semibold text-slate-300">{p.name} ({p.sequence.length}手)</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">
                        G:{gCount} / T:{tCount} / P:{pCount} (
                        {Math.round((gCount / p.sequence.length) * 100)}% /{" "}
                        {Math.round((tCount / p.sequence.length) * 100)}% /{" "}
                        {Math.round((pCount / p.sequence.length) * 100)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* 右カラム: iPad手書き移し用インタラクティブ一覧 */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 sticky top-0 z-10 backdrop-blur">
              <div>
                <h2 className="font-bold text-slate-200">ノート記入モード</h2>
                <p className="text-xs text-slate-400">タップで行の完了/未完了を切り替え</p>
              </div>
              <button
                onClick={() => setCompletedRows({})}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> 進捗リセット
              </button>
            </div>

            <div className="overflow-x-auto max-h-[75vh]">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 text-xs uppercase font-mono sticky top-0 border-b border-slate-700">
                    <th className="p-3 w-16 text-center">#</th>
                    <th className="p-3">Player A</th>
                    <th className="p-3">Player B</th>
                    <th className="p-3">Player C</th>
                    <th className="p-3">Player D</th>
                    <th className="p-3 text-center">勝者</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {simulationResults.map((res, idx) => {
                    const isCompleted = !!completedRows[idx];
                    const isNextActive = idx === currentActiveRowIndex;

                    const formatVal = (h: Hand) =>
                      displayMode === "alpha" ? HAND_LABELS_ALPHA[h] : HAND_LABELS_NUM[h];

                    return (
                      <tr
                        key={idx}
                        onClick={() => toggleRow(idx)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isCompleted
                            ? "bg-slate-950/70 opacity-30 line-through text-slate-500"
                            : isNextActive
                            ? "bg-indigo-950/60 border-l-4 border-l-indigo-400 font-bold scale-[1.002]"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="p-3.5 text-center font-mono text-xs">
                          {isCompleted ? <Check className="w-4 h-4 mx-auto text-emerald-500" /> : res.round}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-center min-w-[2.5rem] font-mono ${
                              res.A === "G"
                                ? "bg-red-500/20 text-red-300"
                                : res.A === "T"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {formatVal(res.A)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-center min-w-[2.5rem] font-mono ${
                              res.B === "G"
                                ? "bg-red-500/20 text-red-300"
                                : res.B === "T"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {formatVal(res.B)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-center min-w-[2.5rem] font-mono ${
                              res.C === "G"
                                ? "bg-red-500/20 text-red-300"
                                : res.C === "T"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {formatVal(res.C)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded text-center min-w-[2.5rem] font-mono ${
                              res.D === "G"
                                ? "bg-red-500/20 text-red-300"
                                : res.D === "T"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}
                          >
                            {formatVal(res.D)}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {res.winners.length === 0 ? (
                            <span className="text-slate-500 text-xs">あいこ</span>
                          ) : (
                            <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-xs font-semibold">
                              {res.winners.join("・")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
