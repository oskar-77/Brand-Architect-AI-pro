import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, postsTable, brandsTable, campaignsTable } from "@workspace/db";
import {
  GetPostParams,
  UpdatePostParams,
  UpdatePostBody,
  RegeneratePostParams,
  GeneratePostImageParams,
} from "@workspace/api-zod";
import { openai, generateImageBuffer } from "@workspace/integrations-openai-ai-server";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { getPostForUser } from "../lib/workspace";
import path from "path";
import fs from "fs";

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
const IMAGES_DIR = path.join(STORAGE_DIR, "images");
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const router: IRouter = Router();

router.get("/posts/:id", requireAuth, asyncHandler(async (req, res) => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const post = await getPostForUser(params.data.id, req.user!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json({ ...post, createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString() });
}));

router.patch("/posts/:id", requireAuth, asyncHandler(async (req, res) => {
  const params = UpdatePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await getPostForUser(params.data.id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.caption !== undefined) updateData.caption = parsed.data.caption;
  if (parsed.data.hook !== undefined) updateData.hook = parsed.data.hook;
  if (parsed.data.cta !== undefined) updateData.cta = parsed.data.cta;
  if (parsed.data.hashtags !== undefined) updateData.hashtags = parsed.data.hashtags;
  if (parsed.data.imagePrompt !== undefined) updateData.imagePrompt = parsed.data.imagePrompt;
  if (parsed.data.platform !== undefined) updateData.platform = parsed.data.platform;

  const [post] = await db.update(postsTable).set(updateData).where(eq(postsTable.id, params.data.id)).returning();

  res.json({ ...post, createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString() });
}));

router.post("/posts/:id/generate-image", requireAuth, asyncHandler(async (req, res) => {
  const params = GeneratePostImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const post = await getPostForUser(params.data.id, req.user!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const imageBuffer = await generateImageBuffer(post.imagePrompt, "1024x1024");
  const filename = `post-${post.id}-${Date.now()}.png`;
  const filePath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filePath, imageBuffer);

  const imageUrl = `/api/storage/images/${filename}`;

  const [updated] = await db
    .update(postsTable)
    .set({ imageUrl })
    .where(eq(postsTable.id, params.data.id))
    .returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
}));

router.post("/posts/:id/regenerate", requireAuth, asyncHandler(async (req, res) => {
  const params = RegeneratePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const post = await getPostForUser(params.data.id, req.user!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, post.campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, campaign.brandId));
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const kit = brand.brandKit as {
    personality: string;
    toneOfVoice: string;
    visualStyle: string;
    colorPalette: { primary: string };
  } | null;

  const primaryColor = kit?.colorPalette?.primary ?? "#6366F1";
  const style = kit?.visualStyle ?? "minimal";
  const tone = kit?.toneOfVoice ?? "professional and clear";

  const prompt = `You are a social media copywriter. Regenerate a completely new, unique version of this Day ${post.day} social media post for the brand "${brand.companyName}" in the ${brand.industry} industry.

Current post concept (create a fresh take, do NOT copy the existing content):
- Current hook: ${post.hook}
- Current caption excerpt: ${post.caption.slice(0, 80)}

Brand tone: ${tone}
Visual style: ${style}

Return ONLY a JSON object with these fields:
{
  "hook": "new attention-grabbing opening line",
  "caption": "full new caption (3-4 paragraphs with line breaks)",
  "cta": "call to action",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "imagePrompt": "detailed AI image prompt: scene description, ${style} aesthetic, ${primaryColor} color accent, cinematic lighting, no text no logos, top-right corner empty for logo, 16:9 ultra-high quality"
}`;

  let newContent: { hook: string; caption: string; cta: string; hashtags: string[]; imagePrompt: string };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    newContent = JSON.parse(cleaned);
  } catch {
    newContent = {
      hook: `${brand.companyName}: A fresh perspective for Day ${post.day}.`,
      caption: `Here's what makes ${brand.companyName} different from every other ${brand.industry} brand.\n\nWe don't just deliver a service — we deliver results that matter.\n\nReady to see the difference? Link in bio.`,
      cta: "See how we can help you",
      hashtags: [`#${brand.companyName.replace(/\s+/g, "")}`, `#${brand.industry.replace(/\s+/g, "")}`, "#Marketing", "#Business", "#Growth"],
      imagePrompt: `Commercial photograph: ${brand.companyName} brand story. ${style} aesthetic, ${primaryColor} color accent, cinematic lighting, no text, no logos, 16:9 ultra-high quality.`,
    };
  }

  const [updated] = await db
    .update(postsTable)
    .set({
      caption: newContent.caption,
      hook: newContent.hook,
      cta: newContent.cta,
      hashtags: newContent.hashtags,
      imagePrompt: newContent.imagePrompt,
    })
    .where(eq(postsTable.id, params.data.id))
    .returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
}));

export default router;
