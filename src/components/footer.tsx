const links = [
  { label: "Brands",   href: "#" },
  { label: "Careers",  href: "#" },
  { label: "Privacy",  href: "#" },
  { label: "Terms",    href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <a href="/" className="text-white font-semibold tracking-[-0.03em]">
          tynderella
        </a>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap justify-center gap-6">
            {links.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-xs text-zinc-700">
          &copy; {new Date().getFullYear()} Tynderella
        </p>
      </div>
    </footer>
  );
}
