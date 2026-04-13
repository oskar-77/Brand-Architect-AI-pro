import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable, usersTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const CreateWorkspaceBody = z.object({ name: z.string().min(1) });
const InviteMemberBody = z.object({ email: z.string().email(), role: z.enum(["admin", "editor"]).default("editor") });
const UpdateMemberBody = z.object({ role: z.enum(["admin", "editor"]) });

router.get("/workspaces", requireAuth, asyncHandler(async (req, res) => {
  const memberships = await db
    .select({ workspace: workspacesTable, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(eq(workspaceMembersTable.userId, req.user!.userId));

  res.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
}));

router.post("/workspaces", requireAuth, asyncHandler(async (req, res) => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [workspace] = await db
    .insert(workspacesTable)
    .values({ name: parsed.data.name, ownerId: req.user!.userId })
    .returning();

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: req.user!.userId,
    role: "owner",
  });

  res.status(201).json(workspace);
}));

router.get("/workspaces/:id/members", requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = parseInt(req.params.id, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspace id" });
    return;
  }

  const isMember = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, req.user!.userId)));

  if (!isMember.length) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const members = await db
    .select({ user: { id: usersTable.id, email: usersTable.email, name: usersTable.name }, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
    .where(eq(workspaceMembersTable.workspaceId, workspaceId));

  res.json(members.map((m) => ({ ...m.user, role: m.role })));
}));

router.post("/workspaces/:id/members", requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = parseInt(req.params.id, 10);
  if (isNaN(workspaceId)) {
    res.status(400).json({ error: "Invalid workspace id" });
    return;
  }

  const parsed = InviteMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [membership] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, req.user!.userId)));

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    res.status(403).json({ error: "Only owners and admins can invite members" });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [existing] = await db
    .select({ id: workspaceMembersTable.id })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, targetUser.id)));

  if (existing) {
    res.status(409).json({ error: "User is already a member" });
    return;
  }

  await db.insert(workspaceMembersTable).values({
    workspaceId,
    userId: targetUser.id,
    role: parsed.data.role,
  });

  res.status(201).json({ message: "Member added" });
}));

router.patch("/workspaces/:id/members/:userId", requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = parseInt(req.params.id, 10);
  const targetUserId = parseInt(req.params.userId, 10);

  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [membership] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, req.user!.userId)));

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    res.status(403).json({ error: "Only owners and admins can update members" });
    return;
  }

  await db
    .update(workspaceMembersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, targetUserId)));

  res.json({ message: "Member updated" });
}));

router.delete("/workspaces/:id/members/:userId", requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = parseInt(req.params.id, 10);
  const targetUserId = parseInt(req.params.userId, 10);

  const [membership] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, req.user!.userId)));

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    res.status(403).json({ error: "Only owners and admins can remove members" });
    return;
  }

  await db
    .delete(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, targetUserId)));

  res.sendStatus(204);
}));

export default router;
