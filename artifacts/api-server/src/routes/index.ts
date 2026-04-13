import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import campaignsRouter from "./campaigns";
import postsRouter from "./posts";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";
import workspacesRouter from "./workspaces";
import mediaRouter from "./media";
import jobsRouter from "./jobs";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(authRouter);
router.use(workspacesRouter);
router.use(mediaRouter);
router.use(jobsRouter);
router.use(exportRouter);
router.use(healthRouter);
router.use(brandsRouter);
router.use(campaignsRouter);
router.use(postsRouter);
router.use(dashboardRouter);

export default router;
