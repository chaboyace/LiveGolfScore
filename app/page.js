"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_PLAYER_COUNT = 4;
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

function generateOfficialCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function initialPars() {
  const pars = {};
  for (const hole of HOLES) pars[hole] = "4";
  return pars;
}

export default function Home() {
  const router = useRouter();
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState(Array(DEFAULT_PLAYER_COUNT).fill(""));
  const [pars, setPars] = useState(initialPars());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function updatePlayer(index, value) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerField() {
    setPlayers((prev) => [...prev, ""]);
  }

  function updatePar(hole, value) {
    setPars((prev) => ({ ...prev, [hole]: value }));
  }

  async function createRound(e) {
    e.preventDefault();
    setError("");

    const names = players.map((p) => p.trim()).filter(Boolean);
    if (names.length < 1) {
      setError("Add at least one player.");
      return;
    }

    const finalPars = {};
    for (const hole of HOLES) {
      const value = Number(pars[hole]);
      if (!Number.isInteger(value) || value < 3 || value > 6) {
        setError(`Enter a valid par (3-6) for hole ${hole} before sharing the round.`);
        return;
      }
      finalPars[hole] = value;
    }

    setCreating(true);
    try {
      const officialCode = generateOfficialCode();
      const roundRef = await addDoc(collection(db, "rounds"), {
        name: roundName.trim() || "Golf Round",
        createdAt: serverTimestamp(),
        holeCount: 18,
        officialCode,
        pars: finalPars,
      });

      await Promise.all(
        names.map((name, i) =>
          setDoc(doc(db, "rounds", roundRef.id, "scores", `player-${i}-${Date.now()}`), {
            name,
            holes: {},
          })
        )
      );

      router.push(`/round/${roundRef.id}?code=${officialCode}`);
    } catch (err) {
      console.error(err);
      setError("Could not create round. Check Firebase setup.");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-green-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-green-900 mb-1">LiveGolfScore</h1>
        <p className="text-green-700 mb-8">Create a round and share the link with your group.</p>

        <form onSubmit={createRound} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              Round name
            </label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="e.g. Saturday at QCC"
              className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              Players
            </label>
            <div className="space-y-2">
              {players.map((p, i) => (
                <input
                  key={i}
                  type="text"
                  value={p}
                  onChange={(e) => updatePlayer(i, e.target.value)}
                  placeholder={`Player ${i + 1} name`}
                  className="w-full rounded-lg border border-green-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addPlayerField}
              className="mt-2 text-sm text-green-700 font-medium hover:underline"
            >
              + Add another player
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              Course par (required before you can share the round)
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-2">
              {HOLES.map((hole) => (
                <div key={hole} className="text-center">
                  <div className="text-xs text-green-600 mb-1">{hole}</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={6}
                    value={pars[hole]}
                    onChange={(e) => updatePar(hole, e.target.value)}
                    className="w-full text-center rounded-md border border-green-300 bg-white py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg bg-green-700 text-white font-semibold py-2.5 hover:bg-green-800 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create round"}
          </button>
        </form>
      </div>
    </main>
  );
}
