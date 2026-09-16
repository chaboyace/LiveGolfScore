"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
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

  function selectPlayer(playerId) {
    window.localStorage.setItem(storageKey, playerId);
    setMyPlayerId(playerId);
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

  const me = players.find((p) => p.id === myPlayerId);

  if (loading) {
    return (
      <main className="min-h-screen bg-green-50 flex items-center justify-center">
        <p className="text-green-700">Loading round...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-green-900">{roundName}</h1>
          <p className="text-sm text-green-700">Share this page's link with your group.</p>
        </div>

        {!me && (
          <section className="bg-white rounded-xl border border-green-200 p-5">
            <h2 className="font-semibold text-green-900 mb-3">Who are you?</h2>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPlayer(p.id)}
                  className="rounded-lg border border-green-300 py-2 px-3 text-left hover:bg-green-50 font-medium text-green-900"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {me && (
          <section className="bg-white rounded-xl border border-green-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-green-900">
                Your scorecard &mdash; {me.name}
              </h2>
              <button
                onClick={clearPlayer}
                className="text-xs text-green-600 hover:underline"
              >
                Not you?
              </button>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-green-900">Hole {currentHole}</h3>
              <p className="text-sm text-green-500 mb-4">Par {pars[currentHole] ?? 4}</p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
                  disabled={currentHole === 1}
                  aria-label="Previous hole"
                  className="w-11 h-11 rounded-full bg-gray-200 text-gray-700 text-xl font-bold flex items-center justify-center hover:bg-gray-300 disabled:opacity-30"
                >
                  ‹
                </button>

                <div className="flex items-stretch rounded-2xl border border-green-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(-1)}
                    aria-label="Decrease score"
                    className="px-5 text-2xl font-bold text-green-800 hover:bg-green-50"
                  >
                    −
                  </button>
                  <div className="px-6 py-2 flex flex-col items-center justify-center border-x border-green-200 min-w-[88px]">
                    <span className="text-xs text-green-500">Score</span>
                    <span className="text-3xl font-bold text-gray-900">
                      {me.holes?.[currentHole] ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustHoleScore(1)}
                    aria-label="Increase score"
                    className="px-5 text-2xl font-bold text-green-800 hover:bg-green-50"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentHole((h) => Math.min(18, h + 1))}
                  disabled={currentHole === 18}
                  aria-label="Next hole"
                  className="w-11 h-11 rounded-full bg-gray-200 text-gray-700 text-xl font-bold flex items-center justify-center hover:bg-gray-300 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm text-green-800 text-center">
              Total: <span className="font-semibold">{totals[me.id] || 0}</span>
              <span className="text-green-500 ml-1">(par {totalPar})</span>
            </p>
          </section>
        )}

        <section className="bg-white rounded-xl border border-green-200 p-5">
          <h2 className="font-semibold text-green-900 mb-3">Live leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse text-sm min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left text-green-900 px-3 py-2 border-b border-green-200">
                    Players
                  </th>
                  {HOLES.map((hole) => (
                    <th
                      key={hole}
                      className="text-center px-2 py-1 border-b border-green-200 bg-yellow-100/60"
                    >
                      <div className="text-[10px] text-yellow-800">Par {pars[hole] ?? 4}</div>
                      <div className="text-green-900 font-semibold">Hole {hole}</div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 border-b border-green-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p) => (
                  <tr
                    key={p.id}
                    className={p.id === myPlayerId ? "bg-green-100" : ""}
                  >
                    <td className="sticky left-0 bg-inherit text-green-900 font-medium px-3 py-2 border-b border-green-100 whitespace-nowrap">
                      {p.name}
                    </td>
                    {HOLES.map((hole) => (
                      <td
                        key={hole}
                        className="text-center px-2 py-2 border-b border-green-100 text-green-800"
                      >
                        {p.holes?.[hole] ?? ""}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 border-b border-green-100 font-semibold text-green-900">
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
