import Link from "next/link";
import { Fragment } from "react";
import { BrandLink } from "@/components/brand-icons";
import { Container } from "@/components/ui/container";
import { plazoTexto } from "@/content/legal/runs";
import type { LegalBlock, LegalDoc, Run } from "@/content/legal/types";
import { formatEcPhone, telHref, whatsappHref } from "@/lib/phone-ec";
import { slugify } from "@/lib/slug";
import { getPublicStoreInfo } from "@/lib/store-info";

function Runs({ runs, horas }: { runs: Run[]; horas: number | null }) {
  return (
    <>
      {runs.map((run, i) => {
        if (typeof run === "string") return <Fragment key={i}>{run}</Fragment>;
        if ("plazo" in run) return run.b ? <strong key={i}>{plazoTexto(horas)}</strong> : <Fragment key={i}>{plazoTexto(horas)}</Fragment>;
        if ("b" in run) return <strong key={i}>{run.b}</strong>;
        return <em key={i}>{run.i}</em>;
      })}
    </>
  );
}

function Block({ block, horas }: { block: LegalBlock; horas: number | null }) {
  switch (block.t) {
    case "h2": {
      const id = slugify(block.text, "seccion");
      return (
        <h2 id={id} className="group mt-10 scroll-mt-32 text-xl font-semibold text-ink">
          {block.text}
          <a
            href={`#${id}`}
            aria-label={`Enlace a la sección: ${block.text}`}
            className="ml-2 inline-flex min-h-8 items-center px-1 text-accent opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 print:hidden"
          >
            #
          </a>
        </h2>
      );
    }
    case "p":
      return (
        <p className="mt-4 leading-relaxed text-ink">
          <Runs runs={block.runs} horas={horas} />
        </p>
      );
    case "ul":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-ink marker:text-accent">
          {block.items.map((item, i) => (
            <li key={i}>
              <Runs runs={item} horas={horas} />
            </li>
          ))}
        </ul>
      );
    case "note": {
      const warning = block.tone === "warning";
      return (
        <aside
          className={
            warning
              ? "mt-6 rounded-lg border-l-4 border-sale bg-sale-soft p-4 leading-relaxed text-ink"
              : "mt-8 rounded-lg border-l-4 border-accent bg-accent-soft p-4 leading-relaxed text-ink"
          }
        >
          {block.titleInline ? (
            <p>
              <strong className={warning ? "text-sale-ink" : undefined}>{block.title}</strong>
              <Runs runs={block.paragraphs[0]} horas={horas} />
            </p>
          ) : (
            <>
              <p className="font-semibold">{block.title}</p>
              {block.paragraphs.map((p, i) => (
                <p key={i} className="mt-2">
                  <Runs runs={p} horas={horas} />
                </p>
              ))}
            </>
          )}
        </aside>
      );
    }
  }
}

/** Datos de contacto reales de Configuración (solo los que existen) y el enlace a /contacto. */
async function ContactFooter() {
  const info = await getPublicStoreInfo();
  const phones = [info.telefono, info.telefonoSecundario].filter((p): p is string => Boolean(p));
  return (
    <section aria-labelledby="datos-contacto" className="mt-12 border-t border-line pt-6">
      <h2 id="datos-contacto" className="text-lg font-semibold text-ink">
        Datos de contacto de {info.nombre}
      </h2>
      <ul className="mt-3 space-y-1 text-ink">
        {info.direccion && <li>{info.direccion}</li>}
        {phones.map((phone) => {
          const wa = whatsappHref(phone);
          return (
            <li key={phone} className="flex items-center gap-1">
              <a href={telHref(phone)} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
                {formatEcPhone(phone)}
              </a>
              {wa && <BrandLink brand="whatsapp" href={wa} label={`WhatsApp ${formatEcPhone(phone)}`} className="hover:bg-accent-soft print:hidden" />}
            </li>
          );
        })}
        {info.email && (
          <li>
            <a href={`mailto:${info.email}`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">
              {info.email}
            </a>
          </li>
        )}
        {info.horario && <li>Horario de atención: {info.horario}</li>}
      </ul>
      <p className="mt-2">
        <Link href="/contacto" className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-4 hover:underline">
          Ir a la página de contacto
        </Link>
      </p>
    </section>
  );
}

/**
 * Página de un documento legal: texto del cliente tal cual, ancho de lectura cómodo, títulos con anclas y
 * estilo de impresión (el encabezado y el pie de la tienda no se imprimen). `horas`: plazo de pago real.
 */
export async function LegalPage({ doc, horas = null }: { doc: LegalDoc; horas?: number | null }) {
  return (
    <Container className="py-10">
      <article className="mx-auto max-w-3xl rounded-card border border-line bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{doc.titulo}</h1>
        <p className="mt-2 text-sm italic text-ink-soft">Última actualización: {doc.actualizado}</p>
        {doc.bloques.map((block, i) => (
          <Block key={i} block={block} horas={horas} />
        ))}
        <ContactFooter />
      </article>
    </Container>
  );
}
