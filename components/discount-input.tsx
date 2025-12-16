"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DiscountInput({
  onApplied,
}: {
  onApplied?: (discount: any) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success && data.valid) {
        toast.success("Discount applied");
        onApplied?.(data.discount);
      } else {
        toast.error(data.error || "Invalid code");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={code}
        onChange={(e) => setCode((e.target as HTMLInputElement).value)}
        placeholder="Promo code"
      />
      <Button onClick={apply} disabled={loading || !code}>
        {loading ? "Applying..." : "Apply"}
      </Button>
    </div>
  );
}
