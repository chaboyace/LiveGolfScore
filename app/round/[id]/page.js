"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

export default function RoundPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-green-50 flex items-center justify-center">
          <p className="text-green-700">Loading round...</p>
        </main>
      }
    >
      <RoundPage />
    </Suspense>
  );
}

function RoundPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const newCode = searchParams.get("code");

  const [roundName, setRoundName] = useState("");
  const [officialCode, setOfficialCode] = useState(null);
  const [pars, setPars] = useState({});
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [parDraft, setParDraft] = useState({});
  const [savingPars, setSavingPars] = useState(false);

  const storageKey = `livegolfscore:${id}:playerId`;

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setMyPlayerId(saved);
  }, [storageKey]);

  useEffect(() => {
    getDoc(doc(db, "rounds", id)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoundName(data.name);
        setOfficialCode(data.officialCode || null);
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

  function openCodeEntry() {
    setShowCodeEntry(true);
    setCodeError("");
    setCodeInput("");
  }

  function submitCode(e) {
    e.preventDefault();
    if (codeInput.trim() === officialCode) {
      setParDraft(pars);
      setUnlocked(true);
      setShowCodeEntry(false);
    } else {
      setCodeError("Wrong code.");
    }
  }

  function updateParDraft(hole, value) {
    const par = Math.max(3, Math.min(6, Number(value) || 4));
    setParDraft((prev) => ({ ...prev, [hole]: par }));
  }

  async function savePars() {
    setSavingPars(true);
    await updateDoc(doc(db, "rounds", id), { pars: parDraft });
    setPars(parDraft);
    setSavingPars(false);
    setUnlocked(false);
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

        {newCode && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-sm text-yellow-900">
            Rules official code: <span className="font-bold text-lg tracking-wider">{newCode}</span>
            <br />
            Save this &mdash; whoever holds it can change the par for each hole.
          </div>
        )}

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
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
              {HOLES.map((hole) => (
                <div key={hole} className="text-center">
                  <div className="text-xs text-green-600">{hole}</div>
                  <div className="text-[10px] text-green-400 mb-1">par {pars[hole] ?? 4}</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={15}
                    value={me.holes?.[hole] ?? ""}
                    onChange={(e) => setHoleScore(me.id, hole, e.target.value)}
                    className="w-full text-center rounded-md border border-green-300 bg-white py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-green-800">
              Total: <span className="font-semibold">{totals[me.id] || 0}</span>
              <span className="text-green-500 ml-1">(par {totalPar})</span>
            </p>
          </section>
        )}

        <section className="bg-white rounded-xl border border-green-200 p-5">
          <h2 className="font-semibold text-green-900 mb-3">Live leaderboard</h2>
          <ol className="space-y-1">
            {leaderboard.map((p, i) => {
              const holesPlayed = Object.keys(p.holes || {}).length;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${
                    p.id === myPlayerId ? "bg-green-100" : ""
                  }`}
                >
                  <span className="text-green-900">
                    <span className="text-green-500 mr-2">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="text-green-800 text-sm">
                    {totals[p.id] || 0}
                    <span className="text-green-500 ml-1">({holesPlayed}/18)</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="bg-white rounded-xl border border-green-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-green-900">Hole pars</h2>
            {!unlocked && (
              <button
                onClick={openCodeEntry}
                className="text-xs text-green-600 hover:underline"
              >
                Rules official: edit pars
              </button>
            )}
          </div>

          {showCodeEntry && !unlocked && (
            <form onSubmit={submitCode} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="4-digit code"
                className="rounded-md border border-green-300 bg-white px-3 py-1.5 w-32 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-md bg-green-700 text-white text-sm font-medium px-3 py-1.5 hover:bg-green-800"
              >
                Unlock
              </button>
              {codeError && <span className="text-red-600 text-xs">{codeError}</span>}
            </form>
          )}

          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-3">
            {HOLES.map((hole) => (
              <div key={hole} className="text-center">
                <div className="text-xs text-green-600 mb-1">{hole}</div>
                {unlocked ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={6}
                    value={parDraft[hole] ?? 4}
                    onChange={(e) => updateParDraft(hole, e.target.value)}
                    className="w-full text-center rounded-md border border-green-300 bg-white py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                ) : (
                  <div className="rounded-md border border-green-100 bg-green-50 py-1.5 text-green-800">
                    {pars[hole] ?? 4}
                  </div>
                )}
              </div>
            ))}
          </div>

          {unlocked && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={savePars}
                disabled={savingPars}
                className="rounded-md bg-green-700 text-white text-sm font-medium px-4 py-2 hover:bg-green-800 disabled:opacity-50"
              >
                {savingPars ? "Saving..." : "Save pars"}
              </button>
              <button
                onClick={() => setUnlocked(false)}
                className="text-sm text-green-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
