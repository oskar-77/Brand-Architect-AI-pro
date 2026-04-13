import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateBrand, useGenerateBrandKit, getListBrandsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Globe, Upload, Check, Sparkles, Loader2, ChevronRight, ChevronLeft, X, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractColorsFromDataUrl } from "@/lib/colorExtractor";
import { useAuth } from "@/contexts/AuthContext";

const steps = [
  { id: 1, label: "Company Info" },
  { id: 2, label: "Logo Upload" },
  { id: 3, label: "Review" },
  { id: 4, label: "Generate" },
];

const industries = [
  "Technology", "SaaS", "E-commerce", "Fashion", "Luxury", "Health & Fitness",
  "Food & Beverage", "Finance", "Legal", "Real Estate", "Education", "Media",
  "Travel", "Beauty", "Consulting", "Non-profit", "Manufacturing", "Other",
];

export default function BrandWizard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { workspace } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    companyName: "",
    companyDescription: "",
    industry: "",
    websiteUrl: "",
    logoUrl: "",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [extractingColors, setExtractingColors] = useState(false);
  const [createdBrandId, setCreatedBrandId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const createBrand = useCreateBrand();
  const generateKit = useGenerateBrandKit();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        setLogoPreview(compressed);
        setForm((f) => ({ ...f, logoUrl: compressed }));

        setExtractingColors(true);
        const colors = await extractColorsFromDataUrl(compressed, 5);
        setExtractedColors(colors);
        setExtractingColors(false);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoPreview(null);
    setExtractedColors([]);
    setForm((f) => ({ ...f, logoUrl: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCreateAndGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const brand = await createBrand.mutateAsync({
        data: {
          companyName: form.companyName,
          companyDescription: form.companyDescription,
          industry: form.industry,
          websiteUrl: form.websiteUrl || null,
          logoUrl: form.logoUrl || null,
          brandColors: extractedColors.length > 0 ? extractedColors : undefined,
          ...(workspace ? { workspaceId: workspace.id } : {}),
        } as Parameters<typeof createBrand.mutateAsync>[0]["data"],
      });
      setCreatedBrandId(brand.id);

      await generateKit.mutateAsync({ id: brand.id, data: { brandColors: extractedColors.length > 0 ? extractedColors : undefined } });

      queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });

      setGenerated(true);
      setGenerating(false);

      setTimeout(() => {
        navigate(`/brands/${brand.id}`);
      }, 1500);
    } catch (err: unknown) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع. يرجى المحاولة مجدداً.";
      setError(msg);
    }
  }

  const canProceed1 = form.companyName.trim() && form.companyDescription.trim() && form.industry;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Create Brand Project</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate a complete brand identity in minutes.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                  step > s.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : step === s.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground bg-background"
                )}
              >
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              {i < steps.length - 1 && (
                <div className={cn("w-10 h-0.5 mx-1", step > s.id ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
        </div>

        {/* Step label */}
        <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-6">
          Step {step}: {steps[step - 1].label}
        </p>

        {/* Card */}
        <div className="rounded-2xl border border-card-border bg-card p-8 shadow-sm">
          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Company Name *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    placeholder="e.g. Acme Corp"
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Company Description *</label>
                <textarea
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Describe what your company does, who it serves, and what makes it unique..."
                  value={form.companyDescription}
                  onChange={(e) => update("companyDescription", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.companyDescription.length} / 500 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Industry *</label>
                <select
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                >
                  <option value="">Select industry...</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Website URL (optional)</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    placeholder="https://yourwebsite.com"
                    value={form.websiteUrl}
                    onChange={(e) => update("websiteUrl", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Logo Upload */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Upload your logo. The AI will extract your brand colors automatically and use them to build a consistent visual identity.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              {!logoPreview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG up to 10MB</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="rounded-xl border border-card-border bg-muted/30 p-6 flex items-center justify-center">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-h-40 max-w-full object-contain"
                      />
                    </div>
                    <button
                      onClick={removeLogo}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Change logo
                    </button>
                  </div>

                  {/* Extracted Colors */}
                  {extractingColors ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting brand colors from logo...
                    </div>
                  ) : extractedColors.length > 0 && (
                    <div className="rounded-lg bg-muted/40 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Colors extracted from logo</span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {extractedColors.map((color, i) => (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <div
                              className="w-10 h-10 rounded-lg border border-black/10 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] font-mono text-muted-foreground">{color}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-3">
                        ✓ These colors will be used as your brand palette
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">
                You can skip this step — AI will derive colors from your industry.
              </p>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Review your brand details before generating.</p>
              <div className="rounded-lg bg-muted/40 divide-y divide-border">
                {[
                  { label: "Company", value: form.companyName },
                  { label: "Industry", value: form.industry },
                  { label: "Website", value: form.websiteUrl || "—" },
                  { label: "Logo", value: logoPreview ? "Uploaded" : "Not uploaded" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0 pt-0.5">{row.label}</span>
                    <span className="text-sm text-foreground">{row.value}</span>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground block mb-1">Description</span>
                  <span className="text-sm text-foreground">{form.companyDescription}</span>
                </div>
                {extractedColors.length > 0 && (
                  <div className="px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground block mb-2">Extracted Colors</span>
                    <div className="flex items-center gap-2">
                      {extractedColors.map((color, i) => (
                        <div key={i} className="w-8 h-8 rounded-md border border-black/10" style={{ backgroundColor: color }} title={color} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Generate */}
          {step === 4 && (
            <div className="text-center py-4 space-y-6">
              {generated ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Brand kit generated!</h3>
                    <p className="text-sm text-muted-foreground mt-1">Redirecting to your brand dashboard...</p>
                  </div>
                </div>
              ) : generating ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">AI is building your brand kit...</h3>
                    <p className="text-sm text-muted-foreground mt-1">ChatGPT is analyzing your company profile.</p>
                  </div>
                  <div className="space-y-2 text-left">
                    {[
                      "Analyzing company profile and industry",
                      extractedColors.length > 0 ? "Using logo colors for palette" : "Deriving brand color palette",
                      "Building brand personality & positioning",
                      "Defining tone of voice & audience segments",
                    ].map((task) => (
                      <div key={task} className="flex items-center gap-3">
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Ready to generate</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                      ChatGPT will analyze your company and build a complete brand identity — personality, positioning, color palette, tone of voice, and visual style rules.
                    </p>
                  </div>
                  {extractedColors.length > 0 && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-muted-foreground">Using logo colors:</span>
                      {extractedColors.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                  {error && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left">
                      <strong className="font-semibold">خطأ:</strong> {error}
                    </div>
                  )}
                  <button
                    onClick={handleCreateAndGenerate}
                    className="w-full py-3 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {error ? "Try Again" : "Generate Brand Kit with AI"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : navigate("/"))}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancel" : "Back"}
            </button>
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canProceed1}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                step === 1 && !canProceed1
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
