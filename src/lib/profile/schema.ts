import { z } from "zod";

/** O Supabase aceita senhas de até 72 caracteres (limite do bcrypt). */
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(2, "Informe seu nome.").max(60, "O nome está muito longo."),
});
export type DisplayNameValues = z.infer<typeof displayNameSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: z
      .string()
      .min(MIN_PASSWORD, `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      .max(MAX_PASSWORD, `A nova senha pode ter no máximo ${MAX_PASSWORD} caracteres.`),
    confirmPassword: z.string().min(1, "Repita a nova senha."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não são iguais.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha precisa ser diferente da atual.",
  });
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export const emailChangeSchema = z.object({
  newEmail: z.string().trim().min(1, "Informe o novo e-mail.").email("E-mail inválido."),
  currentPassword: z.string().min(1, "Informe sua senha atual."),
});
export type EmailChangeValues = z.infer<typeof emailChangeSchema>;
