import type { LegalDoc } from "./types.ts";

/** En el texto del cliente el plazo de pago es "48 horas": aquí es `{ plazo: true }` y se muestra el valor real de Configuración. */
export const terminos: LegalDoc = {
  slug: "terminos",
  titulo: "Términos y Condiciones",
  actualizado: "2 de octubre de 2026",
  version: "2026-10-02",
  bloques: [
    {
      t: "p",
      runs: ["Al utilizar nuestro sitio web y realizar una compra en Mi Casa Store, usted acepta íntegramente los siguientes términos y condiciones de servicio:"],
    },
    { t: "h2", text: "2.1. Proceso de Compra y Pago" },
    {
      t: "ul",
      items: [
        ["El método de pago aceptado para las compras en línea es la transferencia bancaria o depósito directo a las cuentas indicadas al finalizar su pedido."],
        ["Una vez generado el pedido en la web, el cliente cuenta con un plazo máximo de ", { plazo: true, b: true }, " para realizar el pago."],
        [
          "El comprobante de pago (captura de pantalla o fotografía legible del recibo) debe ser subido/enviado ",
          { b: "a través de la misma página web" },
          " en la sección designada para tal fin.",
        ],
        ["Si no se recibe y carga el comprobante en el plazo de ", { plazo: true }, ", el sistema cancelará automáticamente el pedido y los productos volverán al inventario."],
      ],
    },
    {
      t: "note",
      tone: "warning",
      title: "Importante - Verificación de Pagos:",
      titleInline: true,
      paragraphs: [
        [
          " El envío del comprobante por la web es un requisito obligatorio, pero el pedido ",
          { i: "solo se considerará confirmado y empezará a prepararse" },
          " una vez que los fondos se reflejen de manera efectiva en nuestra cuenta bancaria. Nos reservamos el derecho de rechazar comprobantes que presenten alteraciones, cortes o indicios de falsificación.",
        ],
      ],
    },
    { t: "h2", text: "2.2. Envíos y Entregas" },
    {
      t: "ul",
      items: [
        [
          "El tiempo estimado de entrega es de ",
          { b: "1 a 5 días hábiles" },
          ", dependiendo de la ciudad de destino, contados a partir del momento en que el pago ha sido confirmado en cuenta.",
        ],
        [
          "Nos comprometemos a despachar los productos a la brevedad, pero no nos hacemos responsables por retrasos logísticos atribuibles exclusivamente a la empresa de mensajería. Proporcionaremos el número de guía para el rastreo oportuno del paquete.",
        ],
      ],
    },
    { t: "h2", text: "2.3. Devoluciones y Garantías" },
    {
      t: "ul",
      items: [
        ["Solo se aceptarán cambios o devoluciones que correspondan a ", { b: "defectos de fábrica" }, "."],
        [
          "Para que una devolución sea válida, el defecto debe ser reportado dentro de las primeras ",
          { b: "24 horas" },
          " tras haber recibido el producto por parte de la empresa de paquetería.",
        ],
        ["No se aceptan devoluciones por daños causados por mal uso o manipulación incorrecta del cliente."],
      ],
    },
    { t: "h2", text: "2.4. Jurisdicción y Ley Aplicable" },
    {
      t: "p",
      runs: [
        "Estos términos y condiciones se rigen bajo las leyes de la República del Ecuador. Cualquier controversia, reclamo o disputa relacionada con el uso de este sitio web o las transacciones realizadas será resuelta en la jurisdicción de ",
        { b: "Zaruma, provincia de El Oro" },
        ", renunciando a cualquier otra jurisdicción que pudiese corresponder.",
      ],
    },
  ],
};
