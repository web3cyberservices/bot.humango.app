
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware для защиты терминала и обработки путей.
 * Оптимизировано для корректной работы в standalone-режиме.
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // КРИТИЧЕСКОЕ ПРАВИЛО: Никогда не перехватывать системные чанки и статику Next.js
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/static/') ||
    url.pathname.includes('/chunks/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const isReportPdf = url.pathname.startsWith('/api/admin/report-pdf');
  const isAdminPath = url.pathname.startsWith('/api/admin');
  const isAnalyticsPath = url.pathname.startsWith('/analytics');
  
  // Проверка авторизации для админ-панели и аналитики
  if ((isAdminPath && !isReportPdf) || isAnalyticsPath) {
    const isAdmin = request.cookies.get('admin_authenticated')?.value === 'true';
    
    if (!isAdmin) {
      if (isAnalyticsPath) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.json(
        { success: false, message: 'Unauthorized terminal access' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Обрабатываем все пути, кроме тех, что явно исключены из middleware.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|audit-scope.txt|robots.txt).*)',
  ],
};
