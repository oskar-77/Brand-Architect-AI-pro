import { Router, type IRouter } from "express";
import { eq, desc, count, sql, inArray } from "drizzle-orm";
import { db, brandsTable, campaignsTable, postsTable } from "@workspace/db";
import {
  CreateBrandBody,
  UpdateBrandBody,
  GetBrandParams,
  UpdateBrandParams,
  DeleteBrandParams,
  GenerateBrandKitParams,
  GenerateCampaignParams,
  GenerateCampaignBody,
  GetBrandStatsParams,
} from "@workspace/api-zod";
import { generateBrandKit, generateCampaign } from "../lib/ai";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { getUserWorkspaceIds, getBrandForUser, isMemberOfWorkspace } from "../lib/workspace";
import { z } from "zod";

const router: IRouter = Router();

router.get("/brands", requireAuth, asyncHandler(async (req, res) => {
  const workspaceIds = await getUserWorkspaceIds(req.user!.userId);
  if (!workspaceIds.length) {
    res.json([]);
    return;
  }

  const brands = await db
    .select({
      id: brandsTable.id,
      companyName: brandsTable.companyName,
      industry: brandsTable.industry,
      logoUrl: brandsTable.logoUrl,
      status: brandsTable.status,
      createdAt: brandsTable.createdAt,
      updatedAt: brandsTable.updatedAt,
    })
    .from(brandsTable)
    .where(inArray(brandsTable.workspaceId, workspaceIds))
    .orderBy(desc(brandsTable.createdAt));

  res.json(brands);
}));

const CreateBrandBodyWithWorkspace = CreateBrandBody.extend({
  workspaceId: z.number().int().positive().optional(),
});

router.post("/brands", requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateBrandBodyWithWorkspace.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let workspaceId = parsed.data.workspaceId;

  if (workspaceId !== undefined) {
    const allowed = await isMemberOfWorkspace(req.user!.userId, workspaceId);
    if (!allowed) {
      res.status(403).json({ error: "Access denied to this workspace" });
      return;
    }
  } else {
    const workspaceIds = await getUserWorkspaceIds(req.user!.userId);
    if (!workspaceIds.length) {
      res.status(400).json({ error: "You must belong to a workspace to create a brand" });
      return;
    }
    workspaceId = workspaceIds[0];
  }

  const [brand] = await db
    .insert(brandsTable)
    .values({
      workspaceId,
      companyName: parsed.data.companyName,
      companyDescription: parsed.data.companyDescription,
      industry: parsed.data.industry,
      websiteUrl: parsed.data.websiteUrl ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
      status: "draft",
    })
    .returning();

  res.status(201).json({
    ...brand,
    brandKit: brand.brandKit ?? null,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  });
}));

router.get("/brands/:id", requireAuth, asyncHandler(async (req, res) => {
  const params = GetBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const brand = await getBrandForUser(params.data.id, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json({
    ...brand,
    brandKit: brand.brandKit ?? null,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  });
}));

router.patch("/brands/:id", requireAuth, asyncHandler(async (req, res) => {
  const params = UpdateBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBrandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await getBrandForUser(params.data.id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.companyName !== undefined) updateData.companyName = parsed.data.companyName;
  if (parsed.data.companyDescription !== undefined) updateData.companyDescription = parsed.data.companyDescription;
  if (parsed.data.industry !== undefined) updateData.industry = parsed.data.industry;
  if (parsed.data.websiteUrl !== undefined) updateData.websiteUrl = parsed.data.websiteUrl;
  if (parsed.data.logoUrl !== undefined) updateData.logoUrl = parsed.data.logoUrl;

  const [brand] = await db
    .update(brandsTable)
    .set(updateData)
    .where(eq(brandsTable.id, params.data.id))
    .returning();

  res.json({
    ...brand,
    brandKit: brand.brandKit ?? null,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
  });
}));

router.delete("/brands/:id", requireAuth, asyncHandler(async (req, res) => {
  const params = DeleteBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = await getBrandForUser(params.data.id, req.user!.userId);
  if (!existing) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  await db.delete(brandsTable).where(eq(brandsTable.id, params.data.id));
  res.sendStatus(204);
}));

router.post("/brands/:id/generate-kit", requireAuth, asyncHandler(async (req, res) => {
  const params = GenerateBrandKitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const brand = await getBrandForUser(params.data.id, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const brandColors = (req.body as { brandColors?: string[] })?.brandColors ?? [];
  const kit = await generateBrandKit(brand.companyName, brand.companyDescription, brand.industry, brandColors);

  const [updated] = await db
    .update(brandsTable)
    .set({ brandKit: kit, status: "kit_ready" })
    .where(eq(brandsTable.id, params.data.id))
    .returning();

  res.json({
    ...updated,
    brandKit: updated.brandKit ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}));

router.post("/brands/:id/generate-campaign", requireAuth, asyncHandler(async (req, res) => {
  const params = GenerateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const bodyParsed = GenerateCampaignBody.safeParse(req.body ?? {});
  const brief = bodyParsed.success ? (bodyParsed.data.brief ?? undefined) : undefined;
  const postCount = bodyParsed.success ? (bodyParsed.data.postCount ?? 7) : 7;

  const brand = await getBrandForUser(params.data.id, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  let kit = brand.brandKit as {
    personality: string;
    positioning: string;
    toneOfVoice: string;
    audienceSegments: string[];
    visualStyle: string;
    colorPalette: { primary: string; secondary: string; accent: string; background: string; text: string };
    visualStyleRules: string;
  } | null;

  if (!kit) {
    kit = await generateBrandKit(brand.companyName, brand.companyDescription, brand.industry);
    await db.update(brandsTable).set({ brandKit: kit, status: "kit_ready" }).where(eq(brandsTable.id, params.data.id));
  }

  const campaignData = await generateCampaign(brand.companyName, brand.companyDescription, brand.industry, kit, brief, postCount);

  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      brandId: brand.id,
      title: campaignData.title,
      strategy: campaignData.strategy,
      days: campaignData.days,
    })
    .returning();

  const insertedPosts = await db
    .insert(postsTable)
    .values(
      campaignData.posts.map((p) => ({
        campaignId: campaign.id,
        day: p.day,
        caption: p.caption,
        hook: p.hook,
        cta: p.cta,
        hashtags: p.hashtags,
        imagePrompt: p.imagePrompt,
        platform: p.platform,
      }))
    )
    .returning();

  await db.update(brandsTable).set({ status: "active" }).where(eq(brandsTable.id, brand.id));

  res.json({
    id: campaign.id,
    brandId: campaign.brandId,
    title: campaign.title,
    strategy: campaign.strategy,
    days: campaign.days,
    posts: insertedPosts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  });
}));

router.get("/brands/:id/campaigns", requireAuth, asyncHandler(async (req, res) => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const brandId = parseInt(raw, 10);
  if (isNaN(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }

  const brand = await getBrandForUser(brandId, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.brandId, brandId))
    .orderBy(desc(campaignsTable.createdAt));

  const campaignIds = campaigns.map((c) => c.id);
  const allPosts =
    campaignIds.length > 0
      ? await db.select().from(postsTable).where(sql`${postsTable.campaignId} = ANY(${sql.raw(`ARRAY[${campaignIds.join(",")}]`)})`)
      : [];

  const result = campaigns.map((c) => ({
    id: c.id,
    brandId: c.brandId,
    title: c.title,
    strategy: c.strategy,
    days: c.days,
    posts: allPosts
      .filter((p) => p.campaignId === c.id)
      .map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  res.json(result);
}));

router.get("/brands/:id/stats", requireAuth, asyncHandler(async (req, res) => {
  const params = GetBrandStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const brand = await getBrandForUser(params.data.id, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const campaigns = await db
    .select({ id: campaignsTable.id, createdAt: campaignsTable.createdAt })
    .from(campaignsTable)
    .where(eq(campaignsTable.brandId, params.data.id))
    .orderBy(desc(campaignsTable.createdAt));

  const campaignIds = campaigns.map((c) => c.id);
  let totalPosts = 0;
  if (campaignIds.length > 0) {
    const [row] = await db
      .select({ cnt: count() })
      .from(postsTable)
      .where(sql`${postsTable.campaignId} = ANY(${sql.raw(`ARRAY[${campaignIds.join(",")}]`)})`);
    totalPosts = Number(row?.cnt ?? 0);
  }

  res.json({
    brandId: params.data.id,
    totalCampaigns: campaigns.length,
    totalPosts,
    brandKitGenerated: brand.brandKit != null,
    lastCampaignDate: campaigns[0]?.createdAt?.toISOString() ?? null,
  });
}));

export default router;
