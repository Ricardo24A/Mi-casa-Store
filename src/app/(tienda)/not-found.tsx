import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";

export default function TiendaNotFound() {
  return (
    <Container className="py-12">
      <EmptyState
        title="No encontramos esta página"
        action={
          <Link href="/catalogo" className={buttonClass("primary")}>
            Ver productos
          </Link>
        }
      >
        Puede que el producto o la categoría ya no esté disponible.
      </EmptyState>
    </Container>
  );
}
