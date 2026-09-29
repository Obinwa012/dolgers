"use client";

import { Quote, Star } from "lucide-react";
import Rail from "@/components/Rail";

type Review = { title: string; body: string; name: string; product: string };

export default function Reviews({ reviews }: { reviews: Review[] }) {
  return (
    <Rail label="Customer reviews" itemClass="w-[88%] md:w-[48%] lg:w-[32%]">
      {reviews.map((r, i) => (
        <figure key={i} className="flex h-full flex-col gap-4 rounded-lg bg-white p-7 shadow-[0_0_0_1px_#e5e7eb]">
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5" aria-label="5 out of 5 stars">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-accent text-accent" />
              ))}
            </div>
            <Quote className="h-7 w-7 text-brand-100" />
          </div>
          <h3 className="font-display text-xl">{r.title}</h3>
          <blockquote className="flex-1 text-sm leading-relaxed text-muted">{r.body}</blockquote>
          <figcaption className="border-t pt-4 text-sm">
            <b>{r.name}</b>
            <span className="block text-muted">Purchased: {r.product}</span>
          </figcaption>
        </figure>
      ))}
    </Rail>
  );
}
