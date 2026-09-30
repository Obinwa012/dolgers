import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import AnnouncementBar from "@/components/AnnouncementBar";
import BackToTop from "@/components/BackToTop";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { AuthProvider } from "@/context/AuthProvider";
import { ShopProvider } from "@/context/ShopProvider";
import { getBrands, getCategories, getProducts, getSellers } from "@/lib/catalog";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata: Metadata = {
  title: { default: "Dolgers | Pro Tools & Workshop Supply", template: "%s | Dolgers" },
  description: "Power tools, hand tools, storage and site gear for trades and serious DIYers.",
};

export const revalidate = 300;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, categories, sellers, brands] = await Promise.all([getProducts(), getCategories(), getSellers(), getBrands()]);
  return (
    <html lang="en" className={`${heebo.variable} antialiased`}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <ShopProvider products={products} sellers={sellers}>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
              Skip to content
            </a>
            <AnnouncementBar />
            <Header categories={categories} brands={brands} />
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
