/**
 * Regras do perfil (nome, senha, e-mail). Recebem o cliente Supabase da usuária logada e não
 * dependem do Next.js, para poderem ser testadas contra o banco real.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { displayNameSchema, emailChangeSchema, passwordChangeSchema } from "@/lib/profile/schema";

export type ProfileResult = { ok: true; message?: string } | { ok: false; error: string; field?: "currentPassword" | "newPassword" | "newEmail" };

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const WRONG_PASSWORD: ProfileResult = { ok: false, error: "Senha atual incorreta.", field: "currentPassword" };

/** Confere a senha atual (ação sensível). Devolve null se estiver certa. */
async function verifyCurrentPassword(supabase: SupabaseClient, email: string, password: string): Promise<ProfileResult | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  if (error.status === 429) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }
  if (error.status === 400 || error.status === 401 || error.status === 422) return WRONG_PASSWORD;
  return { ok: false, error: "Não foi possível verificar agora. Verifique a internet e tente de novo." };
}

/** Atualiza o nome de exibição (usado em mensagens e na agenda) e o nome do perfil. */
export async function updateDisplayName(
  supabase: SupabaseClient,
  actor: { professionalId: string; userId: string },
  values: unknown,
): Promise<ProfileResult> {
  const parsed = displayNameSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = parsed.data.displayName;

  const pro = await supabase.from("professionals").update({ display_name: name }).eq("id", actor.professionalId).select("id");
  if (pro.error || !pro.data?.length) return { ok: false, error: GENERIC_ERROR };

  const profile = await supabase.from("profiles").update({ full_name: name }).eq("id", actor.userId).select("id");
  if (profile.error) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, message: "Nome atualizado." };
}

/** Troca a senha exigindo a senha atual. */
export async function changePassword(supabase: SupabaseClient, email: string, values: unknown): Promise<ProfileResult> {
  const parsed = passwordChangeSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0] === "newPassword" ? "newPassword" : undefined;
    return { ok: false, error: issue.message, field };
  }

  const wrong = await verifyCurrentPassword(supabase, email, parsed.data.currentPassword);
  if (wrong) return wrong;

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    if (error.status === 422) return { ok: false, error: "Esta senha não é aceita. Escolha outra, mais forte.", field: "newPassword" };
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true, message: "Senha alterada." };
}

/**
 * Pede a troca de e-mail exigindo a senha atual. O Supabase envia um link de confirmação:
 * o e-mail de acesso só muda depois que o link for aberto.
 */
export async function requestEmailChange(supabase: SupabaseClient, currentEmail: string, values: unknown): Promise<ProfileResult> {
  const parsed = emailChangeSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: issue.path[0] === "newEmail" ? "newEmail" : "currentPassword" };
  }
  if (parsed.data.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
    return { ok: false, error: "Este já é o seu e-mail de acesso.", field: "newEmail" };
  }

  const wrong = await verifyCurrentPassword(supabase, currentEmail, parsed.data.currentPassword);
  if (wrong) return wrong;

  const { error } = await supabase.auth.updateUser({ email: parsed.data.newEmail });
  if (error) {
    if (error.status === 429) return { ok: false, error: "Muitos pedidos de troca. Aguarde um pouco e tente de novo." };
    if (error.status === 422 || /already|registered/i.test(error.message)) {
      return { ok: false, error: "Não foi possível usar este e-mail.", field: "newEmail" };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  return {
    ok: true,
    message: `Enviamos um link de confirmação para ${parsed.data.newEmail}. O e-mail de acesso só muda depois que você abrir o link.`,
  };
}
