import Image from "next/image";

export function Hero() {
  return (
    <section
      id="discover"
      className="relative min-h-[100dvh] flex items-center pt-[72px]"
    >
      {/* Subtle radial glow behind card stack */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-rose-500/[0.07] via-transparent to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-16 lg:py-20">

        {/* ── Left: copy ── */}
        <div className="flex flex-col gap-7">
          <div className="fade-in-up-0 flex items-center gap-2">
            <span className="w-5 h-px bg-rose-500" />
            <span className="text-[11px] font-medium text-rose-400 tracking-[0.14em] uppercase font-mono">
              Fashion discovery reimagined
            </span>
          </div>

          <h1 className="fade-in-up-1 text-5xl md:text-6xl lg:text-[4.25rem] font-bold tracking-[-0.03em] leading-[1.02] text-white">
            Swipe right<br />on your style.
          </h1>

          <p className="fade-in-up-2 text-lg text-zinc-400 leading-relaxed max-w-[38ch]">
            Tynderella curates thousands of fashion pieces and learns what you love.
            Your next favorite outfit is one swipe away.
          </p>

          <div className="fade-in-up-3 flex flex-col sm:flex-row gap-3">
            <a
              href="#join"
              className="inline-flex h-12 items-center justify-center rounded-full bg-rose-500 px-7 text-sm font-medium text-white hover:bg-rose-400 active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
            >
              Start swiping
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-7 text-sm font-medium text-zinc-300 hover:border-white/25 hover:text-white transition-all duration-200 whitespace-nowrap"
            >
              How it works
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        {/* ── Right: card stack ── */}
        <div className="relative h-[440px] md:h-[500px] flex items-center justify-center lg:justify-end">

          {/* Back card */}
          <div
            className="absolute"
            style={{ transform: "translateX(52px) translateY(-28px) rotate(7deg)", zIndex: 1 }}
          >
            <div className="animate-float-3 w-[220px] md:w-[248px] h-[300px] md:h-[336px] rounded-2xl overflow-hidden opacity-50">
              <Image
                src="https://picsum.photos/seed/tynderella-coat-fashion/248/336"
                alt="Fashion item"
                width={248}
                height={336}
                className="object-cover w-full h-full"
                sizes="248px"
              />
            </div>
          </div>

          {/* Middle card */}
          <div
            className="absolute"
            style={{ transform: "translateX(-24px) translateY(12px) rotate(-5deg)", zIndex: 2 }}
          >
            <div className="animate-float-2 w-[240px] md:w-[268px] h-[320px] md:h-[360px] rounded-2xl overflow-hidden opacity-70">
              <Image
                src="https://picsum.photos/seed/tynderella-dress-fashion/268/360"
                alt="Fashion item"
                width={268}
                height={360}
                className="object-cover w-full h-full"
                sizes="268px"
              />
            </div>
          </div>

          {/* Front card */}
          <div
            className="absolute"
            style={{ zIndex: 3 }}
          >
            <div className="animate-float relative w-[260px] md:w-[296px] h-[350px] md:h-[400px] rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
              <Image
                src="https://picsum.photos/seed/tynderella-blazer-fashion/296/400"
                alt="Curated fashion item: Oversized Blazer"
                width={296}
                height={400}
                className="object-cover w-full h-full"
                sizes="296px"
                priority
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

              {/* LIKE stamp */}
              <div
                className="absolute top-4 left-4 border-[1.5px] border-rose-500 text-rose-400 text-[9px] font-bold font-mono px-2 py-[3px] rounded tracking-[0.2em] uppercase"
                style={{ transform: "rotate(-15deg)" }}
                aria-hidden="true"
              >
                LIKE
              </div>

              {/* Product info */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-16 pt-4">
                <p className="text-white font-semibold text-base leading-tight">Oversized Blazer</p>
                <p className="text-white/55 text-sm mt-0.5">$214 · Free shipping</p>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3">
                <button
                  className="w-11 h-11 rounded-full bg-zinc-900/90 border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/25 active:scale-95 transition-all"
                  aria-label="Skip"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>

                <button
                  className="w-[52px] h-[52px] rounded-full bg-rose-500 flex items-center justify-center text-white hover:bg-rose-400 active:scale-95 transition-all animate-pulse-ring"
                  aria-label="Like"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>

                <button
                  className="w-11 h-11 rounded-full bg-zinc-900/90 border border-white/[0.1] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/25 active:scale-95 transition-all"
                  aria-label="Save for later"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
    </section>
  );
}
