"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logoutModel() {
  const cookieStore = await cookies();

  cookieStore.delete("karay-model");

  redirect("/area-da-modelo");
}