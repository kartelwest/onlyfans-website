import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  POST_BOARDING_ITEM_KEYS,
  POST_BOARDING_SECTIONS,
  flattenPostBoarding,
} from "./definition";

import type { ManagementRole } from "@/types/model";

type NoteRow = {
  id: string;
  model_id: string;
  item_key: string;
  section_key: string;
  item_title: string;
  item_description: string | null;
  body: string;
  created_by: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_by_role: string | null;
  created_at: string;
  updated_at: string;
};

const NOTE_COLUMNS = `
  id,
  model_id,
  item_key,
  section_key,
  item_title,
  item_description,
  body,
  created_by,
  created_by_name,
  created_by_role,
  updated_by,
  updated_by_name,
  updated_by_role,
  created_at,
  updated_at
`;

export type PostBoardingAccess = {
  canRead: boolean;
  canEdit: boolean;
};

type ModelAccessRow = {
  id: string;
  representative_id: string | null;
};

export async function resolvePostBoardingAccess({
  supabase,
  modelId,
  userId,
  role,
}: {
  supabase: SupabaseClient;
  modelId: string;
  userId: string;
  role: ManagementRole;
}): Promise<PostBoardingAccess & { model: ModelAccessRow | null }> {
  const { data: model } = await supabase
    .from("models")
    .select("id, representative_id")
    .eq("id", modelId)
    .maybeSingle<ModelAccessRow>();

  if (!model) {
    return { canRead: false, canEdit: false, model: null };
  }

  const isStaff = role === "owner" || role === "administrator";
  const isAssignedRep =
    role === "representative" && model.representative_id === userId;

  return {
    canRead: isStaff || isAssignedRep,
    canEdit: isStaff || isAssignedRep,
    model,
  };
}

export type PostBoardingNote = {
  id: string;
  modelId: string;
  itemKey: string;
  sectionKey: string;
  itemTitle: string;
  itemDescription: string | null;
  body: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByRole: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedByRole: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostBoardingItemView = {
  key: string;
  title: string;
  description: string;
  notes: PostBoardingNote[];
};

export type PostBoardingSectionView = {
  key: string;
  title: string;
  items: PostBoardingItemView[];
};

function mapNote(row: Record<string, unknown>): PostBoardingNote {
  return {
    id: String(row.id ?? ""),
    modelId: String(row.model_id ?? ""),
    itemKey: String(row.item_key ?? ""),
    sectionKey: String(row.section_key ?? ""),
    itemTitle: String(row.item_title ?? ""),
    itemDescription: (row.item_description as string | null) ?? null,
    body: String(row.body ?? ""),
    createdBy: (row.created_by as string | null) ?? null,
    createdByName: (row.created_by_name as string | null) ?? null,
    createdByRole: (row.created_by_role as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedByName: (row.updated_by_name as string | null) ?? null,
    updatedByRole: (row.updated_by_role as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function loadPostBoarding({
  supabase,
  modelId,
}: {
  supabase: SupabaseClient;
  modelId: string;
}): Promise<PostBoardingSectionView[]> {
  const canonical = flattenPostBoarding();

  const { data: rows, error } = await supabase
    .from("model_post_boarding_notes")
    .select(NOTE_COLUMNS)
    .eq("model_id", modelId)
    .in("item_key", POST_BOARDING_ITEM_KEYS)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const notesByItem = new Map<string, PostBoardingNote[]>();

  for (const row of (rows ?? []) as NoteRow[]) {
    const note = mapNote(row as unknown as Record<string, unknown>);
    const list = notesByItem.get(note.itemKey) ?? [];

    list.push(note);
    notesByItem.set(note.itemKey, list);
  }

  return POST_BOARDING_SECTIONS.map((section) => ({
    key: section.key,
    title: section.title,
    items: section.items.map((item) => {
      const canonicalItem = canonical.find((flat) => flat.key === item.key);

      return {
        key: item.key,
        title: canonicalItem?.title ?? item.title,
        description: canonicalItem?.description ?? item.description,
        notes: notesByItem.get(item.key) ?? [],
      };
    }),
  }));
}
