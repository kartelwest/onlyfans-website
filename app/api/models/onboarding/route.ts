import { NextResponse } from "next/server";

import { logAuditEntry } from "@/lib/audit/auditLogger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ONBOARDING_PLATFORM,
  findOnboardingField,
  findOnboardingItem,
  isReadOnlyLinkedFieldKey,
  linkedFieldLocation,
} from "@/lib/onboarding/definition";
import {
  syncOnboardingItems,
  loadOnboarding,
  resolveOnboardingAccess,
} from "@/lib/onboarding/server";

import type { ManagementRole } from "@/types/model";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: ManagementRole;
  active: boolean;
  status: string | null;
};

type PatchBody = {
  modelId?: string;
  itemKey?: string;
  completed?: boolean;
  field?: {
    key?: string;
    value?: string;
  };
};

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthenticatedProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: fail("Não autenticado.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, status")
    .eq("id", user.id)
    .maybeSingle<ProfileRecord>();

  if (profileError || !profile || !profile.active) {
    return { error: fail("Perfil inválido ou inativo.", 403) };
  }

  if (
    profile.role === "representative" &&
    profile.status !== "ativa"
  ) {
    return { error: fail("Representante inativo.", 403) };
  }

  return { supabase, user, profile };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const modelId = new URL(request.url).searchParams.get("modelId");

    if (!modelId) {
      return fail("Identificação da modelo não informada.", 400);
    }

    const access = await resolveOnboardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.model || !access.canRead) {
      return fail("Sem permissão para ver este onboarding.", 403);
    }

    await syncOnboardingItems({
      admin: createAdminClient(),
      modelId,
      locked: access.locked,
    });

    const { sections, summary } = await loadOnboarding({
      supabase: auth.supabase,
      modelId,
      viewerRole: auth.profile.role,
    });

    return NextResponse.json({
      sections,
      summary,
      canEdit: access.canEdit,
      locked: access.locked,
      viewerRole: auth.profile.role,
    });
  } catch (error) {
    console.error("Erro ao carregar onboarding:", error);

    return fail("Erro interno ao carregar o onboarding.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedProfile();

    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as PatchBody;

    const { modelId, itemKey } = body;

    if (!modelId || !itemKey) {
      return fail("Dados inválidos.", 400);
    }

    const definition = findOnboardingItem(itemKey);

    if (!definition) {
      return fail("Etapa de onboarding desconhecida.", 400);
    }

    const access = await resolveOnboardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    if (!access.model || !access.canRead) {
      return fail("Sem permissão para ver este onboarding.", 403);
    }

    if (!access.canEdit) {
      return fail(
        access.locked
          ? "Onboarding concluído: apenas o proprietário pode alterá-lo."
          : "Você não tem permissão para editar este onboarding.",
        403,
      );
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from("model_onboarding_items")
      .select("id, completed, field_values")
      .eq("model_id", modelId)
      .eq("platform", ONBOARDING_PLATFORM)
      .eq("item_key", itemKey)
      .maybeSingle<{
        id: string;
        completed: boolean;
        field_values: Record<string, unknown> | null;
      }>();

    if (existingError) {
      console.error("Erro ao buscar etapa:", existingError);

      return fail("Erro interno ao buscar a etapa.", 500);
    }

    if (!existing) {
      return fail("Etapa de onboarding não encontrada.", 404);
    }

    // A representative cannot change a step that is already complete. The same
    // rule is enforced by the per-item lock trigger; this pre-check gives a
    // clearer message and avoids a Postgres round-trip.
    if (existing.completed && auth.profile.role === "representative") {
      return fail("Etapa concluída: o representante não pode alterá-la.", 403);
    }

    // ----- a fill-in box -----------------------------------------------------
    if (body.field?.key) {
      const fieldDefinition = findOnboardingField(itemKey, body.field.key);

      if (!fieldDefinition) {
        return fail("Campo de onboarding desconhecido.", 400);
      }

      const value = (body.field.value ?? "").trim();

      // The actress's legal name and anything else read-only is shown for
      // reference only. The RPC would refuse it anyway (no allowlist entry);
      // this turns that into a clear message instead of a 400 from Postgres.
      if (
        fieldDefinition.linked &&
        isReadOnlyLinkedFieldKey(fieldDefinition.linked)
      ) {
        return fail(
          `"${fieldDefinition.label}" não é editável pelo onboarding. Altere em ${linkedFieldLocation(fieldDefinition.linked)}.`,
          400,
        );
      }

      if (fieldDefinition.linked) {
        // Goes to the column that already holds this value elsewhere in the
        // app, so it shows up there too — and stays editable there.
        const { error: rpcError } = await auth.supabase.rpc(
          "set_onboarding_linked_field",
          {
            target_model: modelId,
            field_key: fieldDefinition.linked,
            new_value: value,
          },
        );

        if (rpcError) {
          console.error("Erro ao salvar campo vinculado:", rpcError);

          return fail(
            rpcError.message || "Não foi possível salvar este campo.",
            400,
          );
        }
      } else {
        const merged = {
          ...(existing.field_values ?? {}),
          [fieldDefinition.key]: value,
        };

        if (value === "") {
          delete merged[fieldDefinition.key];
        }

        const { error: updateError } = await auth.supabase
          .from("model_onboarding_items")
          .update({ field_values: merged, updated_by: auth.user.id })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Erro ao salvar campo:", updateError);

          return fail(
            updateError.message || "Não foi possível salvar este campo.",
            400,
          );
        }
      }

      await logAuditEntry(auth.supabase, {
        modelId,
        action: "onboarding_update",
        fieldName: `${itemKey}.${fieldDefinition.key}`,
        previousValue: null,
        newValue: value || null,
        actor: {
          id: auth.profile.id,
          fullName: auth.profile.full_name || "Usuário",
          role: auth.profile.role,
        },
        source: "api:/api/models/onboarding",
        summary: `Onboarding — "${definition.title}": ${fieldDefinition.label} atualizado`,
      });
    }

    // ----- the checkbox ------------------------------------------------------
    if (typeof body.completed === "boolean") {
      // Re-read after any field write above, so a box being ticked in the same
      // request as its last required field is judged on the new values.
      const { sections } = await loadOnboarding({
        supabase: auth.supabase,
        modelId,
        viewerRole: auth.profile.role,
      });

      const current = sections
        .flatMap((section) => section.items)
        .find((item) => item.itemKey === itemKey);

      if (body.completed && current && current.missingRequired.length > 0) {
        return fail(
          `Preencha antes: ${current.missingRequired.join(", ")}.`,
          400,
        );
      }

      const { error: toggleError } = await auth.supabase
        .from("model_onboarding_items")
        .update({
          completed: body.completed,
          completed_by: body.completed ? auth.user.id : null,
          updated_by: auth.user.id,
        })
        .eq("id", existing.id);

      if (toggleError) {
        console.error("Erro ao atualizar etapa:", toggleError);

        return fail(
          toggleError.message || "Não foi possível atualizar esta etapa.",
          400,
        );
      }

      await logAuditEntry(auth.supabase, {
        modelId,
        action: "onboarding_update",
        fieldName: itemKey,
        previousValue: existing.completed ? "completed" : "pending",
        newValue: body.completed ? "completed" : "pending",
        actor: {
          id: auth.profile.id,
          fullName: auth.profile.full_name || "Usuário",
          role: auth.profile.role,
        },
        source: "api:/api/models/onboarding",
        summary: `Onboarding — "${definition.title}" marcado como ${
          body.completed ? "concluído" : "pendente"
        }`,
      });
    }

    // The percentage is maintained by trg_onboarding_progress, so re-reading
    // here is what the client gets back — never a number computed twice.
    const refreshed = await resolveOnboardingAccess({
      supabase: auth.supabase,
      modelId,
      userId: auth.user.id,
      role: auth.profile.role,
    });

    const { sections, summary } = await loadOnboarding({
      supabase: auth.supabase,
      modelId,
      viewerRole: auth.profile.role,
    });

    return NextResponse.json({
      sections,
      summary,
      canEdit: refreshed.canEdit,
      locked: refreshed.locked,
      viewerRole: auth.profile.role,
    });
  } catch (error) {
    console.error("Erro ao atualizar onboarding:", error);

    return fail("Erro interno ao atualizar o onboarding.", 500);
  }
}
