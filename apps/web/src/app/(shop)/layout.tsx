import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

export default function ShopLayout({ children, drawer }: { children: React.ReactNode; drawer: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {drawer}
    </>
  );
}
