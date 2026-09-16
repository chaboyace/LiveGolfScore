export default function Footer() {
  return (
    <footer className="bg-blue-950 px-4 py-6 text-sm text-blue-100">
      <div className="max-w-2xl mx-auto space-y-2">
        <p className="font-semibold text-orange-400">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Create a round and add everyone&apos;s name.</li>
          <li>Share the round link with your group &mdash; no login needed.</li>
          <li>Set the course par for each hole when you create the round (or search for your course to auto-fill it).</li>
          <li>Each player opens the link, taps their own name, and enters their own scores as they play.</li>
          <li>Everyone sees the live leaderboard update in real time.</li>
        </ol>
      </div>
    </footer>
  );
}
