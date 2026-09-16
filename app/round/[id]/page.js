"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, onSnapshot, updateDoc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

export default function RoundPage() {
  const { id } = useParams();

  const [roundName, setRoundName] = useState("");
  const [pars, setPars] = useState({});
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [claimError, setClaimError] = useState("");

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

  async function selectPlayer(playerId) {
    setClaimError("");
    const scoreRef = doc(db, "rounds", id, "scores", playerId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        if (snap.data()?.claimed) {
          throw new Error("already-claimed");
        }
        tx.update(scoreRef, { claimed: true });
      });
      window.localStorage.setItem(storageKey, playerId);
      setMyPlayerId(playerId);
    } catch (err) {
      setClaimError("That name was just taken — pick another.");
    }
  }

  async function clearPlayer() {
    if (myPlayerId) {
      updateDoc(doc(db, "rounds", id, "scores", myPlayerId), { claimed: false }).catch(() => {});
    }
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

  const me = players.find((p) => p.id === myPlayerId);

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
            {claimError && <p className="text-red-600 text-sm mb-3">{claimError}</p>}
            <div className="grid grid-cols-2 gap-2">
              {players.filter((p) => !p.claimed).map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p.id)}
                  className="rounded-lg border border-slate-300 py-2 px-3 text-left hover:bg-orange-50 font-medium text-blue-950"
                >
                  {p.name}
                </button>
              ))}
            </div>
            {players.every((p) => p.claimed) && (
              <p className="text-sm text-slate-500">
                Everyone has already claimed a name. If that's a mistake, ask them to tap &quot;Not you?&quot; to release it.
              </p>
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

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-blue-950 mb-3">Live leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left text-blue-950 px-3 py-2 border-b border-slate-200">
                    Players
                  </th>
                  {HOLES.map((hole) => (
                    <th
                      key={hole}
                      className="text-center px-2 py-1 border-b border-slate-200 bg-amber-100/60"
                    >
                      <div className="text-[10px] text-orange-700">Par {pars[hole] ?? 4}</div>
                      <div className="text-blue-950 font-semibold">Hole {hole}</div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 border-b border-slate-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p) => (
                  <tr
                    key={p.id}
                    className={p.id === myPlayerId ? "bg-blue-50" : ""}
                  >
                    <td className="sticky left-0 bg-inherit text-blue-950 font-medium px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {p.name}
                    </td>
                    {HOLES.map((hole) => (
                      <td
                        key={hole}
                        className="text-center px-2 py-2 border-b border-slate-100 text-slate-700"
                      >
                        {p.holes?.[hole] ?? ""}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 border-b border-slate-100 font-semibold text-blue-950">
                      {totals[p.id] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
