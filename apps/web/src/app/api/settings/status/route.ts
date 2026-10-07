import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-auth';
import { getAeCreds } from '@/lib/ae';

export async function GET() {
  const denied = await requireAdminRoute();
  if (denied) return denied;
  const creds = await getAeCreds();
  return NextResponse.json({
    appKeySet: !!creds?.appKey,
    appSecretSet: !!creds?.appSecret,
    connected: !!(creds?.accessToken && creds.expiresAt && creds.expiresAt > Date.now()),
    expiresAt: creds?.expiresAt ?? null,
  });
}
