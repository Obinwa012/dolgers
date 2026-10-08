export function Footer() {
  return (
    <footer className="mt-24 bg-denim-deep text-mist">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="display text-2xl text-paper">DOLGERS</p>
          <p className="mt-2 max-w-xs text-sm text-mist/80">Clothes already in the US, checked before they’re listed.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-paper">How we choose products</p>
          <p className="mt-2 max-w-sm text-mist/80">
            We only list items stocked in US warehouses, from sellers with strong ratings, after reading every review from
            people who bought them. If buyers report a problem we can’t fix, we don’t sell it.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-paper">No customs surprises</p>
          <p className="mt-2 max-w-sm text-mist/80">Shipping is included in the price, and there are no import fees on delivery: it’s already in the US.</p>
        </div>
      </div>
    </footer>
  );
}
