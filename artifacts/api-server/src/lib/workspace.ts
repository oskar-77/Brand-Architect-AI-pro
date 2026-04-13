import { eq, inArray, and } from "drizzle-orm";
import { db, workspaceMembersTable, brandsTable, campaignsTable, postsTable } from "@workspace/db";

export async function getUserWorkspaceIds(userId: number): Promise<number[]> {
  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));
  return memberships.map((m) => m.workspaceId);
}

export async function isMemberOfWorkspace(userId: number, workspaceId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)));
  return !!row;
}

export async function getBrandForUser(brandId: number, userId: number) {
  const workspaceIds = await getUserWorkspaceIds(userId);
  if (!workspaceIds.length) return null;
  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(and(eq(brandsTable.id, brandId), inArray(brandsTable.workspaceId, workspaceIds)));
  return brand ?? null;
}

export async function getCampaignForUser(campaignId: number, userId: number) {
  const workspaceIds = await getUserWorkspaceIds(userId);
  if (!workspaceIds.length) return null;
  const rows = await db
    .select({ campaign: campaignsTable })
    .from(campaignsTable)
    .innerJoin(brandsTable, eq(campaignsTable.brandId, brandsTable.id))
    .where(and(eq(campaignsTable.id, campaignId), inArray(brandsTable.workspaceId, workspaceIds)));
  return rows[0]?.campaign ?? null;
}

export async function getPostForUser(postId: number, userId: number) {
  const workspaceIds = await getUserWorkspaceIds(userId);
  if (!workspaceIds.length) return null;
  const rows = await db
    .select({ post: postsTable })
    .from(postsTable)
    .innerJoin(campaignsTable, eq(postsTable.campaignId, campaignsTable.id))
    .innerJoin(brandsTable, eq(campaignsTable.brandId, brandsTable.id))
    .where(and(eq(postsTable.id, postId), inArray(brandsTable.workspaceId, workspaceIds)));
  return rows[0]?.post ?? null;
}
