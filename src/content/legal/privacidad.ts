import type { LegalDoc } from "./types.ts";

export const privacidad: LegalDoc = {
  slug: "privacidad",
  titulo: "Políticas de Privacidad",
  actualizado: "2 de octubre de 2026",
  version: "2026-10-02",
  bloques: [
    {
      t: "p",
      runs: [
        "En ",
        { b: "Mi Casa Store" },
        ", valoramos y respetamos su privacidad. Esta política explica cómo recopilamos, usamos y protegemos su información personal cuando visita y realiza compras en nuestro sitio web.",
      ],
    },
    { t: "h2", text: "Información que recopilamos" },
    { t: "p", runs: ["Para procesar sus pedidos de manera eficiente, recopilamos la siguiente información estrictamente necesaria:"] },
    {
      t: "ul",
      items: [
        ["Nombre y apellidos."],
        ["Información de contacto (correo electrónico, número de teléfono)."],
        ["Dirección completa de envío."],
        [{ b: "Imágenes de comprobantes de transferencia bancaria" }, " que usted carga directamente a través de nuestra plataforma web para validar su pago."],
      ],
    },
    {
      t: "p",
      runs: [
        { i: "Nota importante:" },
        " Mi Casa Store no recopila, procesa ni almacena datos de tarjetas de crédito o débito, ya que nuestro método de pago es exclusivamente mediante transferencia o depósito bancario directo.",
      ],
    },
    { t: "h2", text: "Uso de la información" },
    { t: "p", runs: ["Utilizamos sus datos exclusivamente para los siguientes fines:"] },
    {
      t: "ul",
      items: [
        ["Procesar, preparar y facturar sus pedidos."],
        ["Verificar sus pagos a través de los comprobantes electrónicos proporcionados en la web."],
        ["Contactarle en caso de que exista alguna novedad con la preparación de su pedido o problemas con la entrega."],
      ],
    },
    { t: "h2", text: "Protección y Retención de Datos" },
    {
      t: "p",
      runs: [
        "Las imágenes de los comprobantes de pago se utilizan únicamente para la conciliación bancaria y verificación interna de la compra. Sus datos personales no serán vendidos ni compartidos con terceros con fines comerciales.",
      ],
    },
    {
      t: "p",
      runs: [
        "La única excepción aplicable es la información compartida con las empresas de mensajería, la cual es compartida de forma confidencial y con el propósito exclusivo de realizar la entrega física de sus productos en la dirección indicada.",
      ],
    },
  ],
};
