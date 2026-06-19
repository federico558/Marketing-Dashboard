"use client";
import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  Link2,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  email?: string | null;
  signOutAction: () => Promise<void>;
}

export function MobileNav({ email, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col bg-card shadow-xl data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold">Marketing Dashboard</span>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
            <NavItem href="/" icon={<Sparkles className="h-4 w-4" />} onClick={close}>
              Executive Summary
            </NavItem>
            <div className="mt-6 px-3 text-xs font-medium uppercase text-muted-foreground">
              Settings
            </div>
            <NavItem
              href="/settings/connections"
              icon={<Link2 className="h-4 w-4" />}
              onClick={close}
            >
              Connections
            </NavItem>
            <NavItem
              href="/settings/mcp"
              icon={<Settings className="h-4 w-4" />}
              onClick={close}
            >
              MCP
            </NavItem>
          </nav>
          <div className="border-t p-3">
            {email ? (
              <div className="truncate px-2 py-2 text-xs text-muted-foreground">
                {email}
              </div>
            ) : null}
            <form action={signOutAction}>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NavItem({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
