"use client";

import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { cn, initials } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS } from "./nav-items";

type SidebarUser = { name: string; email: string; role: string };

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    // Sync with the class applied by the pre-paint theme script.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("theme", next ? "dark" : "light");
        } catch {}
      }}
      className="rounded-lg p-2 text-ink-foreground/60 hover:bg-white/10 hover:text-ink-foreground"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-primary"
                : "text-ink-foreground/65 hover:bg-white/5 hover:text-ink-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ businessName }: { businessName: string }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <BrandMark className="text-white/10" />
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold leading-tight">BizDesk</span>
        <span className="block truncate text-xs text-ink-foreground/60">{businessName}</span>
      </span>
    </Link>
  );
}

function UserFooter({ user }: { user: SidebarUser }) {
  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-xs font-semibold text-ink">
        {initials(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs capitalize text-ink-foreground/60">{user.role}</p>
      </div>
      <ThemeToggle />
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg p-2 text-ink-foreground/60 hover:bg-white/10 hover:text-ink-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ user, businessName }: { user: SidebarUser; businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-ink-foreground lg:hidden">
        <Brand businessName={businessName} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-ink p-4 text-ink-foreground">
            <div className="flex items-center justify-between">
              <Brand businessName={businessName} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserFooter user={user} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 bg-ink p-4 text-ink-foreground lg:flex">
        <Brand businessName={businessName} />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <UserFooter user={user} />
      </aside>
    </>
  );
}
