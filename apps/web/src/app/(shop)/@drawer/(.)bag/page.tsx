import { BagView } from '@/components/checkout/BagView';
import { RouteDrawer } from '@/components/RouteDrawer';

export default function BagDrawerPage() {
  return (
    <RouteDrawer title="Your bag">
      <BagView drawer />
    </RouteDrawer>
  );
}
