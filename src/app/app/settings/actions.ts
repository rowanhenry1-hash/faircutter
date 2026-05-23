"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { stringToMinorUnits } from "@/lib/money";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const name = ((formData.get("name") as string) || "").trim();
  const preferredCurrency = (
    (formData.get("preferredCurrency") as string) || "USD"
  )
    .trim()
    .toUpperCase();
  const incomeRaw = ((formData.get("declaredIncome") as string) || "").trim();
  const dataSharingOptIn = formData.get("dataSharingOptIn") === "on";

  let declaredIncome: number | null = null;
  if (incomeRaw) {
    declaredIncome = stringToMinorUnits(incomeRaw, preferredCurrency);
  }

  await db
    .update(users)
    .set({
      name: name || null,
      preferredCurrency,
      declaredIncome,
      dataSharingOptIn,
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/app/settings");
  revalidatePath("/app");
}

/**
 * Account deletion stub — real cascade delete is a post-launch GDPR task.
 */
export async function deleteAccount(): Promise<{ ok: false; message: string }> {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  // TODO: delete user rows, sessions, and owned groups per retention policy.
  return {
    ok: false,
    message:
      "Account deletion is not available yet. Email your request to support — we will remove your data manually.",
  };
}
