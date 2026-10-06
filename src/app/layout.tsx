import type { Metadata } from "next";
import { Familjen_Grotesk, Geist_Mono, Public_Sans } from "next/font/google";
import { resolveSiteUrl } from "@/lib/site-url";
import "./globals.css";

// Familjen Grotesk (ink-trap grotesque) for headings; Public Sans for UI text with tabular figures.
const display = Familjen_Grotesk({ variable: "--font-familjen", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Absolute base for the Open Graph image (src/app/opengraph-image.jpg).
  metadataBase: resolveSiteUrl(),
  title: { default: "BizDesk", template: "%s · BizDesk" },
  openGraph: { siteName: "BizDesk", type: "website" },
  description: "All-in-one business management: customers, inventory, invoicing, expenses, tasks and reports.",
};

// Applies the saved theme before paint to avoid a flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
