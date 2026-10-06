import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import { getCurrentUser } from "@/lib/auth";
import { InvoiceSlip } from "./invoice-slip";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/*
 * Hero photo (public/images/login-hero.jpg) layered over an ink background with a faint
 * shelving-label grid, which is what shows while the photo loads or if it is ever removed.
 * (No filesystem check: on serverless hosts public/ is served by the CDN, not the function.)
 */
const HERO_PHOTO = "/images/login-hero.jpg";

const HERO_BACKGROUND = [
  // Shade the top (wordmark over bright windows) and bottom (headline) for legibility.
  "linear-gradient(to bottom, rgb(10 16 21 / 0.75) 0%, rgb(10 16 21 / 0.2) 22%, rgb(10 16 21 / 0.35) 55%, rgb(10 16 21 / 0.93) 100%)",
  `url(${HERO_PHOTO})`,
  "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 72px)",
  "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 120px)",
].join(", ");

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-ink bg-cover bg-[position:50%_72%] p-10 text-ink-foreground lg:flex xl:p-14"
        style={{ backgroundImage: HERO_BACKGROUND }}
      >
        <div className="flex items-center gap-2.5">
          <BrandMark className="text-white/10" />
          <span className="font-display text-lg font-semibold">BizDesk</span>
        </div>

        <div className="flex flex-col gap-10">
          <InvoiceSlip />
          <div className="max-w-md">
            <p className="font-display text-3xl font-semibold leading-tight xl:text-4xl">
              Invoices, stock and cash flow in one set of books.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-foreground/75">
              Send an invoice and the shelves update. Record a payment and the profit report does too.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-6 py-10 sm:px-10">
        <div className="flex items-center gap-2.5 lg:hidden">
          <BrandMark className="text-ink" />
          <span className="font-display text-lg font-semibold">BizDesk</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You&apos;re looking at the books of Northwind Supply Co., a demo company with a year of orders,
            stock and expenses.
          </p>
          <div className="mt-8">
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </div>
        </div>

        <p className="mx-auto w-full max-w-sm text-xs text-muted-foreground">
          Demo data resets when the database is reseeded. Password for every demo account: demo1234
        </p>
      </main>
    </div>
  );
}
