// Rutas con codificación de porcentaje inválida (p. ej. `/producto/%E0%A4%A`): el enrutador de Next
// responde 500 a las dinámicas. Una petición mal formada es del cliente, así que el proxy responde 400.

/** true si `pathname` trae un `%` que no se puede decodificar. */
export function hasMalformedEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}
