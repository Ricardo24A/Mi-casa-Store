import { CartOwner } from "@/components/store/cart-owner";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";

export default function TiendaLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <CartOwner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
