const usd = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** Dinero en dólares con formato de Ecuador. */
export function formatUsd(value: number): string {
  return usd.format(value);
}
