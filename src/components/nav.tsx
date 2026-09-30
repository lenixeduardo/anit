"use client";

import { useState } from "react";

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { label: "Discover",      href: "#discover"      },
    { label: "Collections",   href: "#featured"      },
    { label: "How it works",  href: "#how-it-works"  },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[72px] flex items-center">
      <div className="absolute inset-0 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl" />
      <nav className="relative max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
        <a
          href="/"
          className="text-white font-semibold tracking-[-0.03em] text-lg select-none z-20"
        >
          tynderella
        </a>

        {/* Desktop nav links */}
        <ul className="hidden md:flex items-center gap-8">
          {links.map(({ label, href }) => (
            <li key={label}>
              <a
                href={href}
                className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <a
          href="#join"
          className="hidden md:inline-flex h-9 items-center rounded-full bg-rose-500 px-5 text-sm font-medium text-white hover:bg-rose-400 active:scale-[0.98] transition-all duration-200 z-20"
        >
          Get started
        </a>

        {/* Hamburger button — mobile only */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-[5px] p-2 z-20 bg-transparent border-none cursor-pointer"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <span
            className={`block w-[22px] h-[2px] rounded-full bg-zinc-100 transition-all duration-300 origin-center ${
              menuOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`block w-[22px] h-[2px] rounded-full bg-zinc-100 transition-all duration-300 ${
              menuOpen ? "opacity-0 scale-x-0" : ""
            }`}
          />
          <span
            className={`block w-[22px] h-[2px] rounded-full bg-zinc-100 transition-all duration-300 origin-center ${
              menuOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      {/* Mobile overlay menu */}
      <div
        className={`fixed inset-0 z-10 flex flex-col items-center justify-center gap-10 bg-zinc-950/95 backdrop-blur-xl transition-all duration-500 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {links.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            onClick={() => setMenuOpen(false)}
            className="text-3xl font-bold text-zinc-300 hover:text-rose-400 transition-colors duration-200 no-underline"
          >
            {label}
          </a>
        ))}
        <a
          href="#join"
          onClick={() => setMenuOpen(false)}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-rose-500 px-8 text-base font-medium text-white hover:bg-rose-400 transition-all duration-200 no-underline"
        >
          Get started
        </a>
      </div>
    </header>
  );
}
