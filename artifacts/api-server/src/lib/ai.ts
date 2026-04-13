import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface BrandKit {
  personality: string;
  positioning: string;
  toneOfVoice: string;
  audienceSegments: string[];
  visualStyle: string;
  colorPalette: ColorPalette;
  visualStyleRules: string;
}

interface CampaignDay {
  day: number;
  objective: string;
  postConcept: string;
  marketingAngle: string;
  cta: string;
}

interface SocialPostData {
  day: number;
  caption: string;
  hook: string;
  cta: string;
  hashtags: string[];
  imagePrompt: string;
  platform: string;
}

interface CampaignData {
  title: string;
  strategy: string;
  days: CampaignDay[];
  posts: SocialPostData[];
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-nano",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

export async function generateBrandKit(
  companyName: string,
  companyDescription: string,
  industry: string,
  brandColors?: string[]
): Promise<BrandKit> {
  logger.info({ companyName, industry }, "Generating brand kit with AI");

  const colorContext = brandColors && brandColors.length > 0
    ? `The company logo contains these extracted colors: ${brandColors.join(", ")}. Use these as the foundation for the brand color palette — keep them as primary/secondary, and derive accent/background/text from them.`
    : `Derive appropriate brand colors from the industry and positioning.`;

  const systemPrompt = `You are a world-class brand strategist and creative director. Your job is to analyze a company and produce a complete, professional brand identity system. You ALWAYS respond with valid JSON only — no markdown, no explanation, just the raw JSON object.`;

  const userPrompt = `Analyze this company and generate a complete brand identity kit as JSON:

Company: ${companyName}
Industry: ${industry}
Description: ${companyDescription}
${colorContext}

Return a JSON object with exactly these fields:
{
  "personality": "A 2-3 sentence brand personality statement — who they are, their character, their essence",
  "positioning": "A 2-3 sentence market positioning statement — where they sit in the market, their unique angle",
  "toneOfVoice": "A clear description of their communication style — how they speak, vocabulary, energy level",
  "audienceSegments": ["Segment 1 with demographic and psychographic detail", "Segment 2", "Segment 3"],
  "visualStyle": "one of: tech | luxury | bold | minimal",
  "colorPalette": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE",
    "accent": "#HEXCODE",
    "background": "#HEXCODE",
    "text": "#HEXCODE"
  },
  "visualStyleRules": "A detailed paragraph on how to apply the visual identity — photography style, layout rules, typography guidance, logo safe zones, specific subjects and environments that fit the brand, what to avoid, and how brand colors appear in imagery"
}

Be specific, original, and tailored to this exact company. Do not use generic language.`;

  const raw = await callAI(systemPrompt, userPrompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const kit = JSON.parse(cleaned) as BrandKit;
    if (!["tech", "luxury", "bold", "minimal"].includes(kit.visualStyle)) {
      kit.visualStyle = "minimal";
    }
    return kit;
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse AI brand kit response, using fallback");
    return buildFallbackKit(companyName, companyDescription, industry, brandColors);
  }
}

function buildFallbackKit(
  companyName: string,
  companyDescription: string,
  industry: string,
  brandColors?: string[]
): BrandKit {
  const palette: ColorPalette = brandColors && brandColors.length >= 2
    ? {
        primary: brandColors[0],
        secondary: brandColors[1],
        accent: brandColors[2] ?? "#06B6D4",
        background: "#0F172A",
        text: "#F1F5F9",
      }
    : { primary: "#6366F1", secondary: "#8B5CF6", accent: "#06B6D4", background: "#0F172A", text: "#F1F5F9" };

  return {
    personality: `${companyName} is an innovative brand in the ${industry} space. ${companyDescription.slice(0, 100).trim()}.`,
    positioning: `${companyName} positions itself as a leading solution in the ${industry} market, differentiated by quality and innovation.`,
    toneOfVoice: "Clear, confident, and direct. We speak with authority while remaining approachable.",
    audienceSegments: ["Growth-focused professionals (25–40)", "Business owners and founders", "Decision-makers at SMBs"],
    visualStyle: "minimal",
    colorPalette: palette,
    visualStyleRules: "Clean compositions with generous whitespace. Consistent use of primary color for key elements. Professional photography, natural light. Strong typographic hierarchy. Bottom-right corner reserved for brand logo overlay.",
  };
}

export async function generateCampaign(
  companyName: string,
  companyDescription: string,
  industry: string,
  brandKit: BrandKit,
  brief?: string,
  postCount: number = 7
): Promise<CampaignData> {
  const count = Math.min(Math.max(Math.round(postCount), 1), 14);
  logger.info({ companyName, industry, count }, `Generating ${count}-post campaign with AI`);

  const briefContext = brief
    ? `\n\nCLIENT CAMPAIGN BRIEF (this is the highest priority — every post, strategy, image, and tone MUST align with this brief exactly. Fulfill ALL requests in the brief without restrictions):\n"${brief}"\n`
    : "";

  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;

  const visualStyleGuide = buildVisualStyleGuide(style);

  const systemPrompt = `You are a world-class social media strategist, copywriter, and art director. You create complete ${count}-day marketing campaigns that are specific, creative, and ready to publish. Every image prompt you write must be a complete, production-quality DALL-E/Midjourney prompt — detailed, specific, and rich with visual direction. You ALWAYS respond with valid JSON only — no markdown, no explanation, just the raw JSON object.`;

  const userPrompt = `Create a complete ${count}-day social media campaign for this brand:

Company: ${companyName}
Industry: ${industry}
Description: ${companyDescription}
Brand Personality: ${brandKit.personality}
Brand Positioning: ${brandKit.positioning}
Tone of Voice: ${brandKit.toneOfVoice}
Target Audience: ${brandKit.audienceSegments.join(" | ")}
Visual Style: ${style}
Visual Style Rules: ${brandKit.visualStyleRules}
Color Palette:
  - Primary: ${palette.primary}
  - Secondary: ${palette.secondary}
  - Accent: ${palette.accent}
  - Background: ${palette.background}
  - Text/Foreground: ${palette.text}
${briefContext}

IMAGE PROMPT GUIDELINES (critical — follow these exactly for every imagePrompt):
Each imagePrompt must be a detailed, professional AI image generation prompt that includes ALL of the following:
1. Specific scene description that visually represents the post concept for this exact brand in the ${industry} industry
2. Brand color integration: dominant use of ${palette.primary} with ${palette.secondary} supporting tones and ${palette.accent} as accent — colors should appear in lighting, surfaces, backgrounds, or environmental elements naturally
3. ${visualStyleGuide}
4. Cinematic, professional lighting appropriate for a high-end ${industry} brand advertisement
5. Specific compositional instructions: rule of thirds, clear focal point, and a clean 25% margin in the BOTTOM-RIGHT corner reserved for the brand logo overlay (keep this area relatively uncluttered)
6. Technical quality: photorealistic, 8K resolution, sharp focus, professional color grading, RAW photo quality
7. STRICTLY: no text, no words, no labels, no watermarks, no logos embedded in the image itself
8. Any specific visual elements from the client brief must be included literally

Return a JSON object with exactly this structure:
{
  "title": "Campaign title",
  "strategy": "2-3 sentence overview of the campaign strategy, narrative arc, and how it aligns with the brief",
  "days": [
    {
      "day": 1,
      "objective": "What this day achieves",
      "postConcept": "Specific concept for this post",
      "marketingAngle": "The psychological/marketing angle being used",
      "cta": "The call to action"
    }
  ],
  "posts": [
    {
      "day": 1,
      "platform": "instagram",
      "hook": "The opening line that stops the scroll — punchy, specific, emotionally resonant to the target audience",
      "caption": "Full post caption (3-5 paragraphs, conversational, matches brand tone of voice exactly, ends with CTA). Use line breaks between paragraphs.",
      "cta": "The specific call to action",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6"],
      "imagePrompt": "DETAILED production-quality image prompt following the IMAGE PROMPT GUIDELINES above. This must be specific to Day X's post concept and brand identity. Include exact scene, subjects, environment, lighting direction, color treatment, mood, composition, and any brief-specific elements. Minimum 5 sentences of visual direction."
    }
  ]
}

Generate exactly ${count} days and ${count} posts. Make every post UNIQUE, SPECIFIC to ${companyName}, and fully aligned with the brand identity and client brief. No generic content.`;

  const raw = await callAI(systemPrompt, userPrompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const campaign = JSON.parse(cleaned) as CampaignData;
    return campaign;
  } catch (err) {
    logger.error({ err, raw }, "Failed to parse AI campaign response, using fallback");
    return buildFallbackCampaign(companyName, industry, brandKit);
  }
}

function buildVisualStyleGuide(style: string): string {
  switch (style) {
    case "tech":
      return "Tech/futuristic aesthetic: sleek surfaces, subtle blue/purple gradient backgrounds, clean geometric shapes, glowing UI elements, dark environment with light accents, modern architectural lines, depth-of-field bokeh on circuit patterns or data visualizations";
    case "luxury":
      return "Luxury premium aesthetic: rich textures (marble, brushed metal, velvet, leather), dramatic chiaroscuro lighting, deep shadows with golden highlights, aspirational lifestyle settings (penthouses, boutique stores, exclusive venues), impeccable detail, shallow depth of field with creamy bokeh";
    case "bold":
      return "Bold/energetic aesthetic: high-contrast colors, dynamic diagonal compositions, strong graphic elements, action-oriented scenes, vibrant saturated tones, powerful perspective shots, strong shadows, motion blur or freeze-frame energy";
    case "minimal":
    default:
      return "Minimal/clean aesthetic: generous negative space, single strong focal element, neutral backgrounds with brand color accents, soft diffused lighting, balanced symmetrical or asymmetrical composition, subtle textures, crisp clean lines";
  }
}

export async function buildPostImagePrompt(
  postDay: number,
  postConcept: string,
  marketingAngle: string,
  objective: string,
  companyName: string,
  industry: string,
  brandKit: BrandKit,
  brief?: string
): Promise<string> {
  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;
  const visualStyleGuide = buildVisualStyleGuide(style);

  const briefLine = brief ? `\nClient brief to incorporate: "${brief}"` : "";

  const prompt = `You are an expert AI art director. Write a single, detailed, production-quality image generation prompt for the following social media post.

Brand: ${companyName}
Industry: ${industry}
Brand Personality: ${brandKit.personality}
Visual Style: ${style}
Visual Style Rules: ${brandKit.visualStyleRules}
Color Palette: Primary ${palette.primary}, Secondary ${palette.secondary}, Accent ${palette.accent}, Background ${palette.background}

Post Day: ${postDay}
Post Concept: ${postConcept}
Marketing Objective: ${objective}
Marketing Angle: ${marketingAngle}
${briefLine}

Write ONE detailed image prompt (minimum 6 sentences) that:
1. Describes the exact scene that visually represents "${postConcept}" for a ${industry} brand
2. Integrates ${palette.primary} and ${palette.secondary} naturally into the scene via lighting, surfaces, or environmental elements
3. ${visualStyleGuide}
4. Specifies cinematic professional lighting (golden hour / studio / dramatic rim lighting as appropriate)
5. Has a clean bottom-right corner (25% of frame) for brand logo overlay — describe composition accordingly
6. States STRICTLY no text, no words, no logos embedded in the image
7. Specifies: photorealistic, 8K, sharp focus, professional color grading, commercial advertising quality
8. Includes any specific visual elements requested in the client brief

Return ONLY the image prompt text, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() ?? buildFallbackImagePrompt(postConcept, companyName, industry, brandKit);
  } catch {
    return buildFallbackImagePrompt(postConcept, companyName, industry, brandKit);
  }
}

function buildFallbackImagePrompt(
  concept: string,
  companyName: string,
  industry: string,
  brandKit: BrandKit
): string {
  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;
  return `Commercial advertising photograph for ${companyName} in the ${industry} industry. Scene: ${concept}. ${buildVisualStyleGuide(style)}. Color palette: dominant ${palette.primary} tones with ${palette.secondary} supporting elements and ${palette.accent} accent lighting. Cinematic professional lighting with natural shadows and highlights. Rule of thirds composition with a clear focal point; bottom-right 25% of frame is relatively clean for logo overlay. Photorealistic, 8K resolution, sharp focus, professional color grading, commercial advertising quality. No text, no words, no labels, no logos embedded in the image.`;
}

function buildFallbackCampaign(companyName: string, industry: string, brandKit: BrandKit): CampaignData {
  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;
  const styleGuide = buildVisualStyleGuide(style);

  const days: CampaignDay[] = [
    { day: 1, objective: "Brand awareness", postConcept: `Introduce ${companyName}`, marketingAngle: "Storytelling", cta: "Learn our story" },
    { day: 2, objective: "Pain point", postConcept: "The problem we solve", marketingAngle: "Empathy", cta: "See how we help" },
    { day: 3, objective: "Differentiation", postConcept: "What makes us different", marketingAngle: "Value proposition", cta: "Discover our difference" },
    { day: 4, objective: "Social proof", postConcept: "Customer success story", marketingAngle: "Trust building", cta: "Read the story" },
    { day: 5, objective: "Transparency", postConcept: "Behind the scenes", marketingAngle: "Authenticity", cta: "Follow our journey" },
    { day: 6, objective: "Education", postConcept: `3 things about ${industry}`, marketingAngle: "Thought leadership", cta: "Get our free guide" },
    { day: 7, objective: "Conversion", postConcept: "Our offer", marketingAngle: "Urgency", cta: "Claim your offer" },
  ];

  const posts: SocialPostData[] = days.map((d) => ({
    day: d.day,
    platform: "instagram",
    hook: `${companyName}: ${d.postConcept}.`,
    caption: `${d.postConcept}\n\nAt ${companyName}, we believe in ${d.objective}.\n\n${d.cta} — link in bio.`,
    cta: d.cta,
    hashtags: [`#${companyName.replace(/\s+/g, "")}`, `#${industry.replace(/\s+/g, "")}`, "#Marketing", "#Brand", "#Business"],
    imagePrompt: `Commercial advertising photograph for ${companyName} (${industry} industry). Scene: ${d.postConcept}. ${styleGuide}. Dominant color: ${palette.primary} with ${palette.secondary} supporting tones and ${palette.accent} accents in lighting. Cinematic lighting, rule-of-thirds composition, bottom-right 25% clean for logo overlay. Photorealistic, 8K resolution, sharp focus, professional color grading. Strictly no text, no words, no logos in the image.`,
  }));

  return {
    title: `${companyName} — 7-Day Launch Campaign`,
    strategy: `A 7-day campaign for ${companyName} following an awareness → trust → conversion arc.`,
    days,
    posts,
  };
}
