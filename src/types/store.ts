// Tipos de la vista del cliente. Todo es serializable (pasa entre servidor y cliente).

export interface SubcategoryNode {
  id: string;
  slug: string;
  nombre: string;
  parentId: string;
}

export interface CategoryNode {
  id: string;
  slug: string;
  nombre: string;
  /** URL pública de la imagen de la categoría, si el dueño la subió. */
  imagenUrl: string | null;
  /** Solo subcategorías con productos activos. */
  subcategorias: SubcategoryNode[];
}

export interface StoreProduct {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: { slug: string; nombre: string };
  subcategoria: { slug: string; nombre: string };
  /** Precio de lista. */
  precio: number;
  /** Precio que se paga (con descuento, si lo hay). */
  precioFinal: number;
  /** Porcentaje de rebaja redondeado (para la etiqueta), o null. */
  descuentoPct: number | null;
  /** Unidades que se pueden comprar ahora (stock menos reservado). */
  disponible: number;
  destacado: boolean;
  imagenes: string[];
  createdAt: string;
}

export type CategoryScope =
  | { tipo: "categoria"; categoria: CategoryNode }
  | { tipo: "subcategoria"; categoria: CategoryNode; subcategoria: SubcategoryNode };
