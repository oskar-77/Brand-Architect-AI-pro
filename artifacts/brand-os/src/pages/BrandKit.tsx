import { useParams, Link } from "wouter";
import { useState } from "react";
import { useGetBrand, useGetBrandStats, useGenerateCampaign, getGetBrandQueryKey, getGetBrandStatsQueryKey, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Loader2, Megaphone, Building2, Globe, Palette, MessageSquare, Users, Layers, Edit, X, Image as ImageIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-16 h-16 rounded-xl border border-black/10 shadow-sm"
        style={{ backgroundColor: color }}
      />
      <div className="text-center">
        <p className="text-[11px] font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground font-mono">{color}</p>
      </div>
    </div>
  );
}

const styleLabels: Record<string, { label: string; className: string }> = {
  tech: { label: "Tech", className: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300" },
  luxury: { label: "Luxury", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
  bold: { label: "Bold", className: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-300" },
  minimal: { label: "Minimal", className: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300" },
};

export default function BrandKit() {
  const params = useParams<{ id: string }>();
  const brandId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [brief, setBrief] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [postCount, setPostCount] = useState(7);
  const [generating, setGenerating] = useState(false);
  const briefFileRef = useState<HTMLInputElement | null>(null);

  const { data: brand, isLoading } = useGetBrand(brandId, {
    query: { enabled: !!brandId, queryKey: getGetBrandQueryKey(brandId) },
  });
  const { data: stats } = useGetBrandStats(brandId, {
    query: { enabled: !!brandId, queryKey: getGetBrandStatsQueryKey(brandId) },
  });

  const generateCampaign = useGenerateCampaign();

  function handleRefImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 512;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.75);
          setReferenceImages((prev) => [...prev.slice(0, 2), compressed]);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  async function handleGenerateCampaign() {
    setGenerating(true);
    setShowBriefModal(false);
    try {
      const campaign = await generateCampaign.mutateAsync({
        id: brandId,
        data: {
          brief: brief.trim() || undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          postCount,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey(brandId) });
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Brand not found</p>
        <Link href="/" className="text-primary text-sm hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const kit = brand.brandKit;
  const style = styleLabels[kit?.visualStyle ?? "minimal"] ?? styleLabels.minimal;

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      {/* Campaign Brief Modal */}
      {showBriefModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-card-border shadow-xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">Campaign Brief</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Tell the AI how you want your campaign to look and feel</p>
              </div>
              <button onClick={() => setShowBriefModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center justify-between">
                <span>Number of Posts</span>
                <span className="text-primary font-bold text-base">{postCount}</span>
              </label>
              <input
                type="range"
                min={1}
                max={14}
                value={postCount}
                onChange={(e) => setPostCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>1 post</span>
                <span>14 posts</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Campaign Instructions</label>
              <textarea
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={5}
                placeholder={`Examples:
• Focus on converting new leads, use urgency and social proof
• Promote our summer sale with a fun and vibrant tone
• Target young professionals 25-35, keep it minimal and premium
• Campaign for product launch week — build excitement gradually`}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5" />
                Reference Images (optional, max 3)
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt={`ref ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-card-border" />
                    <button
                      onClick={() => setReferenceImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 3 && (
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleRefImageUpload} />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">These images will guide the visual style of the campaign posts</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBriefModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCampaign}
                disabled={generating}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/" className="flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.companyName} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">{brand.companyName}</h1>
                <p className="text-sm text-muted-foreground">{brand.industry}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {kit && (
                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border", style.className)}>
                  {style.label} Style
                </span>
              )}
              <Link
                href={`/brands/${brandId}/edit`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Link>
              <Link
                href={`/brands/${brandId}/campaigns`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Campaigns ({stats?.totalCampaigns ?? 0})
              </Link>
              <button
                onClick={() => setShowBriefModal(true)}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? "Generating..." : "Generate Campaign"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {!kit ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">Brand kit not generated yet</h3>
          <p className="text-sm text-muted-foreground">Go to the brand wizard to generate your brand kit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left col */}
          <div className="lg:col-span-2 space-y-5">
            {/* Color Palette */}
            <div className="rounded-xl border border-card-border bg-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Color Palette</h2>
              </div>
              <div className="flex flex-wrap gap-6">
                {Object.entries(kit.colorPalette).map(([key, color]) => (
                  <ColorSwatch key={key} color={color as string} label={key.charAt(0).toUpperCase() + key.slice(1)} />
                ))}
              </div>
            </div>

            {/* Personality */}
            <div className="rounded-xl border border-card-border bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Brand Personality</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{kit.personality}</p>
            </div>

            {/* Positioning */}
            <div className="rounded-xl border border-card-border bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Market Positioning</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{kit.positioning}</p>
            </div>

            {/* Visual Style Rules */}
            <div className="rounded-xl border border-card-border bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Visual Style Rules</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{kit.visualStyleRules}</p>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-5">
            {/* Tone of Voice */}
            <div className="rounded-xl border border-card-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Tone of Voice</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{kit.toneOfVoice}</p>
            </div>

            {/* Audience Segments */}
            <div className="rounded-xl border border-card-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Audience Segments</h2>
              </div>
              <div className="space-y-2">
                {kit.audienceSegments.map((seg, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <p className="text-sm text-foreground">{seg}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Campaign CTA card */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Generate Campaign</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Tell the AI your campaign goals, style preferences, and any reference images — then get a complete 7-day plan with ready-to-publish posts.
              </p>
              <button
                onClick={() => setShowBriefModal(true)}
                disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generating ? "Generating..." : "Launch Campaign Wizard"}
              </button>
            </div>

            {/* Stats */}
            {stats && (
              <div className="rounded-xl border border-card-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-3">Brand Stats</h2>
                <div className="space-y-2">
                  {[
                    { label: "Campaigns", value: stats.totalCampaigns },
                    { label: "Posts", value: stats.totalPosts },
                    { label: "Brand Kit", value: stats.brandKitGenerated ? "Generated" : "Pending" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <span className="text-xs font-semibold text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
