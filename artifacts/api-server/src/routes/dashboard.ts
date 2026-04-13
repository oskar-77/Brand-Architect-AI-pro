import { Router, type IRouter } from "express";
import { desc, count } from "drizzle-orm";
import { db, brandsTable, campaignsTable, postsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [brandCount] = await db.select({ cnt: count() }).from(brandsTable);
  const [campaignCount] = await db.select({ cnt: count() }).from(campaignsTable);
  const [postCount] = await db.select({ cnt: count() }).from(postsTable);

  const recentBrands = await db
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
    .limit(5);

  res.json({
    totalBrands: Number(brandCount?.cnt ?? 0),
    totalCampaigns: Number(campaignCount?.cnt ?? 0),
    totalPosts: Number(postCount?.cnt ?? 0),
    recentBrands: recentBrands.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
  });
});

export default router;
