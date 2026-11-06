/** Un cours en centièmes de pièce, affiché avec deux décimales : « 123,45 pièces ». */
export function formatPrice(cents: number, currency: string): string {
  const value = (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `${value} ${currency}`;
}
