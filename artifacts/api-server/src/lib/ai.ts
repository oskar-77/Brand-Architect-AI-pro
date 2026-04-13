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
  "visualStyleRules": "A detailed paragraph on how to apply the visual identity — photography style, layout rules, typography guidance, logo safe zones, what to avoid"
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
    visualStyleRules: "Clean compositions with generous whitespace. Consistent use of primary color for key elements. Professional photography, natural light. Strong typographic hierarchy.",
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
    ? `\n\nIMPORTANT campaign brief from the client:\n"${brief}"\n\nThis brief MUST shape the campaign direction, tone, style, and strategy. Follow it closely.`
    : "";

  const systemPrompt = `You are a world-class social media strategist and copywriter. You create complete ${count}-day marketing campaigns that are specific, creative, and ready to publish. You ALWAYS respond with valid JSON only — no markdown, no explanation, just the raw JSON object.`;

  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;

  const userPrompt = `Create a complete 7-day social media campaign for this brand:

Company: ${companyName}
Industry: ${industry}
Description: ${companyDescription}
Brand Personality: ${brandKit.personality}
Tone of Voice: ${brandKit.toneOfVoice}
Visual Style: ${style}
Primary Color: ${palette.primary}
${briefContext}

Return a JSON object with exactly this structure:
{
  "title": "Campaign title",
  "strategy": "2-3 sentence overview of the campaign strategy and narrative arc",
  "days": [
    {
      "day": 1,
      "objective": "What this day achieves",
      "postConcept": "Specific concept for this post",
      "marketingAngle": "The psychological/marketing angle being used",
      "cta": "The call to action"
    }
    ... (${count} days total)
  ],
  "posts": [
    {
      "day": 1,
      "platform": "instagram",
      "hook": "The opening line that stops the scroll — make it punchy, specific, provocative",
      "caption": "Full post caption (3-5 paragraphs, conversational, matches brand tone, ends with CTA). Use line breaks.",
      "cta": "The specific call to action",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
      "imagePrompt": "Detailed Midjourney/DALL-E prompt: describe scene, lighting, mood, style, composition. Include: ${palette.primary} as dominant color accent, cinematic lighting, NO text/logos/words in image, leave top-right 20% empty for logo overlay, ${style} aesthetic, ultra-high quality 16:9"
    }
    ... (${count} posts total, one per day)
  ]
}

Make every post UNIQUE, SPECIFIC to ${companyName}, and ready to publish. No generic content.`;

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

function buildFallbackCampaign(companyName: string, industry: string, brandKit: BrandKit): CampaignData {
  const palette = brandKit.colorPalette;
  const style = brandKit.visualStyle;

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
    imagePrompt: `Commercial advertising photograph: ${d.postConcept}. ${style} aesthetic, ${palette.primary} color accent, cinematic lighting, no text, no logos, top-right corner empty for logo placement, 16:9 ratio, ultra-high quality.`,
  }));

  return {
    title: `${companyName} — 7-Day Launch Campaign`,
    strategy: `A 7-day campaign for ${companyName} following an awareness → trust → conversion arc.`,
    days,
    posts,
  };
}
