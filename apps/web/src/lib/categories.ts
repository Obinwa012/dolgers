/**
 * Curated men's categories for Stage 1 importing, with the default keyword for
 * each. The search formula needs keyWord (the ship_from filter is ignored
 * without it), so every category carries one.
 * Source: mens_category_ids.json (full tree pulled 2026-10-03, 548 categories).
 */
export interface ImportCategory {
  id: string;
  name: string;
  keyword: string;
}

export const IMPORT_CATEGORIES: ImportCategory[] = [
  { id: '200000343', name: "Men's Clothing (all)", keyword: 'men clothing' },
  { id: '200000795', name: 'Coats & Jackets', keyword: 'men jacket' },
  { id: '200128143', name: 'Down Coats', keyword: 'men down coat' },
  { id: '200001877', name: 'Parkas', keyword: 'men parka' },
  { id: '200000344', name: 'Hoodies & Sweatshirts', keyword: 'men hoodie' },
  { id: '201236604', name: 'Sweaters', keyword: 'men sweater' },
  { id: '202235806', name: "Men's Shirts", keyword: 'men shirt' },
  { id: '200000779', name: 'Tops & Tees', keyword: 'men t-shirt' },
  { id: '201240601', name: 'Pants', keyword: 'men pants' },
  { id: '202220211', name: 'Denim', keyword: 'men jeans' },
  { id: '200005141', name: 'Shorts', keyword: 'men shorts' },
  { id: '200001819', name: 'Suits & Blazer', keyword: 'men blazer' },
  { id: '202236004', name: "Men's Sets", keyword: 'men tracksuit set' },
  { id: '202220407', name: 'Basic Clothing', keyword: 'men basics' },
  { id: '202225807', name: "Plus Size Men's Clothing", keyword: 'men plus size' },
  { id: '200131145', name: "Men's Shoes", keyword: 'men shoes' },
  { id: '202219099', name: 'Men Socks', keyword: 'men socks' },
  { id: '200001865', name: "Men's Underwear", keyword: 'men underwear' },
  { id: '200001813', name: "Men's Sleep & Lounge", keyword: 'men pajama' },
  { id: '201337808', name: "Men's Bags", keyword: 'men bag' },
  { id: '200362146', name: "Men's Watches", keyword: 'men watch' },
];
