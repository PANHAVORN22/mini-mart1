"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const generateCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
};

export default function AdminDiscountsPage() {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const [listLoading, setListLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const url = new URL("/api/admin/discounts", window.location.origin);
      if (query.trim()) url.searchParams.set("q", query.trim());

      const res = await fetch(url.toString(), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Failed to load promo codes");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalCount(typeof data.count === "number" ? data.count : null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load promo codes");
    } finally {
      setListLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const onCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    try {
      const res = await fetch(`/api/admin/discounts/${id}` as string, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Failed to update");
        return;
      }
      setItems((prev) =>
        prev.map((row) => (row.id === id ? { ...row, active: next } : row))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update");
    }
  };

  const deleteCode = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/discounts/${id}` as string, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        toast.error(data?.error || "Failed to delete");
        return;
      }
      toast.success("Deleted");
      setItems((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete");
    }
  };

  const create = async () => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Promo code is required");
      return;
    }

    const hasPercent = percent.trim().length > 0;
    const hasAmount = amount.trim().length > 0;
    if ((hasPercent && hasAmount) || (!hasPercent && !hasAmount)) {
      toast.error("Choose either Percent Off or Amount Off");
      return;
    }

    if (hasPercent) {
      const value = Number(percent);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        toast.error("Percent Off must be between 1 and 100");
        return;
      }
    }

    if (hasAmount) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Amount Off must be greater than 0");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        code: normalizedCode,
        description: description.trim() ? description.trim() : null,
        active,
      };
      if (hasPercent) payload.percent_off = Number(percent);
      if (hasAmount) payload.amount_off = Number(amount);
      if (usageLimit.trim()) payload.usage_limit = Number(usageLimit);
      if (startsAt) payload.starts_at = new Date(startsAt).toISOString();
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();

      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Discount created");
        setCode("");
        setDescription("");
        setPercent("");
        setAmount("");
        setUsageLimit("");
        setStartsAt("");
        setExpiresAt("");
        setActive(true);
        await fetchList();
      } else {
        toast.error(data.error || "Failed to create discount");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    if (listLoading) return "Loading…";
    if (typeof totalCount === "number") return `${totalCount} promo codes`;
    return `${items.length} promo codes`;
  }, [items.length, listLoading, totalCount]);

  return (
    <div className="space-y-6">
      <Card className="border-muted/60">
        <CardHeader>
          <CardTitle className="text-xl">Create Promo Code</CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate a code for events (example:{" "}
            <span className="font-mono">XMAS15</span>) and apply it at checkout.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) =>
                  setCode((e.target as HTMLInputElement).value.toUpperCase())
                }
                placeholder="XMAS15"
                className="font-mono"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCode(generateCode())}
                disabled={loading}
              >
                Generate
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) =>
                setDescription((e.target as HTMLInputElement).value)
              }
              placeholder="Christmas Event 15% off"
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Percent Off</Label>
              <Input
                value={percent}
                onChange={(e) => {
                  setPercent((e.target as HTMLInputElement).value);
                  if ((e.target as HTMLInputElement).value.trim())
                    setAmount("");
                }}
                placeholder="15"
                inputMode="numeric"
                disabled={Boolean(amount.trim())}
              />
              <p className="text-xs text-muted-foreground">
                Use for percentage discounts (1–100).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Amount Off</Label>
              <Input
                value={amount}
                onChange={(e) => {
                  setAmount((e.target as HTMLInputElement).value);
                  if ((e.target as HTMLInputElement).value.trim())
                    setPercent("");
                }}
                placeholder="5.00"
                inputMode="decimal"
                disabled={Boolean(percent.trim())}
              />
              <p className="text-xs text-muted-foreground">
                Use for fixed amount discounts.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts At (optional)</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) =>
                  setStartsAt((e.target as HTMLInputElement).value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt((e.target as HTMLInputElement).value)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Usage Limit (optional)</Label>
              <Input
                value={usageLimit}
                onChange={(e) =>
                  setUsageLimit((e.target as HTMLInputElement).value)
                }
                placeholder="100"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label>Active</Label>
              <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-sm text-muted-foreground">
                  {active ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="text-muted-foreground">Preview</div>
              <div className="font-medium">
                {code.trim() ? code.trim().toUpperCase() : "—"}{" "}
                {percent.trim()
                  ? `${percent.trim()}% off`
                  : amount.trim()
                  ? `$${Number(amount || 0).toFixed(2)} off`
                  : ""}
              </div>
            </div>

            <Button onClick={create} disabled={loading}>
              {loading ? "Creating..." : "Create Promo Code"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted/60">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-xl">Manage Promo Codes</CardTitle>
            <Button
              type="button"
              variant="secondary"
              onClick={fetchList}
              disabled={listLoading}
            >
              {listLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <Label>Search</Label>
              <Input
                value={query}
                onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
                placeholder="Search by code or description"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" variant="secondary" onClick={fetchList}>
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setTimeout(() => void fetchList(), 0);
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {listLoading
                      ? "Loading promo codes…"
                      : "No promo codes found."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        <span>{row.code}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onCopy(row.code)}
                        >
                          Copy
                        </Button>
                      </div>
                      {row.description ? (
                        <div className="text-xs text-muted-foreground mt-1 whitespace-normal">
                          {row.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {row.percent_off != null
                        ? `${row.percent_off}%`
                        : row.amount_off != null
                        ? `$${Number(row.amount_off).toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {row.times_used ?? 0}
                      {row.usage_limit != null ? ` / ${row.usage_limit}` : ""}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(row.active)}
                        onCheckedChange={(checked) =>
                          void toggleActive(row.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button type="button" variant="destructive" size="sm">
                            Delete
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete promo code?</DialogTitle>
                            <DialogDescription>
                              This will permanently delete {row.code}.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button type="button" variant="secondary">
                                Cancel
                              </Button>
                            </DialogClose>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => void deleteCode(row.id)}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
