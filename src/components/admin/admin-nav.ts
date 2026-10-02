import { BadgePercent, ClipboardList, FolderTree, Inbox, LayoutDashboard, Package, Settings, type LucideIcon } from "lucide-react";

/** Contadores del menú. */
export interface Counters {
  pedidos: number;
  mensajes: number;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo activo con la ruta exacta (Resumen no debe quedar activo en las demás). */
  exact?: boolean;
  /** Contador que se muestra junto al nombre (pedidos por revisar, mensajes sin leer). */
  badge?: keyof Counters;
}

/**
 * Menú del panel. Solo hay enlaces a pantallas que existen: cada sección nueva se agrega aquí junto con
 * su página. Lo usan el marco del panel y su esqueleto de carga.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/categorias", label: "Categorías", icon: FolderTree },
  { href: "/admin/descuentos", label: "Descuentos", icon: BadgePercent },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "pedidos" },
  { href: "/admin/mensajes", label: "Mensajes", icon: Inbox, badge: "mensajes" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];
