import { BarChart3, Briefcase, FileText, Package } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES = [
  { icon: FileText, text: "Invoices with payments, tax and printable PDFs" },
  { icon: Package, text: "Inventory that updates as you sell" },
  { icon: BarChart3, text: "Live profit & loss, A/R aging and sales reports" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5 font-semibold">
          <Briefcase className="h-5 w-5" aria-hidden /> BizDesk
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">Run your whole business from one desk.</h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 opacity-90">
                <Icon className="h-5 w-5" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-75">Customers · Inventory · Invoicing · Expenses · Tasks · Reports</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo credentials are prefilled: <span className="font-mono">demo@bizdesk.app</span> /{" "}
              <span className="font-mono">demo1234</span>
            </p>
          </div>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
    </div>
  );
}
