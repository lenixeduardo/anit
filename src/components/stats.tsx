const stats = [
  { value: "47k+",  label: "Shoppers styled daily" },
  { value: "200k+", label: "Items across 800 brands" },
  { value: "9 in 10", label: "Find their look within a week" },
];

export function Stats() {
  return (
    <section className="border-y border-white/[0.06] bg-zinc-900/40">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        {stats.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 py-8 sm:py-6 sm:px-8 text-center first:pt-8 last:pb-8">
            <span className="text-4xl font-bold tracking-[-0.03em] text-white font-mono">
              {value}
            </span>
            <span className="text-sm text-zinc-500 max-w-[18ch]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
