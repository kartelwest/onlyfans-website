import { redirect } from "next/navigation";

/**
 * Kept so older links still land somewhere. The representative view of a model
 * is keyed by the model now — one screen, rendered from the real rep dashboard
 * — so this hands over to it instead of maintaining a second copy that drifts.
 */
export default async function ViewAsRepresentativeModelRedirect({
  params,
}: {
  params: Promise<{ repId: string; modelId: string }>;
}) {
  const { modelId } = await params;

  redirect(`/admin/view-as/model/${modelId}/representative`);
}
