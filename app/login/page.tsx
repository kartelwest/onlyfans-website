import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; expired?: string }>;
}) {
  const { returnTo, expired } = await searchParams;

  return <LoginForm returnTo={returnTo} expired={expired === "1"} />;
}
