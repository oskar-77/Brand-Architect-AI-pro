import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, jobsTable, postsTable, campaignsTable, brandsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { getCampaignForUser, getUserWorkspaceIds } from "../lib/workspace";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
const IMAGES_DIR = path.join(STORAGE_DIR, "images");
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const router: IRouter = Router();

async function compositeLogoOnImage(
  imageBuffer: Buffer,
  logoUrl: string | null | undefined
): Promise<Buffer> {
  if (!logoUrl) return imageBuffer;
  try {
    let logoBuffer: Buffer;
    if (logoUrl.startsWith("data:")) {
      const base64Part = logoUrl.split(",")[1];
      if (!base64Part) return imageBuffer;
      logoBuffer = Buffer.from(base64Part, "base64");
    } else if (logoUrl.startsWith("/api/storage/")) {
      const relativePath = logoUrl.replace("/api/storage/", "");
      const filePath = path.join(STORAGE_DIR, relativePath);
      if (!fs.existsSync(filePath)) return imageBuffer;
      logoBuffer = fs.readFileSync(filePath);
    } else {
      return imageBuffer;
    }
    const base = sharp(imageBuffer);
    const baseMeta = await base.metadata();
    const imgWidth = baseMeta.width ?? 1024;
    const imgHeight = baseMeta.height ?? 1024;
    const logoWidth = Math.round(imgWidth * 0.22);
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoWidth, null, { fit: "inside", withoutEnlargement: false })
      .ensureAlpha()
      .png()
      .toBuffer();
    const logoMeta = await sharp(resizedLogo).metadata();
    const logoH = logoMeta.height ?? Math.round(logoWidth * 0.5);
    const paddingX = Math.round(imgWidth * 0.04);
    const paddingY = Math.round(imgHeight * 0.04);
    const left = imgWidth - logoWidth - paddingX;
    const top = imgHeight - logoH - paddingY;
    return base
      .composite([{ input: resizedLogo, left, top, blend: "over" }])
      .png()
      .toBuffer();
  } catch (err) {
    logger.warn({ err }, "Logo compositing failed in bulk job, returning base image");
    return imageBuffer;
  }
}

async function processImageJob(jobId: number, payload: { postId: number }): Promise<void> {
  await db.update(jobsTable).set({ status: "running" }).where(eq(jobsTable.id, jobId));

  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, payload.postId));
    if (!post) throw new Error("Post not found");

    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, post.campaignId));
    const brandLogoUrl = campaign
      ? (await db.select({ logoUrl: brandsTable.logoUrl }).from(brandsTable).where(eq(brandsTable.id, campaign.brandId)))[0]?.logoUrl
      : null;

    const baseImageBuffer = await generateImageBuffer(post.imagePrompt, "1024x1024");
    const finalBuffer = await compositeLogoOnImage(baseImageBuffer, brandLogoUrl ?? null);

    const filename = `post-${post.id}-${Date.now()}.png`;
    const filePath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filePath, finalBuffer);

    const imageUrl = `/api/storage/images/${filename}`;
    await db.update(postsTable).set({ imageUrl }).where(eq(postsTable.id, post.id));
    await db.update(jobsTable).set({ status: "done", result: { imageUrl } }).where(eq(jobsTable.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId }, "Image job failed");
    await db.update(jobsTable).set({ status: "failed", error: message }).where(eq(jobsTable.id, jobId));
  }
}

router.post("/campaigns/:id/generate-all-images", requireAuth, asyncHandler(async (req, res) => {
  const campaignId = parseInt(req.params.id, 10);
  if (isNaN(campaignId)) {
    res.status(400).json({ error: "Invalid campaign id" });
    return;
  }

  const campaign = await getCampaignForUser(campaignId, req.user!.userId);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const posts = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.campaignId, campaignId));

  if (!posts.length) {
    res.status(404).json({ error: "No posts found for this campaign" });
    return;
  }

  const jobs = await db
    .insert(jobsTable)
    .values(
      posts.map((p) => ({
        type: "generatePostImage",
        status: "pending",
        payload: { postId: p.id },
        referenceId: p.id,
        referenceType: "post",
      }))
    )
    .returning();

  res.status(202).json({
    message: `Queued ${jobs.length} image generation jobs`,
    jobIds: jobs.map((j) => j.id),
  });

  const CONCURRENCY = 2;
  const queue = [...jobs];

  async function processNext(): Promise<void> {
    const job = queue.shift();
    if (!job) return;
    await processImageJob(job.id, job.payload as { postId: number });
    await processNext();
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => processNext());
  Promise.all(workers).catch((err) => logger.error({ err }, "Worker error"));
}));

router.get("/jobs/:id", requireAuth, asyncHandler(async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  if (isNaN(jobId)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.referenceType === "post" && job.referenceId) {
    const workspaceIds = await getUserWorkspaceIds(req.user!.userId);
    if (!workspaceIds.length) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const rows = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .innerJoin(campaignsTable, eq(postsTable.campaignId, campaignsTable.id))
      .innerJoin(brandsTable, eq(campaignsTable.brandId, brandsTable.id))
      .where(and(eq(postsTable.id, job.referenceId), inArray(brandsTable.workspaceId, workspaceIds)));
    if (!rows.length) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  res.json({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
}));

router.get("/jobs", requireAuth, asyncHandler(async (req, res) => {
  const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string, 10) : null;

  if (campaignId) {
    const campaign = await getCampaignForUser(campaignId, req.user!.userId);
    if (!campaign) {
      res.json([]);
      return;
    }

    const posts = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.campaignId, campaignId));

    const postIds = posts.map((p) => p.id);
    if (!postIds.length) {
      res.json([]);
      return;
    }

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(and(eq(jobsTable.referenceType, "post")));

    const relevantJobs = jobs.filter((j) => postIds.includes(j.referenceId ?? -1));
    res.json(relevantJobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })));
    return;
  }

  res.json([]);
}));

export default router;
