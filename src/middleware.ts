
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for path management and API protection.
 * Updated to allow public access to PDF reports generated for users.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // 1. Admin API Protection
  // We exclude /api/admin/report-pdf from authentication because users 
  // need to download their reports after a public scan.
  if (url.pathname.startsWith('/api/admin') && !url.pathname.includes('/report-pdf')) {
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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|audit-scope.txt|bot-policy.txt).*)',
  ],
};
