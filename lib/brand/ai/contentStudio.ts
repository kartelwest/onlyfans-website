import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/anthropic/config";
import type { BrandProfile, ContentType, GeneratedContent, Platform, Talent } from "@/types/brand";

export interface ContentGenerationRequest {
  talent: Talent;
  brandProfile: BrandProfile;
  platform: Platform;
  contentType: ContentType;
  objective?: string;
  pillar?: string;
  language?: string;
  dailyDirective?: string | null;
  mediaAssetIds?: string[];
}

export async function generateContent(
  request: ContentGenerationRequest,
): Promise<GeneratedContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey });
  const language = request.language ?? request.brandProfile.defaultLanguages[0] ?? "pt-BR";

  const systemPrompt = `You are an expert social-media content strategist and copywriter for a talent agency. You create platform-native content for Instagram and X/Twitter for models, actresses and influencers. You never generate sexual or nude content, never fabricate personal experiences, and never use engagement-bait tactics that violate platform policies. You write in the client's voice, guided by their niches, positioning, and AI guidance. You respect all boundaries. Output valid JSON only.`;

  const userMessage = `Generate a single ${request.platform} ${request.contentType} in ${language}.

Brand Profile:
- Display name: ${request.brandProfile.displayName ?? request.talent.displayName}
- Stage name: ${request.talent.stageName ?? request.talent.displayName}
- Niches: ${request.brandProfile.niche1}${request.brandProfile.niche2 ? `, ${request.brandProfile.niche2}` : ""}${request.brandProfile.niche3 ? `, ${request.brandProfile.niche3}` : ""}
- Primary positioning: ${request.brandProfile.primaryPositioning ?? "not set"}
- Secondary positioning: ${request.brandProfile.secondaryPositioning ?? "not set"}
- Brand voice / AI guidance: ${request.brandProfile.aiGuidance ?? "not set"}
${request.dailyDirective ? `- Daily directive: ${request.dailyDirective}` : ""}
- Target gender: ${request.brandProfile.targetGender ?? "not set"}, age ${request.brandProfile.targetAgeMin ?? "?"}-${request.brandProfile.targetAgeMax ?? "?"}
- Target countries: ${request.brandProfile.targetCountries?.join(", ") ?? "not set"}
- Target languages: ${request.brandProfile.targetLanguages?.join(", ") ?? "not set"}
- Target interests: ${request.brandProfile.targetInterests?.join(", ") ?? "not set"}
- Markets to avoid: ${request.brandProfile.marketsToAvoid?.join(", ") ?? "not set"}
${request.objective ? `- Objective: ${request.objective}` : ""}
${request.pillar ? `- Content pillar: ${request.pillar}` : ""}

Return ONLY a JSON object with:
- caption (string, main caption/post text)
- hashtags (array of 10-30 strings, without #)
- altText (string, accessibility description)
- cta (string, call-to-action)
- body (string, longer-form copy if needed for a thread, otherwise same as caption)
- platform (string)
- contentType (string)
- language (string)
- riskNotes (array of strings, any policy/brand risks)`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const cleaned = text.replace(/```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<GeneratedContent>;

  return {
    caption: parsed.caption ?? "",
    hashtags: parsed.hashtags ?? [],
    altText: parsed.altText ?? "",
    cta: parsed.cta ?? "",
    body: parsed.body ?? parsed.caption ?? "",
    platform: request.platform,
    contentType: request.contentType,
    language,
    riskNotes: parsed.riskNotes ?? [],
  };
}
