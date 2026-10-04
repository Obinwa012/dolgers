import { DELIVERY, US_STATES, formatMoney, type Address, type Cents, type DeliveryMethod } from '@dolgers/shared';

export function deliveryPrice(cents: Cents): string {
  return cents === 0 ? 'Complimentary' : formatMoney(cents);
}

export function deliverySummary(method: DeliveryMethod): string {
  return `${DELIVERY[method].label} · ${deliveryPrice(DELIVERY[method].price)}`;
}

export function stateName(code: string): string {
  return US_STATES.find(([c]) => c === code)?.[1] ?? code;
}

/** "12 Mercer St, Apt 4, New York, NY 10013" */
export function addressOneLine(a: Pick<Address, 'line1' | 'line2' | 'city' | 'state' | 'postalCode'>): string {
  return [a.line1, a.line2, a.city, `${a.state} ${a.postalCode}`].filter((s) => s && s.trim()).join(', ');
}

export function fullName(a: Pick<Address, 'firstName' | 'lastName'>): string {
  return `${a.firstName} ${a.lastName}`.trim();
}

/** Groups lines by maker, keeping the order in which each maker first appears. */
export function groupByVendor<T extends { vendorId: string; vendorName: string }>(lines: T[]) {
  const groups: { vendorId: string; vendorName: string; lines: T[] }[] = [];
  for (const line of lines) {
    const g = groups.find((x) => x.vendorId === line.vendorId);
    if (g) g.lines.push(line);
    else groups.push({ vendorId: line.vendorId, vendorName: line.vendorName, lines: [line] });
  }
  return groups;
}

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dayYear = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function formatDate(ms: number): string {
  return dayYear.format(new Date(ms));
}

export function formatDateRange(from: number, to: number): string {
  const a = day.format(new Date(from));
  const b = day.format(new Date(to));
  return a === b ? a : `${a} – ${b}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "VISA ending 4242" -> "Visa ending 4242"; "klarna" -> "Klarna". */
export function paymentLabel(summary: string | null): string {
  if (!summary) return 'Card';
  const [first, ...rest] = summary.split(' ');
  const brand = first.replace(/_/g, ' ');
  return [brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase(), ...rest].join(' ');
}
