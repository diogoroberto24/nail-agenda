import { z } from "zod";
import { MAX_PASSWORD, MIN_PASSWORD } from "@/lib/profile/schema";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Cadastro de nova profissional. O código de convite é conferido no banco (ver migração do cadastro). */
export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome.").max(60, "O nome está muito longo."),
    email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
    password: z
      .string()
      .min(MIN_PASSWORD, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`)
      .max(MAX_PASSWORD, `A senha pode ter no máximo ${MAX_PASSWORD} caracteres.`),
    confirmPassword: z.string().min(1, "Repita a senha."),
    inviteCode: z.string().trim().min(1, "Informe o código de convite.").max(100, "Código inválido."),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "As senhas não são iguais." });

export type SignupValues = z.infer<typeof signupSchema>;
