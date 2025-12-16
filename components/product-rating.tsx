"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

type Props = {
  productId: string;
  size?: "sm" | "md";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ProductRating({ productId, size = "sm" }: Props) {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  const fetchRating = async () => {
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      const data = await res.json();
      if (!data?.success) return;

      const reviews: Array<{ rating: number }> = data.reviews || [];
      setCount(reviews.length);
      if (reviews.length === 0) {
        setAvg(null);
        return;
      }
      const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
      setAvg(sum / reviews.length);
    } catch (e) {
      // best-effort UI
      setAvg(null);
      setCount(0);
    }
  };

  useEffect(() => {
    fetchRating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const display = useMemo(() => {
    if (avg == null) return { filled: 0, label: "No ratings" };
    const clamped = clamp(avg, 0, 5);
    return {
      filled: Math.round(clamped),
      label: `${clamped.toFixed(1)} (${count})`,
    };
  }, [avg, count]);

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, idx) => {
          const active = idx < display.filled;
          return (
            <Star
              key={idx}
              className={`${iconSize} ${
                active
                  ? "text-yellow-500 fill-yellow-500"
                  : "text-muted-foreground/40"
              }`}
            />
          );
        })}
      </div>
      <span className="tabular-nums">{display.label}</span>
    </div>
  );
}
