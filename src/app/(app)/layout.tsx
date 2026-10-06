import { Suspense } from "react";
import { NoticeBanner } from "@/components/layout/notice-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/queries/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  return (
    <div className="min-h-screen">
      <Sidebar user={user} businessName={settings.businessName} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense>
            <NoticeBanner />
          </Suspense>
          {children}
        </div>
      </main>
    </div>
  );
}
