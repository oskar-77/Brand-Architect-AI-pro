import { Router, type IRouter } from "express";
import { desc, count, inArray } from "drizzle-orm";
import { db, brandsTable, campaignsTable, postsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { getUserWorkspaceIds } from "../lib/workspace";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, asyncHandler(async (req, res) => {
  const workspaceIds = await getUserWorkspaceIds(req.user!.userId);

  if (!workspaceIds.length) {
    res.json({ totalBrands: 0, totalCampaigns: 0, totalPosts: 0, recentBrands: [] });
    return;
  }

  const workspaceBrands = await db
    .select({ id: brandsTable.id })
    .from(brandsTable)
    .where(inArray(brandsTable.workspaceId, workspaceIds));

  const brandIds = workspaceBrands.map((b) => b.id);

  if (!brandIds.length) {
    res.json({ totalBrands: 0, totalCampaigns: 0, totalPosts: 0, recentBrands: [] });
    return;
  }

  const [campaignRows, recentBrands] = await Promise.all([
    db.select({ id: campaignsTable.id }).from(campaignsTable).where(inArray(campaignsTable.brandId, brandIds)),
    db
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
      .where(inArray(brandsTable.id, brandIds))
      .orderBy(desc(brandsTable.createdAt))
      .limit(5),
  ]);

  const campaignIds = campaignRows.map((c) => c.id);

  let totalPosts = 0;
  if (campaignIds.length) {
    const [postCountRow] = await db
      .select({ cnt: count() })
      .from(postsTable)
      .where(inArray(postsTable.campaignId, campaignIds));
    totalPosts = Number(postCountRow?.cnt ?? 0);
  }

  res.json({
    totalBrands: brandIds.length,
    totalCampaigns: campaignIds.length,
    totalPosts,
    recentBrands: recentBrands.map((b: typeof brandsTable.$inferSelect) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}));

export default router;
