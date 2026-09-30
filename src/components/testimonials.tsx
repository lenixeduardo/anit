import Image from "next/image";

const quotes = [
  {
    body: "Tynderella changed how I shop. I used to spend hours scrolling, now I find pieces I love in minutes.",
    name: "Mei Chen",
    role: "Fashion blogger",
    avatar: "https://picsum.photos/seed/tynderella-avatar-mei/64/64",
  },
  {
    body: "My wardrobe has never felt more like me. The more I swipe, the better it gets at knowing my taste.",
    name: "Amara Osei",
    role: "Marketing director",
    avatar: "https://picsum.photos/seed/tynderella-avatar-amara/64/64",
  },
  {
    body: "I have discovered brands I never would have found otherwise. The curation is genuinely impressive.",
    name: "Sofia Laurent",
    role: "Student",
    avatar: "https://picsum.photos/seed/tynderella-avatar-sofia/64/64",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 lg:py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] text-white mb-12">
          Worn and loved.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quotes.map(({ body, name, role, avatar }) => (
            <div
              key={name}
              className="flex flex-col gap-6 rounded-2xl border border-white/[0.07] bg-zinc-900/40 p-7 hover:border-white/[0.12] transition-colors duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1" aria-label="5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-rose-500" aria-hidden="true">
                    <path d="M8 1l1.85 3.74L14 5.5l-3 2.92.71 4.12L8 10.27l-3.71 2.27L5 8.42 2 5.5l4.15-.76z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-sm text-zinc-300 leading-relaxed">
                &ldquo;{body}&rdquo;
              </blockquote>

              {/* Attribution */}
              <div className="flex items-center gap-3 mt-auto">
                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                  <Image
                    src={avatar}
                    alt={name}
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                    sizes="32px"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{name}</p>
                  <p className="text-xs text-zinc-500">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
