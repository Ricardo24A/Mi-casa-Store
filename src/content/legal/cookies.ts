import type { LegalDoc } from "./types.ts";

export const cookies: LegalDoc = {
  slug: "cookies",
  titulo: "Política de Cookies",
  actualizado: "2 de octubre de 2026",
  version: "2026-10-02",
  bloques: [
    {
      t: "p",
      runs: ["En Mi Casa Store utilizamos cookies y tecnologías similares para asegurar el correcto funcionamiento de nuestra tienda en línea y mejorar su experiencia de usuario."],
    },
    { t: "h2", text: "¿Qué son las cookies?" },
    {
      t: "p",
      runs: ["Las cookies son pequeños archivos de texto que se descargan y almacenan en su navegador o dispositivo (computadora o teléfono móvil) cuando visita nuestra página web."],
    },
    { t: "h2", text: "Cookies que utilizamos en nuestro sitio" },
    {
      t: "ul",
      items: [
        [
          { b: "Cookies Estrictamente Necesarias:" },
          " Son fundamentales para que la página web funcione. Permiten la navegación, mantener los artículos guardados en su carrito de compras y recordar su sesión activa para que pueda cargar el comprobante de pago de manera segura.",
        ],
        [{ b: "Cookies Funcionales:" }, " Nos permiten recordar sus preferencias y agilizar su proceso de compra en visitas futuras."],
      ],
    },
    {
      t: "p",
      runs: [
        "Usted tiene la opción de configurar su navegador para bloquear o ser alertado sobre estas cookies. Sin embargo, tenga en cuenta que si desactiva las cookies estrictamente necesarias, partes fundamentales de la tienda, como el carrito de compras o la subida de comprobantes, no funcionarán correctamente.",
      ],
    },
    {
      t: "note",
      tone: "info",
      title: "Contacto",
      paragraphs: [
        ["Para cualquier consulta legal, duda sobre su pedido o reporte de devoluciones, puede contactarnos a través de nuestros canales oficiales en la web."],
        [{ b: "Zaruma, El Oro, Ecuador." }],
      ],
    },
  ],
};
