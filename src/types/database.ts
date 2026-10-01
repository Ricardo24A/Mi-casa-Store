// Tipos de las tablas de Supabase (espejo de supabase/migrations). Escritos a mano; si se
// instala la CLI de Supabase se pueden reemplazar por los generados (`supabase gen types`).
// Los `numeric` de Postgres llegan como number en supabase-js.

export type UserRole = "admin" | "customer";
export type DiscountType = "porcentaje" | "monto_fijo";
export type DiscountScope = "producto" | "categoria" | "tienda";
export type OrderStatus =
  | "pendiente_pago"
  | "comprobante_recibido"
  | "pagado"
  | "enviado"
  | "entregado"
  | "rechazado"
  | "cancelado"
  | "vencido";
export type ProofStatus = "en_revision" | "aprobado" | "rechazado" | "reemplazado";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  nombre: string;
  slug: string;
  imagen_url: string | null;
  orden: number;
  created_at: string;
}

export interface ProductTemplate {
  id: string;
  category_id: string;
  nombre: string;
  descripcion_base: string;
  precio_sugerido: number | null;
  prefijo_sku: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  precio: number;
  stock: number;
  stock_reservado: number;
  sku: string | null;
  activo: boolean;
  destacado: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  orden: number;
  created_at: string;
}

export interface Discount {
  id: string;
  nombre: string;
  tipo: DiscountType;
  valor: number;
  alcance: DiscountScope;
  target_id: string | null;
  codigo: string | null;
  inicia: string;
  termina: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  provincia: string;
  ciudad: string;
  direccion: string;
  referencia?: string;
}

export interface Order {
  id: string;
  referencia: string;
  user_id: string | null;
  contacto_nombre: string;
  contacto_email: string;
  contacto_telefono: string;
  documento: string | null;
  direccion_envio: ShippingAddress;
  access_token: string;
  estado: OrderStatus;
  subtotal: number;
  descuento: number;
  descuento_transferencia: number;
  envio: number;
  total: number;
  cupon: string | null;
  notas: string | null;
  vence_en: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
}

export interface PaymentProof {
  id: string;
  order_id: string;
  archivo: string;
  hash: string;
  estado: ProofStatus;
  motivo: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  created_at: string;
}

export interface BankAccount {
  banco: string;
  tipo: "ahorros" | "corriente";
  numero: string;
  titular: string;
  identificacion: string;
}

export interface StoreSettings {
  id: true;
  nombre_negocio: string;
  email_contacto: string | null;
  telefono: string | null;
  direccion: string | null;
  horario_atencion: string | null;
  cuentas_bancarias: BankAccount[];
  costo_envio: number;
  envio_gratis_desde: number | null;
  descuento_transferencia_pct: number;
  horas_limite_pago: number;
  updated_at: string;
}

export type ContactMessageStatus = "nuevo" | "leido" | "archivado";

/** Mensaje de /contacto. Solo lo lee el administrador con 2FA (migración 20). */
export interface ContactMessage {
  id: string;
  nombre: string;
  email: string;
  /** Solo dígitos, formato nacional (celular 09… o fijo 02 a 07). */
  telefono: string;
  asunto: string | null;
  mensaje: string;
  aceptado_en: string;
  estado: ContactMessageStatus;
  created_at: string;
  leido_en: string | null;
}
