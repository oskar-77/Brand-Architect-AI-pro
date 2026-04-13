import { Link } from "wouter";
import { useGetDashboardSummary, useListBrands, getGetDashboardSummaryQueryKey, getListBrandsQueryKey } from "@workspace/api-client-react";
import { Building2, Megaphone, FileText, PlusCircle, ArrowRight, Sparkles, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
    kit_ready: { label: "Kit Ready", className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    active: { label: "Active", className: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", s.className)}>
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: brands, isLoading: brandsLoading } = useListBrands({
    query: { queryKey: getListBrandsQueryKey() },
  });

  const stats = [
    {
      label: "Total Brands",
      value: summary?.totalBrands ?? 0,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Campaigns",
      value: summary?.totalCampaigns ?? 0,
      icon: Megaphone,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      label: "Social Posts",
      value: summary?.totalPosts ?? 0,
      icon: FileText,
      color: "text-cyan-500",
      bg: "bg-cyan-50 dark:bg-cyan-950",
    },
  ];

  const isLoading = summaryLoading || brandsLoading;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your brand intelligence platform at a glance.</p>
        </div>
        <Link
          href="/brands/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          New Brand
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-card-border bg-card p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", s.bg)}>
                <Icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                {isLoading ? (
                  <div className="h-6 w-10 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Brand Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Brand Projects
          </h2>
          <span className="text-xs text-muted-foreground">{brands?.length ?? 0} total</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : !Array.isArray(brands) || brands.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No brands yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create your first brand to generate a complete visual identity and marketing campaign with AI.
            </p>
            <Link
              href="/brands/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Create your first brand
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-card-border bg-card hover:bg-muted/30 transition-colors group"
              >
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.companyName}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{brand.companyName}</p>
                  <p className="text-xs text-muted-foreground">{brand.industry}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={brand.status} />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(brand.createdAt).toLocaleDateString()}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
