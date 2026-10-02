import type { Metadata } from "next";
import BackToTop from "@/components/BackToTop";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import TopBar from "@/components/TopBar";
import { AuthProvider } from "@/context/AuthProvider";
import { ShopProvider } from "@/context/ShopProvider";
import { getBrands, getCategories, getProducts, getSellers } from "@/lib/catalog";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dolgers | Women's Fashion", template: "%s | Dolgers" },
  description: "Dresses, tops, knitwear, coats, jeans and activewear for women, from Dolgers and independent boutiques. Free shipping over $99 and 30-day returns.",
};

export const revalidate = 300;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, categories, sellers, brands] = await Promise.all([getProducts(), getCategories(), getSellers(), getBrands()]);
  return (
    <html lang="en" className="antialiased">
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <ShopProvider products={products} sellers={sellers}>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
              Skip to content
            </a>
            <TopBar />
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
