/**
 * The DAILY marketing checklist — the single source of truth.
 *
 * Everything else derives from this file: the rows seeded into
 * `public.model_daily_checklist_items`, the tick boxes and note boxes rendered
 * under the "Daily" tab, and the percentage that colours the DAILY badge on
 * /admin/models. To change the routine, change `DAILY_SECTIONS`; nothing else
 * needs touching.
 *
 * Two rules, the same ones the onboarding definition follows:
 *
 *   1. `key` values are permanent. A row is matched by (model_id, item_key),
 *      so renaming a key orphans whatever progress was recorded against it.
 *   2. No copy lives here. Titles and descriptions are UI text and come from
 *      the message catalogues under `daily.sections.*` / `daily.items.*`,
 *      keyed by the same permanent keys.
 *
 * The routine comes from two places. The agency's platform manuals supply the
 * daily war plan and the per-platform actions for OnlyFans, X/Twitter, Reddit,
 * Instagram, TikTok, YouTube and Facebook. Current agency practice supplies
 * the three blocks the manuals do not cover, and which is where the money
 * actually is: the chat shift (proactive outreach to spenders, mass messages
 * kept to two or three a week, unsending unbought PPV), retention (the
 * pre-renewal touch three to five days out, and the two-touch win-back after
 * a subscription expires), and measuring which traffic source converts.
 */

export type DailyItemDefinition = {
  key: string;
};

export type DailySectionDefinition = {
  key: string;
  items: DailyItemDefinition[];
};

export const DAILY_SECTIONS: DailySectionDefinition[] = [
  {
    // The 60–90 minute routine that the rest of the list expands on.
    key: "war_plan",
    items: [
      { key: "x_posts" },
      { key: "reddit_rounds" },
      { key: "short_video" },
      { key: "collab_outreach" },
      { key: "onlyfans_post_and_dms" },
    ],
  },
  {
    key: "onlyfans_page",
    items: [
      { key: "feed_post" },
      { key: "pinned_and_menu" },
      { key: "active_offer" },
      { key: "welcome_ppv" },
      { key: "check_analytics" },
    ],
  },
  {
    // The chat shift. Agency-run accounts out-earn solo creators here, not in
    // the feed: individual outreach to people who have already spent.
    key: "onlyfans_chat",
    items: [
      { key: "read_handoff" },
      { key: "answer_all_dms" },
      { key: "proactive_outreach" },
      { key: "mass_message" },
      { key: "ppv_drop" },
      { key: "unsend_expired" },
      { key: "write_handoff" },
    ],
  },
  {
    // Keeping a subscriber costs less than finding one, and an expired
    // subscriber is the warmest lead there is.
    key: "retention",
    items: [
      { key: "pre_renewal_touch" },
      { key: "winback_first_touch" },
      { key: "winback_discount" },
      { key: "thank_spenders" },
      { key: "track_rebill" },
    ],
  },
  {
    key: "twitter",
    items: [
      { key: "daily_posts" },
      { key: "post_formula" },
      { key: "peak_hours" },
      { key: "hashtags" },
      { key: "reply_big_accounts" },
      { key: "like_and_follow" },
      { key: "dm_engagers" },
      { key: "pinned_tweet" },
      { key: "sfs_retweets" },
    ],
  },
  {
    key: "reddit",
    items: [
      { key: "post_subreddits" },
      { key: "check_rules" },
      { key: "verification_and_karma" },
      { key: "native_upload" },
      { key: "hook_titles" },
      { key: "post_timing" },
      { key: "reply_comments" },
      { key: "track_results" },
    ],
  },
  {
    key: "instagram",
    items: [
      { key: "stories" },
      { key: "feed_or_reel" },
      { key: "engage_niche" },
      { key: "fast_dm_reply" },
      { key: "comment_to_dm" },
      { key: "story_interaction" },
      { key: "welcome_dm" },
      { key: "check_bio_link" },
    ],
  },
  {
    key: "tiktok",
    items: [
      { key: "videos" },
      { key: "trending_audio" },
      { key: "hook_and_watermark" },
      { key: "hashtags" },
      { key: "reply_comments" },
      { key: "pinned_comment_funnel" },
      { key: "peak_hours" },
    ],
  },
  {
    key: "youtube_facebook",
    items: [
      { key: "youtube_short" },
      { key: "youtube_comments" },
      { key: "facebook_post" },
      { key: "facebook_groups" },
      { key: "facebook_dms" },
    ],
  },
  {
    key: "collabs_growth",
    items: [
      { key: "find_creators" },
      { key: "send_sfs_dms" },
      { key: "deliver_agreed_posts" },
      { key: "track_collab_results" },
      { key: "tracked_links" },
    ],
  },
  {
    key: "safety",
    items: [
      { key: "backup_content" },
      { key: "proxy_check" },
      { key: "avoid_banned_words" },
      { key: "screenshot_posts" },
    ],
  },
];

/** "<section>.<item>" — the value stored in `item_key`. */
export function buildDailyItemKey(
  sectionKey: string,
  itemKey: string,
): string {
  return `${sectionKey}.${itemKey}`;
}

export type FlatDailyItem = {
  sectionKey: string;
  sectionOrder: number;
  key: string;
  itemOrder: number;
};

export function flattenDaily(): FlatDailyItem[] {
  return DAILY_SECTIONS.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      sectionKey: section.key,
      sectionOrder: sectionIndex + 1,
      key: item.key,
      itemOrder: itemIndex + 1,
    })),
  );
}

/** The definition behind an `item_key`, or undefined when it is not ours. */
export function findDailyItem(itemKey: string): FlatDailyItem | undefined {
  return flattenDaily().find(
    (item) => buildDailyItemKey(item.sectionKey, item.key) === itemKey,
  );
}

/**
 * The three bands the DAILY badge is painted in, and the one place they are
 * defined. Read by the admin list and by the Daily tab so a model can never
 * look red on one screen and yellow on the other.
 */
export type DailyBand = "red" | "yellow" | "green";

export function dailyBand(percentage: number): DailyBand {
  if (percentage >= 86) return "green";
  if (percentage >= 61) return "yellow";
  return "red";
}

/** Notes are optional, but not unbounded — the audit trail carries them too. */
export const DAILY_NOTE_MAX_LENGTH = 2000;
