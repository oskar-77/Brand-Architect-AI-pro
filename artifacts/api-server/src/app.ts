import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
fs.mkdirSync(STORAGE_DIR, { recursive: true });

app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => req.path === "/api/healthz",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please wait before trying again." },
});

app.use("/api", apiLimiter);
app.use("/api/brands/:id/generate-kit", aiLimiter);
app.use("/api/brands/:id/generate-campaign", aiLimiter);
app.use("/api/posts/:id/generate-image", aiLimiter);
app.use("/api/posts/:id/regenerate", aiLimiter);
app.use("/api/campaigns/:id/generate-all-images", aiLimiter);

app.use("/api/storage", express.static(STORAGE_DIR, {
  maxAge: "7d",
  etag: true,
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=604800");
  },
}));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error({ err, url: req.url }, "Unhandled error");
  res.status(500).json({ error: message });
});

export default app;
