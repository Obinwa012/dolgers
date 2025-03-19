import "./globals.css";
import { Roboto } from "next/font/google";
import Header from "@/components/header/Header";
import LeftDrawer from "@/components/leftDrawer/LeftDrawer";
import RightDrawer from "@/components/rightDrawer/RightDrawer";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ['300', '400', '500', '700', '900'],
});

export const metadata = {
  title: "Dolgers",
  description: "Shop now and discover incredible deals on electronics, fashion, and more at Dolgers! Your trusted online marketplace.",
  keywords: "online shopping, ecommerce, marketplace, buy online, online store, fashion, electronics, groceries, deals, best prices, Dolgers, Dolgers, Dolgers",
  openGraph: {
    title: "Dolgers - Your trusted online marketplace | Shop smart & Save big.",
    description: "Shop now and discover incredible deals on electronics, fashion, and more at Dolgers! Your trusted online marketplace.",
    url: "Dolgers.com",
    siteName: "Dolgers",
    images: [
      {
        url: 'https://Dolgers.vercel.app/favicon.ico',
        width: 1200,
        height: 630,
        alt: "Dolgers - Your trusted online marketplace",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dolgers - Your trusted online marketplace | Shop smart & Save big.",
    description: "Shop now and discover incredible deals on electronics, fashion, and more at Dolgers! Your trusted online marketplace.",
    images: ['https://Dolgers.vercel.app/favicon.ico'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`flex flex-col min-h-screen ${roboto.variable} antialiased`}>
        <Header />
        <main className="flex grow">{children}</main>
        <LeftDrawer />
        <RightDrawer />
      </body>
    </html>
  );
}
