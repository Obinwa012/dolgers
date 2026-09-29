"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";

/**
 * Sends a question to the listing's seller. It's stored as "open" and shows on the page once the
 * seller answers it from their dashboard (answers are written server-side).
 */
export default function AskQuestion({ productId, seller, slug }: { productId: string; seller: string; slug: string }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  if (!user)
    return (
      <p className="text-sm text-muted">
        <Link href={`/login?next=/products/${slug}`} className="font-semibold text-brand-700 underline">Log in</Link> to ask the seller a question.
      </p>
    );
  if (state === "sent")
    return <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">Thanks! We&apos;ve sent your question to the seller. Answers usually appear within 2 business days.</p>;

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = db();
        const q = text.trim();
        if (!d || q.length < 10) return;
        setState("busy");
        try {
          await addDoc(collection(d, "questions"), {
            productId,
            seller,
            question: q.slice(0, 500),
            name: (user.displayName ?? "Customer").split(" ")[0].slice(0, 40),
            uid: user.uid,
            status: "open",
            createdAt: serverTimestamp(),
          });
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      <label htmlFor="ask" className="sr-only">Your question</label>
      <input
        id="ask"
        value={text}
        onChange={(e) => setText(e.target.value)}
        minLength={10}
        maxLength={500}
        required
        placeholder="Ask about fit, compatibility, what's in the box…"
        className="input flex-1"
      />
      <button disabled={state === "busy"} className="btn btn-outline">{state === "busy" ? "Sending…" : "Ask the seller"}</button>
      {state === "error" && <p className="text-sm text-sale" role="alert">Couldn&apos;t send that. Please try again.</p>}
    </form>
  );
}
