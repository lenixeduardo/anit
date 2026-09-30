export function CtaSection() {
  return (
    <section id="join" className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-white/[0.07] px-8 py-16 md:px-16 md:py-20 text-center">

          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.08] via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-rose-500/[0.06] blur-3xl pointer-events-none" />

          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold tracking-[-0.03em] text-white leading-[1.08]">
              Your next favorite outfit<br className="hidden sm:block" /> is waiting.
            </h2>
            <p className="mt-5 text-zinc-400 text-base max-w-[38ch] mx-auto">
              Join 47,000 shoppers who discovered their style through Tynderella.
              Free to join, cancel any time.
            </p>

            <form
              action="#"
              method="post"
              className="mt-10 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
              aria-label="Join waitlist"
            >
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="email-cta" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-cta"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-full border border-white/[0.1] bg-white/[0.06] px-5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 transition-all"
                />
              </div>
              <button
                type="submit"
                className="h-12 rounded-full bg-rose-500 px-7 text-sm font-medium text-white hover:bg-rose-400 active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
              >
                Join Tynderella
              </button>
            </form>

            <p className="mt-4 text-xs text-zinc-600">
              No spam, ever. Unsubscribe with one click.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
