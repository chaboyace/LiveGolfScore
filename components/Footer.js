export default function Footer() {
  return (
    <footer className="bg-blue-950 px-4 py-6 text-sm text-blue-100">
      <div className="max-w-2xl mx-auto space-y-2">
        <p className="font-semibold text-orange-400">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Create a round and add everyone&apos;s name.</li>
          <li>Share the round link with your group &mdash; no login needed.</li>
          <li>Set the course par for each hole when you create the round (or search for your course to auto-fill it).</li>
          <li>Each player opens the link, taps their own name, sets a 4-digit code to protect it, and enters their own scores as they play.</li>
          <li>Everyone sees the live scorecard update in real time, with running totals for the front nine, back nine, and full round.</li>
          <li>
            Picking red or blue as your team color puts you in a team match: each hole, the two
            teams&apos; strokes are added up and the lower total wins that hole, tracked in the
            match scoreboard above the scorecard.
          </li>
        </ol>
      </div>
    </footer>
  );
}
