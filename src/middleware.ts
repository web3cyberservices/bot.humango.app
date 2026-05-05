import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

/**
 * Middleware для защиты API админки.
 * В продакшене здесь должна быть проверка JWT или Firebase Auth.
 * Сейчас реализована базовая защита через сессионную куку.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const isAdmin = request.cookies.get('admin_authenticated')?.value === 'true';
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized access' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/admin/:path*',
};
