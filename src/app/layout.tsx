import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import AnnouncementBar from "@/components/AnnouncementBar";
import BackToTop from "@/components/BackToTop";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { AuthProvider } from "@/context/AuthProvider";
import { ShopProvider } from "@/context/ShopProvider";
import { getCategories, getProducts, getSellers } from "@/lib/catalog";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Torqline | Pro Tools & Workshop Supply", template: "%s | Torqline" },
  description: "Power tools, hand tools, storage and site gear for trades and serious DIYers.",
};

export const revalidate = 300;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, categories, sellers] = await Promise.all([getProducts(), getCategories(), getSellers()]);
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} antialiased`}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <ShopProvider products={products} sellers={sellers}>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
              Skip to content
            </a>
            <AnnouncementBar />
            <Header categories={categories} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
            <CartDrawer />
            <BackToTop />
          </ShopProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
