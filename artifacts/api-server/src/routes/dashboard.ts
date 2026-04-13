import { Router, type IRouter } from "express";
import { desc, count } from "drizzle-orm";
import { db, brandsTable, campaignsTable, postsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";

const router: IRouter = Router();

router.get("/dashboard/summary", asyncHandler(async (_req, res) => {
  const [brandCount, campaignCount, postCount, recentBrands] = await Promise.all([
    db.select({ cnt: count() }).from(brandsTable),
    db.select({ cnt: count() }).from(campaignsTable),
    db.select({ cnt: count() }).from(postsTable),
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
      .orderBy(desc(brandsTable.createdAt))
      .limit(5),
  ]);

  res.json({
    totalBrands: Number(brandCount[0]?.cnt ?? 0),
    totalCampaigns: Number(campaignCount[0]?.cnt ?? 0),
    totalPosts: Number(postCount[0]?.cnt ?? 0),
    recentBrands: recentBrands.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
}));

export default router;
