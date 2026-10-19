import { z } from 'zod';
import { m } from '@/paraglide/messages';

export const PASSWORD_MIN = 10;

// Mensagens como funções: avaliadas na validação, no idioma ativo.
const email = z
  .string()
  .trim()
  .min(1, { error: () => m.validation_email_required() })
  .email({ error: () => m.validation_email_invalid() });
const newPassword = z
  .string()
  .min(PASSWORD_MIN, { error: () => m.validation_password_min({ min: PASSWORD_MIN }) })
  .max(128, { error: () => m.validation_password_max() })
  .refine((value) => value.trim() === value, { error: () => m.validation_password_spaces() });
const mismatch = { path: ['confirm'], error: () => m.validation_passwords_mismatch() };

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: () => m.validation_password_required() }),
  remember_me: z.boolean(),
});
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, { error: () => m.validation_name_max() })
    .optional(),
  email,
  password: newPassword,
});
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, { error: () => m.validation_name_max() }),
});
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, mismatch);
export const changePasswordSchema = z
  .object({ current: z.string(), password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, mismatch);

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
