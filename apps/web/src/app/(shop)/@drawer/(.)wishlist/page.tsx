import { WishlistView } from '@/components/account/WishlistView';
import { RouteDrawer } from '@/components/RouteDrawer';

export default function WishlistDrawerPage() {
  return (
    <RouteDrawer title="Wishlist">
      <WishlistView drawer />
    </RouteDrawer>
  );
}
