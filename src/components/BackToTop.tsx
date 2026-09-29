"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0 })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-30 grid h-12 w-12 place-items-center rounded-full bg-brand-700 text-white shadow-lg hover:bg-brand-900"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
