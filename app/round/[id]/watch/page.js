"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

const TEAM_DOT = {
  white: "border border-slate-400 bg-white",
  red: "bg-[#521515]",
  blue: "bg-[#2a4163]",
};

function sumHoles(holesLike, holeRange) {
  let sum = 0;
  let hasAny = false;
  for (const hole of holeRange) {
    const value = holesLike[hole];
    if (value != null) {
      sum += value;
      hasAny = true;
    }
  }
  return hasAny ? sum : null;
}

export default function WatchPage() {
  const { id } = useParams();

  const [roundName, setRoundName] = useState("");
  const [pars, setPars] = useState({});
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "rounds", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoundName(data.name);
        setPars(data.pars || {});
      }
    });

    const unsub = onSnapshot(collection(db, "rounds", id, "scores"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(list);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const totalPar = useMemo(
    () => HOLES.reduce((sum, hole) => sum + (pars[hole] ?? 4), 0),
    [pars]
  );

  const totals = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      map[p.id] = Object.values(p.holes || {}).reduce((sum, v) => sum + v, 0);
    });
    return map;
  }, [players]);

  const leaderboard = useMemo(
    () => [...players].sort((a, b) => (totals[a.id] || 0) - (totals[b.id] || 0) || a.name.localeCompare(b.name)),
    [players, totals]
  );

  const redPlayers = useMemo(() => players.filter((p) => p.teamColor === "red"), [players]);
  const bluePlayers = useMemo(() => players.filter((p) => p.teamColor === "blue"), [players]);
  const hasMatch = redPlayers.length > 0 && bluePlayers.length > 0;

  const holeWinners = useMemo(() => {
    if (!hasMatch) return {};
    const result = {};
    for (const hole of HOLES) {
      const redComplete = redPlayers.every((p) => p.holes?.[hole] != null);
      const blueComplete = bluePlayers.every((p) => p.holes?.[hole] != null);
      if (!redComplete || !blueComplete) continue;
      const redSum = redPlayers.reduce((sum, p) => sum + p.holes[hole], 0);
      const blueSum = bluePlayers.reduce((sum, p) => sum + p.holes[hole], 0);
      result[hole] = redSum < blueSum ? "red" : blueSum < redSum ? "blue" : "tie";
    }
    return result;
  }, [hasMatch, redPlayers, bluePlayers]);

  const matchTally = useMemo(() => {
    const tally = { red: 0, blue: 0, tie: 0 };
    Object.values(holeWinners).forEach((w) => tally[w]++);
    return tally;
  }, [holeWinners]);

  const holesCompleted = Object.keys(holeWinners).length;
  const lead = matchTally.red - matchTally.blue;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf8f1] flex items-center justify-center">
        <p className="text-[#647895]">Loading round...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f1]">
      <div className="relative min-h-[280px] sm:min-h-[515px]">
        <div
          className="absolute inset-0 sm:hidden bg-cover bg-top bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent 30%, #faf8f1 92%), url('/round-hero.png')",
          }}
        />
        <div
          className="absolute inset-0 hidden sm:block bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent 68%, #faf8f1 100%), url('/round-hero.png')",
          }}
        />

        <header className="relative max-w-5xl mx-auto px-6 sm:px-10 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-[#071d49] tracking-tight">
            <svg viewBox="0 0 48 48" className="w-8 h-8 sm:w-10 sm:h-10" aria-hidden="true">
              <ellipse cx="23" cy="40" rx="21" ry="6" fill="#659347" />
              <path d="M23 6v34" stroke="#152342" strokeWidth="3" />
              <path d="M25 7c9-2 10 7 21 4l-5 13c-8 2-10-6-16-4z" fill="#ff6b00" />
            </svg>
            LiveGolfScore
          </div>
          <span className="rounded-full border border-[#cddaca] bg-[#fafbf1] px-4 py-2 text-[10px] font-bold uppercase tracking-[2px] text-[#244e3b]">
            The gallery
          </span>
        </header>

        <section className="relative max-w-4xl mx-auto px-6 sm:px-10 pt-2 pb-12 sm:pb-16">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#b74511] mb-3">
            For everyone cheering them on
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight text-[#071d49] mb-3">
            A great round.
            <br />
            Even better company.
          </h1>
          <p className="text-base sm:text-lg text-[#3f5060] mb-5">
            A little friendly rivalry. Every shot, together.
          </p>
          <span className="inline-flex items-center gap-3 rounded-full border border-[#d7dfcc] bg-[#fffdf3] px-4 py-2 text-xs text-[#476050]">
            18 holes <span className="text-[#e48a37]">&bull;</span> {players.length} player{players.length === 1 ? "" : "s"}
            <span className="text-[#e48a37]">&bull;</span> {roundName}
          </span>
        </section>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-14 space-y-6">
        {hasMatch && (
          <section className="bg-white rounded-2xl border border-[#e3e6de] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 sm:px-8 pt-5">
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#50694f]">
                The friendly rivalry
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 py-4 gap-2">
              <div className="text-center flex flex-col items-center">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#802f29]">
                  <span aria-hidden="true">⚑</span> Team Red
                </span>
                <strong className="font-serif text-6xl sm:text-8xl font-normal tracking-tighter text-[#802f29]">
                  {matchTally.red}
                </strong>
                <span className="text-sm text-[#536276] mt-1">
                  {redPlayers.map((p) => p.name).join(", ")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 px-2">
                <span className="font-serif italic text-xl sm:text-2xl text-[#88948a]">vs</span>
                <span className="text-[9px] tracking-[2px] text-[#819087]">HOLES WON</span>
                <span className="text-[11px] bg-[#eff4f8] text-[#315875] rounded-full px-3 py-1.5 whitespace-nowrap">
                  {lead === 0 ? "All square" : `${lead > 0 ? "Red" : "Blue"} leads by ${Math.abs(lead)}`}
                </span>
              </div>
              <div className="text-center flex flex-col items-center">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#305c83]">
                  <span aria-hidden="true">⚑</span> Team Blue
                </span>
                <strong className="font-serif text-6xl sm:text-8xl font-normal tracking-tighter text-[#305c83]">
                  {matchTally.blue}
                </strong>
                <span className="text-sm text-[#536276] mt-1">
                  {bluePlayers.map((p) => p.name).join(", ")}
                </span>
              </div>
            </div>
            <div className="border-t border-[#e9ece5] bg-[#fcfcf8] flex items-center gap-3 px-6 sm:px-8 py-3 text-[11px] text-[#627365]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#789155] shrink-0" />
              <span className="whitespace-nowrap">{holesCompleted} of 18 holes completed</span>
              <span className="flex-1 h-1 rounded-full bg-[#e7ece0] overflow-hidden">
                <span
                  className="block h-full bg-[#87a669]"
                  style={{ width: `${(holesCompleted / 18) * 100}%` }}
                />
              </span>
              <span className="whitespace-nowrap">{18 - holesCompleted} to play</span>
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-[#e1e6dd] shadow-sm px-5 sm:px-6 pt-5 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="font-serif text-lg font-bold text-[#071d49]">The scorecard</h2>
            <span className="italic text-sm text-[#7c897a]" style={{ fontFamily: "Georgia, serif" }}>
              Every shot tells the story.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm min-w-max w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[#f6f8f2] text-left text-[#556953] px-4 py-3 text-sm font-semibold">
                    Player
                  </th>
                  {HOLES.map((hole) => (
                    <th
                      key={hole}
                      className="text-center px-3 py-3 bg-[#f6f8f2] text-sm font-semibold text-[#556953]"
                    >
                      {hole}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 bg-[#edf3e9] text-sm font-bold text-[#234d38]">
                    TOT
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="par-row">
                  <td className="sticky left-0 bg-white text-[#7b8776] px-4 py-2 text-xs font-semibold">
                    Par
                  </td>
                  {HOLES.map((hole) => (
                    <td key={hole} className="text-center px-3 py-2 text-xs text-[#7b8776]">
                      {pars[hole] ?? 4}
                    </td>
                  ))}
                  <td className="text-center px-4 py-2 bg-[#f5f7f3] text-xs font-bold text-[#7b8776]">
                    {totalPar}
                  </td>
                </tr>
                {leaderboard.map((p) => {
                  const dot = TEAM_DOT[p.teamColor] || TEAM_DOT.white;
                  return (
                    <tr key={p.id} className="border-t border-[#eef1ec]">
                      <td className="sticky left-0 bg-white text-[#071d49] font-bold px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${dot}`} />
                        {p.name}
                      </td>
                      {HOLES.map((hole) => {
                        const value = p.holes?.[hole];
                        const par = pars[hole] ?? 4;
                        const isBirdie = value != null && value < par;
                        return (
                          <td key={hole} className="text-center px-3 py-3">
                            {value == null ? (
                              <span className="text-[#c3cac6]">&mdash;</span>
                            ) : isBirdie ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#d2e7c9] text-[#234d38] font-bold">
                                {value}
                              </span>
                            ) : (
                              <span className="text-lg font-bold text-[#071d49]">{value}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-4 py-3 bg-[#f5f7f3] text-lg font-bold text-[#071d49]">
                        {totals[p.id] || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-5 mt-4 text-[11px] text-[#7b8777]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-[#d2e7c9]" />
              Under par
            </span>
            <span>&mdash; Yet to play</span>
            <span className="ml-auto">Scroll to explore all 18 holes &rarr;</span>
          </div>
        </section>
      </div>

      <div className="relative mt-4">
        <div
          className="min-h-[220px] bg-cover bg-center bg-no-repeat flex items-center justify-center text-center px-6 py-10"
          style={{ backgroundImage: "url('/round-footer.png')" }}
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-5">
            <p className="text-[9px] uppercase tracking-[2px] text-[#708069] mb-2">
              The best part of the game
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#071d49]">
              Having someone to cheer for.
            </h2>
            <div className="w-9 h-0.5 bg-[#fc5b08] mx-auto my-3" />
            <p className="italic text-sm text-[#7a8775]" style={{ fontFamily: "Georgia, serif" }}>
              Good people. Great golf. Better memories.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
