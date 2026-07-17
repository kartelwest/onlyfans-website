"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type LoginAccount = {
  username: string;
  password: string;
  slug: string;
};

export async function loginModel(formData: FormData) {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "").trim();

  const accounts: LoginAccount[] = JSON.parse(
    process.env.MODEL_ACCOUNTS ?? "[]",
  );

  const account = accounts.find(
    (a) =>
      a.username.toLowerCase() === username &&
      a.password === password,
  );

  if (!account) {
    redirect("/area-da-modelo?erro=credenciais");
  }

  const cookieStore = await cookies();

  cookieStore.set("karay-model", account.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(`/modelo/${account.slug}`);
}