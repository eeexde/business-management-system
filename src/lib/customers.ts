import { z } from "zod";

/** Optional free-text field: trims, caps length, and stores blanks as null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep this under ${max} characters.` })
    .optional()
    .transform((v) => (v ? v : null));

/** Validates the shared customer create/edit form. */
export const CustomerSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(1, { error: "Name is required." })
    .max(120, { error: "Keep the name under 120 characters." }),
  company: optionalText(120),
  email: z
    .string()
    .trim()
    .max(200, { error: "Keep the email under 200 characters." })
    .optional()
    .refine((v) => !v || z.email().safeParse(v).success, { error: "Enter a valid email address." })
    .transform((v) => (v ? v : null)),
  phone: optionalText(40),
  address: optionalText(500),
  notes: optionalText(5000),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;
