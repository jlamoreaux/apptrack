"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Filter,
  CreditCard,
  AlertCircle,
  UserCheck,
  TrendingUp,
  Clock,
  DollarSign,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

interface UserSubscription {
  status: string;
  billing_cycle: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan_name: string;
  price: number | null;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_admin: boolean;
  subscription: UserSubscription | null;
}

interface UserStats {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  pastDueUsers: number;
  canceledUsers: number;
  newUsersLast30Days: number;
}

interface AllUsersClientProps {
  initialData: User[];
  initialStats: UserStats;
}

export function AllUsersClient({ initialData, initialStats }: AllUsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialData);
  const [stats, setStats] = useState<UserStats>(initialStats);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/all-users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => {
        if (statusFilter === "admin") return user.is_admin;
        if (statusFilter === "no_subscription") return !user.subscription;
        if (statusFilter === "active") 
          return user.subscription?.status === "active";
        if (statusFilter === "trialing") 
          return user.subscription?.status === "trialing";
        if (statusFilter === "past_due") 
          return user.subscription?.status === "past_due";
        if (statusFilter === "canceled") 
          return user.subscription?.status === "canceled";
        return true;
      });
    }

    return filtered;
  }, [users, searchTerm, statusFilter]);

  const getStatusBadge = (subscription: UserSubscription | null, isAdmin: boolean) => {
    if (isAdmin) {
      return <Badge className="bg-purple-100 text-purple-800">Admin</Badge>;
    }
    
    if (!subscription) {
      return <Badge variant="outline">Free</Badge>;
    }

    const statusColors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      trialing: "bg-blue-100 text-blue-800",
      past_due: "bg-red-100 text-red-800",
      canceled: "bg-gray-100 text-gray-800",
    };

    return (
      <div className="flex gap-2">
        <Badge className={statusColors[subscription.status] || ""}>
          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
        </Badge>
        {subscription.cancel_at_period_end && (
          <Badge variant="outline" className="text-orange-600">
            Canceling
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          All Users
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage and monitor all platform users and their subscription status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Trials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trialUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Past Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pastDueUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-gray-500" />
              Canceled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.canceledUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              New (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersLast30Days}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="active">Active Subscribers</SelectItem>
                <SelectItem value="trialing">Trial Users</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="no_subscription">Free Users</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={refreshData}
              disabled={loading}
              variant="outline"
              size="icon"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Showing {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-sm">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.full_name || "No name"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(user.subscription, user.is_admin)}
                      <Badge variant="outline" className="text-xs">
                        {user.subscription?.plan_name || "Free"}
                      </Badge>
                    </div>
                    {user.subscription && (
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="h-3 w-3" />
                        {user.subscription.price || "0"}
                        <span className="text-xs text-muted-foreground">
                          /{user.subscription.billing_cycle === "yearly" ? "yr" : "mo"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Joined: {format(new Date(user.created_at), "MMM d, yyyy")}</span>
                    {user.subscription?.current_period_end && (
                      <span>Next: {format(new Date(user.subscription.current_period_end), "MMM d")}</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your criteria
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Next Bill</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      {getStatusBadge(user.subscription, user.is_admin)}
                    </TableCell>
                    <TableCell>
                      {user.subscription?.plan_name || "Free"}
                    </TableCell>
                    <TableCell>
                      {user.subscription ? (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {user.subscription.price || "0"}
                          <span className="text-xs text-muted-foreground">
                            /{user.subscription.billing_cycle === "yearly" ? "yr" : "mo"}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {user.subscription?.current_period_end
                        ? format(new Date(user.subscription.current_period_end), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your criteria
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}