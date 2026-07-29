const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NormalizedModelFields = {
  fullName: string | null;
  stageName: string | null;
  email: string | null;
  emailValid: boolean;
  phone: string | null;
  phoneDigits: string | null;
  phoneValid: boolean;
  dateOfBirth: string | null;
  dateAmbiguous: boolean;
  country: string | null;
};

export function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().replace(/\s+/g, " ");

  return trimmed || null;
}

export function normalizeEmail(
  value: unknown,
): { value: string | null; valid: boolean } {
  if (typeof value !== "string") {
    return { value: null, valid: false };
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return { value: null, valid: false };
  }

  const valid = EMAIL_REGEX.test(trimmed);

  return { value: trimmed, valid };
}

export function normalizePhone(
  value: unknown,
): { normalized: string | null; digits: string | null; valid: boolean } {
  if (typeof value !== "string") {
    return { normalized: null, digits: null, valid: false };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { normalized: null, digits: null, valid: false };
  }

  let normalized = trimmed.replace(/[^0-9+]/g, "");

  if (normalized.includes("+") && !normalized.startsWith("+")) {
    normalized = normalized.replace(/\+/g, "");
  }

  const digits = normalized.replace(/\D/g, "");

  const valid = digits.length >= 8;

  return { normalized, digits, valid };
}

function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseISODate(value: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!isValidDate(year, month, day)) return null;

  return value;
}

function parseSlashDate(value: string): { value: string | null; ambiguous: boolean } | null {
  const match = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);

  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);

  const asDayMonth = isValidDate(year, second, first);
  const asMonthDay = isValidDate(year, first, second);

  if (asDayMonth && asMonthDay && first !== second) {
    return { value: null, ambiguous: true };
  }

  if (asDayMonth && asMonthDay && first === second) {
    const month = String(second).padStart(2, "0");
    const day = String(first).padStart(2, "0");

    return { value: `${year}-${month}-${day}`, ambiguous: false };
  }

  if (asDayMonth) {
    const month = String(second).padStart(2, "0");
    const day = String(first).padStart(2, "0");

    return { value: `${year}-${month}-${day}`, ambiguous: false };
  }

  if (asMonthDay) {
    const month = String(first).padStart(2, "0");
    const day = String(second).padStart(2, "0");

    return { value: `${year}-${month}-${day}`, ambiguous: false };
  }

  return null;
}

export function normalizeDateOfBirth(
  value: unknown,
): { value: string | null; ambiguous: boolean } {
  if (typeof value !== "string" || !value.trim()) {
    return { value: null, ambiguous: false };
  }

  const trimmed = value.trim();

  const iso = parseISODate(trimmed);

  if (iso) {
    return { value: iso, ambiguous: false };
  }

  const slash = parseSlashDate(trimmed);

  if (slash) {
    return slash;
  }

  return { value: null, ambiguous: false };
}

export function normalizeCountry(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  if (
    lower === "brasil" ||
    lower === "brazil" ||
    lower === "br" ||
    lower.startsWith("brasil")
  ) {
    return "Brasil";
  }

  return trimmed;
}

export function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) =>
      typeof item === "string" ? item.trim() : String(item ?? "").trim(),
    )
    .filter((item) => item.length > 0);
}

export function normalizeExtractedModelData(
  input: Record<string, unknown>,
): NormalizedModelFields {
  const fullName = normalizeName(input.fullName);
  const stageName = normalizeName(input.stageName);

  const emailResult = normalizeEmail(input.email);
  const phoneResult = normalizePhone(input.phone);
  const dateResult = normalizeDateOfBirth(input.dateOfBirth);
  const country = normalizeCountry(input.country);

  return {
    fullName,
    stageName,
    email: emailResult.value,
    emailValid: emailResult.valid,
    phone: phoneResult.normalized,
    phoneDigits: phoneResult.digits,
    phoneValid: phoneResult.valid,
    dateOfBirth: dateResult.value,
    dateAmbiguous: dateResult.ambiguous,
    country,
  };
}

export function generateTemporaryPassword(phoneDigits: string): string {
  if (!phoneDigits || phoneDigits.length === 0) {
    return "";
  }

  const lastFour = phoneDigits.slice(-4);

  return `${lastFour}1234567`;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "Nome completo",
  stageName: "Nome artístico",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  dateOfBirth: "Data de nascimento",
  country: "País",
};

export function getModelFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

type ExtractableField =
  | "fullName"
  | "stageName"
  | "email"
  | "phone"
  | "dateOfBirth"
  | "country";

export type ConflictItem = {
  field: ExtractableField;
  label: string;
  current: string;
  extracted: string;
};

export function computeConflicts(
  extracted: NormalizedModelFields,
  currentForm: Partial<Record<ExtractableField, string | null>>,
): ConflictItem[] {
  const fields: ExtractableField[] = [
    "fullName",
    "stageName",
    "email",
    "phone",
    "dateOfBirth",
    "country",
  ];

  const conflicts: ConflictItem[] = [];

  for (const field of fields) {
    const extractedValue = extracted[field];

    if (typeof extractedValue !== "string" || !extractedValue.trim()) {
      continue;
    }

    const currentValue =
      typeof currentForm[field] === "string"
        ? String(currentForm[field]).trim()
        : "";

    if (currentValue && currentValue !== extractedValue) {
      conflicts.push({
        field,
        label: getModelFieldLabel(field),
        current: currentValue,
        extracted: extractedValue,
      });
    }
  }

  return conflicts;
}
