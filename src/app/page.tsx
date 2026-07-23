const foundation = [
  'Next.js and TypeScript',
  'Tailwind CSS',
  'Local Node.js runtime',
  'Feature-oriented structure',
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.10),transparent_30%)]" />

      <section className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-950/75 p-8 shadow-2xl shadow-black/30 backdrop-blur sm:p-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 font-mono text-sm font-semibold text-emerald-300">
              &gt;_
            </span>
            <span className="font-mono text-sm tracking-[0.22em] text-slate-300 uppercase">
              CommandDeck
            </span>
          </div>

          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-xs text-emerald-200">
            Foundation ready
          </span>
        </div>

        <div className="max-w-3xl">
          <p className="mb-4 font-mono text-sm text-emerald-300">$ build the workspace</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-white sm:text-6xl">
            Your commands deserve more than scrollback.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            CommandDeck is a local-first visual terminal workspace where executed commands become
            searchable, reusable objects. The project foundation is configured; terminal
            development begins in the next phase.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {foundation.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-slate-300"
            >
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/8 pt-6 font-mono text-xs text-slate-500">
          Phase 0 · Technical validation is next
        </div>
      </section>
    </main>
  );
}
