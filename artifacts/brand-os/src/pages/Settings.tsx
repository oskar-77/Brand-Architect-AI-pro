import { useState } from "react";
import { User, Lock, Building2, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/auth";

export default function Settings() {
  const { user, workspace, workspaces, switchWorkspace } = useAuth();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and workspace preferences.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Account</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium text-foreground mt-0.5">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium text-foreground mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {workspaces.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Workspaces</h2>
          </div>
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                  workspace?.id === ws.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{ws.role ?? "member"}</p>
                </div>
                {workspace?.id === ws.id && (
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">About</h2>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>AI Brand & Marketing OS — SaaS Platform</p>
          <p>Powered by OpenAI GPT models via Replit AI Integrations</p>
          <p className="mt-3 text-[11px] text-muted-foreground/50">v2.0.0 — Production Build</p>
        </div>
      </div>
    </div>
  );
}
