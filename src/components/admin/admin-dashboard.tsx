"use client";

import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Gauge,
  Grid2X2,
  Loader2,
  MapPin,
  Menu,
  Radio,
  ReceiptText,
  Search,
  ShieldCheck,
  Siren,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Badge,
  EmptyState,
  PaginationControls,
  Panel,
  StatCard,
} from "@/components/admin/dashboard-ui";
import { LoginCard } from "@/components/admin/login-card";
import { PasswordChangeCard } from "@/components/admin/password-change-card";
import { ProfilePasswordForm } from "@/components/admin/profile-password-form";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AdminSection =
  | "overview"
  | "users"
  | "emergencies"
  | "reports"
  | "audit"
  | "analytics"
  | "exports"
  | "monitoring"
  | "profile";
type UserRow = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  role?: string | null;
  approvalStatus?: string | null;
  requestedRole?: string | null;
  wardNumber?: string | null;
  wardName?: string | null;
  ward_id?: string | null;
  location?: string | null;
  createdAt?: string | null;
};
type ReportRow = {
  id: string;
  userId?: string | null;
  submittedBy?: string | null;
  reportType?: string | null;
  crimeCategory?: string | null;
  otherCategory?: string | null;
  description?: string | null;
  photoUrls?: string[] | null;
  location?: unknown;
  ward_id?: string | null;
  status?: string | null;
  createdAt?: string | null;
};
type EmergencyRow = {
  id: string;
  userId?: string | null;
  emergencyType?: string | null;
  userName?: string | null;
  userPhone?: string | null;
  description?: string | null;
  location?: unknown;
  responderName?: string | null;
  responderId?: string | null;
  ward_id?: string | null;
  status?: string | null;
  createdAt?: string | null;
  respondedAt?: string | null;
  completedAt?: string | null;
};
type AuditRow = {
  id: string;
  action_summary?: string | null;
  operation?: string | null;
  table_name?: string | null;
  record_id?: string | null;
  actor_display_name?: string | null;
  actor_email?: string | null;
  record_label?: string | null;
  change_details?: unknown;
  changed_fields?: string[] | null;
  privacy_version?: number | null;
  created_at?: string | null;
};

const auditResourceLabels: Record<string, string> = {
  users: "user",
  reports: "community report",
  emergencies: "emergency",
  emergency_requests: "emergency request",
  cps_duty_sessions: "CPS duty session",
  saved_contacts: "saved contact",
  wards: "ward",
};

const humanizeAuditField = (field: string) =>
  field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getAuditFields = (log: AuditRow) => {
  if (Array.isArray(log.changed_fields)) return log.changed_fields;
  if (Array.isArray(log.change_details)) {
    return log.change_details.flatMap((entry) =>
      entry && typeof entry === "object" && "field" in entry && typeof entry.field === "string"
        ? [entry.field]
        : [],
    );
  }
  return [];
};

const getAuditResource = (log: AuditRow) => {
  const table = log.table_name?.split(".").pop()?.replaceAll('"', "") || "record";
  return auditResourceLabels[table.toLowerCase()] || humanizeAuditField(table);
};

const getAuditAction = (operation?: string | null) => {
  switch (operation?.toUpperCase()) {
    case "INSERT": return "Created";
    case "UPDATE": return "Updated";
    case "DELETE": return "Deleted";
    default: return "Changed";
  }
};

const getAuditSummary = (log: AuditRow) => {
  if (log.privacy_version && log.privacy_version > 0) {
    return `${getAuditAction(log.operation)} ${getAuditResource(log)}`;
  }
  return log.action_summary || `${getAuditAction(log.operation)} ${getAuditResource(log)}`;
};

const getAuditActor = (log: AuditRow) => {
  const actor = log.actor_display_name || log.actor_email;
  return actor?.startsWith("hmac-sha256:") ? "Protected actor" : actor || "Unknown actor";
};

const getAuditRecordLabel = (log: AuditRow) =>
  log.record_label?.startsWith("hmac-sha256:") ? "Protected record" : log.record_label;

const navItems = [
  { id: "overview", label: "Overview", icon: Grid2X2 },
  { id: "users", label: "User Management", icon: Users },
  { id: "emergencies", label: "Emergency Management", icon: Siren },
  { id: "reports", label: "Community Reports", icon: FileText },
  { id: "audit", label: "Audit Logs", icon: ReceiptText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "exports", label: "Exports", icon: Download },
  { id: "monitoring", label: "System Monitoring", icon: Gauge },
  { id: "profile", label: "Profile", icon: UserCircle },
] as const;

const reportTypes = [
  { name: "Crime", key: "crime", color: "#dc2626" },
  { name: "Emergency", key: "hazard", color: "#f59e0b" },
  { name: "Infrastructure", key: "infrastructure", color: "#2563eb" },
  { name: "Community", key: "other", color: "#16a34a" },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  community_protection_service: "CPS Responder",
  emergency_responder: "Emergency Responder",
  community_leader: "Community Leader",
  leader: "Community Leader",
  resident: "Resident",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat().format(value || 0);
const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};
const daysSince = (value?: string | null) => {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / 86400000);
};
const getName = (user: UserRow) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
  user.email ||
  "Unnamed account";
const getLocationLabel = (location: unknown) => {
  if (!location || typeof location !== "object") return "Location not provided";
  const record = location as Record<string, unknown>;
  return (
    `${record.address || record.label || record.latitude || ""}${record.longitude ? `, ${record.longitude}` : ""}`.trim() ||
    "Location captured"
  );
};


export function AdminDashboard() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [emergencyTypeFilter, setEmergencyTypeFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("30");
  const [pageBySection, setPageBySection] = useState<Record<string, number>>(
    {},
  );
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [selectedEmergency, setSelectedEmergency] =
    useState<EmergencyRow | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditRow | null>(
    null,
  );
  const sessionUserId = sessionUser?.id ?? null;
  const pageSize = 10;

  const loadDashboard = useCallback(async () => {
    console.log("[AdminDashboard] Loading dashboard data");
    setLoading(true);
    setAccessDenied(false);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    console.log("[AdminDashboard] Session check", {
      hasSession: !!sessionData.session,
      userId: user?.id,
      email: user?.email,
    });
    setSessionUser(user);
    if (!user) {
      console.log("[AdminDashboard] No active session, showing login");
      setUsers([]);
      setReports([]);
      setEmergencies([]);
      setAuditLogs([]);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    console.log("[AdminDashboard] Admin profile response", {
      profile,
      error: profileError?.message,
    });
    if (profileError) {
      console.error("[AdminDashboard] Could not verify admin profile", {
        message: profileError.message,
        code: profileError.code,
      });
      setError("Could not verify your admin access. Please sign in again.");
      setAccessDenied(true);
      setLoading(false);
      return;
    }
    if (profile?.role !== "admin" || profile?.approvalStatus !== "approved") {
      console.warn("[AdminDashboard] Signed-in user is not an approved admin", {
        role: profile?.role,
        approvalStatus: profile?.approvalStatus,
      });
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    console.log("[AdminDashboard] Fetching dashboard tables", {
      role: profile?.role,
      approvalStatus: profile?.approvalStatus,
    });
    const [usersResult, wardsResult, reportsResult, emergencyResult, auditResult] =
      await Promise.all([
        supabase
          .from("users")
          .select("*")
          .order("createdAt", { ascending: false }),
        supabase.from("wards").select("id, ward_number"),
        supabase
          .from("reports")
          .select("*")
          .order("createdAt", { ascending: false }),
        supabase
          .from("emergencyRequests")
          .select("*")
          .order("createdAt", { ascending: false }),
        supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const tableErrors = [
      usersResult.error ? `users: ${usersResult.error.message}` : null,
      wardsResult.error ? `wards: ${wardsResult.error.message}` : null,
      reportsResult.error ? `reports: ${reportsResult.error.message}` : null,
      emergencyResult.error
        ? `emergencyRequests: ${emergencyResult.error.message}`
        : null,
      auditResult.error ? `audit_logs: ${auditResult.error.message}` : null,
    ].filter(Boolean);
    console.log("[AdminDashboard] Table fetch results", {
      users: usersResult.data?.length || 0,
      reports: reportsResult.data?.length || 0,
      emergencies: emergencyResult.data?.length || 0,
      auditLogs: auditResult.data?.length || 0,
      errors: tableErrors,
    });
    if (tableErrors.length > 0) {
      console.warn(
        "[AdminDashboard] One or more table fetches failed",
        tableErrors,
      );
      setError(tableErrors.join(" | "));
    }
    const wardNumbersById = new Map(
      (wardsResult.data || []).map((ward) => [ward.id, ward.ward_number]),
    );
    setUsers(
      ((usersResult.data || []) as UserRow[]).map((user) => ({
        ...user,
        wardNumber: user.ward_id
          ? wardNumbersById.get(user.ward_id) || null
          : null,
      })),
    );
    setReports((reportsResult.data || []) as ReportRow[]);
    setEmergencies((emergencyResult.data || []) as EmergencyRow[]);
    setAuditLogs((auditResult.data || []) as AuditRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(loadDashboard, 0);
    const { data: authListener } = supabase.auth.onAuthStateChange(() =>
      loadDashboard(),
    );
    return () => {
      clearTimeout(initialLoad);
      authListener.subscription.unsubscribe();
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!sessionUserId) return;
    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        loadDashboard,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        loadDashboard,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergencyRequests" },
        loadDashboard,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        loadDashboard,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard, sessionUserId]);

  const selectedNav =
    navItems.find((item) => item.id === activeSection) ?? navItems[0];
  const metrics = useMemo(() => {
    const activeEmergencies = emergencies.filter((item) =>
      ["active", "pending", "open", "in_review"].includes(
        `${item.status || ""}`.toLowerCase(),
      ),
    );
    const pendingReports = reports.filter(
      (item) => item.status === "pending_review",
    );
    return {
      activeEmergencies,
      pendingReports,
      pendingUsers: users.filter((item) => item.approvalStatus === "pending"),
      recentUsers: users.filter((item) => daysSince(item.createdAt) <= 7)
        .length,
      recentReports: reports.filter((item) => daysSince(item.createdAt) <= 7)
        .length,
      recentEmergencies: emergencies.filter(
        (item) => daysSince(item.createdAt) <= 7,
      ).length,
      wardCount: new Set(
        [
          ...users.map((item) => item.ward_id || item.wardName),
          ...reports.map((item) => item.ward_id),
          ...emergencies.map((item) => item.ward_id),
        ].filter(Boolean),
      ).size,
    };
  }, [emergencies, reports, users]);

  const roleOptions = Array.from(
    new Set(users.map((user) => user.role).filter(Boolean)),
  ) as string[];
  const statusOptions = Array.from(
    new Set([
      ...users.map((user) => user.approvalStatus).filter(Boolean),
      ...reports.map((report) => report.status).filter(Boolean),
      ...emergencies.map((emergency) => emergency.status).filter(Boolean),
    ]),
  ) as string[];
  const locationOptions = Array.from(
    new Set(
      users
        .map((user) => user.wardName || user.location || user.ward_id)
        .filter(Boolean),
    ),
  ) as string[];
  const emergencyTypeOptions = Array.from(
    new Set(emergencies.map((row) => row.emergencyType).filter(Boolean)),
  ) as string[];
  const reportTypeOptions = Array.from(
    new Set(reports.map((row) => row.reportType).filter(Boolean)),
  ) as string[];
  const pageFor = (section: string) => pageBySection[section] || 1;
  const setPageFor = (section: string, page: number) =>
    setPageBySection((current) => ({
      ...current,
      [section]: Math.max(1, page),
    }));
  const paginate = <T,>(rows: T[], section: string) => {
    const page = pageFor(section);
    return rows.slice((page - 1) * pageSize, page * pageSize);
  };
  const pageCount = (rows: unknown[]) =>
    Math.max(1, Math.ceil(rows.length / pageSize));

  const filteredUsers = users.filter((user) => {
    const haystack =
      `${getName(user)} ${user.email || ""} ${user.phoneNumber || ""} ${user.wardName || ""} ${user.location || ""}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (roleFilter === "all" || user.role === roleFilter) &&
      (statusFilter === "all" || user.approvalStatus === statusFilter) &&
      (locationFilter === "all" ||
        user.wardName === locationFilter ||
        user.location === locationFilter ||
        user.ward_id === locationFilter)
    );
  });
  const filteredEmergencies = emergencies.filter((row) => {
    const haystack =
      `${row.id} ${row.userName || ""} ${row.userPhone || ""} ${row.emergencyType || ""} ${row.description || ""} ${getLocationLabel(row.location)}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (statusFilter === "all" || row.status === statusFilter) &&
      (emergencyTypeFilter === "all" ||
        row.emergencyType === emergencyTypeFilter) &&
      (locationFilter === "all" || row.ward_id === locationFilter)
    );
  });
  const filteredReports = reports.filter((row) => {
    const haystack =
      `${row.id} ${row.reportType || ""} ${row.crimeCategory || ""} ${row.otherCategory || ""} ${row.description || ""} ${getLocationLabel(row.location)}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (statusFilter === "all" || row.status === statusFilter) &&
      (reportTypeFilter === "all" || row.reportType === reportTypeFilter) &&
      (locationFilter === "all" || row.ward_id === locationFilter)
    );
  });
  const filteredAuditLogs = auditLogs.filter((log) => {
    const fields = getAuditFields(log).map(humanizeAuditField).join(" ");
    const haystack =
      `${getAuditSummary(log)} ${log.operation || ""} ${getAuditResource(log)} ${getAuditActor(log)} ${getAuditRecordLabel(log) || ""} ${fields}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (statusFilter === "all" ||
        log.operation === statusFilter ||
        log.table_name === statusFilter)
    );
  });

  const reportMix = reportTypes.map((type) => ({
    name: type.name,
    value: reports.filter(
      (report) =>
        report.reportType === type.key ||
        report.reportType === type.name.toLowerCase(),
    ).length,
    color: type.color,
  }));
  const roleMix = [
    "resident",
    "community_leader",
    "community_protection_service",
    "admin",
  ].map((role) => ({
    role: roleLabels[role],
    count: users.filter((user) => user.role === role).length,
  }));
  const activityData = ["6d", "5d", "4d", "3d", "2d", "1d", "Today"].map(
    (label, index) => {
      const daysAgo = 6 - index;
      return {
        day: label,
        users: users.filter((row) => daysSince(row.createdAt) === daysAgo)
          .length,
        reports: reports.filter((row) => daysSince(row.createdAt) === daysAgo)
          .length,
        alerts: emergencies.filter(
          (row) => daysSince(row.createdAt) === daysAgo,
        ).length,
      };
    },
  );

  const passwordUpdatedAt = sessionUser?.user_metadata?.password_updated_at as
    | string
    | undefined;
  const mustChangePassword =
    !!sessionUser && daysSince(passwordUpdatedAt) >= 90;

  const updateUserRole = async (user: UserRow, role: string) => {
    if (user.approvalStatus === "blocked") return;
    if (
      !window.confirm(`Change ${getName(user)} to ${roleLabels[role] || role}?`)
    )
      return;
    setUpdatingId(user.id);
    const { error: updateError } = await supabase
      .from("users")
      .update({ role, requestedRole: null, approvalStatus: "approved" })
      .eq("id", user.id);
    setUpdatingId(null);
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice(`${getName(user)} was updated to ${roleLabels[role] || role}.`);
    }
    await loadDashboard();
  };
  const blockUser = async (user: UserRow) => {
    if (user.role === "admin" || user.approvalStatus === "blocked") return;
    if (
      !window.confirm(
        `Block ${getName(user)}? They will no longer be able to sign in.`,
      )
    ) {
      return;
    }

    setUpdatingId(user.id);
    setError(null);
    setNotice(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Your admin session has expired. Sign in again.");
      }

      const response = await fetch("/api/admin/users/block", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Could not block this user.");
      }

      setNotice(`${getName(user)} has been blocked from signing in.`);
      await loadDashboard();
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Could not block this user.",
      );
    } finally {
      setUpdatingId(null);
    }
  };
  const deleteUser = async (user: UserRow) => {
    if (user.role === "admin" || user.id === sessionUserId) return;
    if (
      !window.confirm(
        `Permanently delete ${getName(user)}? Their sign-in, profile, emergency contacts, and saved pinpoints will be removed. Historical reports and emergency records will be retained with identifying account details anonymized. Existing access tokens may remain valid until they expire. Use Block to prevent sign-in without deleting the account.`,
      )
    ) {
      return;
    }

    setUpdatingId(user.id);
    setError(null);
    setNotice(null);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session?.access_token) {
        throw new Error("Your admin session has expired. Sign in again.");
      }

      const response = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Could not delete this user.");
      }

      setNotice(`${getName(user)} was permanently deleted.`);
      await loadDashboard();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this user.",
      );
    } finally {
      setUpdatingId(null);
    }
  };
  const updateEmergencyStatus = async (row: EmergencyRow, status: string) => {
    if (row.status === status) return;
    if (
      !window.confirm(
        `Change emergency ${row.id} to ${status.replace("_", " ")}?`,
      )
    )
      return;
    setUpdatingId(row.id);
    const { error: updateError } = await supabase
      .from("emergencyRequests")
      .update({ status })
      .eq("id", row.id);
    setUpdatingId(null);
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice(
        `Emergency ${row.id} was updated to ${status.replace("_", " ")}.`,
      );
    }
    await loadDashboard();
  };
  const updateReportStatus = async (row: ReportRow, status: string) => {
    if (row.status === status) return;
    if (
      !window.confirm(
        `${status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Move"} report ${row.id}?`,
      )
    )
      return;
    setUpdatingId(row.id);
    const { error: updateError } = await supabase
      .from("reports")
      .update({ status, moderatedAt: new Date().toISOString() })
      .eq("id", row.id);
    setUpdatingId(null);
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice(`Report ${row.id} was updated to ${status.replace("_", " ")}.`);
    }
    await loadDashboard();
  };

  const downloadExport = (label: string, rows: Record<string, unknown>[]) => {
    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map((row) =>
        Object.values(row)
          .map((value) => `"${`${value ?? ""}`.replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${label.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!sessionUser) return <LoginCard onSignedIn={loadDashboard} />;
  if (mustChangePassword)
    return (
      <PasswordChangeCard
        user={sessionUser}
        onDone={async () => {
          console.log(
            "[AdminPassword] Returning to login after password update",
          );
          await supabase.auth.signOut();
          await loadDashboard();
        }}
      />
    );
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading admin
        dashboard...
      </main>
    );
  }
  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-8">
        <section className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-zinc-950">Admin access required</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {error ||
              "This account does not have an approved admin profile. Ask the project owner to grant admin access."}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </section>
      </main>
    );
  }
  const renderSection = () => {
    if (activeSection === "users") {
      return (
        <Panel
          title="User Management"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadExport(
                  "Users",
                  users as unknown as Record<string, unknown>[],
                )
              }
            >
              <Download /> CSV
            </Button>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Search users"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role] || role}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="all">All locations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Approve Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginate(filteredUsers, "users").map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-zinc-950">{getName(user)}</p>
                      <p className="text-zinc-500">
                        {user.email || user.phoneNumber || user.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {roleLabels[user.role || ""] || user.role || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {user.wardNumber
                        ? `Ward ${user.wardNumber}`
                        : user.wardName || "Not assigned"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={user.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {[
                          "resident",
                          "community_leader",
                          "community_protection_service",
                          "admin",
                        ].map((role) => (
                          <Button
                            key={role}
                            variant={user.role === role ? "default" : "outline"}
                            size="xs"
                            disabled={
                              updatingId === user.id ||
                              user.approvalStatus === "blocked"
                            }
                            onClick={() => updateUserRole(user, role)}
                          >
                            {roleLabels[role]}
                          </Button>
                        ))}
                        <Button
                          variant={
                            user.approvalStatus === "blocked"
                              ? "outline"
                              : "destructive"
                          }
                          size="xs"
                          disabled={
                            updatingId === user.id ||
                            user.approvalStatus === "blocked" ||
                            user.role === "admin"
                          }
                          onClick={() => blockUser(user)}
                          title={
                            user.role === "admin"
                              ? "Admin accounts cannot be blocked here"
                              : undefined
                          }
                        >
                          {user.approvalStatus === "blocked" ? "Blocked" : "Block"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          disabled={
                            updatingId === user.id ||
                            user.role === "admin" ||
                            user.id === sessionUserId
                          }
                          onClick={() => deleteUser(user)}
                          title={
                            user.role === "admin"
                              ? "Admin accounts cannot be deleted here"
                              : user.id === sessionUserId
                                ? "You cannot delete your own admin account"
                                : undefined
                          }
                        >
                          {updatingId === user.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="No users match the current filters." />
            </div>
          ) : null}
          <div className="mt-3">
            <PaginationControls
              page={pageFor("users")}
              pages={pageCount(filteredUsers)}
              total={filteredUsers.length}
              onPage={(page) => setPageFor("users", page)}
            />
          </div>
        </Panel>
      );
    }

    if (activeSection === "emergencies") {
      return (
        <Panel
          title="Emergency Management"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadExport(
                  "Emergency Alerts",
                  emergencies as unknown as Record<string, unknown>[],
                )
              }
            >
              <Download /> CSV
            </Button>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Search emergencies"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={emergencyTypeFilter}
              onChange={(event) => setEmergencyTypeFilter(event.target.value)}
            >
              <option value="all">All emergency types</option>
              {emergencyTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="all">All wards</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {paginate(filteredEmergencies, "emergencies").map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4 transition hover:border-blue-300"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-red-50 text-red-700">
                    <Siren className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-zinc-950">
                      {row.emergencyType || "Emergency"} alert
                    </p>
                    <p className="text-sm text-zinc-500">
                      {row.userName || "Unknown resident"} ·{" "}
                      {formatDate(row.createdAt)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {row.description || "No description provided."}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="size-3" />
                      {getLocationLabel(row.location)}
                    </p>
                  </div>
                  <Badge value={row.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedEmergency(row)}
                  >
                    View details
                  </Button>
                  {["active", "in_review", "resolved"].map((status) => (
                    <Button
                      key={status}
                      variant={row.status === status ? "default" : "outline"}
                      size="sm"
                      disabled={updatingId === row.id}
                      onClick={() => updateEmergencyStatus(row, status)}
                    >
                      {status.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {filteredEmergencies.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="No emergency records match the current filters." />
            </div>
          ) : null}
          <div className="mt-3">
            <PaginationControls
              page={pageFor("emergencies")}
              pages={pageCount(filteredEmergencies)}
              total={filteredEmergencies.length}
              onPage={(page) => setPageFor("emergencies", page)}
            />
          </div>
        </Panel>
      );
    }

    if (activeSection === "reports") {
      return (
        <Panel
          title="Community Reports"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadExport(
                  "Reports",
                  reports as unknown as Record<string, unknown>[],
                )
              }
            >
              <Download /> CSV
            </Button>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Search reports"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 px-3 text-sm"
              value={reportTypeFilter}
              onChange={(event) => setReportTypeFilter(event.target.value)}
            >
              <option value="all">All report categories</option>
              {reportTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="all">All dates</option>
            </select>
          </div>
          <div className="space-y-3">
            {paginate(
              filteredReports.filter(
                (row) =>
                  datePreset === "all" ||
                  daysSince(row.createdAt) <= Number(datePreset),
              ),
              "reports",
            ).map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-zinc-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black capitalize text-zinc-950">
                      {row.reportType || "Report"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {formatDate(row.createdAt)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {row.description || "No description provided."}
                    </p>
                  </div>
                  <Badge value={row.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedReport(row)}
                  >
                    View details
                  </Button>
                  {[
                    ["pending_review", "Review"],
                    ["approved", "Approve"],
                    ["rejected", "Reject"],
                  ].map(([status, label]) => (
                    <Button
                      key={status}
                      variant={row.status === status ? "default" : "outline"}
                      size="sm"
                      disabled={updatingId === row.id}
                      onClick={() => updateReportStatus(row, status)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {filteredReports.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="No reports match the current filters." />
            </div>
          ) : null}
          <div className="mt-3">
            <PaginationControls
              page={pageFor("reports")}
              pages={pageCount(filteredReports)}
              total={filteredReports.length}
              onPage={(page) => setPageFor("reports", page)}
            />
          </div>
        </Panel>
      );
    }

    if (activeSection === "audit") {
      return (
        <Panel title="Audit Logs">
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-blue-500"
              placeholder="Search audit logs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All actions/resources</option>
              {Array.from(
                new Set(
                  auditLogs
                    .flatMap((log) => [log.operation, log.table_name])
                    .filter(Boolean),
                ),
              ).map((value) => (
                <option key={value} value={value || ""}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-zinc-200 px-3 text-sm"
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="all">All dates</option>
            </select>
          </div>
          <div className="space-y-3">
            {paginate(
              filteredAuditLogs.filter(
                (log) =>
                  datePreset === "all" ||
                  daysSince(log.created_at) <= Number(datePreset),
              ),
              "audit",
            ).map((log) => (
              <div
                key={log.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-blue-300"
                onClick={() => setSelectedAuditLog(log)}
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <ReceiptText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-zinc-950">{getAuditSummary(log)}</p>
                  <p className="text-sm text-zinc-500">
                    {getAuditActor(log)} · {formatDate(log.created_at)}
                  </p>
                  {getAuditRecordLabel(log) ? (
                    <p className="mt-1 text-sm text-zinc-700">{getAuditRecordLabel(log)}</p>
                  ) : null}
                  {getAuditFields(log).length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Changed: {getAuditFields(log).slice(0, 4).map(humanizeAuditField).join(", ")}
                      {getAuditFields(log).length > 4 ? ` +${getAuditFields(log).length - 4} more` : ""}
                    </p>
                  ) : null}</div>
              </div>
            ))}
          </div>
          {filteredAuditLogs.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="No audit logs match the current filters." />
            </div>
          ) : null}
          <div className="mt-3">
            <PaginationControls
              page={pageFor("audit")}
              pages={pageCount(filteredAuditLogs)}
              total={filteredAuditLogs.length}
              onPage={(page) => setPageFor("audit", page)}
            />
          </div>
        </Panel>
      );
    }

    if (activeSection === "analytics") {
      return (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <Panel title="Community Activity">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="reports"
                    stroke="#2563eb"
                    fill="#bfdbfe"
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    stroke="#dc2626"
                    fill="#fecaca"
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#16a34a"
                    fill="#bbf7d0"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Report Mix">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {reportMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      );
    }

    if (activeSection === "exports") {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Users", users],
            ["Reports", reports],
            ["Emergency Alerts", emergencies],
            ["Audit Logs", auditLogs],
          ].map(([label, rows]) => (
            <button
              key={label as string}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40"
              onClick={() =>
                downloadExport(
                  label as string,
                  rows as Record<string, unknown>[],
                )
              }
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Download className="size-5" />
              </div>
              <h2 className="mt-4 font-bold text-zinc-950">
                {label as string} Export
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {formatNumber((rows as unknown[]).length)} database rows as CSV.
              </p>
            </button>
          ))}
        </div>
      );
    }

    if (activeSection === "monitoring") {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="System Health">
            {[
              [
                "Supabase Data Sync",
                "online",
                `${formatNumber(users.length + reports.length + emergencies.length + auditLogs.length)} records loaded`,
                "text-emerald-600",
              ],
              [
                "Realtime Subscriptions",
                "active",
                "Listening for users, reports, emergency requests, and audit logs",
                "text-emerald-600",
              ],
              [
                "Emergency Queue",
                metrics.activeEmergencies.length ? "attention" : "clear",
                `${metrics.activeEmergencies.length} active emergency alert records`,
                metrics.activeEmergencies.length
                  ? "text-amber-600"
                  : "text-emerald-600",
              ],
              [
                "Moderation Queue",
                metrics.pendingReports.length ? "pending" : "clear",
                `${metrics.pendingReports.length} reports awaiting review`,
                metrics.pendingReports.length
                  ? "text-amber-600"
                  : "text-emerald-600",
              ],
            ].map(([label, status, detail, color]) => (
              <div
                key={label}
                className="flex items-center gap-3 border-b border-zinc-100 py-3 last:border-0"
              >
                <span
                  className={cn("size-2.5 rounded-full bg-current", color)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-zinc-950">{label}</p>
                  <p className="text-sm text-zinc-500">{detail}</p>
                </div>
                <span className={cn("text-xs font-black uppercase", color)}>
                  {status}
                </span>
              </div>
            ))}
          </Panel>
          <Panel title="Role Distribution">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleMix}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="role" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      );
    }

    if (activeSection === "profile") {
      return (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Admin Profile">
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-bold text-zinc-700">Email:</span>{" "}
                {sessionUser.email || "Not available"}
              </p>
              <p>
                <span className="font-bold text-zinc-700">User ID:</span>{" "}
                {sessionUser.id}
              </p>
              <p>
                <span className="font-bold text-zinc-700">Last password update:</span>{" "}
                {formatDate(
                  sessionUser.user_metadata?.password_updated_at as
                    | string
                    | undefined,
                )}
              </p>
            </div>
          </Panel>
          <Panel title="Change Password">
            <ProfilePasswordForm user={sessionUser} onUpdated={loadDashboard} />
          </Panel>
        </div>
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Users"
              value={formatNumber(users.length)}
              detail={`${metrics.pendingUsers.length} approval pending`}
              icon={Users}
              tone="bg-blue-50 text-blue-700"
              onClick={() => setActiveSection("users")}
            />
            <StatCard
              label="Active Alerts"
              value={formatNumber(metrics.activeEmergencies.length)}
              detail="Open or in review right now"
              icon={Radio}
              tone="bg-red-50 text-red-700"
              onClick={() => setActiveSection("emergencies")}
            />
            <StatCard
              label="Pending Reports"
              value={formatNumber(metrics.pendingReports.length)}
              detail="Awaiting moderation"
              icon={Clock3}
              tone="bg-amber-50 text-amber-700"
              onClick={() => setActiveSection("reports")}
            />
            <StatCard
              label="Represented Wards"
              value={formatNumber(metrics.wardCount)}
              detail="Unique ward IDs or ward names visible"
              icon={MapPin}
              tone="bg-emerald-50 text-emerald-700"
              onClick={() => setActiveSection("users")}
            />
          </div>
          <Panel title="Operational Activity">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="reports"
                    stroke="#2563eb"
                    fill="#bfdbfe"
                  />
                  <Area
                    type="monotone"
                    dataKey="alerts"
                    stroke="#dc2626"
                    fill="#fecaca"
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#16a34a"
                    fill="#bbf7d0"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel title="Command Summary">
            <div className="space-y-3">
              {[
                {
                  label: "SOS readiness",
                  value: metrics.activeEmergencies.length
                    ? "Attention"
                    : "Clear",
                  icon: ShieldCheck,
                  color: "bg-emerald-50 text-emerald-700",
                },
                {
                  label: "New users",
                  value: formatNumber(metrics.recentUsers),
                  icon: Activity,
                  color: "bg-blue-50 text-blue-700",
                },
                {
                  label: "New reports",
                  value: formatNumber(metrics.recentReports),
                  icon: CheckCircle2,
                  color: "bg-zinc-100 text-zinc-700",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3"
                >
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      item.color,
                    )}
                  >
                    <item.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">{item.label}</p>
                    <p className="font-black text-zinc-950">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Report Mix">
            <div className="space-y-3">
              {reportMix.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold text-zinc-800">
                      {item.name}
                    </span>
                    <span className="text-zinc-500">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, item.value * 8)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-zinc-200 bg-white transition lg:static lg:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-zinc-100 px-5">
            <div>
              <p className="text-lg font-black">Comm-Connect</p>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                Admin Console
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation"
            >
              <X />
            </Button>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id as AdminSection);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>
        {mobileMenuOpen ? (
          <button
            className="fixed inset-0 z-30 bg-zinc-950/40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation overlay"
          />
        ) : null}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase text-zinc-500">
                  {selectedNav.label}
                </p>
                <h1 className="truncate text-base font-black text-zinc-950 sm:text-xl">
                  Community operations dashboard
                </h1>
              </div>
              <div className="hidden h-10 min-w-80 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 md:flex">
                <Search className="size-4" />
                Search users, reports, alerts
              </div>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Notifications"
              >
                <Bell />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => supabase.auth.signOut()}
              >
                <span className="hidden sm:inline">Sign out</span> <ChevronDown />
              </Button>
            </div>
          </header>
          <section className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
            <div className="mb-5 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-2xl font-black text-zinc-950">
                  Admin Dashboard
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button variant="outline" onClick={loadDashboard}>
                  <Activity /> Refresh
                </Button>
                <Button onClick={() => setActiveSection("emergencies")}>
                  <AlertCircle /> Review urgent
                </Button>
              </div>
            </div>
            {error ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}
            {notice ? (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                <span>{notice}</span>
                <button
                  className="text-emerald-900"
                  onClick={() => setNotice(null)}
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            {renderSection()}
            {selectedEmergency ? (
              <Panel
                title={`Emergency Details · ${selectedEmergency.id}`}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEmergency(null)}
                  >
                    <X /> Close
                  </Button>
                }
              >
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p>
                    <strong>Type:</strong>{" "}
                    {selectedEmergency.emergencyType || "Not provided"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {selectedEmergency.status || "pending"}
                  </p>
                  <p>
                    <strong>Resident:</strong>{" "}
                    {selectedEmergency.userName || "Unknown"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {selectedEmergency.userPhone || "Not available"}
                  </p>
                  <p>
                    <strong>Created:</strong>{" "}
                    {formatDate(selectedEmergency.createdAt)}
                  </p>
                  <p>
                    <strong>Responder:</strong>{" "}
                    {selectedEmergency.responderName ||
                      selectedEmergency.responderId ||
                      "Unassigned"}
                  </p>
                  <p className="md:col-span-2">
                    <strong>Location:</strong>{" "}
                    {getLocationLabel(selectedEmergency.location)}
                  </p>
                  <p className="md:col-span-2">
                    <strong>Description:</strong>{" "}
                    {selectedEmergency.description ||
                      "No description provided."}
                  </p>
                </div>
              </Panel>
            ) : null}
            {selectedReport ? (
              <Panel
                title={`Report Details · ${selectedReport.id}`}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedReport(null)}
                  >
                    <X /> Close
                  </Button>
                }
              >
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <p>
                    <strong>Category:</strong>{" "}
                    {selectedReport.reportType || "Report"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {selectedReport.status || "pending_review"}
                  </p>
                  <p>
                    <strong>Created:</strong>{" "}
                    {formatDate(selectedReport.createdAt)}
                  </p>
                  <p>
                    <strong>Submitted by:</strong>{" "}
                    {selectedReport.submittedBy ||
                      selectedReport.userId ||
                      "Unknown"}
                  </p>
                  <p className="md:col-span-2">
                    <strong>Location:</strong>{" "}
                    {getLocationLabel(selectedReport.location)}
                  </p>
                  <p className="md:col-span-2">
                    <strong>Description:</strong>{" "}
                    {selectedReport.description || "No description provided."}
                  </p>
                  {selectedReport.photoUrls?.length ? (
                    <div className="md:col-span-2">
                      <strong>Attachments:</strong>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedReport.photoUrls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-zinc-200 px-2 py-1 text-blue-700"
                          >
                            Open image
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
            {selectedAuditLog ? (
              <Panel
                title="Audit Log Details"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAuditLog(null)}
                  >
                    <X /> Close
                  </Button>
                }
              >
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600">
                    Personal values are protected in audit history. The event, resource, time, and changed field names remain available here.
                  </p>
                  <div className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2">
                    <p><strong>Action:</strong> {getAuditAction(selectedAuditLog.operation)}</p>
                    <p><strong>Resource:</strong> {getAuditResource(selectedAuditLog)}</p>
                    <p><strong>Actor:</strong> {getAuditActor(selectedAuditLog)}</p>
                    <p><strong>When:</strong> {formatDate(selectedAuditLog.created_at)}</p>
                    <p className="sm:col-span-2"><strong>Record:</strong> {getAuditRecordLabel(selectedAuditLog) || "Not available"}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-zinc-900">Changed fields</h3>
                    {getAuditFields(selectedAuditLog).length ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {getAuditFields(selectedAuditLog).map((field) => (
                          <li key={field} className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                            {humanizeAuditField(field)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-500">No field-level details are available for this event.</p>
                    )}
                  </div>
                </div>
              </Panel>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}

