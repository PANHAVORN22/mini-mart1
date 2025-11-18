"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Search } from "lucide-react";

interface RedemptionRecord {
  id: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  quantity: number;
  status: string;
  verificationCode: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  adminUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  fulfilledAt?: string | null;
  user: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
  };
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "picked_up", label: "Picked up" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  preparing: "secondary",
  ready: "default",
  picked_up: "default",
  cancelled: "destructive",
};

export function RewardRedemptionMonitor() {
  const [records, setRecords] = useState<RedemptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      const res = await fetch(
        `/api/admin/reward-redemptions${params.toString() ? `?${params}` : ""}`
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to fetch redemptions");
      }
      const data: RedemptionRecord[] = json.data || [];
      setRecords(data);
      setStatusDrafts((prev) => {
        const next = { ...prev };
        data.forEach((item) => {
          next[item.id] = next[item.id] || item.status;
        });
        return next;
      });
      setNoteDrafts((prev) => {
        const next = { ...prev };
        data.forEach((item) => {
          next[item.id] =
            item.id in next ? next[item.id] : item.adminNotes || "";
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to load redemptions", err);
      toast.error("Failed to load redemptions");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (record: RedemptionRecord) => {
    const nextStatus = statusDrafts[record.id] || record.status;
    const note = noteDrafts[record.id] ?? record.adminNotes ?? "";
    setUpdatingId(record.id);
    try {
      const res = await fetch("/api/admin/reward-redemptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redemptionId: record.id,
          status: nextStatus,
          adminNotes: note,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Update failed");
      }
      toast.success("Redemption updated");
      setRecords((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: nextStatus,
                adminNotes: note || undefined,
                fulfilledAt: json.data?.fulfilled_at,
              }
            : item
        )
      );
    } catch (err) {
      console.error("Failed to update redemption", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update redemption"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Verification code copied");
    } catch (err) {
      console.error("Failed to copy code", err);
      toast.error("Unable to copy code");
    }
  };

  const summary = useMemo(() => {
    if (!records.length) return null;
    const counts = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {});
    return counts;
  }, [records]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Reward Redemptions</CardTitle>
            <CardDescription>
              Review redemption requests, verify pickup info, and mark when
              rewards are ready.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex flex-wrap gap-2 text-sm">
              {STATUS_OPTIONS.map((status) => (
                <Badge
                  key={status.value}
                  variant={STATUS_VARIANTS[status.value] || "secondary"}
                >
                  {status.label}: {summary[status.value] || 0}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, code, address, or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading redemptions...
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No redemption requests match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reward</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[220px]">Admin Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const statusValue = statusDrafts[record.id] || record.status;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {record.rewardName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {record.pointsSpent} pts · Qty {record.quantity}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {record.user.name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {record.user.email || "No email"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{record.contactPhone}</span>
                          {record.notes && (
                            <span className="text-xs text-muted-foreground">
                              Pref: {record.notes}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{record.addressLine1}</p>
                          {record.addressLine2 && <p>{record.addressLine2}</p>}
                          <p>
                            {[record.city, record.postalCode]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {record.verificationCode}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyCode(record.verificationCode)}
                            title="Copy code"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Select
                            value={statusValue}
                            onValueChange={(value) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [record.id]: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Badge
                            variant={
                              STATUS_VARIANTS[record.status] || "secondary"
                            }
                          >
                            Current:{" "}
                            {STATUS_OPTIONS.find(
                              (s) => s.value === record.status
                            )?.label || record.status}
                          </Badge>
                          {record.fulfilledAt && (
                            <span className="text-xs text-muted-foreground">
                              Picked up{" "}
                              {new Date(record.fulfilledAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={
                            noteDrafts[record.id] ?? record.adminNotes ?? ""
                          }
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [record.id]: event.target.value,
                            }))
                          }
                          placeholder="Add internal note"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(record)}
                          disabled={updatingId === record.id}
                        >
                          {updatingId === record.id ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
