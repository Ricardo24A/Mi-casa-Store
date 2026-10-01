import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/store/contact-form";
import { BrandIcon, BrandLink } from "@/components/brand-icons";
import { Container } from "@/components/ui/container";
import { formatEcPhone, telHref, whatsappHref } from "@/lib/phone-ec";
import { getPublicStoreInfo } from "@/lib/store-info";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos si tienes una consulta sobre nuestros productos o tu pedido.",
};

const link = "inline-flex min-h-11 items-center font-semibold text-accent underline-offset-4 hover:underline";

function Item({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-card border border-line bg-surface p-4">
      <span className="mt-2.5 text-accent" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        <div className="break-words text-ink">{children}</div>
      </div>
    </li>
  );
}

/**
 * Contacto. Arriba, solo los datos que el dueño completó en Configuración (vista pública
 * `store_public_info`); nada inventado. Debajo, el formulario, que guarda el mensaje para el panel.
 */
export default async function ContactPage() {
  const info = await getPublicStoreInfo();
  const phones = [info.telefono, info.telefonoSecundario].filter((p): p is string => Boolean(p));
  const hasData = phones.length > 0 || Boolean(info.email || info.direccion || info.horario || info.facebook);

  return (
    <Container className="py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Contacto</h1>

        {hasData && (
          <section aria-labelledby="datos" className="mt-6">
            <h2 id="datos" className="sr-only">
              Datos de contacto
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {phones.map((phone, i) => {
                const wa = whatsappHref(phone);
                return (
                  <Item key={phone} icon={<Phone className="size-5" />} label={phones.length > 1 ? `Teléfono ${i + 1}` : "Teléfono"}>
                    <span className="flex flex-wrap items-center gap-1">
                      <a href={telHref(phone)} className={link}>
                        {formatEcPhone(phone)}
                      </a>
                      {wa && <BrandLink brand="whatsapp" href={wa} label={`WhatsApp ${formatEcPhone(phone)}`} className="hover:bg-accent-soft" />}
                    </span>
                  </Item>
                );
              })}
              {info.email && (
                <Item icon={<Mail className="size-5" />} label="Correo">
                  <a href={`mailto:${info.email}`} className={link}>
                    {info.email}
                  </a>
                </Item>
              )}
              {info.direccion && (
                <Item icon={<MapPin className="size-5" />} label="Dirección">
                  <p className="py-2.5">{info.direccion}</p>
                </Item>
              )}
              {info.horario && (
                <Item icon={<Clock className="size-5" />} label="Horario de atención">
                  <p className="py-2.5">{info.horario}</p>
                </Item>
              )}
              {info.facebook && (
                <Item icon={<BrandIcon brand="facebook" size={20} />} label="Facebook">
                  <a href={info.facebook} target="_blank" rel="noopener noreferrer" className={link}>
                    {info.nombre} en Facebook
                  </a>
                </Item>
              )}
            </ul>
          </section>
        )}

        <section aria-labelledby="escribenos" className="mt-10 rounded-card border border-line bg-surface p-5 sm:p-8">
          <h2 id="escribenos" className="text-xl font-semibold text-ink">
            Escríbenos
          </h2>
          <div className="mt-4">
            <ContactForm storeName={info.nombre} />
          </div>
        </section>
      </div>
    </Container>
  );
}
