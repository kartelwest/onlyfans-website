import { formatBrazilDateTime } from "@/lib/models/formatDateTime";
import type { ManagementRole } from "@/types/model";

export function getRoleLabel(role: ManagementRole | null | undefined): string {
  switch (role) {
    case "owner":
      return "Proprietário";
    case "administrator":
      return "Administrador";
    case "representative":
      return "Representante";
    case "model":
      return "Modelo";
    default:
      return "Usuário";
  }
}

export type RepresentativeAssignmentResult = {
  body: string;
  previousRepresentativeId: string | null;
  newRepresentativeId: string | null;
};

export function buildRepresentativeAssignmentNote({
  previousRepresentativeId,
  previousRepresentativeName,
  newRepresentativeId,
  newRepresentativeName,
  actorName,
  actorRole,
  changedAt = new Date(),
}: {
  previousRepresentativeId: string | null;
  previousRepresentativeName?: string | null | undefined;
  newRepresentativeId: string | null;
  newRepresentativeName?: string | null | undefined;
  actorName: string;
  actorRole: ManagementRole | null | undefined;
  changedAt?: Date;
}): RepresentativeAssignmentResult {
  const timestamp = formatBrazilDateTime(changedAt);
  const actorLabel = actorName || "Usuário";
  const roleLabel = getRoleLabel(actorRole);
  const prevName = previousRepresentativeName || "Representante";
  const newName = newRepresentativeName || "Representante";

  let body: string;

  if (!previousRepresentativeId && newRepresentativeId) {
    body = `${newName} foi atribuído(a) como representante da modelo por ${actorLabel}, ${roleLabel}, em ${timestamp}.`;
  } else if (previousRepresentativeId && !newRepresentativeId) {
    body = `${prevName} foi removido(a) como representante da modelo por ${actorLabel}, ${roleLabel}, em ${timestamp}.`;
  } else if (previousRepresentativeId && newRepresentativeId) {
    body = `Responsável alterado de ${prevName} para ${newName} por ${actorLabel}, ${roleLabel}, em ${timestamp}.`;
  } else {
    body = `Nenhuma alteração de representante registrada por ${actorLabel}, ${roleLabel}, em ${timestamp}.`;
  }

  return {
    body,
    previousRepresentativeId,
    newRepresentativeId,
  };
}
