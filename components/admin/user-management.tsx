"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crown, Shield } from "lucide-react";
import { toast } from "sonner";
import { getAllUsers, toggleUserPremium } from "@/lib/actions/admin";
import { setUserRole } from "@/lib/actions/admin";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isPremium: boolean;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      setIsLoading(false);
    };

    fetchUsers();
  }, []);

  const handleTogglePremium = async (
    userId: string,
    currentStatus: boolean
  ) => {
    setUpdatingUserId(userId);

    const result = await toggleUserPremium(userId, !currentStatus);

    if (result.success) {
      // Update local state
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, isPremium: !currentStatus } : user
        )
      );
      toast.success("User updated", {
        description: "Premium status has been toggled",
      });
    } else {
      toast.error("Failed to update user", {
        description: result.error,
      });
    }

    setUpdatingUserId(null);
  };

  const handleSetRole = async (userId: string, role: "customer" | "admin") => {
    setUpdatingUserId(userId);

    const result = await setUserRole(userId, role);

    if (result.success) {
      setUsers(users.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success("User role updated", {
        description: `User has been set to ${role}`,
      });
    } else {
      toast.error("Failed to update role", {
        description: result.error,
      });
    }

    setUpdatingUserId(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "admin" ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {user.role === "admin" && <Shield className="h-3 w-3" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isPremium ? (
                      <Badge className="gap-1">
                        <Crown className="h-3 w-3" />
                        Premium
                      </Badge>
                    ) : (
                      <Badge variant="outline">Standard</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleSetRole(
                            user.id,
                            user.role === "admin" ? "customer" : "admin"
                          )
                        }
                        disabled={updatingUserId === user.id}
                      >
                        {updatingUserId === user.id
                          ? "Updating..."
                          : user.role === "admin"
                          ? "Demote"
                          : "Promote"}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          handleTogglePremium(user.id, user.isPremium)
                        }
                        disabled={updatingUserId === user.id}
                      >
                        Toggle Premium
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
