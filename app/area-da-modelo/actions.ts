"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type ModelAccount = {
  username: string;
  password: string;
  slug: string;
};

export async function loginModel(formData: FormData) {
  const submittedUsername = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();

  const submittedPassword = String(formData.get("password") ?? "").trim();

  const accounts: ModelAccount[] = [
    {
      username: process.env.RAISSA_USERNAME ?? "",
      password: process.env.RAISSA_PASSWORD ?? "",
      slug: process.env.RAISSA_SLUG ?? "",
    },
    {
      username: process.env.GRACE_USERNAME ?? "",
      password: process.env.GRACE_PASSWORD ?? "",
      slug: process.env.GRACE_SLUG ?? "",
    },
    {
      username: process.env.DANI_USERNAME ?? "",
      password: process.env.DANI_PASSWORD ?? "",
      slug: process.env.DANI_SLUG ?? "",
    },
  ];

  const account = accounts.find(
    (item) =>
      item.username.toLowerCase() === submittedUsername &&
      item.password === submittedPassword,
  );

  if (!account || !account.slug) {
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