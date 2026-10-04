'use client';

import { useParams } from 'next/navigation';
import { ProductEditor } from '@/components/dashboard/ProductEditor';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductEditor key={id} productId={id} />;
}
