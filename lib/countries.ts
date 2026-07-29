// ISO 3166-1 alpha-2 codes. Names are resolved with Intl.DisplayNames so the
// list stays localized (pt-BR) without shipping a translated copy of it.
export const COUNTRY_CODES = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG",
  "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB",
  "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW",
  "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM",
  "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM",
  "CD", "CG", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ",
  "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE",
  "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF",
  "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP",
  "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN",
  "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL",
  "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR",
  "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT",
  "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ",
  "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS",
  "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI",
  "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW",
  "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR",
  "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF",
  "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL",
  "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES",
  "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ",
  "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC",
  "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU",
  "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const LOCALE = "pt-BR";

const displayNames = new Intl.DisplayNames([LOCALE], {
  type: "region",
  fallback: "code",
});

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

export function countryCodeToFlag(code: string): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function getCountryName(code: string | null): string | null {
  if (!code) {
    return null;
  }

  return displayNames.of(code) ?? code;
}

let cachedCountries: { code: string; name: string }[] | null = null;

export function listCountries(): { code: string; name: string }[] {
  if (!cachedCountries) {
    cachedCountries = COUNTRY_CODES.map((code) => ({
      code,
      name: displayNames.of(code) ?? code,
    })).sort((first, second) =>
      first.name.localeCompare(second.name, LOCALE, { sensitivity: "base" }),
    );
  }

  return cachedCountries;
}
