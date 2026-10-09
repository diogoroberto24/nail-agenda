import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
