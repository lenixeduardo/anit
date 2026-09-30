const steps = [
  {
    number: "01",
    title: "Browse",
    body: "A curated feed of fashion pieces built around your taste, refreshed every day across thousands of brands.",
  },
  {
    number: "02",
    title: "Swipe",
    body: "Right for yes, left for maybe later. Every reaction teaches us exactly what works for you.",
  },
  {
    number: "03",
    title: "Shop",
    body: "Your matched pieces are ready to buy whenever you are, with saved sizing and free returns on every order.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-6">

        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-white">
            Three steps to your style.
          </h2>
          <p className="mt-4 text-zinc-500 text-base max-w-[42ch]">
            No more endless scrolling. No more buyer&apos;s remorse.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          {steps.map(({ number, title, body }) => (
            <div
              key={number}
              className="bg-zinc-950 p-8 lg:p-10 flex flex-col gap-5 hover:bg-zinc-900/60 transition-colors duration-300 group"
            >
              <span className="text-[2.75rem] font-black font-mono text-zinc-800 group-hover:text-rose-500/30 transition-colors duration-300 leading-none select-none">
                {number}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-white tracking-[-0.01em]">
                  {title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-[28ch]">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
