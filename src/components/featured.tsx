import Image from "next/image";

const products = [
  {
    id: "hero",
    name: "The Ribbed Knit Co-ord",
    brand: "Studio Ninety",
    price: "$189",
    seed: "tynderella-knit-coord/800/420",
    wide: true,
  },
  {
    id: "b",
    name: "Japanese Denim Jacket",
    brand: "Indigo Workshop",
    price: "$156",
    seed: "tynderella-denim-jacket/400/560",
    tall: true,
  },
  {
    id: "c",
    name: "Linen Barrel Trousers",
    brand: "Chalk & Thread",
    price: "$94",
    seed: "tynderella-linen-trousers/400/280",
  },
  {
    id: "d",
    name: "Cashmere Midi Dress",
    brand: "Soft Arc",
    price: "$312",
    seed: "tynderella-cashmere-dress/400/280",
  },
];

export function Featured() {
  const [hero, tall, c, d] = products;

  return (
    <section id="featured" className="py-24 lg:py-32 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6">

        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-[10px] font-mono font-medium text-rose-500/80 tracking-[0.16em] uppercase">
              Trending now
            </span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-[-0.03em] text-white">
              Pieces people are loving.
            </h2>
          </div>
          <a
            href="#discover"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            View all
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {/*
          Bento grid: 3 cols, 2 rows
          [  hero (col 1-2, row 1)  ] [ tall (col 3, rows 1-2) ]
          [ c (col 1, row 2) ] [ d (col 2, row 2) ]  [ tall ↑ ]
        */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 auto-rows-[280px]">

          {/* Hero tile: spans cols 1-2, row 1 */}
          <div className="sm:col-span-2 relative rounded-2xl overflow-hidden group cursor-pointer">
            <Image
              src={`https://picsum.photos/seed/${hero.seed}`}
              alt={hero.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 66vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <ProductLabel name={hero.name} brand={hero.brand} price={hero.price} large />
          </div>

          {/* Tall tile: col 3, rows 1-2 */}
          <div className="sm:row-span-2 relative rounded-2xl overflow-hidden group cursor-pointer">
            <Image
              src={`https://picsum.photos/seed/${tall.seed}`}
              alt={tall.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <ProductLabel name={tall.name} brand={tall.brand} price={tall.price} />
          </div>

          {/* Item C: col 1, row 2 */}
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer">
            <Image
              src={`https://picsum.photos/seed/${c.seed}`}
              alt={c.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <ProductLabel name={c.name} brand={c.brand} price={c.price} />
          </div>

          {/* Item D: col 2, row 2 */}
          <div className="relative rounded-2xl overflow-hidden group cursor-pointer">
            <Image
              src={`https://picsum.photos/seed/${d.seed}`}
              alt={d.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <ProductLabel name={d.name} brand={d.brand} price={d.price} />
          </div>

        </div>
      </div>
    </section>
  );
}

function ProductLabel({
  name,
  brand,
  price,
  large,
}: {
  name: string;
  brand: string;
  price: string;
  large?: boolean;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
      <div>
        <p className={`text-white font-semibold leading-tight ${large ? "text-base" : "text-sm"}`}>
          {name}
        </p>
        <p className="text-white/50 text-xs mt-0.5">{brand}</p>
      </div>
      <span className="text-white font-mono text-sm font-medium bg-white/[0.12] rounded-full px-3 py-1 backdrop-blur-sm">
        {price}
      </span>
    </div>
  );
}
