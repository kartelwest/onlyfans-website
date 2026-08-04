import { NextResponse } from "next/server";

import { logAuditEntry } from "@/lib/audit/auditLogger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CHECKBOX_TRUE,
  ONBOARDING_PLATFORM,
  findOnboardingField,
  findOnboardingItem,
  isReadOnlyLinkedFieldKey,
  linkedFieldLocation,
  resolveDerivedStatus,
  type OnboardingItemStatus,
} from "@/lib/onboarding/definition";
import {
  DRIVE_FOLDER_ERROR,
  isValidDriveFolderValue,
} from "@/lib/models/driveFolder";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Linked columns that hold a Google Drive folder. The checklist writes them
 * through set_onboarding_linked_field, which does not know a folder from a
 * sentence — so the shape is checked here, the same rule /api/models/update
 * applies when the same columns are edited from the admin screens.
 */
const DRIVE_LINKED_FIELDS = new Set<string>([
  "drive_onlyfans",
  "drive_instagram",
  "drive_twitter",
  "content_drive_url",
]);

const STATUS_WORDS: Record<OnboardingItemStatus, string> = {
  completed: "preenchido",
  skipped: "pulado (não se aplica)",
  pending: "pendente",
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

    // The checklist as it stands right now. Read before anything is written so
    // every audit row can carry the value that is being replaced, and so a save
    // that changes nothing can be recognised as such and left unrecorded.
    const before = await loadOnboarding({
      supabase: auth.supabase,
      modelId,
      viewerRole: auth.profile.role,
    });

    const beforeItem = before.sections
      .flatMap((section) => section.items)
      .find((item) => item.itemKey === itemKey);

    const actor = {
      id: auth.profile.id,
      fullName: auth.profile.full_name || "Usuário",
      role: auth.profile.role,
    };

    // ----- a fill-in box -----------------------------------------------------
    //
    // A request may carry a field, a checkbox, or both, so this half decides on
    // its own whether it has work to do — an untouched field must not abandon
    // the checkbox that came with it.
    const fieldDefinition = body.field?.key
      ? findOnboardingField(itemKey, body.field.key)
      : undefined;

    if (body.field?.key && !fieldDefinition) {
      return fail("Campo de onboarding desconhecido.", 400);
    }

    if (fieldDefinition) {
      const isCheckbox = fieldDefinition.type === "checkbox";

      // A checkbox is stored as the literal "true" or as nothing at all, so
      // there is exactly one truthy representation to reason about.
      const value = isCheckbox
        ? (body.field?.value ?? "") === CHECKBOX_TRUE
          ? CHECKBOX_TRUE
          : ""
        : (body.field?.value ?? "").trim();

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

      if (
        fieldDefinition.type === "email" &&
        value !== "" &&
        !EMAIL_PATTERN.test(value)
      ) {
        return fail("Informe um endereço de e-mail válido.", 400);
      }

      if (
        fieldDefinition.linked &&
        DRIVE_LINKED_FIELDS.has(fieldDefinition.linked) &&
        !isValidDriveFolderValue(value)
      ) {
        return fail(DRIVE_FOLDER_ERROR, 400);
      }

      const previousValue =
        beforeItem?.fields.find((field) => field.key === fieldDefinition.key)
          ?.value ?? "";

      // Saving a form without touching this box must not manufacture history.
      const changed = previousValue !== value;

      if (changed && fieldDefinition.linked) {
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
      } else if (changed) {
        const merged: Record<string, unknown> = {
          ...(existing.field_values ?? {}),
          [fieldDefinition.key]: value,
        };

        if (value === "") {
          delete merged[fieldDefinition.key];
        }

        // A step that ticks itself keeps its two fields mutually exclusive:
        // typing an e-mail clears "does not apply", and ticking "does not
        // apply" clears the e-mail. Done here rather than in the browser, so a
        // direct API call cannot leave the pair in a state the UI never shows.
        if (definition.completion) {
          const { valueField, skipField } = definition.completion;

          if (fieldDefinition.key === valueField && value !== "") {
            delete merged[skipField];
          }

          if (fieldDefinition.key === skipField && value === CHECKBOX_TRUE) {
            delete merged[valueField];
          }
        }

        const update: Record<string, unknown> = {
          field_values: merged,
          updated_by: auth.user.id,
        };

        // The percentage counts `completed` rows, so a derived step has to
        // write that column too — otherwise "skipped" would look identical to
        // "nobody has looked at this yet" to the progress trigger.
        if (definition.completion) {
          const status = resolveDerivedStatus(
            definition.completion,
            Object.fromEntries(
              Object.entries(merged).map(([key, entry]) => [
                key,
                typeof entry === "string" ? entry : String(entry ?? ""),
              ]),
            ),
          );

          const shouldBeComplete = status !== "pending";

          if (shouldBeComplete !== existing.completed) {
            update.completed = shouldBeComplete;
            update.completed_by = shouldBeComplete ? auth.user.id : null;
          }
        }

        const { error: updateError } = await auth.supabase
          .from("model_onboarding_items")
          .update(update)
          .eq("id", existing.id);

        if (updateError) {
          console.error("Erro ao salvar campo:", updateError);

          return fail(
            updateError.message || "Não foi possível salvar este campo.",
            400,
          );
        }
      }

      const readableValue = (raw: string) =>
        isCheckbox ? (raw === CHECKBOX_TRUE ? "sim" : "não") : raw || null;

      if (changed) {
        await logAuditEntry(auth.supabase, {
          modelId,
          action: "onboarding_update",
          fieldName: `${itemKey}.${fieldDefinition.key}`,
          previousValue: readableValue(previousValue),
          newValue: readableValue(value),
          actor,
          source: "api:/api/models/onboarding",
          summary: `Onboarding — "${definition.title}": ${fieldDefinition.label} alterado de "${
            readableValue(previousValue) ?? "vazio"
          }" para "${readableValue(value) ?? "vazio"}"`,
        });
      }

      // A derived step's completion moved with the field; record that too, so
      // the history says "skipped" rather than leaving the reader to infer it.
      if (definition.completion) {
        const after = await loadOnboarding({
          supabase: auth.supabase,
          modelId,
          viewerRole: auth.profile.role,
        });

        const afterItem = after.sections
          .flatMap((section) => section.items)
          .find((item) => item.itemKey === itemKey);

        if (
          afterItem?.status &&
          beforeItem?.status &&
          afterItem.status !== beforeItem.status
        ) {
          await logAuditEntry(auth.supabase, {
            modelId,
            action: "onboarding_update",
            fieldName: itemKey,
            previousValue: STATUS_WORDS[beforeItem.status],
            newValue: STATUS_WORDS[afterItem.status],
            actor,
            source: "api:/api/models/onboarding",
            summary: `Onboarding — "${definition.title}" passou de ${
              STATUS_WORDS[beforeItem.status]
            } para ${STATUS_WORDS[afterItem.status]}`,
          });
        }

        return respondWithCurrent(auth, modelId, after);
      }
    }

    // ----- the checkbox ------------------------------------------------------
    if (typeof body.completed === "boolean") {
      if (definition.completion) {
        return fail(
          `"${definition.title}" conclui-se sozinha: preencha o campo ou marque a caixa de "não se aplica".`,
          400,
        );
      }

      // Nothing changed, so nothing is recorded.
      if (body.completed === existing.completed) {
        return respondWithCurrent(auth, modelId);
      }

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
        previousValue: existing.completed ? "concluída" : "pendente",
        newValue: body.completed ? "concluída" : "pendente",
        actor,
        source: "api:/api/models/onboarding",
        summary: `Onboarding — "${definition.title}" ${
          body.completed ? "marcada como concluída" : "reaberta"
        }`,
      });
    }

    return respondWithCurrent(auth, modelId);
  } catch (error) {
    console.error("Erro ao atualizar onboarding:", error);

    return fail("Erro interno ao atualizar o onboarding.", 500);
  }
}

/**
 * The checklist as it stands after the write.
 *
 * The percentage is maintained by trg_onboarding_progress, so it is read back
 * from the database rather than computed a second time here.
 */
async function respondWithCurrent(
  auth: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    user: { id: string };
    profile: ProfileRecord;
  },
  modelId: string,
  preloaded?: Awaited<ReturnType<typeof loadOnboarding>>,
) {
  const refreshed = await resolveOnboardingAccess({
    supabase: auth.supabase,
    modelId,
    userId: auth.user.id,
    role: auth.profile.role,
  });

  const { sections, summary } =
    preloaded ??
    (await loadOnboarding({
      supabase: auth.supabase,
      modelId,
      viewerRole: auth.profile.role,
    }));

  return NextResponse.json({
    sections,
    summary,
    canEdit: refreshed.canEdit,
    locked: refreshed.locked,
    viewerRole: auth.profile.role,
  });
}
