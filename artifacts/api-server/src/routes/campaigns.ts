import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, campaignsTable, postsTable } from "@workspace/db";
import {
  GetCampaignParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.campaignId, params.data.id))
    .orderBy(postsTable.day);

  res.json({
    id: campaign.id,
    brandId: campaign.brandId,
    title: campaign.title,
    strategy: campaign.strategy,
    days: campaign.days,
    posts: posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  });
});

export default router;
