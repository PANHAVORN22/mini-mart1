"use client";

import React, { useEffect, useState } from "react";

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export default function ReviewList({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      const data = await res.json();
      if (data.success) setReviews(data.reviews || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  // Allow other components to refresh by re-mounting

  if (loading) return <div>Loading reviews...</div>;

  if (reviews.length === 0)
    return <div className="text-sm text-muted-foreground">No reviews yet</div>;

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="border rounded p-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{r.rating} / 5</div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
