import type { DeliveryMethod, SizeSystem } from './types.ts';

export const SITE_NAME = 'DOLGERS';
export const CURRENCY = 'usd' as const;

/** Size labels a vendor may pick for each size system, in display order. */
export const SIZE_LABELS: Record<SizeSystem, string[]> = {
  alpha: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'eu-shoe': ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
  age: ['2–3Y', '4–5Y', '6–7Y', '8–9Y', '10–11Y', '12–13Y', '14–15Y'],
  waist: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'],
  'one-size': ['One size'],
};

export const SIZE_SYSTEM_LABEL: Record<SizeSystem, string> = {
  alpha: 'Size',
  'eu-shoe': 'Size (EU)',
  age: 'Size (age)',
  waist: 'Waist',
  'one-size': 'Size',
};

export const DELIVERY: Record<DeliveryMethod, { label: string; detail: string; price: number }> = {
  standard: { label: 'Standard', detail: '3–6 working days from each maker', price: 0 },
  express: { label: 'Express', detail: '1–2 working days, tracked', price: 2500 },
};

/** Default platform commission for new vendors (15%). */
export const DEFAULT_COMMISSION_BPS = 1500;
/** How long checkout holds stock while the buyer pays. */
export const RESERVATION_MINUTES = 30;
/** Products published within this window carry the NEW label. */
export const NEW_WINDOW_DAYS = 30;
export const RETURN_WINDOW_DAYS = 30;
export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 10;

export const US_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export const COLOURS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#111111' },
  { name: 'Charcoal', hex: '#3d3b38' },
  { name: 'Grey', hex: '#9a9893' },
  { name: 'Navy', hex: '#1f2a44' },
  { name: 'Indigo', hex: '#2c3a5c' },
  { name: 'Camel', hex: '#b89a74' },
  { name: 'Tobacco', hex: '#7a5636' },
  { name: 'Espresso', hex: '#4a3428' },
  { name: 'Olive', hex: '#5c5a3f' },
  { name: 'Slate', hex: '#6b7075' },
  { name: 'Oat', hex: '#d8cdb8' },
  { name: 'Ecru', hex: '#ece6d8' },
  { name: 'Sand', hex: '#cdb999' },
  { name: 'White', hex: '#f7f6f2' },
];
