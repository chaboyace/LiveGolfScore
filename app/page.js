"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEFAULT_PLAYER_COUNT = 4;
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

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

  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState([]);
  const [searchingCourse, setSearchingCourse] = useState(false);
  const [courseSearchError, setCourseSearchError] = useState("");
  const [loadingCourseId, setLoadingCourseId] = useState(null);
  const [appliedCourseName, setAppliedCourseName] = useState("");

  function updatePlayer(index, value) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerField() {
    setPlayers((prev) => [...prev, ""]);
  }

  function updatePar(hole, value) {
    setPars((prev) => ({ ...prev, [hole]: value }));
  }

  async function searchCourses(e) {
    e.preventDefault();
    setCourseSearchError("");
    setCourseResults([]);

    if (courseQuery.trim().length < 3) {
      setCourseSearchError("Type at least 3 characters.");
      return;
    }

    setSearchingCourse(true);
    try {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(courseQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setCourseResults(data.courses || []);
      if ((data.courses || []).length === 0) setCourseSearchError("No courses found.");
    } catch (err) {
      setCourseSearchError(err.message);
    } finally {
      setSearchingCourse(false);
    }
  }

  async function applyCourse(course) {
    setLoadingCourseId(course.id);
    setCourseSearchError("");
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load course.");
      const courseData = data.course || data;

      const teeSets = [...(courseData.tees?.male || []), ...(courseData.tees?.female || [])];
      const tee = teeSets.find((t) => t.holes?.length === 18) || teeSets[0];
      if (!tee || !tee.holes) {
        throw new Error("This course doesn't have hole-by-hole par data.");
      }

      const newPars = {};
      tee.holes.forEach((h, i) => {
        newPars[i + 1] = String(h.par);
      });
      for (const hole of HOLES) if (!newPars[hole]) newPars[hole] = "4";

      setPars(newPars);
      setAppliedCourseName(
        `${courseData.club_name}${
          courseData.course_name && courseData.course_name !== courseData.club_name
            ? ` — ${courseData.course_name}`
            : ""
        } (${tee.tee_name} tees)`
      );
      setCourseResults([]);
      setCourseQuery("");
      if (!roundName) setRoundName(courseData.club_name);
    } catch (err) {
      setCourseSearchError(err.message);
    } finally {
      setLoadingCourseId(null);
    }
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
      const roundRef = await addDoc(collection(db, "rounds"), {
        name: roundName.trim() || "Golf Round",
        createdAt: serverTimestamp(),
        holeCount: 18,
        pars: finalPars,
      });

      await Promise.all(
        names.map((name, i) =>
          setDoc(doc(db, "rounds", roundRef.id, "scores", `player-${i}-${Date.now()}`), {
            name,
            holes: {},
            code: null,
            teamColor: "white",
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
    <main className="min-h-screen bg-slate-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold text-blue-950 mb-1">LiveGolfScore</h1>
        <p className="text-slate-600 mb-8">Create a round and share the link with your group.</p>

        <form onSubmit={createRound} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">
              Round name
            </label>
            <input
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="e.g. Saturday at QCC"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addPlayerField}
              className="mt-2 text-sm text-orange-600 font-medium hover:underline"
            >
              + Add another player
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">
              Find your course (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Search by course or club name"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={searchCourses}
                disabled={searchingCourse}
                className="rounded-lg bg-blue-950 text-white text-sm font-medium px-4 hover:bg-blue-900 disabled:opacity-50"
              >
                {searchingCourse ? "Searching..." : "Search"}
              </button>
            </div>

            {courseSearchError && (
              <p className="text-red-600 text-sm mt-2">{courseSearchError}</p>
            )}

            {courseResults.length > 0 && (
              <ul className="mt-2 space-y-1 border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {courseResults.map((course) => (
                  <li key={course.id}>
                    <button
                      type="button"
                      onClick={() => applyCourse(course)}
                      disabled={loadingCourseId === course.id}
                      className="w-full text-left px-3 py-2 hover:bg-orange-50 disabled:opacity-50"
                    >
                      <div className="text-gray-900 font-medium">{course.club_name}</div>
                      {course.location?.city && (
                        <div className="text-xs text-slate-500">
                          {course.location.city}
                          {course.location.state ? `, ${course.location.state}` : ""}
                        </div>
                      )}
                      {loadingCourseId === course.id && (
                        <div className="text-xs text-orange-600">Loading pars...</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {appliedCourseName && (
              <p className="text-sm text-emerald-700 mt-2">
                Pars loaded from <span className="font-medium">{appliedCourseName}</span> &mdash; adjust below if needed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">
              Course par (required before you can share the round)
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-2">
              {HOLES.map((hole) => (
                <div key={hole} className="text-center">
                  <div className="text-xs text-slate-500 mb-1">{hole}</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={3}
                    max={6}
                    value={pars[hole]}
                    onChange={(e) => updatePar(hole, e.target.value)}
                    className="w-full text-center rounded-md border border-slate-300 bg-white py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg bg-orange-500 text-white font-semibold py-2.5 hover:bg-orange-600 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create round"}
          </button>
        </form>
      </div>
    </main>
  );
}
