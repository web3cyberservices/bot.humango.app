
'use server';

import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = LoginSchema.safeParse({ email, password });
  if (!validation.success) {
    return { success: false, error: "Некорректный email или пароль" };
  }

  try {
    // Важно: Ищем точно так же, как записываем в сиде
    const res = await pool.query(
      "SELECT id, email, name FROM public.users WHERE email = $1 AND password = $2",
      [email.toLowerCase().trim(), password]
    );

    if (res.rows.length === 0) {
      return { success: false, error: "Пользователь не найден или пароль неверен" };
    }

    const user = res.rows[0];
    const cookieStore = await cookies();
    
    cookieStore.set('admin_authenticated', 'true', {
      path: '/',
      maxAge: 86400,
      sameSite: 'strict',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    cookieStore.set('manager_id', user.id.toString(), { path: '/' });
    cookieStore.set('manager_email', user.email, { path: '/' });

    return { success: true };
  } catch (error: any) {
    console.error('Login database error:', error.message);
    return { success: false, error: "Системная ошибка базы данных" };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_authenticated');
  cookieStore.delete('manager_id');
  cookieStore.delete('manager_email');
}

export async function getSession() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('admin_authenticated')?.value === 'true';
  const managerId = cookieStore.get('manager_id')?.value;
  const managerEmail = cookieStore.get('manager_email')?.value;

  if (!isAuthenticated) return null;

  return {
    id: managerId,
    email: managerEmail
  };
}
