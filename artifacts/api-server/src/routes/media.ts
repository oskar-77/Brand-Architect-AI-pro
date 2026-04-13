import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db, brandsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { optionalAuth } from "../middlewares/auth";

const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
const LOGOS_DIR = path.join(STORAGE_DIR, "logos");
const IMAGES_DIR = path.join(STORAGE_DIR, "images");

fs.mkdirSync(LOGOS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

export const uploadLogo = multer({ storage: logoStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single("logo");
export const uploadImage = multer({ storage: imageStorage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }).single("image");

export function getPublicUrl(req: Express.Request, filePath: string): string {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const relativePath = path.relative(STORAGE_DIR, filePath).replace(/\\/g, "/");
  return `${baseUrl}/api/storage/${relativePath}`;
}

export function saveBase64Image(base64Data: string, filename: string): string {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const filePath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

const router: IRouter = Router();

router.post("/media/upload-logo", optionalAuth, (req, res, next) => {
  uploadLogo(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = getPublicUrl(req, req.file.path);
  res.json({ url, filename: req.file.filename });
}));

router.post("/media/upload-image", optionalAuth, (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = getPublicUrl(req, req.file.path);
  res.json({ url, filename: req.file.filename });
}));

router.get("/media/library", optionalAuth, asyncHandler(async (req, res) => {
  const brandId = req.query.brandId ? parseInt(req.query.brandId as string, 10) : null;

  const imagesDir = IMAGES_DIR;
  let files: Array<{ filename: string; url: string; size: number; createdAt: string; brandId?: number | null }> = [];

  if (fs.existsSync(imagesDir)) {
    const dirFiles = fs.readdirSync(imagesDir);
    const baseUrl = `${req.protocol}://${req.get("host")}/api/storage/images`;

    for (const file of dirFiles) {
      const filePath = path.join(imagesDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        files.push({
          filename: file,
          url: `${baseUrl}/${file}`,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
        });
      }
    }
  }

  files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(files);
}));

router.delete("/media/:filename", optionalAuth, asyncHandler(async (req, res) => {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(IMAGES_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  fs.unlinkSync(filePath);
  res.sendStatus(204);
}));

export default router;
