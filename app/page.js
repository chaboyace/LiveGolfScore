"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_PLAYER_COUNT = 4;

export default function Home() {
  const router = useRouter();
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState(Array(DEFAULT_PLAYER_COUNT).fill(""));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function updatePlayer(index, value) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerField() {
    setPlayers((prev) => [...prev, ""]);
  }

  async function createRound(e) {
    e.preventDefault();
    setError("");

    const names = players.map((p) => p.trim()).filter(Boolean);
    if (names.length < 1) {
      setError("Add at least one player.");
      return;
    }

    setCreating(true);
    try {
      const roundRef = await addDoc(collection(db, "rounds"), {
        name: roundName.trim() || "Golf Round",
        createdAt: serverTimestamp(),
        holeCount: 18,
      });

      await Promise.all(
        names.map((name, i) =>
          setDoc(doc(db, "rounds", roundRef.id, "scores", `player-${i}-${Date.now()}`), {
            name,
            holes: {},
          })
        )
      );

      router.push(`/round/${roundRef.id}`);
    } catch (err) {
      console.error(err);
      setError("Could not create round. Check Firebase setup.");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-green-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-green-900 mb-1">LiveGolfScore</h1>
        <p className="text-green-700 mb-8">Create a round and share the link with your group.</p>

        <form onSubmit={createRound} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-900 mb-1">
              Round name
            </label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="e.g. Saturday at QCC"
              className="w-full rounded-lg border border-green-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full rounded-lg border border-green-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
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
