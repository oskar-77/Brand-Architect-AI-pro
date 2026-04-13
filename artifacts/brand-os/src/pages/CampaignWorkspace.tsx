import { useParams, Link } from "wouter";
import { useState } from "react";
import { useGetCampaign, useUpdatePost, useRegeneratePost, useGeneratePostImage, getGetCampaignQueryKey, getGetPostQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Edit3, Check, X, RefreshCw, Loader2, Hash, Image as ImageIcon, Megaphone, Sparkles, Wand2 } from "lucide-react";
import type { SocialPost } from "@workspace/api-client-react";

function PostCard({ post, onSave, onRegenerate, onGenerateImage }: {
  post: SocialPost;
  onSave: (id: number, data: Partial<SocialPost>) => Promise<void>;
  onRegenerate: (id: number) => Promise<void>;
  onGenerateImage: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [draft, setDraft] = useState({
    hook: post.hook,
    caption: post.caption,
    cta: post.cta,
    imagePrompt: post.imagePrompt,
    hashtags: post.hashtags.join(" "),
  });

  async function save() {
    setSaving(true);
    await onSave(post.id, {
      hook: draft.hook,
      caption: draft.caption,
      cta: draft.cta,
      imagePrompt: draft.imagePrompt,
      hashtags: draft.hashtags.split(/\s+/).filter(Boolean),
    });
    setSaving(false);
    setEditing(false);
  }

  async function regen() {
    setRegenerating(true);
    await onRegenerate(post.id);
    setRegenerating(false);
  }

  async function genImage() {
    setGeneratingImage(true);
    await onGenerateImage(post.id);
    setGeneratingImage(false);
  }

  function cancel() {
    setDraft({
      hook: post.hook,
      caption: post.caption,
      cta: post.cta,
      imagePrompt: post.imagePrompt,
      hashtags: post.hashtags.join(" "),
    });
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      {/* AI-generated image */}
      {post.imageUrl ? (
        <div className="relative">
          <img
            src={post.imageUrl}
            alt={`Day ${post.day} post visual`}
            className="w-full aspect-video object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button
            onClick={genImage}
            disabled={generatingImage}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium backdrop-blur-sm transition-colors disabled:opacity-60"
          >
            {generatingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {generatingImage ? "Generating..." : "Regenerate Image"}
          </button>
        </div>
      ) : (
        <div className="w-full aspect-video bg-muted/40 flex flex-col items-center justify-center gap-3 border-b border-card-border">
          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
          <button
            onClick={genImage}
            disabled={generatingImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generatingImage ? "Generating Image..." : "Generate AI Image"}
          </button>
          <p className="text-xs text-muted-foreground">Click to generate image from prompt</p>
        </div>
      )}

      {/* Day header */}
      <div className="px-5 py-3.5 bg-muted/30 border-b border-card-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {post.day}
          </div>
          <span className="text-sm font-semibold text-foreground">Day {post.day}</span>
          <span className="text-xs text-muted-foreground">{post.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancel}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={regen}
                disabled={regenerating}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border transition-colors"
              >
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {regenerating ? "Regenerating..." : "Regenerate"}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Hook */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hook</label>
          {editing ? (
            <input
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={draft.hook}
              onChange={(e) => setDraft((d) => ({ ...d, hook: e.target.value }))}
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{post.hook}</p>
          )}
        </div>

        {/* Caption */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Caption</label>
          {editing ? (
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={5}
              value={draft.caption}
              onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
            />
          ) : (
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{post.caption}</p>
          )}
        </div>

        {/* CTA */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Call to Action</label>
          {editing ? (
            <input
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={draft.cta}
              onChange={(e) => setDraft((d) => ({ ...d, cta: e.target.value }))}
            />
          ) : (
            <p className="text-sm text-primary font-medium">{post.cta}</p>
          )}
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Hashtags
          </label>
          {editing ? (
            <input
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              value={draft.hashtags}
              onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
              placeholder="#hashtag1 #hashtag2"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image Prompt */}
        <div className="rounded-lg bg-muted/40 p-3.5">
          <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" /> Image Prompt
          </label>
          {editing ? (
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={4}
              value={draft.imagePrompt}
              onChange={(e) => setDraft((d) => ({ ...d, imagePrompt: e.target.value }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">{post.imagePrompt}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignWorkspace() {
  const params = useParams<{ id: string }>();
  const campaignId = parseInt(params.id, 10);
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useGetCampaign(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) },
  });

  const updatePost = useUpdatePost();
  const regeneratePost = useRegeneratePost();
  const generatePostImage = useGeneratePostImage();

  async function handleSavePost(id: number, data: Partial<SocialPost>) {
    await updatePost.mutateAsync({ id, data: {
      caption: data.caption,
      hook: data.hook,
      cta: data.cta,
      hashtags: data.hashtags,
      imagePrompt: data.imagePrompt,
    }});
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
  }

  async function handleRegeneratePost(id: number) {
    await regeneratePost.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
  }

  async function handleGenerateImage(id: number) {
    await generatePostImage.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
    queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Campaign not found</p>
        <Link href="/" className="text-primary text-sm hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/brands/${campaign.brandId}/campaigns`}
          className="text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{campaign.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{(campaign.strategy ?? "").slice(0, 120)}...</p>
        </div>
      </div>

      {/* Campaign plan grid */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          Campaign Plan ({campaign.days?.length ?? 0} Days)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {campaign.days?.map((day) => (
            <div key={day.day} className="rounded-xl border border-card-border bg-card p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {day.day}
                </div>
                <span className="text-xs font-semibold text-foreground">Day {day.day}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{day.marketingAngle}</p>
              <p className="text-xs text-foreground leading-relaxed">{day.postConcept}</p>
              <div className="pt-1 border-t border-border">
                <p className="text-[11px] text-primary font-medium">{day.cta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Megaphone className="w-4 h-4 text-muted-foreground" />
          Social Posts ({campaign.posts?.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {campaign.posts
            ?.sort((a, b) => a.day - b.day)
            .map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onSave={handleSavePost}
                onRegenerate={handleRegeneratePost}
                onGenerateImage={handleGenerateImage}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
