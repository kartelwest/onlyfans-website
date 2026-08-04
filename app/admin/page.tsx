import { redirect } from "next/navigation";

/**
 * `/admin` never had a page. The old "Dashboard" tab pointed here and answered
 * 404; the tab is now "Pageview" and points at /admin/pageview.
 *
 * This redirect stays for the bookmarks and old links that still say /admin,
 * so the address is a way in rather than a dead end. The model list re-checks
 * the viewer's role and sends anyone who does not belong to their own screen.
 */
export default function AdminIndexPage() {
  redirect("/admin/models");
}
