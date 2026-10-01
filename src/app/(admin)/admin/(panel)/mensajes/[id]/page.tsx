import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { MessageActions } from "@/components/admin/message-actions";
import { MessageStatusBadge } from "@/components/admin/message-status";
import { WhatsappIcon } from "@/components/store/whatsapp-icon";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatEcPhone, telHref, whatsappHref } from "@/lib/phone-ec";
import { getPublicStoreInfo } from "@/lib/store-info";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/common";
import type { ContactMessage } from "@/types/database";

export const metadata: Metadata = { title: "Mensaje" };

const dateFormat = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{children}</dd>
    </div>
  );
}

export default async function MessageDetailPage(props: PageProps<"/admin/mensajes/[id]">) {
  await requireAdmin();
  const id = uuid.safeParse((await props.params).id);
  if (!id.success) notFound();

  // RLS: solo el administrador con 2FA lee los mensajes.
  const supabase = await createClient();
  const [{ data: message }, info] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id, nombre, email, telefono, asunto, mensaje, aceptado_en, estado, created_at, leido_en")
      .eq("id", id.data)
      .maybeSingle<ContactMessage>(),
    getPublicStoreInfo(),
  ]);
  if (!message) notFound();

  // Responder: el correo y el teléfono ya vienen validados por la base (formato de correo; teléfono
  // normalizado de Ecuador), así que se usan tal cual. El texto del asunto va codificado.
  const subject = message.asunto ? `Re: ${message.asunto}` : `Tu consulta en ${info.nombre}`;
  const mailto = `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hola ${message.nombre},\n\n`)}`;
  const wa = whatsappHref(message.telefono);

  return (
    <>
      <Link href="/admin/mensajes" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
        ← Volver a mensajes
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">{message.asunto ?? "Mensaje sin asunto"}</h1>
        <MessageStatusBadge status={message.estado} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Recibido el {dateFormat.format(new Date(message.created_at))}
        {message.leido_en && ` · Leído el ${dateFormat.format(new Date(message.leido_en))}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="texto" className="rounded-card border border-line bg-surface p-5">
          <h2 id="texto" className="mb-3 text-xl font-semibold text-ink">
            Mensaje de {message.nombre}
          </h2>
          {/* Texto plano: React lo escapa; los saltos de línea se respetan con CSS, sin HTML. */}
          <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">{message.mensaje}</p>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="datos" className="rounded-card border border-line bg-surface p-5">
            <h2 id="datos" className="mb-2 text-lg font-semibold text-ink">
              Datos de contacto
            </h2>
            <dl className="divide-y divide-line">
              <Row label="Nombre">{message.nombre}</Row>
              <Row label="Correo">{message.email}</Row>
              <Row label="Teléfono">{formatEcPhone(message.telefono)}</Row>
              <Row label="Aceptó el uso de sus datos">{dateFormat.format(new Date(message.aceptado_en))}</Row>
            </dl>
          </section>

          <section aria-labelledby="responder" className="space-y-3 rounded-card border border-line bg-surface p-5">
            <h2 id="responder" className="text-lg font-semibold text-ink">
              Responder
            </h2>
            <a href={mailto} className={buttonClass("primary", "lg", "w-full gap-2")}>
              <Mail className="size-4" aria-hidden />
              Responder por correo
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "lg", "w-full gap-2")}>
                <WhatsappIcon className="size-4" />
                Escribir por WhatsApp
              </a>
            )}
            <a href={telHref(message.telefono)} className={buttonClass("secondary", "lg", "w-full gap-2")}>
              <Phone className="size-4" aria-hidden />
              Llamar al {formatEcPhone(message.telefono)}
            </a>
          </section>

          <section aria-labelledby="estado" className="rounded-card border border-line bg-surface p-5">
            <h2 id="estado" className="mb-3 text-lg font-semibold text-ink">
              Estado
            </h2>
            <MessageActions id={message.id} status={message.estado} />
          </section>
        </div>
      </div>
    </>
  );
}
