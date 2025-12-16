"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  productId: string;
  onSubmitted?: () => void;
}

export default function ReviewForm({ productId, onSubmitted }: Props) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, comment }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Review submitted");
        setComment("");
        setRating(5);
        onSubmitted?.();
      } else {
        toast.error(data.error || "Failed to submit review");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm">Rating</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border px-2 py-1 rounded"
        >
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border rounded p-2"
          rows={3}
        />
      </div>

      <div>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
