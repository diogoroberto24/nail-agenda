"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/auth/session";
import { changePassword, requestEmailChange, updateDisplayName, type ProfileResult } from "@/lib/profile/service";
import { createClient } from "@/lib/supabase/server";

export type { ProfileResult };

const SESSION_EXPIRED: ProfileResult = { ok: false, error: "Sua sessão expirou. Entre novamente." };

export async function updateDisplayNameAction(values: unknown): Promise<ProfileResult> {
  const me = await getCurrentProfessional();
  if (!me) return SESSION_EXPIRED;
  const result = await updateDisplayName(await createClient(), me, values);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function changePasswordAction(values: unknown): Promise<ProfileResult> {
  const me = await getCurrentProfessional();
  if (!me?.email) return SESSION_EXPIRED;
  return changePassword(await createClient(), me.email, values);
}

export async function requestEmailChangeAction(values: unknown): Promise<ProfileResult> {
  const me = await getCurrentProfessional();
  if (!me?.email) return SESSION_EXPIRED;
  return requestEmailChange(await createClient(), me.email, values);
}
