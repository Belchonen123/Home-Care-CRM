import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Sidebar } from "@/components/shell/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <Link href="/app" className="text-sm font-semibold tracking-tight">
            Home Care CRM
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/onboarding"
              afterSelectOrganizationUrl="/app"
              hidePersonal
              appearance={{ elements: { rootBox: "flex items-center" } }}
            />
            <UserButton />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
