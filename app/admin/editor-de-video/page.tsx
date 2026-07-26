import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getModelsForVideo, getVideoJobs, getVideoTemplates } from "@/lib/video/jobs";
import VideoEditorDashboard, {
  type VideoEditorDashboardProps,
} from "./VideoEditorDashboard";

export const dynamic = "force-dynamic";

export default async function VideoEditorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active || (profile.role !== "owner" && profile.role !== "administrator")) {
    redirect("/login");
  }

  const [jobs, templates, models] = await Promise.all([
    getVideoJobs(),
    getVideoTemplates(),
    getModelsForVideo(),
  ]);

  return (
    <VideoEditorDashboard
      initialJobs={jobs as unknown as VideoEditorDashboardProps["initialJobs"]}
      initialTemplates={templates as unknown as VideoEditorDashboardProps["initialTemplates"]}
      initialModels={models as unknown as VideoEditorDashboardProps["initialModels"]}
    />
  );
}
