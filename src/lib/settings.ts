/** Supported business currencies (ISO 4217), shown in the settings currency select. */
export const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "PHP", label: "Philippine Peso" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "JPY", label: "Japanese Yen" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

export const ROLE_DESCRIPTIONS = {
  admin: "Everything, including settings and team",
  manager: "All business data, no settings or team",
  staff: "Read everything; edit customers, expenses and tasks",
} as const;
