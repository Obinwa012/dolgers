// Original demo catalog for Dolgers (women's fashion). All brands, products and copy are fictional.
// Imported by the app (fallback when Firestore is empty/unconfigured) and by scripts/seed.ts.
import type { Brand, Category, Fit, IconKey, Post, Product, Seller, SpecRow, Variant } from "../lib/types.ts";

export const categories: Category[] = [
  {
    slug: "dresses", name: "Dresses", icon: "dress", tint: "#e11d74",
    subcategories: [
      { slug: "casual-dresses", name: "Casual Dresses", icon: "dress" },
      { slug: "party-dresses", name: "Party & Evening", icon: "dress" },
      { slug: "maxi-dresses", name: "Maxi Dresses", icon: "dress" },
      { slug: "work-dresses", name: "Work Dresses", icon: "dress" },
    ],
  },
  {
    slug: "tops", name: "Tops & Blouses", icon: "top", tint: "#0ea5e9",
    subcategories: [
      { slug: "blouses", name: "Blouses", icon: "top" },
      { slug: "tees", name: "T-Shirts", icon: "top" },
      { slug: "shirts", name: "Shirts", icon: "top" },
      { slug: "camisoles", name: "Camisoles", icon: "top" },
    ],
  },
  {
    slug: "knitwear", name: "Knitwear", icon: "knit", tint: "#b45309",
    subcategories: [
      { slug: "sweaters", name: "Sweaters", icon: "knit" },
      { slug: "cardigans", name: "Cardigans", icon: "knit" },
    ],
  },
  {
    slug: "outerwear", name: "Coats & Jackets", icon: "coat", tint: "#a16207",
    subcategories: [
      { slug: "coats", name: "Coats & Trenches", icon: "coat" },
      { slug: "blazers", name: "Blazers", icon: "coat" },
      { slug: "puffers", name: "Puffer Jackets", icon: "coat" },
    ],
  },
  {
    slug: "bottoms", name: "Jeans & Trousers", icon: "denim", tint: "#1d4ed8",
    subcategories: [
      { slug: "jeans", name: "Jeans", icon: "denim" },
      { slug: "trousers", name: "Trousers", icon: "pants" },
      { slug: "shorts", name: "Shorts", icon: "pants" },
    ],
  },
  {
    slug: "skirts", name: "Skirts", icon: "skirt", tint: "#059669",
    subcategories: [
      { slug: "midi-skirts", name: "Midi Skirts", icon: "skirt" },
      { slug: "mini-skirts", name: "Mini Skirts", icon: "skirt" },
    ],
  },
  {
    slug: "activewear", name: "Activewear", icon: "active", tint: "#a21caf",
    subcategories: [
      { slug: "sets", name: "Matching Sets", icon: "active" },
      { slug: "leggings", name: "Leggings", icon: "active" },
      { slug: "sports-bras", name: "Sports Bras", icon: "active" },
    ],
  },
  {
    slug: "sleep-lounge", name: "Sleep & Lounge", icon: "sleep", tint: "#be185d",
    subcategories: [
      { slug: "pyjamas", name: "Pyjama Sets", icon: "sleep" },
      { slug: "robes", name: "Robes", icon: "sleep" },
    ],
  },
];

/** Marketplace sellers. "dolgers" is first party; the others are fictional third-party boutiques. */
export const sellers: Seller[] = [
  {
    slug: "dolgers", name: "Dolgers", tagline: "Sold and shipped by Dolgers",
    about: "Our own edit of everyday wardrobe staples, packed and shipped the same day when you order before 2pm.",
    rating: 4.8, ratingCount: 12_480, since: "2019-03-01", location: "Los Angeles, CA", color: "#ff5000",
    handlingDays: 0, returns: "dolgers", returnDays: 30, warranty: "manufacturer", pickup: true, status: "active",
  },
  {
    slug: "atelier-rose", name: "Atelier Rose", tagline: "Occasion dresses and skirts",
    about: "A small Los Angeles studio designing party dresses, satin skirts and wedding-guest outfits in limited runs.",
    rating: 4.7, ratingCount: 3_120, since: "2024-02-14", location: "Los Angeles, CA", color: "#be185d",
    handlingDays: 1, returns: "seller", returnDays: 30, warranty: "seller", status: "active",
  },
  {
    slug: "willow-and-thread", name: "Willow & Thread", tagline: "Knitwear made to be kept",
    about: "Cashmere blends, merino and chunky cables from a Portland knitwear studio. Returns go through the Dolgers returns centre.",
    rating: 4.9, ratingCount: 1_874, since: "2024-09-02", location: "Portland, OR", color: "#92400e",
    handlingDays: 2, returns: "dolgers", returnDays: 30, warranty: "manufacturer", status: "active",
  },
  {
    slug: "maison-lune", name: "Maison Lune", tagline: "Outerwear and tailoring",
    about: "Trench coats, wool wraps and relaxed blazers cut in New York. Fit questions go straight to the Maison Lune stylists.",
    rating: 4.6, ratingCount: 962, since: "2025-01-09", location: "New York, NY", color: "#374151",
    handlingDays: 2, returns: "seller", returnDays: 21, warranty: "seller", status: "active",
  },
];

export const brands: Brand[] = [
  { slug: "aurelia", name: "Aurelia", color: "#e11d74", textColor: "#ffffff", icon: "dress" },
  { slug: "lunette", name: "LUNETTE", color: "#111827", textColor: "#ffffff", icon: "dress" },
  { slug: "marlowe", name: "Marlowe", color: "#0f766e", textColor: "#ffffff", icon: "top" },
  { slug: "sorella", name: "SORELLA", color: "#f59e0b", textColor: "#111827", icon: "skirt" },
  { slug: "nomi", name: "nomi", color: "#1d4ed8", textColor: "#ffffff", icon: "denim" },
  { slug: "velvet-hour", name: "Velvet Hour", color: "#a21caf", textColor: "#ffffff", icon: "active" },
  { slug: "willow-thread", name: "Willow & Thread", color: "#92400e", textColor: "#ffffff", icon: "knit" },
  { slug: "maison-lune", name: "Maison Lune", color: "#374151", textColor: "#ffffff", icon: "coat" },
  { slug: "atelier-rose", name: "Atelier Rose", color: "#be185d", textColor: "#ffffff", icon: "skirt" },
];

interface Seed {
  slug: string;
  title: string;
  brand: string;
  category: string;
  sub: string;
  icon: IconKey;
  tint: string;
  /** [id, name, price, was?] per colour option. */
  opts: [string, string, number, number?][];
  fit: Fit;
  description: string;
  specs: string[];
  tags?: string[];
  seller?: string;
  sold: number;
  pair?: string[];
  specTable?: SpecRow[];
  qa?: Product["qa"];
}

const seeds: Seed[] = [
  // Dresses
  {
    slug: "aurelia-floral-wrap-midi-dress", title: "Aurelia Floral Wrap Midi Dress, V-Neck with Adjustable Waist Tie",
    brand: "aurelia", category: "dresses", sub: "casual-dresses", icon: "dress", tint: "#e11d74",
    opts: [["rose", "Rose Bloom", 58, 79], ["navy", "Navy Garden", 58, 79]], fit: "Regular", sold: 18_400,
    description: "A fluid wrap dress that moves with you. The adjustable tie sits at the natural waist and the midi hem lands just below the knee, so it works from brunch to the office with a blazer.",
    specs: ["Fabric: 100% viscose", "Length: 114 cm (size M)", "Neckline: V-neck wrap", "Lining: unlined, non-sheer", "Care: machine wash cold"],
    tags: ["new", "featured", "hot"], pair: ["maison-double-breasted-trench", "marlowe-relaxed-linen-blazer"],
    specTable: [
      { label: "Fabric", value: "100% LENZING™ viscose" }, { label: "Length", value: "114 cm (size M)" },
      { label: "Neckline", value: "V-neck wrap with adjustable waist tie" }, { label: "Sleeves", value: "Flutter, 18 cm" },
      { label: "Lining", value: "Unlined, non-sheer" }, { label: "Model", value: "175 cm, wears size S" }, { label: "Care", value: "Machine wash cold, line dry" },
    ],
    qa: [
      { q: "Is it see-through in the lighter print?", a: "No, the viscose is a mid weight and opaque in both prints.", by: "seller", date: "2026-09-18" },
      { q: "Does the wrap stay closed when walking?", a: "Yes. There's a hidden snap inside the wrap plus the waist tie.", by: "customer", date: "2026-09-02" },
    ],
  },
  {
    slug: "lunette-satin-slip-dress", title: "Lunette Satin Slip Dress with Cowl Neck and Bias-Cut Skirt",
    brand: "lunette", category: "dresses", sub: "party-dresses", icon: "dress", tint: "#7c3aed",
    opts: [["champagne", "Champagne", 64], ["emerald", "Emerald", 64]], fit: "Regular", sold: 9_600, seller: "atelier-rose",
    description: "A bias-cut slip in heavy satin that skims rather than clings. Adjustable straps and a cowl neck make it easy to dress up with heels or down with a denim jacket.",
    specs: ["Fabric: recycled polyester satin", "Length: 108 cm (size M)", "Adjustable spaghetti straps", "Side invisible zip", "Care: hand wash cold"],
    tags: ["featured"], pair: ["lunette-cropped-tweed-jacket"],
  },
  {
    slug: "sorella-linen-maxi-sundress", title: "Sorella Linen-Blend Maxi Sundress with Pockets and Smocked Back",
    brand: "sorella", category: "dresses", sub: "maxi-dresses", icon: "dress", tint: "#f59e0b",
    opts: [["sand", "Sand", 49, 69], ["terracotta", "Terracotta", 49, 69]], fit: "Regular", sold: 24_100,
    description: "The dress you'll live in all summer: breathable linen-blend, a smocked back that stretches to fit, and real pockets.",
    specs: ["Fabric: 55% linen, 45% cotton", "Length: 135 cm (size M)", "Side seam pockets", "Smocked back panel", "Care: machine wash cold"],
    tags: ["hot", "clearance"],
  },
  {
    slug: "marlowe-tailored-shirt-dress", title: "Marlowe Tailored Cotton Shirt Dress with Belt, Knee Length",
    brand: "marlowe", category: "dresses", sub: "work-dresses", icon: "dress", tint: "#0f766e",
    opts: [["white", "Optic White", 72], ["stripe", "Blue Stripe", 72]], fit: "Tall", sold: 5_200,
    description: "A crisp poplin shirt dress cut long for tall frames, with a removable fabric belt and a hem that sits at the knee on 175 cm+.",
    specs: ["Fabric: 100% organic cotton poplin", "Length: 118 cm", "Removable belt", "Button-through front", "Care: machine wash 40°"],
    tags: ["new"],
  },
  {
    slug: "aurelia-ruffle-tiered-maxi", title: "Aurelia Tiered Ruffle Maxi Dress, Plus Size Cut with Square Neck",
    brand: "aurelia", category: "dresses", sub: "maxi-dresses", icon: "dress", tint: "#db2777",
    opts: [["berry", "Berry", 68], ["ink", "Ink Black", 68]], fit: "Plus", sold: 7_300,
    description: "Cut properly for curves, with extra room through the bust and hip, a supportive square neckline and a three-tier skirt that swings.",
    specs: ["Fabric: stretch cotton jersey", "Sizes: 1X–4X", "Square neckline with elastic back", "Length: 140 cm (size 2X)", "Care: machine wash cold"],
    tags: ["new", "hot"],
  },
  {
    slug: "lunette-little-black-dress", title: "Lunette Little Black Dress, Petite-Cut Crepe with Open Back",
    brand: "lunette", category: "dresses", sub: "party-dresses", icon: "dress", tint: "#1f2937",
    opts: [["black", "Black", 85, 120]], fit: "Petite", sold: 6_900, seller: "atelier-rose",
    description: "Proportioned for 160 cm and under: a shorter bodice, a higher waist and a hem that stops at the knee, in a fluid crepe with a low open back.",
    specs: ["Fabric: stretch crepe", "Petite length: 96 cm", "Open back", "Hidden back zip", "Care: dry clean or hand wash"],
    tags: ["featured", "hot"], pair: ["lunette-cropped-tweed-jacket"],
  },
  // Tops
  {
    slug: "marlowe-silk-feel-button-blouse", title: "Marlowe Silk-Feel Button-Up Blouse, Relaxed Fit with Pearl Buttons",
    brand: "marlowe", category: "tops", sub: "blouses", icon: "top", tint: "#0ea5e9",
    opts: [["ivory", "Ivory", 44, 59], ["sage", "Sage", 44, 59]], fit: "Regular", sold: 15_800,
    description: "A washable satin-weave blouse with the drape of silk. Pearl-effect buttons, a soft collar and a longer back hem.",
    specs: ["Fabric: 100% recycled polyester", "Machine washable", "Pearl-effect buttons", "Longer back hem", "Care: machine wash cold"],
    tags: ["hot", "featured"], pair: ["marlowe-pleated-wide-leg-trousers"],
  },
  {
    slug: "sorella-ribbed-cotton-tee-3pack", title: "Sorella Ribbed Cotton Fitted Tee, 3-Pack in Neutral Colours",
    brand: "sorella", category: "tops", sub: "tees", icon: "top", tint: "#94a3b8",
    opts: [["neutrals", "White / Black / Stone", 36], ["pastels", "Blush / Sky / Mint", 36]], fit: "Regular", sold: 41_200,
    description: "Three everyday tees in a soft 2×2 rib that holds its shape wash after wash. Cropped just above the hip so they tuck or hang.",
    specs: ["Fabric: 95% cotton, 5% elastane", "3 tees per pack", "Crew neck", "Length: 56 cm (size M)", "Care: machine wash 40°"],
    tags: ["featured"],
  },
  {
    slug: "nomi-puff-sleeve-poplin-shirt", title: "nomi Puff-Sleeve Poplin Shirt with Gathered Cuffs",
    brand: "nomi", category: "tops", sub: "shirts", icon: "top", tint: "#f472b6",
    opts: [["pink", "Pale Pink", 39], ["white", "White", 39]], fit: "Regular", sold: 8_700,
    description: "A romantic take on the classic shirt, with voluminous sleeves gathered into buttoned cuffs. Crisp poplin that doesn't cling.",
    specs: ["Fabric: 100% cotton poplin", "Puff sleeves with button cuffs", "Concealed placket", "Length: 62 cm (size M)", "Care: machine wash 40°"],
    tags: ["new"],
  },
  {
    slug: "lunette-lace-trim-camisole", title: "Lunette Lace-Trim Satin Camisole with Adjustable Straps",
    brand: "lunette", category: "tops", sub: "camisoles", icon: "top", tint: "#be185d",
    opts: [["wine", "Wine", 28, 38], ["ivory", "Ivory", 28, 38], ["black", "Black", 28, 38]], fit: "Regular", sold: 12_600, seller: "atelier-rose",
    description: "A layering staple with a scalloped lace neckline and straps that adjust for the right length under a blazer.",
    specs: ["Fabric: satin with lace trim", "Adjustable straps", "Length: 58 cm (size M)", "Care: hand wash cold"],
    tags: ["hot"],
  },
  {
    slug: "marlowe-oversized-linen-shirt", title: "Marlowe Oversized Linen Shirt, Garment-Washed with Roll-Up Sleeves",
    brand: "marlowe", category: "tops", sub: "shirts", icon: "top", tint: "#84a98c",
    opts: [["sage", "Sage", 52], ["chalk", "Chalk", 52]], fit: "Plus", sold: 6_100,
    description: "Pre-washed 100% linen for a soft, lived-in feel from the first wear. Generously cut with a high-low hem; sleeves button up to three-quarter length.",
    specs: ["Fabric: 100% European linen", "Sizes: 1X–4X", "Roll-up sleeves with tab", "High-low hem", "Care: machine wash cold"],
    tags: ["new", "featured"],
  },
  // Knitwear
  {
    slug: "willow-cashmere-blend-crewneck", title: "Willow & Thread Cashmere-Blend Crewneck Sweater, Relaxed Fit",
    brand: "willow-thread", category: "knitwear", sub: "sweaters", icon: "knit", tint: "#b45309",
    opts: [["camel", "Camel", 98, 138], ["oat", "Oatmeal", 98, 138], ["charcoal", "Charcoal", 98, 138]], fit: "Regular", sold: 11_300, seller: "willow-and-thread",
    description: "Soft, light and warm: 30% cashmere in a fine gauge knit, with a ribbed neckline and cuffs that keep their shape.",
    specs: ["Fabric: 70% merino wool, 30% cashmere", "Fine gauge knit", "Ribbed neck, cuffs and hem", "Length: 62 cm (size M)", "Care: hand wash or wool cycle"],
    tags: ["hot", "featured"], pair: ["nomi-high-waist-straight-jeans", "marlowe-pleated-wide-leg-trousers"],
    qa: [{ q: "Does it itch?", a: "No. The merino is a 19 micron fibre and the cashmere softens it further.", by: "seller", date: "2026-09-21" }],
  },
  {
    slug: "willow-chunky-cable-cardigan", title: "Willow & Thread Chunky Cable-Knit Cardigan with Horn Buttons",
    brand: "willow-thread", category: "knitwear", sub: "cardigans", icon: "knit", tint: "#d6b98c",
    opts: [["oat", "Oatmeal", 86], ["forest", "Forest", 86]], fit: "Regular", sold: 7_900, seller: "willow-and-thread",
    description: "A heavyweight cable cardigan with deep pockets and horn-effect buttons. Roomy enough to layer over a shirt.",
    specs: ["Fabric: 60% cotton, 40% recycled wool", "Chunky cable knit", "Two patch pockets", "Length: 68 cm (size M)", "Care: wool cycle, dry flat"],
    tags: ["new"],
  },
  {
    slug: "nomi-mock-neck-rib-sweater", title: "nomi Mock-Neck Ribbed Sweater, Slim Fit Stretch Knit",
    brand: "nomi", category: "knitwear", sub: "sweaters", icon: "knit", tint: "#6b21a8",
    opts: [["plum", "Plum", 54, 70], ["black", "Black", 54, 70]], fit: "Regular", sold: 19_700,
    description: "A close-fitting rib knit with enough stretch to move in. The mock neck sits comfortably under a coat.",
    specs: ["Fabric: 50% viscose, 28% nylon, 22% polyester", "Mock neck", "Stretch rib", "Length: 58 cm (size M)", "Care: machine wash cold"],
    tags: ["hot"],
  },
  {
    slug: "willow-merino-turtleneck", title: "Willow & Thread Tall Merino Turtleneck, Extra-Long Body and Sleeves",
    brand: "willow-thread", category: "knitwear", sub: "sweaters", icon: "knit", tint: "#1e3a5f",
    opts: [["navy", "Navy", 79], ["cream", "Cream", 79]], fit: "Tall", sold: 4_300, seller: "willow-and-thread",
    description: "Cut 5 cm longer in the body and 4 cm longer in the sleeve, in a smooth washable merino that doesn't pill.",
    specs: ["Fabric: 100% extra-fine merino", "Machine washable wool", "Tall fit +5 cm body, +4 cm sleeve", "Fold-over turtleneck", "Care: wool cycle 30°"],
    tags: ["new"],
  },
  // Outerwear
  {
    slug: "maison-double-breasted-trench", title: "Maison Lune Double-Breasted Trench Coat, Water-Repellent Cotton Twill",
    brand: "maison-lune", category: "outerwear", sub: "coats", icon: "coat", tint: "#a16207",
    opts: [["stone", "Stone", 168, 215], ["black", "Black", 172, 219]], fit: "Regular", sold: 8_200, seller: "maison-lune",
    description: "The classic trench with a modern cut: storm flap, belted waist, and a water-repellent finish on organic cotton twill.",
    specs: ["Fabric: organic cotton twill, water-repellent", "Fully lined", "Belted waist, storm flap", "Length: 105 cm (size M)", "Care: dry clean"],
    tags: ["hot", "featured"], pair: ["marlowe-silk-feel-button-blouse"],
    qa: [{ q: "Can I wear it over a chunky sweater?", a: "Yes, size up if you plan to layer more than a mid-weight knit.", by: "seller", date: "2026-09-12" }],
  },
  {
    slug: "maison-wool-blend-wrap-coat", title: "Maison Lune Wool-Blend Wrap Coat with Self-Tie Belt",
    brand: "maison-lune", category: "outerwear", sub: "coats", icon: "coat", tint: "#9a3412",
    opts: [["rust", "Rust", 189], ["camel", "Camel", 189]], fit: "Regular", sold: 3_900, seller: "maison-lune",
    description: "A soft, brushed wool-blend wrap coat that closes with a self-tie belt. No buttons, no fuss, and warm enough for -5°C with a knit underneath.",
    specs: ["Fabric: 60% wool, 30% polyester, 10% other", "Fully lined", "Wrap front with tie belt", "Length: 112 cm (size M)", "Care: dry clean"],
    tags: ["new", "featured"],
  },
  {
    slug: "marlowe-relaxed-linen-blazer", title: "Marlowe Relaxed Linen-Blend Blazer, Single-Breasted with Patch Pockets",
    brand: "marlowe", category: "outerwear", sub: "blazers", icon: "coat", tint: "#475569",
    opts: [["slate", "Slate", 96, 128], ["ecru", "Ecru", 96, 128]], fit: "Regular", sold: 10_400,
    description: "An unstructured, breathable blazer that works over dresses and tees. Half-lined for spring and summer, with soft shoulders.",
    specs: ["Fabric: 52% linen, 48% viscose", "Half-lined", "Two patch pockets", "Length: 70 cm (size M)", "Care: dry clean"],
    tags: ["hot"],
  },
  {
    slug: "sorella-quilted-puffer-jacket", title: "Sorella Recycled Quilted Puffer Jacket, Plus-Size Cut with Hood",
    brand: "sorella", category: "outerwear", sub: "puffers", icon: "coat", tint: "#0f172a",
    opts: [["black", "Black", 112, 159], ["olive", "Olive", 112, 159]], fit: "Plus", sold: 5_600,
    description: "Lightweight recycled-fill insulation in a wind-resistant shell, cut for plus sizes with extra room across the shoulders and hips.",
    specs: ["Fill: 100% recycled polyester", "Sizes: 1X–4X", "Detachable hood", "Two zip pockets", "Care: machine wash cold"],
    tags: ["hot", "clearance"],
  },
  {
    slug: "lunette-cropped-tweed-jacket", title: "Lunette Cropped Bouclé Tweed Jacket, Petite Fit with Gold Buttons",
    brand: "lunette", category: "outerwear", sub: "blazers", icon: "coat", tint: "#db2777",
    opts: [["pink", "Blush Pink", 108], ["cream", "Cream", 108]], fit: "Petite", sold: 3_100, seller: "atelier-rose",
    description: "A boxy cropped jacket with a bouclé weave, braid trim and gold-tone buttons. Proportioned for petite frames.",
    specs: ["Fabric: polyester-cotton bouclé", "Lined", "Braid trim", "Petite length: 48 cm", "Care: dry clean"],
    tags: ["new"],
  },
  // Bottoms
  {
    slug: "nomi-high-waist-straight-jeans", title: "nomi High-Waist Straight Leg Jeans, Rigid Organic Denim",
    brand: "nomi", category: "bottoms", sub: "jeans", icon: "denim", tint: "#1d4ed8",
    opts: [["mid", "Mid Wash", 68, 89], ["dark", "Dark Wash", 68, 89]], fit: "Regular", sold: 33_500,
    description: "A true high-rise straight leg in 100% rigid organic cotton denim that softens with wear. Sits at the natural waist and ends at the ankle.",
    specs: ["Fabric: 100% organic cotton denim", "Rise: 28 cm", "Inseam: 76 cm (size 28)", "Straight leg", "Care: machine wash cold, inside out"],
    tags: ["hot", "featured"], pair: ["marlowe-silk-feel-button-blouse"],
  },
  {
    slug: "nomi-wide-leg-denim", title: "nomi Tall Wide-Leg Jeans, 86 cm Inseam with Raw Hem",
    brand: "nomi", category: "bottoms", sub: "jeans", icon: "denim", tint: "#2563eb",
    opts: [["indigo", "Indigo", 72], ["ecru", "Ecru", 72]], fit: "Tall", sold: 5_900,
    description: "Wide-leg jeans with a proper 86 cm inseam, high rise and a raw hem so nobody has to hem them.",
    specs: ["Fabric: 100% cotton denim", "Inseam: 86 cm", "Rise: 29 cm", "Raw hem", "Care: machine wash cold"],
    tags: ["new"],
  },
  {
    slug: "marlowe-pleated-wide-leg-trousers", title: "Marlowe Pleated Wide-Leg Trousers, High Waist with Belt Loops",
    brand: "marlowe", category: "bottoms", sub: "trousers", icon: "pants", tint: "#374151",
    opts: [["charcoal", "Charcoal", 64], ["camel", "Camel", 64]], fit: "Regular", sold: 14_100,
    description: "Fluid, drapey trousers with forward pleats and a flattering high waist. Finished with side pockets and a hook-and-bar closure.",
    specs: ["Fabric: 70% polyester, 30% viscose", "Rise: 30 cm", "Inseam: 78 cm", "Side pockets", "Care: machine wash cold"],
    tags: ["featured"],
  },
  {
    slug: "sorella-linen-drawstring-shorts", title: "Sorella Linen Drawstring Shorts, Elastic Waist with Pockets",
    brand: "sorella", category: "bottoms", sub: "shorts", icon: "pants", tint: "#0891b2",
    opts: [["aqua", "Aqua", 34, 44], ["sand", "Sand", 34, 44]], fit: "Regular", sold: 22_800,
    description: "Breathable linen-blend shorts with an elastic drawstring waist and deep side pockets.",
    specs: ["Fabric: 55% linen, 45% cotton", "Elastic waist with drawstring", "Inseam: 12 cm", "Care: machine wash cold"],
    tags: ["clearance"],
  },
  {
    slug: "nomi-petite-ankle-trousers", title: "nomi Petite Slim Ankle Trousers, Stretch Crepe with 66 cm Inseam",
    brand: "nomi", category: "bottoms", sub: "trousers", icon: "pants", tint: "#4b5563",
    opts: [["black", "Black", 58], ["navy", "Navy", 58]], fit: "Petite", sold: 4_800,
    description: "Slim ankle trousers with a 66 cm inseam, designed for 160 cm and under so you can skip the tailor.",
    specs: ["Fabric: stretch crepe", "Inseam: 66 cm", "Rise: 26 cm", "Back pockets", "Care: machine wash cold"],
    tags: ["new"],
  },
  // Skirts
  {
    slug: "atelier-pleated-satin-midi-skirt", title: "Atelier Rose Pleated Satin Midi Skirt with Elastic Waist",
    brand: "atelier-rose", category: "skirts", sub: "midi-skirts", icon: "skirt", tint: "#059669",
    opts: [["emerald", "Emerald", 56, 74], ["champagne", "Champagne", 56, 74], ["black", "Black", 56, 74]], fit: "Regular", sold: 27_300, seller: "atelier-rose",
    description: "Fine knife pleats in a shimmering satin that swish with every step. Comfortable elastic waist, no lining needed.",
    specs: ["Fabric: 100% polyester satin", "Knife pleats", "Elastic waist", "Length: 80 cm", "Care: machine wash cold"],
    tags: ["hot", "featured"], pair: ["lunette-lace-trim-camisole"],
  },
  {
    slug: "lunette-denim-a-line-mini", title: "Lunette Denim A-Line Mini Skirt with Button Front",
    brand: "lunette", category: "skirts", sub: "mini-skirts", icon: "skirt", tint: "#3b82f6",
    opts: [["light", "Light Wash", 42], ["dark", "Dark Wash", 42]], fit: "Regular", sold: 9_200,
    description: "A button-through mini in a mid-weight denim with a soft A-line flare and built-in shorts for comfort.",
    specs: ["Fabric: 100% cotton denim", "Button-through front", "Built-in shorts", "Length: 42 cm", "Care: machine wash cold"],
    tags: ["new"],
  },
  {
    slug: "atelier-floral-tiered-midi", title: "Atelier Rose Floral Tiered Midi Skirt, Cotton Voile",
    brand: "atelier-rose", category: "skirts", sub: "midi-skirts", icon: "skirt", tint: "#ec4899",
    opts: [["peony", "Peony", 62], ["wild", "Wildflower", 62]], fit: "Regular", sold: 6_400, seller: "atelier-rose",
    description: "Breezy cotton voile in a three-tier cut, lined to the knee so it stays opaque in sunlight.",
    specs: ["Fabric: 100% cotton voile", "Lined to knee", "Elastic back waist", "Length: 86 cm", "Care: machine wash cold"],
    tags: ["featured"],
  },
  // Activewear
  {
    slug: "velvet-seamless-yoga-set", title: "Velvet Hour Seamless Yoga Set: Sports Bra and High-Waist Leggings",
    brand: "velvet-hour", category: "activewear", sub: "sets", icon: "active", tint: "#a21caf",
    opts: [["orchid", "Orchid", 64, 88], ["slate", "Slate", 64, 88], ["black", "Black", 64, 88]], fit: "Regular", sold: 38_900,
    description: "A seamless matching set with sculpting rib and light compression. Medium-support bra with removable pads, leggings with a wide non-dig waistband.",
    specs: ["Fabric: 76% nylon, 24% elastane", "Seamless construction", "Removable bra pads", "Squat-proof", "Care: machine wash cold"],
    tags: ["hot", "featured"],
  },
  {
    slug: "velvet-high-rise-leggings", title: "Velvet Hour High-Rise Leggings, Buttery-Soft with Phone Pocket",
    brand: "velvet-hour", category: "activewear", sub: "leggings", icon: "active", tint: "#111827",
    opts: [["black", "Black", 42], ["navy", "Midnight", 42], ["moss", "Moss", 42]], fit: "Regular", sold: 52_300,
    description: "Buttery-soft brushed fabric, a high-rise waistband that stays up, and a hidden pocket big enough for a phone.",
    specs: ["Fabric: 78% recycled nylon, 22% elastane", "Rise: 27 cm", "Inseam: 71 cm", "Hidden waistband pocket", "Care: machine wash cold"],
    tags: ["hot"],
  },
  {
    slug: "velvet-longline-sports-bra", title: "Velvet Hour Longline Sports Bra, Medium Support with Cross-Back Straps",
    brand: "velvet-hour", category: "activewear", sub: "sports-bras", icon: "active", tint: "#e11d74",
    opts: [["rose", "Rose", 34], ["black", "Black", 34]], fit: "Regular", sold: 16_700,
    description: "A longline bra with a supportive cross-back and removable pads. Sized XS to XXL.",
    specs: ["Fabric: 80% nylon, 20% elastane", "Medium support", "Removable pads", "Cross-back straps", "Care: machine wash cold"],
    tags: ["new"],
  },
  // Sleep
  {
    slug: "sorella-satin-pyjama-set", title: "Sorella Satin Pyjama Set: Piped Button Shirt and Shorts",
    brand: "sorella", category: "sleep-lounge", sub: "pyjamas", icon: "sleep", tint: "#be185d",
    opts: [["blush", "Blush", 54, 72], ["navy", "Navy", 54, 72]], fit: "Regular", sold: 20_400,
    description: "A classic notch-collar pyjama set in washable satin with contrast piping. The shorts have an elastic waist and side pockets.",
    specs: ["Fabric: 100% polyester satin", "Notch collar shirt, piped trim", "Elastic-waist shorts with pockets", "Care: machine wash cold"],
    tags: ["featured", "hot"],
  },
  {
    slug: "willow-waffle-knit-robe", title: "Willow & Thread Waffle-Knit Cotton Robe, Shawl Collar with Belt",
    brand: "willow-thread", category: "sleep-lounge", sub: "robes", icon: "sleep", tint: "#a8a29e",
    opts: [["stone", "Stone", 62], ["sage", "Sage", 62]], fit: "Regular", sold: 6_800, seller: "willow-and-thread",
    description: "A soft waffle-weave robe that's absorbent after a shower and light enough to wear year-round.",
    specs: ["Fabric: 100% cotton waffle weave", "Shawl collar and belt", "Two patch pockets", "Length: 105 cm (size M)", "Care: machine wash 40°"],
    tags: ["hot"],
  },
  {
    slug: "sorella-cotton-lounge-set", title: "Sorella Cotton Lounge Set: Cropped Sweatshirt and Wide-Leg Joggers",
    brand: "sorella", category: "sleep-lounge", sub: "pyjamas", icon: "sleep", tint: "#fb7185",
    opts: [["rose", "Dusty Rose", 48], ["grey", "Heather Grey", 48]], fit: "Regular", sold: 12_200,
    description: "Brushed-back cotton fleece in a cropped crew and wide-leg joggers. Wear them to the shops or to sleep.",
    specs: ["Fabric: 80% cotton, 20% polyester fleece", "Cropped crew neck", "Wide-leg joggers with pockets", "Care: machine wash cold"],
    tags: ["new"],
  },
];

export const products: Product[] = seeds.map((s, i): Product => {
  const variants: Variant[] = s.opts.map(([id, name, price, was]) => ({ id, name, price, ...(was ? { compareAtPrice: was } : {}) }));
  return {
    id: s.slug,
    slug: s.slug,
    title: s.title,
    brand: s.brand,
    category: s.category,
    subcategory: s.sub,
    ...(s.seller ? { seller: s.seller } : {}),
    description: s.description,
    specs: s.specs,
    ...(s.specTable ? { specTable: s.specTable } : {}),
    fit: s.fit,
    icon: s.icon,
    tint: s.tint,
    variants,
    tags: s.tags ?? [],
    ...(s.qa ? { qa: s.qa } : {}),
    ...(s.pair ? { boughtTogether: s.pair } : {}),
    rating: 4.3 + ((i * 7) % 7) / 10,
    reviewCount: Math.max(8, Math.round(s.sold / 38)),
    sold: s.sold,
    stock: 5 + ((i * 11) % 40),
    createdAt: Date.UTC(2026, 8, 1) - i * 86_400_000,
  };
});

export const posts: Post[] = [
  {
    slug: "three-ways-to-style-a-trench-coat",
    title: "Three Ways to Style a Trench Coat This Autumn",
    excerpt: "Over a slip dress, with straight jeans, or belted over tailoring: one coat, three outfits.",
    body: [
      "A good trench works with almost everything in your wardrobe. The trick is deciding where the belt goes and how much you want underneath it.",
      "For evenings, throw it over a satin slip dress and leave it open. For weekends, pair it with straight-leg jeans and a fine knit. For work, belt it tightly over a shirt dress or tailored trousers.",
      "Keep the colours quiet. A trench is a neutral, so let the pieces underneath carry the colour.",
    ],
    author: "Dolgers Style Desk", date: "2026-09-28", icon: "coat", tint: "#a16207",
  },
  {
    slug: "the-autumn-capsule-wardrobe",
    title: "The Autumn Capsule Wardrobe: 12 Pieces, 30 Outfits",
    excerpt: "A short, hard-working edit of knits, trousers, a blazer and one great dress.",
    body: [
      "A capsule wardrobe isn't about owning less for its own sake. It's about owning pieces that all work together so getting dressed takes two minutes.",
      "Start with three knits in neutral tones, two pairs of trousers or jeans, a blazer, a trench and one dress that suits every occasion.",
      "Pick a palette of three or four colours and stick to it. Everything will mix with everything else.",
    ],
    author: "Dolgers Style Desk", date: "2026-09-14", icon: "knit", tint: "#b45309",
  },
  {
    slug: "finding-your-fit-petite-regular-tall-plus",
    title: "Finding Your Fit: Petite, Regular, Tall and Plus Explained",
    excerpt: "What the sizing ranges actually mean, and how to choose between two sizes.",
    body: [
      "Petite means proportioned for 160 cm and under: shorter rise, shorter inseam and sleeve, and a higher waist. Tall adds length to the body, sleeve and leg. Plus is graded for fuller figures, not just scaled up.",
      "If you're between sizes, check the measurements listed on the product page rather than the label. Fabric with stretch can go smaller; structured fabrics like denim and tailoring usually need your true size.",
      "Not sure? Every order has 30-day returns.",
    ],
    author: "Dolgers Style Desk", date: "2026-08-30", icon: "denim", tint: "#1d4ed8",
  },
];
