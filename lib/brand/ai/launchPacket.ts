import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "@/lib/anthropic/config";
import type { BrandProfile, LaunchPacket, Talent } from "@/types/brand";

export async function generateLaunchPacket(
  talent: Talent,
  brandProfile: BrandProfile,
): Promise<LaunchPacket> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a senior brand strategist for a talent agency. You help launch Instagram (and optionally X) brands for models, actresses, influencers and other clients. You are given a brand profile and you output a complete launch packet in Portuguese by default, with the option to include English/Spanish variants if requested.

Rules:
- Use the stage name / display name provided. Do NOT use or reveal the legal name.
- Respect all boundaries and consent flags.
- Never generate nude or sexual imagery descriptions.
- Never fabricate personal experiences, relationships, or false claims.
- Avoid engagement-growth hacks: no follow-for-follow, no mass DM scripts, no automation of inauthentic behavior.
- Suggest only platform-compliant official flows (Professional Instagram account, linked Facebook Page, official OAuth).
- Output only valid JSON matching the requested schema.`;

  const userMessage = `Brand Profile:
- Stage name: ${brandProfile.displayName ?? talent.stageName ?? talent.displayName}
- Preferred username: ${brandProfile.preferredUsername ?? "not set"}
- Pronunciation: ${brandProfile.pronunciation ?? "not set"}
- Category: ${brandProfile.brandCategory ?? "not set"}
- Niches: ${brandProfile.niche1}${brandProfile.niche2 ? `, ${brandProfile.niche2}` : ""}${brandProfile.niche3 ? `, ${brandProfile.niche3}` : ""}
- Primary positioning: ${brandProfile.primaryPositioning ?? "not set"}
- Secondary positioning: ${brandProfile.secondaryPositioning ?? "not set"}
- Target audience: ${brandProfile.targetGender ?? "not set"}, ${brandProfile.targetAgeMin ?? "?"}-${brandProfile.targetAgeMax ?? "?"} years, countries: ${brandProfile.targetCountries?.join(", ") ?? "not set"}, languages: ${brandProfile.targetLanguages?.join(", ") ?? "not set"}
- Target interests: ${brandProfile.targetInterests?.join(", ") ?? "not set"}
- Markets to avoid: ${brandProfile.marketsToAvoid?.join(", ") ?? "not set"}
- AI guidance: ${brandProfile.aiGuidance ?? "none"}
- Default languages: ${brandProfile.defaultLanguages.join(", ")}
- Adult platform links allowed: ${brandProfile.allowAdultPlatformLinks ? "yes" : "no"}

Generate a complete launch packet. Return ONLY a JSON object with these fields:
- stageName
- displayName
- usernameOptions (array of 5-8 strings, without @)
- bioOptions (array of 3-5 strings, max 150 chars each, Portuguese by default)
- profilePictureSpec (string describing the recommended profile picture)
- bannerSpec (string)
- linkInBio (string, suggest a clean linktree-style URL or "link em breve")
- contentPillars (array of 5-8 strings)
- brandVoice (string, 1-2 paragraphs)
- launchStrategy30Days (string, concise bullet list)
- checklist (array of strings, manual launch steps the human must complete)
- accountTypeRecommendation (string)
- moderationRecommendation (string)`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const cleaned = text.replace(/```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<LaunchPacket>;

  return {
    stageName: parsed.stageName ?? (brandProfile.displayName ?? talent.displayName),
    displayName: parsed.displayName ?? (brandProfile.displayName ?? talent.displayName),
    usernameOptions: parsed.usernameOptions ?? [],
    bioOptions: parsed.bioOptions ?? [],
    profilePictureSpec: parsed.profilePictureSpec ?? "",
    bannerSpec: parsed.bannerSpec ?? "",
    linkInBio: parsed.linkInBio ?? "",
    contentPillars: parsed.contentPillars ?? [],
    brandVoice: parsed.brandVoice ?? "",
    launchStrategy30Days: parsed.launchStrategy30Days ?? "",
    checklist: parsed.checklist ?? [],
    accountTypeRecommendation: parsed.accountTypeRecommendation ?? "",
    moderationRecommendation: parsed.moderationRecommendation ?? "",
  };
}
