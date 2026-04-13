import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable, campaignsTable, postsTable } from "@workspace/db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middlewares/auth";
import { getBrandForUser } from "../lib/workspace";
import PDFDocument from "pdfkit";
import https from "https";
import http from "http";

const router: IRouter = Router();

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ] : [99, 102, 241];
}

router.get("/brands/:id/export-pdf", requireAuth, asyncHandler(async (req, res) => {
  const brandId = parseInt(req.params.id, 10);
  if (isNaN(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }

  const brand = await getBrandForUser(brandId, req.user!.userId);
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.brandId, brandId))
    .limit(1);

  const campaign = campaigns[0] ?? null;
  const posts = campaign
    ? await db.select().from(postsTable).where(eq(postsTable.campaignId, campaign.id)).limit(4)
    : [];

  const kit = brand.brandKit as {
    personality?: string;
    positioning?: string;
    toneOfVoice?: string;
    audienceSegments?: string[];
    visualStyle?: string;
    colorPalette?: { primary: string; secondary: string; accent: string; background: string; text: string };
    visualStyleRules?: string;
  } | null;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${brand.companyName.replace(/[^a-z0-9]/gi, "_")}_brandbook.pdf"`);

  const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 60, right: 60 } });
  doc.pipe(res);

  const primaryColor = kit?.colorPalette?.primary ?? "#6366F1";
  const secondaryColor = kit?.colorPalette?.secondary ?? "#8B5CF6";
  const accentColor = kit?.colorPalette?.accent ?? "#06B6D4";
  const [pr, pg, pb] = hexToRgb(primaryColor);
  const [sr, sg, sb] = hexToRgb(secondaryColor);

  const pageWidth = doc.page.width - 120;

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(`${primaryColor}`);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(36).text(brand.companyName, 60, 180, { width: pageWidth });
  doc.font("Helvetica").fontSize(18).fillColor("rgba(255,255,255,0.8)").text("Brand Identity Book", 60, 240);
  doc.fontSize(12).fillColor("rgba(255,255,255,0.6)").text(brand.industry, 60, 275);
  doc.fontSize(10).fillColor("rgba(255,255,255,0.4)").text(`Generated ${new Date().toLocaleDateString()}`, 60, doc.page.height - 80);

  doc.addPage();
  doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(24).text("Brand Overview", 60, 50);
  doc.moveTo(60, 82).lineTo(60 + pageWidth, 82).stroke("#e5e7eb");

  let y = 100;

  if (kit?.personality) {
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(12).text("Brand Personality", 60, y);
    y += 20;
    doc.fillColor("#374151").font("Helvetica").fontSize(10).text(kit.personality, 60, y, { width: pageWidth });
    y += doc.heightOfString(kit.personality, { width: pageWidth }) + 20;
  }

  if (kit?.positioning) {
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(12).text("Market Positioning", 60, y);
    y += 20;
    doc.fillColor("#374151").font("Helvetica").fontSize(10).text(kit.positioning, 60, y, { width: pageWidth });
    y += doc.heightOfString(kit.positioning, { width: pageWidth }) + 20;
  }

  if (kit?.toneOfVoice) {
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(12).text("Tone of Voice", 60, y);
    y += 20;
    doc.fillColor("#374151").font("Helvetica").fontSize(10).text(kit.toneOfVoice, 60, y, { width: pageWidth });
    y += doc.heightOfString(kit.toneOfVoice, { width: pageWidth }) + 20;
  }

  if (kit?.audienceSegments?.length) {
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(12).text("Target Audience", 60, y);
    y += 20;
    for (const seg of kit.audienceSegments) {
      doc.rect(60, y, 4, doc.heightOfString(seg, { width: pageWidth - 20 }) + 4).fill(accentColor);
      doc.fillColor("#374151").font("Helvetica").fontSize(10).text(seg, 72, y + 2, { width: pageWidth - 20 });
      y += doc.heightOfString(seg, { width: pageWidth - 20 }) + 12;
    }
  }

  doc.addPage();
  doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(24).text("Color Palette", 60, 50);
  doc.moveTo(60, 82).lineTo(60 + pageWidth, 82).stroke("#e5e7eb");

  const palette = kit?.colorPalette;
  if (palette) {
    const colors = [
      { label: "Primary", hex: palette.primary },
      { label: "Secondary", hex: palette.secondary },
      { label: "Accent", hex: palette.accent },
      { label: "Background", hex: palette.background },
      { label: "Text", hex: palette.text },
    ];

    const swatchW = 90;
    const swatchH = 80;
    const startX = 60;
    const startY = 110;
    const gap = 12;

    colors.forEach((c, i) => {
      const x = startX + i * (swatchW + gap);
      doc.rect(x, startY, swatchW, swatchH).fill(c.hex);
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(9).text(c.label, x, startY + swatchH + 8, { width: swatchW, align: "center" });
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(c.hex.toUpperCase(), x, startY + swatchH + 22, { width: swatchW, align: "center" });
    });
  }

  y = 280;
  if (kit?.visualStyle) {
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(14).text(`Visual Style: ${kit.visualStyle.toUpperCase()}`, 60, y);
    y += 24;
  }

  if (kit?.visualStyleRules) {
    doc.fillColor("#374151").font("Helvetica").fontSize(10).text(kit.visualStyleRules, 60, y, { width: pageWidth });
    y += doc.heightOfString(kit.visualStyleRules, { width: pageWidth }) + 20;
  }

  if (campaign && posts.length > 0) {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
    doc.fillColor("#111").font("Helvetica-Bold").fontSize(24).text("Campaign Examples", 60, 50);
    doc.moveTo(60, 82).lineTo(60 + pageWidth, 82).stroke("#e5e7eb");

    doc.fillColor("#374151").font("Helvetica").fontSize(10).text(campaign.strategy ?? "", 60, 95, { width: pageWidth });
    y = 95 + doc.heightOfString(campaign.strategy ?? "", { width: pageWidth }) + 20;

    for (const post of posts.slice(0, 3)) {
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 60;
      }
      doc.rect(60, y, pageWidth, 1).fill("#e5e7eb");
      y += 12;
      doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(11).text(`Day ${post.day} — ${post.platform}`, 60, y);
      y += 18;
      doc.fillColor("#111").font("Helvetica-Bold").fontSize(10).text(post.hook, 60, y, { width: pageWidth });
      y += doc.heightOfString(post.hook, { width: pageWidth }) + 8;
      doc.fillColor("#374151").font("Helvetica").fontSize(9).text(post.caption.slice(0, 300) + (post.caption.length > 300 ? "..." : ""), 60, y, { width: pageWidth });
      y += doc.heightOfString(post.caption.slice(0, 300), { width: pageWidth }) + 20;
    }
  }

  doc.end();
}));

export default router;
