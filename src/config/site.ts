/**
 * Datos públicos del sitio. Solo se publica lo que el cliente confirmó.
 * Dejar una URL vacía oculta su icono, para no mostrar un enlace muerto.
 */
export const FACEBOOK_URL = "";

/**
 * Política de compra (decidida con el cliente): para pagar hay que iniciar sesión. Sin sesión
 * se puede ver el catálogo, las fichas de producto y usar el carrito (que vive en el navegador).
 * Se aplica en el servidor: `crearPedido` rechaza si no hay usuario y guarda `user_id = auth.uid()`.
 * `orders.user_id` sigue siendo opcional en la tabla, pero `create_order` exige un usuario:
 * volver a permitir invitados exige cambiar esta constante y esa función a la vez.
 */
export const CHECKOUT_REQUIRES_ACCOUNT = true;
