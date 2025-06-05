import { handleRedirect } from '@/app/login/actions';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return await handleRedirect();
}
