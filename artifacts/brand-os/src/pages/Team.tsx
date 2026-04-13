import { useState, useEffect } from "react";
import { Users, PlusCircle, Shield, Edit3, Trash2, Crown, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-yellow-500" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-500" },
  editor: { label: "Editor", icon: Edit3, color: "text-muted-foreground" },
};

export default function Team() {
  const { workspace, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor">("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchMembers = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${baseUrl}/api/workspaces/${workspace.id}/members`);
      if (res.ok) setMembers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [workspace?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInviting(true);
    try {
      const res = await apiFetch(`${baseUrl}/api/workspaces/${workspace?.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to invite");
      }
      setSuccess(`${inviteEmail} has been added to the workspace.`);
      setInviteEmail("");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    if (!confirm("Remove this member from the workspace?")) return;
    await apiFetch(`${baseUrl}/api/workspaces/${workspace?.id}/members/${memberId}`, { method: "DELETE" });
    setMembers((m) => m.filter((mem) => mem.id !== memberId));
  };

  const myMember = members.find((m) => m.id === user?.id);
  const canManage = myMember && ["owner", "admin"].includes(myMember.role);

  if (!workspace) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage members of <strong>{workspace.name}</strong>.</p>
      </div>

      {canManage && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Invite Member</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm mb-4">
              {success}
            </div>
          )}

          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="colleague@company.com"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "editor")}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              {inviting ? "Inviting..." : "Invite"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{members.length} Member{members.length !== 1 ? "s" : ""}</h2>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted animate-pulse rounded w-32" />
                  <div className="h-3 bg-muted animate-pulse rounded w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => {
              const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.editor;
              const RoleIcon = roleInfo.icon;
              const isMe = member.id === user?.id;
              return (
                <div key={member.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold text-sm">{member.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <div className={cn("flex items-center gap-1.5 text-xs font-medium", roleInfo.color)}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {roleInfo.label}
                  </div>
                  {canManage && !isMe && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
