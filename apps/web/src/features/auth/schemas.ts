import { z } from 'zod';

export const PASSWORD_MIN = 10;

const email = z.string().trim().min(1, 'Indica o teu email').email('Email inválido');
const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Usa pelo menos ${PASSWORD_MIN} caracteres`)
  .max(128, 'A password é demasiado longa')
  .refine((value) => value.trim() === value, 'Sem espaços no início ou no fim');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Indica a password'),
  remember_me: z.boolean(),
});
export const registerSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email,
  password: newPassword,
});
export const profileSchema = z.object({
  name: z.string().trim().max(120, 'O nome é demasiado longo'),
});
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As passwords não coincidem',
  });
export const changePasswordSchema = z
  .object({ current: z.string(), password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As passwords não coincidem',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
export type ResetValues = z.infer<typeof resetSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
