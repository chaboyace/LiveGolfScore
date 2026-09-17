"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { findLocalCourses } from "@/lib/localCourses";

const DEFAULT_PLAYER_COUNT = 4;
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

const TEE_DOT_COLORS = {
  black: "#111111",
  blue: "#2a4163",
  white: "#ffffff",
  gold: "#c9a227",
  yellow: "#e8c93a",
  green: "#3f6b3f",
  red: "#521515",
  silver: "#a8a8a8",
  tips: "#111111",
  championship: "#111111",
};

function teeDotColor(teeName) {
  const key = teeName.toLowerCase().split(/[\s/]/)[0];
  return TEE_DOT_COLORS[key] || "#8a97a8";
}

function initialPars() {
  const pars = {};
  for (const hole of HOLES) pars[hole] = "4";
  return pars;
}

function initialYardages() {
  const yardages = {};
  for (const hole of HOLES) yardages[hole] = "";
  return yardages;
}

export default function Home() {
  const router = useRouter();
  const [roundName, setRoundName] = useState("");
  const [players, setPlayers] = useState(Array(DEFAULT_PLAYER_COUNT).fill(""));
  const [pars, setPars] = useState(initialPars());
  const [organizerCode, setOrganizerCode] = useState("");
  const [trackYardage, setTrackYardage] = useState(false);
  const [yardages, setYardages] = useState(initialYardages());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState([]);
  const [searchingCourse, setSearchingCourse] = useState(false);
  const [courseSearchError, setCourseSearchError] = useState("");
  const [loadingCourseId, setLoadingCourseId] = useState(null);
  const [appliedCourseName, setAppliedCourseName] = useState("");
  const [teeChoices, setTeeChoices] = useState(null);
  const [pendingCourse, setPendingCourse] = useState(null);

  function updatePlayer(index, value) {
    setPlayers((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPlayerField() {
    setPlayers((prev) => [...prev, ""]);
  }

  function updatePar(hole, value) {
    setPars((prev) => ({ ...prev, [hole]: value }));
  }

  function updateYardage(hole, value) {
    setYardages((prev) => ({ ...prev, [hole]: value }));
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
    const localMatches = findLocalCourses(courseQuery);
    try {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(courseQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      const combined = [...localMatches, ...(data.courses || [])];
      setCourseResults(combined);
      if (combined.length === 0) setCourseSearchError("No courses found.");
    } catch (err) {
      if (localMatches.length > 0) {
        setCourseResults(localMatches);
        setCourseSearchError("Course search is unavailable right now — showing your saved courses.");
      } else {
        setCourseSearchError(err.message);
      }
    } finally {
      setSearchingCourse(false);
    }
  }

  async function loadCourseTees(course) {
    if (course.isLocal) {
      const options = course.tees.unisex;
      setPendingCourse(course);
      setTeeChoices(options);
      setCourseResults([]);
      return;
    }

    setLoadingCourseId(course.id);
    setCourseSearchError("");
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load course.");
      const courseData = data.course || data;

      const seen = new Map();
      for (const gender of ["male", "female"]) {
        for (const tee of courseData.tees?.[gender] || []) {
          if (tee.holes?.length !== 18) continue;
          const key = `${tee.tee_name}-${tee.total_yards}`;
          if (!seen.has(key)) seen.set(key, tee);
        }
      }
      const options = [...seen.values()].sort((a, b) => b.total_yards - a.total_yards);
      if (options.length === 0) {
        throw new Error("This course doesn't have hole-by-hole par data.");
      }

      setPendingCourse(courseData);
      setTeeChoices(options);
      setCourseResults([]);
    } catch (err) {
      setCourseSearchError(err.message);
    } finally {
      setLoadingCourseId(null);
    }
  }

  function chooseTee(tee) {
    const newPars = {};
    const newYardages = {};
    let hasYardage = false;
    tee.holes.forEach((h, i) => {
      newPars[i + 1] = String(h.par);
      if (h.yardage != null) {
        newYardages[i + 1] = String(h.yardage);
        hasYardage = true;
      }
    });
    for (const hole of HOLES) {
      if (!newPars[hole]) newPars[hole] = "4";
      if (!newYardages[hole]) newYardages[hole] = "";
    }

    setPars(newPars);
    if (hasYardage) {
      setYardages(newYardages);
      setTrackYardage(true);
    }
    setAppliedCourseName(
      `${pendingCourse.club_name}${
        pendingCourse.course_name && pendingCourse.course_name !== pendingCourse.club_name
          ? ` — ${pendingCourse.course_name}`
          : ""
      } (${tee.tee_name} tees)`
    );
    if (!roundName) setRoundName(pendingCourse.club_name);
    setTeeChoices(null);
    setPendingCourse(null);
    setCourseQuery("");
  }

  async function createRound(e) {
    e.preventDefault();
    setError("");

    const names = players.map((p) => p.trim()).filter(Boolean);
    if (names.length < 1) {
      setError("Add at least one player.");
      return;
    }

    if (!/^\d{4}$/.test(organizerCode.trim())) {
      setError("Set a 4-digit organizer code before creating the round.");
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

    let finalYardages = null;
    if (trackYardage) {
      finalYardages = {};
      for (const hole of HOLES) {
        const value = Number(yardages[hole]);
        if (!Number.isInteger(value) || value < 50 || value > 700) {
          setError(`Enter a valid yardage (50-700) for hole ${hole}, or turn off yardage tracking.`);
          return;
        }
        finalYardages[hole] = value;
      }
    }

    setCreating(true);
    try {
      const roundRef = await addDoc(collection(db, "rounds"), {
        name: roundName.trim() || "Golf Round",
        createdAt: serverTimestamp(),
        holeCount: 18,
        pars: finalPars,
        organizerCode: organizerCode.trim(),
        ...(finalYardages ? { yardages: finalYardages } : {}),
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
    <main className="min-h-screen bg-[#faf9f3]">
      <div className="relative">
        <div
          className="absolute inset-x-0 top-0 h-[280px] sm:hidden bg-cover bg-top bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent 35%, #faf9f3 92%), url('/golf-landscape.png')",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[700px] hidden sm:block bg-cover bg-top bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent 74%, #faf9f3 100%), url('/golf-landscape.png')",
          }}
        />

        <header className="relative max-w-5xl mx-auto px-6 sm:px-10 pt-7 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold text-[#111d49] tracking-tight">
            <svg viewBox="0 0 48 48" className="w-9 h-9 sm:w-11 sm:h-11" aria-hidden="true">
              <ellipse cx="23" cy="40" rx="21" ry="6" fill="#659347" />
              <path d="M23 6v34" stroke="#152342" strokeWidth="3" />
              <path d="M25 7c9-2 10 7 21 4l-5 13c-8 2-10-6-16-4z" fill="#ff6b00" />
            </svg>
            LiveGolfScore
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-[#111d49]">
            Made for your foursome.
            <span className="w-1.5 h-1.5 rounded-full bg-[#56876b]" />
          </div>
        </header>

        <section className="relative max-w-4xl mx-auto px-6 sm:px-10 pt-3 sm:pt-4 pb-24 sm:pb-40">
          <div className="relative z-10 max-w-md">
            <p className="text-[10px] sm:text-[11px] font-bold tracking-[3px] uppercase text-[#215d43] mb-3 sm:mb-4">
              Less admin. More golf.
            </p>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05] sm:leading-[0.98] tracking-tight text-[#111d49] mb-4 sm:mb-5">
              Your round.
              <br />
              Your crew.
              <br />
              Every shot, <span className="text-[#fb6500]">live.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#293f5b] mb-5 sm:mb-6">
              Create a round, share the link,
              <br className="hidden sm:block" /> and keep score together.
            </p>
            <ul className="flex gap-7">
              <li className="flex flex-col items-center gap-2 text-xs font-semibold text-[#111d49]">
                <span className="w-12 h-12 rounded-full bg-[#e0ecb7] flex items-center justify-center text-[#164a3e] text-xl">
                  ↗
                </span>
                One shared link
              </li>
              <li className="flex flex-col items-center gap-2 text-xs font-semibold text-[#111d49]">
                <span className="w-12 h-12 rounded-full bg-[#e0ecb7] flex items-end justify-center gap-[3px] py-3 text-[#164a3e]">
                  <i className="w-1 bg-[#164a3e] rounded-sm" style={{ height: 10 }} />
                  <i className="w-1 bg-[#164a3e] rounded-sm" style={{ height: 14 }} />
                  <i className="w-1 bg-[#164a3e] rounded-sm" style={{ height: 19 }} />
                  <i className="w-1 bg-[#164a3e] rounded-sm" style={{ height: 24 }} />
                </span>
                Live scoring
              </li>
              <li className="flex flex-col items-center gap-2 text-xs font-semibold text-[#111d49]">
                <span className="w-12 h-12 rounded-full bg-[#e0ecb7] flex items-center justify-center text-[#164a3e] text-xl">
                  ⚑
                </span>
                All 18 holes
              </li>
            </ul>
          </div>

          <aside className="hidden md:block absolute right-0 top-2 w-72 bg-white/95 border border-[#e5ebee] rounded-2xl p-5 shadow-xl -rotate-2">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide border-b border-[#ecf0f3] pb-3 text-[#111d49]">
              <span>Live leaderboard</span>
              <span className="font-normal normal-case text-[#536681] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#59ac80] inline-block" />
                Demo &middot; Thru 9
              </span>
            </div>
            <ol className="mt-2 space-y-1 text-sm text-[#111d49]">
              {[
                { rank: 1, name: "Alex R.", score: "−2", color: "#fb6500" },
                { rank: 2, name: "Taylor M.", score: "E", color: "#111d49" },
                { rank: 3, name: "Jordan K.", score: "+3", color: "#111d49" },
              ].map((row) => (
                <li
                  key={row.rank}
                  className="grid grid-cols-[28px_1fr_10px_28px] items-center gap-2 py-1.5"
                >
                  <span className="bg-[#f3f6fa] rounded text-center py-1">{row.rank}</span>
                  <span>{row.name}</span>
                  <span className="w-2 h-2 rounded-full bg-[#61ad87]" />
                  <strong className="text-right" style={{ color: row.color }}>
                    {row.score}
                  </strong>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 -mt-14 sm:-mt-28 pb-14">
        <div className="bg-white border border-[#e1e8ec] rounded-[22px] shadow-2xl px-6 sm:px-11 pt-9 pb-8">
          <p className="text-[10px] font-bold tracking-[1.7px] uppercase text-[#215d43] mb-2">
            Less admin. More golf.
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111d49] mb-1">
            Let&apos;s tee it up.
          </h2>
          <p className="text-[#536681] mb-7">
            Create a round and share the link with your group.
          </p>

          <form onSubmit={createRound} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[#111d49] mb-1.5">
                Round name
              </label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="e.g. Saturday at QCC"
                className="w-full rounded-lg border border-[#ccd7e3] bg-white px-3 h-11 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#111d49] mb-1.5">
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
                    className="w-full rounded-lg border border-[#ccd7e3] bg-white px-3 h-11 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={addPlayerField}
                className="mt-2 text-sm text-[#bc4d00] font-medium hover:underline"
              >
                + Add another player
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#111d49] mb-1.5">
                Organizer code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={organizerCode}
                onChange={(e) => setOrganizerCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                className="w-28 rounded-lg border border-[#ccd7e3] bg-white px-3 h-11 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
              />
              <p className="text-xs text-[#536681] mt-1.5">
                Pick a 4-digit code for yourself as the organizer. You&apos;ll use it on the round page to reset a player&apos;s code or team color if they lose it.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#111d49] mb-1.5">
                Find your course <span className="font-normal text-[#536681]">(optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="Search by course or club name"
                  className="flex-1 rounded-lg border border-[#ccd7e3] bg-white px-3 h-11 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
                />
                <button
                  type="button"
                  onClick={searchCourses}
                  disabled={searchingCourse}
                  className="rounded-lg bg-[#111d49] text-white text-sm font-medium px-4 h-11 hover:bg-[#1a2a5e] disabled:opacity-50"
                >
                  {searchingCourse ? "Searching..." : "Search"}
                </button>
              </div>

              {courseSearchError && (
                <p className="text-red-600 text-sm mt-2">{courseSearchError}</p>
              )}

              {courseResults.length > 0 && (
                <ul className="mt-2 space-y-1 border border-[#e1e8ec] rounded-lg divide-y divide-[#eef2f5] overflow-hidden">
                  {courseResults.map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        onClick={() => loadCourseTees(course)}
                        disabled={loadingCourseId === course.id}
                        className="w-full text-left px-3 py-2 hover:bg-orange-50 disabled:opacity-50"
                      >
                        <div className="text-[#111d49] font-medium flex items-center gap-2">
                          {course.club_name}
                          {course.isLocal && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#215d43] bg-[#e0ecb7] rounded-full px-2 py-0.5">
                              Saved
                            </span>
                          )}
                        </div>
                        {course.location?.city && (
                          <div className="text-xs text-[#536681]">
                            {course.location.city}
                            {course.location.state ? `, ${course.location.state}` : ""}
                          </div>
                        )}
                        {loadingCourseId === course.id && (
                          <div className="text-xs text-[#bc4d00]">Loading tees...</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {teeChoices && pendingCourse && (
                <div className="mt-2 border border-[#e1e8ec] rounded-lg p-3">
                  <p className="text-sm font-medium text-[#111d49] mb-2">
                    Which tees will you play from at {pendingCourse.club_name}?
                  </p>
                  <ul className="space-y-1">
                    {teeChoices.map((tee) => (
                      <li key={`${tee.tee_name}-${tee.total_yards}`}>
                        <button
                          type="button"
                          onClick={() => chooseTee(tee)}
                          className="w-full flex items-center justify-between gap-2 rounded-md border border-[#e1e8ec] px-3 py-2 hover:bg-orange-50 text-left"
                        >
                          <span className="flex items-center gap-2 text-[#111d49] font-medium">
                            <span
                              className="w-3 h-3 rounded-full border border-[#ccd7e3] inline-block"
                              style={{ backgroundColor: teeDotColor(tee.tee_name) }}
                            />
                            {tee.tee_name}
                          </span>
                          <span className="text-xs text-[#536681]">
                            {tee.total_yards.toLocaleString()} yds &middot; par {tee.par_total}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setTeeChoices(null);
                      setPendingCourse(null);
                    }}
                    className="mt-2 text-xs text-[#536681] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {appliedCourseName && (
                <p className="text-sm text-[#215d43] mt-2">
                  Pars loaded from <span className="font-medium">{appliedCourseName}</span> &mdash; adjust below if needed.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#111d49] mb-1.5">
                Course par <span className="font-normal text-[#536681]">(required before you can share the round)</span>
              </label>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-2">
                {HOLES.map((hole) => (
                  <div key={hole} className="text-center">
                    <div className="text-xs text-[#536681] mb-1">{hole}</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={6}
                      value={pars[hole]}
                      onChange={(e) => updatePar(hole, e.target.value)}
                      className="w-full text-center rounded-md border border-[#ccd7e3] bg-white h-10 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#111d49]">
                  Track yardage <span className="font-normal text-[#536681]">(optional)</span>
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackYardage}
                  onClick={() => setTrackYardage((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    trackYardage ? "bg-[#fb6500]" : "bg-[#ccd7e3]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      trackYardage ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {trackYardage && (
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 mt-3">
                  {HOLES.map((hole) => (
                    <div key={hole} className="text-center">
                      <div className="text-xs text-[#536681] mb-1">{hole}</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={50}
                        max={700}
                        placeholder="yds"
                        value={yardages[hole]}
                        onChange={(e) => updateYardage(hole, e.target.value)}
                        className="w-full text-center rounded-md border border-[#ccd7e3] bg-white h-10 text-[#111d49] focus:outline-none focus:ring-2 focus:ring-[#fb6500]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={creating}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-[#fb6500] text-white font-bold h-[52px] hover:bg-[#e75a00] disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create round"}
              {!creating && <span className="text-xl">→</span>}
            </button>
          </form>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-4 pb-10 px-6">
        <span className="w-10 h-px bg-[#b4bbb8]" />
        <p className="italic text-[15px] text-[#526077]" style={{ fontFamily: "Georgia, serif" }}>
          Good company. Great rounds.
        </p>
        <span className="w-10 h-px bg-[#b4bbb8]" />
      </footer>
    </main>
  );
}
