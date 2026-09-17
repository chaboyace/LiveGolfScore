"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
const FRONT_NINE = HOLES.slice(0, 9);
const BACK_NINE = HOLES.slice(9);

const TEAM_DOT = {
  white: "border border-slate-400 bg-white",
  red: "bg-[#521515]",
  blue: "bg-[#2a4163]",
};

const TEAM_SWATCH = {
  white: "bg-white border border-slate-400",
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

export default function RoundPage() {
  const { id } = useParams();

  const [roundName, setRoundName] = useState("");
  const [pars, setPars] = useState({});
  const [yardages, setYardages] = useState({});
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [nine, setNine] = useState(0);
  const [codeModalPlayer, setCodeModalPlayer] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeModalError, setCodeModalError] = useState("");
  const [selectedColor, setSelectedColor] = useState("white");
  const [shareStatus, setShareStatus] = useState("");

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
        setYardages(data.yardages || {});
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

  function goToHole(hole) {
    setCurrentHole(hole);
    setNine(hole > 9 ? 1 : 0);
  }

  async function copyRoundLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Round link copied — send it to your group.");
    } catch {
      setShareStatus("Could not copy automatically — copy the address bar instead.");
    }
    setTimeout(() => setShareStatus(""), 4000);
  }

  const totalPar = useMemo(
    () => HOLES.reduce((sum, hole) => sum + (pars[hole] ?? 4), 0),
    [pars]
  );

  const hasYardages = Object.keys(yardages).length > 0;
  const totalYardage = useMemo(
    () => HOLES.reduce((sum, hole) => sum + (yardages[hole] ?? 0), 0),
    [yardages]
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
  const visibleHoles = nine === 0 ? FRONT_NINE : BACK_NINE;

  function HoleWinnerDot({ hole }) {
    if (!hasMatch) return null;
    const winner = holeWinners[hole];
    const dotColor =
      winner === "red" ? "bg-[#521515]" : winner === "blue" ? "bg-[#2a4163]" : winner === "tie" ? "bg-slate-400" : "bg-transparent";
    return <div className={`mx-auto mt-1 w-2 h-2 rounded-full ${dotColor}`} />;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf8f1] flex items-center justify-center">
        <p className="text-[#647895]">Loading round...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f1]">
      <div className="relative min-h-[260px] sm:min-h-[475px]">
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

        <header className="relative max-w-4xl mx-auto px-6 sm:px-10 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-[#071d49] tracking-tight">
            <svg viewBox="0 0 48 48" className="w-8 h-8 sm:w-10 sm:h-10" aria-hidden="true">
              <ellipse cx="23" cy="40" rx="21" ry="6" fill="#659347" />
              <path d="M23 6v34" stroke="#152342" strokeWidth="3" />
              <path d="M25 7c9-2 10 7 21 4l-5 13c-8 2-10-6-16-4z" fill="#ff6b00" />
            </svg>
            LiveGolfScore
          </div>
          <span className="flex items-center gap-2 rounded-full border border-[#afcfb8] bg-[#dcebdc] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#0e6137]">
            <i className="w-2.5 h-2.5 rounded-full bg-[#118545] inline-block" />
            Round in progress
          </span>
        </header>

        <section className="relative max-w-4xl mx-auto px-6 sm:px-10 pt-2 pb-12 sm:pb-20">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#e44e00] mb-1">
            Good company. Great rounds.
          </p>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#071d49] mb-1">
            {roundName}
          </h1>
          <p className="font-serif text-lg sm:text-xl font-bold text-[#071d49] mb-5">
            Every shot. All together.
          </p>
          <button
            onClick={copyRoundLink}
            className="inline-flex items-center gap-2 rounded-full bg-[#fc5b08] text-white font-semibold px-5 py-2.5 hover:bg-[#df4c00] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
            </svg>
            Copy round link
          </button>
          {shareStatus && (
            <p className="text-xs text-[#647895] mt-2 max-w-xs">{shareStatus}</p>
          )}
          <div>
            <Link
              href={`/round/${id}/watch`}
              className="inline-block mt-3 text-sm text-[#071d49] underline decoration-[#647895] hover:decoration-[#071d49]"
            >
              Just watching? See the spectator view &rarr;
            </Link>
          </div>
        </section>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-14 space-y-6">
        {!me && (
          <section className="bg-white rounded-2xl border border-[#dce1e5] p-5 shadow-sm">
            <h2 className="font-semibold text-[#071d49] mb-3">Who are you?</h2>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openCodeModal(p)}
                  className="rounded-lg border border-[#dce1e5] py-2 px-3 text-left hover:bg-orange-50 font-medium text-[#071d49]"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {codeModalPlayer && (
              <form onSubmit={submitCode} className="mt-4 pt-4 border-t border-[#dce1e5]">
                <p className="text-sm font-medium text-[#071d49] mb-2">
                  {codeModalPlayer.code
                    ? `Enter ${codeModalPlayer.name}'s 4-digit code`
                    : `Set a 4-digit code for ${codeModalPlayer.name}`}
                </p>
                {!codeModalPlayer.code && (
                  <div className="mb-3">
                    <p className="text-xs text-[#647895] mb-1">Pick a team color</p>
                    <div className="flex gap-2">
                      {Object.entries(TEAM_SWATCH).map(([key, swatch]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedColor(key)}
                          aria-label={key}
                          className={`w-8 h-8 rounded-full ${swatch} ${
                            selectedColor === key ? "ring-2 ring-offset-2 ring-[#fc5b08]" : ""
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
                    className="rounded-md border border-[#dce1e5] bg-white px-3 py-1.5 w-24 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#fc5b08]"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#fc5b08] text-white text-sm font-medium px-4 py-1.5 hover:bg-[#df4c00]"
                  >
                    {codeModalPlayer.code ? "Enter" : "Set code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeModalPlayer(null)}
                    className="text-sm text-[#647895] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
                {codeModalError && <p className="text-red-600 text-sm mt-2">{codeModalError}</p>}
                {!codeModalPlayer.code && (
                  <p className="text-xs text-[#647895] mt-2">
                    Remember this code &mdash; you'll need it to get back into your scorecard later.
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        {me && (
          <section className="relative overflow-hidden bg-white rounded-2xl border border-[#dce1e5] p-5 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#071d49]">
                Your scorecard &mdash; {me.name}
              </h2>
              <button
                onClick={clearPlayer}
                className="text-xs text-[#eb570c] hover:underline"
              >
                Not you?
              </button>
            </div>
            <div className="text-center relative z-10">
              <h3 className="font-serif text-3xl font-bold text-[#071d49] mb-2">Hole {currentHole}</h3>
              <span className="inline-block bg-[#fff0df] text-[#ea600d] rounded-full text-sm px-4 py-1 mb-4">
                Par {pars[currentHole] ?? 4}
                {hasYardages && yardages[currentHole] && ` · ${yardages[currentHole]} yds`}
              </span>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => goToHole(Math.max(1, currentHole - 1))}
                  disabled={currentHole === 1}
                  aria-label="Previous hole"
                  className="w-11 h-11 rounded-full bg-[#eef1f4] text-[#071d49] text-xl font-bold flex items-center justify-center hover:bg-[#e3e8ec] disabled:opacity-30"
                >
                  ‹
                </button>

                <div className="flex items-stretch rounded-2xl border border-[#fc5b08] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(-1)}
                    aria-label="Decrease score"
                    className="px-5 text-2xl font-bold text-[#fc5b08] hover:bg-orange-50"
                  >
                    −
                  </button>
                  <div className="px-6 py-2 flex flex-col items-center justify-center border-x border-orange-200 min-w-[88px]">
                    <span className="text-xs text-[#fc5b08]">Score</span>
                    <span className="text-3xl font-bold text-[#071d49]">
                      {me.holes?.[currentHole] ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(1)}
                    aria-label="Increase score"
                    className="px-5 text-2xl font-bold text-[#fc5b08] hover:bg-orange-50"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => goToHole(Math.min(18, currentHole + 1))}
                  disabled={currentHole === 18}
                  aria-label="Next hole"
                  className="w-11 h-11 rounded-full bg-[#eef1f4] text-[#071d49] text-xl font-bold flex items-center justify-center hover:bg-[#e3e8ec] disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-[#071d49] text-center relative z-10">
              Total: <span className="font-semibold">{totals[me.id] || 0}</span>
              <span className="text-[#647895] mx-2">|</span>
              <span className="text-[#647895]">Course par {totalPar}</span>
            </p>

            <div className="flex items-center gap-3 mt-5 text-xs text-[#647895] relative z-10">
              <span className="whitespace-nowrap">{currentHole} of 18 holes</span>
              <progress
                value={currentHole}
                max={18}
                className="w-full h-2 [&::-webkit-progress-bar]:bg-[#eef1f4] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-[#fc5b08] [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-[#fc5b08] rounded-full"
              />
              <span className="whitespace-nowrap">{Math.round((currentHole / 18) * 100)}%</span>
            </div>

            <img
              src="/golf-ball-tee.png"
              alt=""
              aria-hidden="true"
              className="hidden lg:block absolute -right-16 bottom-6 w-24 h-auto opacity-90 pointer-events-none"
            />
          </section>
        )}

        {hasMatch && (
          <section className="bg-white rounded-2xl border border-[#dce1e5] shadow-sm px-5 py-4 flex flex-wrap items-center justify-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#071d49]">
              <span aria-hidden="true">⚑⚑</span>
              Team match
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-[#521515] text-white text-sm font-bold px-4 py-1.5">
                <span aria-hidden="true">⚑</span> RED {matchTally.red}
              </span>
              {matchTally.tie > 0 && (
                <span className="text-xs text-[#647895]">{matchTally.tie} halved</span>
              )}
              <span className="flex items-center gap-1.5 rounded-full bg-[#2a4163] text-white text-sm font-bold px-4 py-1.5">
                <span aria-hidden="true">⚑</span> BLUE {matchTally.blue}
              </span>
            </div>
            <span className="hidden sm:inline font-serif italic text-[#647895]">Better Together</span>
          </section>
        )}

        <section className="bg-white rounded-2xl overflow-hidden border border-[#dce1e5] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-serif text-lg font-bold text-[#071d49]">The scorecard</h2>
            <button
              onClick={() => setNine((n) => 1 - n)}
              aria-label={`Switch to ${nine === 0 ? "back" : "front"} nine`}
              className="rounded-full border border-[#dce1e5] text-sm font-semibold text-[#071d49] px-4 py-1.5 hover:bg-orange-50"
            >
              {nine === 0 ? "Front nine" : "Back nine"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm min-w-max w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left text-[#071d49] px-4 py-2 border-b-2 border-r-2 border-[#dce1e5] text-sm font-bold">
                    Player
                  </th>
                  {visibleHoles.map((hole) => (
                    <th
                      key={hole}
                      className={`text-center border-b-2 border-r border-[#dce1e5] text-sm font-bold text-[#071d49] ${
                        hole === currentHole ? "bg-[#fff0df]" : "bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentHole(hole)}
                        className="w-full h-full px-3 py-2 hover:bg-orange-50"
                      >
                        {hole}
                        <HoleWinnerDot hole={hole} />
                      </button>
                    </th>
                  ))}
                  <th className="text-center px-4 py-2 border-b-2 border-[#dce1e5] text-sm font-bold text-[#071d49] bg-[#f3f6fa]">
                    {nine === 0 ? "OUT" : "IN"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasYardages && (
                  <tr>
                    <td className="sticky left-0 bg-white text-[#647895] px-4 py-1.5 border-b border-r-2 border-[#dce1e5] text-xs font-semibold">
                      Yards
                    </td>
                    {visibleHoles.map((hole) => (
                      <td
                        key={hole}
                        className="text-center px-3 py-1.5 border-b border-r border-[#dce1e5] text-xs text-[#647895]"
                      >
                        {yardages[hole] ?? ""}
                      </td>
                    ))}
                    <td className="text-center px-4 py-1.5 border-b border-[#dce1e5] bg-[#f3f6fa] text-xs text-[#647895] font-semibold">
                      {sumHoles(yardages, visibleHoles)}
                    </td>
                  </tr>
                )}
                <tr className="par-row">
                  <td className="sticky left-0 bg-white text-[#071d49] px-4 py-2 border-b-2 border-r-2 border-[#dce1e5] font-semibold">
                    Par
                  </td>
                  {visibleHoles.map((hole) => (
                    <td
                      key={hole}
                      className={`text-center px-3 py-2 border-b-2 border-r border-[#dce1e5] text-[#071d49] ${
                        hole === currentHole ? "bg-[#fff0df]" : "bg-white"
                      }`}
                    >
                      {pars[hole] ?? 4}
                    </td>
                  ))}
                  <td className="text-center px-4 py-2 border-b-2 border-[#dce1e5] bg-[#f3f6fa] text-[#071d49] font-semibold">
                    {sumHoles(pars, visibleHoles)}
                  </td>
                </tr>
                {leaderboard.map((p) => {
                  const halfTotal = sumHoles(p.holes || {}, visibleHoles);
                  const dot = TEAM_DOT[p.teamColor] || TEAM_DOT.white;
                  return (
                    <tr key={p.id}>
                      <td className="sticky left-0 bg-white text-[#071d49] font-bold px-4 py-3 border-b border-r-2 border-[#dce1e5] whitespace-nowrap">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${dot}`} />
                        {p.name}
                        {p.id === myPlayerId && (
                          <small className="ml-1.5 text-[10px] font-normal text-[#eb570c]">You</small>
                        )}
                      </td>
                      {visibleHoles.map((hole) => (
                        <td
                          key={hole}
                          className={`text-center px-3 py-3 border-b border-r border-[#dce1e5] text-xl font-bold text-[#071d49] ${
                            hole === currentHole ? "bg-[#fff0df]" : "bg-white"
                          }`}
                        >
                          {p.holes?.[hole] ?? "—"}
                        </td>
                      ))}
                      <td className="text-center px-4 py-3 border-b border-[#dce1e5] bg-[#f3f6fa] text-lg font-bold text-[#071d49]">
                        {halfTotal ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="relative mt-4">
        <div
          className="h-[220px] bg-cover bg-center bg-no-repeat flex items-center justify-center text-center px-6"
          style={{ backgroundImage: "url('/round-footer.png')" }}
        >
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#071d49]">
              A little friendly competition.
            </h2>
            <div className="w-16 h-0.5 bg-[#fc5b08] mx-auto my-2" />
            <p className="text-xs uppercase tracking-wide text-[#647895]">
              People &bull; Birdies &bull; Better days
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
