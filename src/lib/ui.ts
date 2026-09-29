// Shared layout class strings. Plain module (not "use client") so server components can import them.

/** Item widths for a dense product rail: 2 → 3 → 4 → 5 → 6 across (gaps: 1rem, then 1.25rem from md). */
export const DENSE_RAIL =
  "w-[46%] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3.75rem)/4)] lg:w-[calc((100%-5rem)/5)] xl:w-[calc((100%-6.25rem)/6)]";
