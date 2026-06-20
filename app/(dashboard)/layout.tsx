import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Filter,
  Link2,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { auth, signOut } from "@/lib/auth/config";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Marketing Dashboard</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
          <NavLink href="/" icon={<Sparkles className="h-4 w-4" />}>
            Executive Summary
          </NavLink>
          <NavLink href="/funnel" icon={<Filter className="h-4 w-4" />}>
            Sales Funnel
          </NavLink>
          <div className="mt-6 px-3 text-xs font-medium uppercase text-muted-foreground">
            Settings
          </div>
          <NavLink href="/settings/connections" icon={<Link2 className="h-4 w-4" />}>
            Connections
          </NavLink>
          <NavLink href="/settings/mcp" icon={<Settings className="h-4 w-4" />}>
            MCP
          </NavLink>
        </nav>
        <div className="border-t p-3">
          <div className="px-2 py-2 text-xs text-muted-foreground">
            {session.user.email}
          </div>
          <form action={handleSignOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
          <MobileNav email={session.user.email} signOutAction={handleSignOut} />
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Marketing Dashboard</span>
          </div>
          <div className="w-9" aria-hidden />
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
