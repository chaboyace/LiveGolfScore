"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
const FRONT_NINE = HOLES.slice(0, 9);
const BACK_NINE = HOLES.slice(9);

const TEAM_COLORS = {
  white: { bg: "bg-white", text: "text-blue-950", swatch: "bg-white border border-slate-400" },
  red: { bg: "bg-[#521515]", text: "text-white", swatch: "bg-[#521515]" },
  blue: { bg: "bg-[#2a4163]", text: "text-white", swatch: "bg-[#2a4163]" },
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

export default function RoundPage() {
  const { id } = useParams();

  const [roundName, setRoundName] = useState("");
  const [pars, setPars] = useState({});
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [codeModalPlayer, setCodeModalPlayer] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeModalError, setCodeModalError] = useState("");
  const [selectedColor, setSelectedColor] = useState("white");

  const storageKey = `livegolfscore:${id}:playerId`;

  useEffect(() => {
    setMyPlayerId(window.localStorage.getItem(storageKey));
    setCurrentHole(1);
  }, [storageKey]);

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

  function openCodeModal(player) {
    setCodeModalPlayer(player);
    setCodeInput("");
    setCodeModalError("");
    setSelectedColor("white");
  }

  function logInLocally(playerId) {
    window.localStorage.setItem(storageKey, playerId);
    setMyPlayerId(playerId);
    setCodeModalPlayer(null);
  }

  async function submitCode(e) {
    e.preventDefault();
    const code = codeInput.trim();
    if (!/^\d{4}$/.test(code)) {
      setCodeModalError("Enter a 4-digit code.");
      return;
    }

    if (codeModalPlayer.code) {
      if (code === codeModalPlayer.code) {
        logInLocally(codeModalPlayer.id);
      } else {
        setCodeModalError("Wrong code.");
      }
      return;
    }

    try {
      await updateDoc(doc(db, "rounds", id, "scores", codeModalPlayer.id), {
        code,
        teamColor: selectedColor,
      });
      logInLocally(codeModalPlayer.id);
    } catch (err) {
      setCodeModalError("Someone just set a code for this name — refresh and enter it instead.");
    }
  }

  function clearPlayer() {
    window.localStorage.removeItem(storageKey);
    setMyPlayerId(null);
  }

  async function setHoleScore(playerId, hole, value) {
    const strokes = value === "" ? null : Math.max(1, Math.min(15, Number(value)));
    const player = players.find((p) => p.id === playerId);
    const newHoles = { ...player.holes };
    if (strokes === null) {
      delete newHoles[hole];
    } else {
      newHoles[hole] = strokes;
    }
    await updateDoc(doc(db, "rounds", id, "scores", playerId), { holes: newHoles });
  }

  function adjustHoleScore(delta) {
    const current = me?.holes?.[currentHole] ?? 0;
    setHoleScore(me.id, currentHole, current + delta);
  }

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

  const me = players.find((p) => p.id === myPlayerId);

  function HoleWinnerDot({ hole }) {
    if (!hasMatch) return null;
    const winner = holeWinners[hole];
    const dotColor =
      winner === "red" ? "bg-[#521515]" : winner === "blue" ? "bg-[#2a4163]" : winner === "tie" ? "bg-slate-400" : "bg-transparent";
    return <div className={`mx-auto mt-1 w-2.5 h-2.5 rounded-full ${dotColor}`} />;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading round...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-blue-950">{roundName}</h1>
          <p className="text-sm text-slate-600">Share this page's link with your group.</p>
        </div>

        {!me && (
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-blue-950 mb-3">Who are you?</h2>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openCodeModal(p)}
                  className="rounded-lg border border-slate-300 py-2 px-3 text-left hover:bg-orange-50 font-medium text-blue-950"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {codeModalPlayer && (
              <form onSubmit={submitCode} className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-blue-950 mb-2">
                  {codeModalPlayer.code
                    ? `Enter ${codeModalPlayer.name}'s 4-digit code`
                    : `Set a 4-digit code for ${codeModalPlayer.name}`}
                </p>
                {!codeModalPlayer.code && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 mb-1">Pick a team color</p>
                    <div className="flex gap-2">
                      {Object.entries(TEAM_COLORS).map(([key, { swatch }]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedColor(key)}
                          aria-label={key}
                          className={`w-8 h-8 rounded-full ${swatch} ${
                            selectedColor === key ? "ring-2 ring-offset-2 ring-orange-500" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="1234"
                    autoFocus
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 w-24 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-orange-500 text-white text-sm font-medium px-4 py-1.5 hover:bg-orange-600"
                  >
                    {codeModalPlayer.code ? "Enter" : "Set code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeModalPlayer(null)}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
                {codeModalError && <p className="text-red-600 text-sm mt-2">{codeModalError}</p>}
                {!codeModalPlayer.code && (
                  <p className="text-xs text-slate-500 mt-2">
                    Remember this code &mdash; you'll need it to get back into your scorecard later.
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        {me && (
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-blue-950">
                Your scorecard &mdash; {me.name}
              </h2>
              <button
                onClick={clearPlayer}
                className="text-xs text-orange-600 hover:underline"
              >
                Not you?
              </button>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-blue-950">Hole {currentHole}</h3>
              <p className="text-sm text-orange-600 mb-4">Par {pars[currentHole] ?? 4}</p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
                  disabled={currentHole === 1}
                  aria-label="Previous hole"
                  className="w-11 h-11 rounded-full bg-blue-50 text-blue-900 text-xl font-bold flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
                >
                  ‹
                </button>

                <div className="flex items-stretch rounded-2xl border border-orange-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(-1)}
                    aria-label="Decrease score"
                    className="px-5 text-2xl font-bold text-orange-600 hover:bg-orange-50"
                  >
                    −
                  </button>
                  <div className="px-6 py-2 flex flex-col items-center justify-center border-x border-orange-200 min-w-[88px]">
                    <span className="text-xs text-orange-600">Score</span>
                    <span className="text-3xl font-bold text-blue-950">
                      {me.holes?.[currentHole] ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(1)}
                    aria-label="Increase score"
                    className="px-5 text-2xl font-bold text-orange-600 hover:bg-orange-50"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentHole((h) => Math.min(18, h + 1))}
                  disabled={currentHole === 18}
                  aria-label="Next hole"
                  className="w-11 h-11 rounded-full bg-blue-50 text-blue-900 text-xl font-bold flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-blue-950 text-center">
              Total: <span className="font-semibold">{totals[me.id] || 0}</span>
              <span className="text-orange-600 ml-1">(par {totalPar})</span>
            </p>
          </section>
        )}

        {hasMatch && (
          <section className="bg-white rounded-xl border-2 border-[#060f1e] px-5 py-3 flex items-center justify-center gap-4">
            <span className="rounded-full bg-[#521515] text-white text-sm font-bold px-4 py-1.5">
              RED {matchTally.red}
            </span>
            {matchTally.tie > 0 && (
              <span className="text-xs text-slate-500">{matchTally.tie} halved</span>
            )}
            <span className="rounded-full bg-[#2a4163] text-white text-sm font-bold px-4 py-1.5">
              BLUE {matchTally.blue}
            </span>
          </section>
        )}

        <section className="bg-white rounded-xl overflow-hidden border-2 border-[#060f1e]">
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm min-w-max w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left text-blue-950 px-4 py-3 border-b-2 border-r-2 border-[#060f1e] text-base font-bold">
                    Player
                  </th>
                  {FRONT_NINE.map((hole) => (
                    <th
                      key={hole}
                      className={`text-center px-3 py-3 border-b-2 border-r border-[#060f1e] text-base font-bold text-blue-950 ${
                        hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                      }`}
                    >
                      {hole}
                      {hole === currentHole && (
                        <div className="text-[10px] font-normal tracking-wide text-blue-950">Editing</div>
                      )}
                      <HoleWinnerDot hole={hole} />
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 border-b-2 border-r-2 border-[#060f1e] text-base font-bold text-blue-950 bg-[#e5e5e5]">
                    OUT
                  </th>
                  {BACK_NINE.map((hole) => (
                    <th
                      key={hole}
                      className={`text-center px-3 py-3 border-b-2 border-r border-[#060f1e] text-base font-bold text-blue-950 ${
                        hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                      }`}
                    >
                      {hole}
                      {hole === currentHole && (
                        <div className="text-[10px] font-normal tracking-wide text-blue-950">Editing</div>
                      )}
                      <HoleWinnerDot hole={hole} />
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 border-b-2 border-r-2 border-[#060f1e] text-base font-bold text-blue-950 bg-[#e5e5e5]">
                    IN
                  </th>
                  <th className="text-center px-4 py-3 border-b-2 border-[#060f1e] text-base font-bold text-blue-950 bg-[#e5e5e5]">
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="sticky left-0 bg-white text-blue-950 px-4 py-2 border-b-2 border-r-2 border-[#060f1e] font-semibold">
                    Par
                  </td>
                  {FRONT_NINE.map((hole) => (
                    <td
                      key={hole}
                      className={`text-center px-3 py-2 border-b-2 border-r border-[#060f1e] text-blue-950 ${
                        hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                      }`}
                    >
                      {pars[hole] ?? 4}
                    </td>
                  ))}
                  <td className="text-center px-4 py-2 border-b-2 border-r-2 border-[#060f1e] bg-[#e5e5e5] text-blue-950 font-semibold">
                    {sumHoles(pars, FRONT_NINE)}
                  </td>
                  {BACK_NINE.map((hole) => (
                    <td
                      key={hole}
                      className={`text-center px-3 py-2 border-b-2 border-r border-[#060f1e] text-blue-950 ${
                        hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                      }`}
                    >
                      {pars[hole] ?? 4}
                    </td>
                  ))}
                  <td className="text-center px-4 py-2 border-b-2 border-r-2 border-[#060f1e] bg-[#e5e5e5] text-blue-950 font-semibold">
                    {sumHoles(pars, BACK_NINE)}
                  </td>
                  <td className="text-center px-4 py-2 border-b-2 border-[#060f1e] bg-[#e5e5e5] text-blue-950 font-bold">
                    {totalPar}
                  </td>
                </tr>
                {leaderboard.map((p) => {
                  const out = sumHoles(p.holes || {}, FRONT_NINE);
                  const inScore = sumHoles(p.holes || {}, BACK_NINE);
                  const team = TEAM_COLORS[p.teamColor] || TEAM_COLORS.white;
                  return (
                    <tr key={p.id} className="bg-white">
                      <td
                        className={`sticky left-0 font-bold px-4 py-3 border-b border-r-2 border-[#060f1e] whitespace-nowrap ${team.bg} ${team.text}`}
                      >
                        {p.name}
                        {p.id === myPlayerId && (
                          <div
                            className={`text-[11px] font-normal ${
                              team.text === "text-white" ? "text-orange-200" : "text-orange-600"
                            }`}
                          >
                            You
                          </div>
                        )}
                      </td>
                      {FRONT_NINE.map((hole) => (
                        <td
                          key={hole}
                          className={`text-center px-3 py-3 border-b border-r border-[#060f1e] text-xl font-bold text-blue-950 ${
                            hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                          }`}
                        >
                          {p.holes?.[hole] ?? "—"}
                        </td>
                      ))}
                      <td className="text-center px-4 py-3 border-b border-r-2 border-[#060f1e] bg-[#e5e5e5] text-lg font-bold text-blue-950">
                        {out ?? "—"}
                      </td>
                      {BACK_NINE.map((hole) => (
                        <td
                          key={hole}
                          className={`text-center px-3 py-3 border-b border-r border-[#060f1e] text-xl font-bold text-blue-950 ${
                            hole === currentHole ? "bg-[#e5e5e5]" : "bg-white"
                          }`}
                        >
                          {p.holes?.[hole] ?? "—"}
                        </td>
                      ))}
                      <td className="text-center px-4 py-3 border-b border-r-2 border-[#060f1e] bg-[#e5e5e5] text-lg font-bold text-blue-950">
                        {inScore ?? "—"}
                      </td>
                      <td className="text-center px-4 py-3 border-b border-[#060f1e] bg-[#e5e5e5] text-xl font-bold text-blue-950">
                        {totals[p.id] || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
