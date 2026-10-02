"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "@/lib/firebase";

/** Saves subscriber emails to Firestore `subscribers/{email}`. */
export default function Newsletter({ tone = "light", variant = "default" }: { tone?: "light" | "dark"; variant?: "default" | "bar" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setState("error");
      setMsg("Please enter a valid email address.");
      return;
    }
    setState("busy");
    try {
      const d = db();
      if (!d) throw new Error("Newsletter is unavailable until Firebase is configured.");
      try {
        await setDoc(doc(d, "subscribers", clean), { email: clean, createdAt: serverTimestamp() });
      } catch (err) {
        // Rules make subscribers create-only, so signing up twice is rejected as an update.
        // Treat that as success, and show the same message either way so the form can't be
        // used to check whether an address is already on the list.
        if ((err as { code?: string })?.code !== "permission-denied") throw err;
      }
      setState("done");
      setMsg("You're on the list. Watch your inbox for deals.");
      setEmail("");
    } catch (err) {
      setState("error");
      console.warn("[newsletter]", err);
      setMsg("Could not subscribe right now. Please try again.");
    }
  }

  if (variant === "bar") {
    return (
      <form onSubmit={submit} className="w-full" noValidate>
        <div className="flex">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            aria-label="Email address"
            className="h-[44px] min-w-0 flex-1 rounded-l-full border-2 border-r-0 border-accent bg-white px-5 text-sm text-ink outline-none placeholder:text-[#999]"
          />
          <button
            type="submit"
            disabled={state === "busy"}
            className="h-[44px] shrink-0 rounded-r-full bg-gradient-to-r from-accent-bright to-accent px-7 text-sm font-bold text-white hover:brightness-95"
          >
            {state === "busy" ? "Sending…" : "Sign Up"}
          </button>
        </div>
        {msg && (
          <p role="status" className={`mt-2 text-sm ${state === "error" ? "text-sale" : "text-emerald-700"}`}>
            {msg}
          </p>
        )}
      </form>
    );
  }

  const dark = tone === "dark";
  return (
    <form onSubmit={submit} className="w-full" noValidate>
      <div className={dark ? "flex flex-col gap-3" : "flex flex-col gap-2 sm:flex-row"}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
          className="input h-12"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className={`btn h-12 shrink-0 ${dark ? "btn-light border border-white" : "btn-brand"}`}
        >
          {state === "busy" ? "Sending…" : "Subscribe"}
        </button>
      </div>
      {msg && (
        <p
          role="status"
          className={`mt-2 text-sm ${state === "error" ? (dark ? "text-red-200" : "text-sale") : dark ? "text-emerald-200" : "text-emerald-700"}`}
        >
          {msg}
        </p>
      )}
    </form>
  );
}
