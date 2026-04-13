import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable, workspaceMembersTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { signToken, requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/register", asyncHandler(async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, password } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();

  const [workspace] = await db
    .insert(workspacesTable)
    .values({ name: `${name}'s Workspace`, ownerId: user.id })
    .returning();

  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  const token = signToken({ userId: user.id, email: user.email });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    workspace: { id: workspace.id, name: workspace.name },
  });
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const [memberRow] = await db
    .select({ workspace: workspacesTable })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(eq(workspaceMembersTable.userId, user.id))
    .limit(1);

  const token = signToken({ userId: user.id, email: user.email });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    workspace: memberRow?.workspace ? { id: memberRow.workspace.id, name: memberRow.workspace.name } : null,
  });
}));

router.get("/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const memberships = await db
    .select({ workspace: workspacesTable, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
    .where(eq(workspaceMembersTable.userId, user.id));

  res.json({
    user,
    workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
  });
}));

export default router;
