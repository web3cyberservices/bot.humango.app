
'use server';

import { pool } from '@/lib/db';
import { getSession } from './auth-actions';
import { z } from 'zod';

const AssignTaskSchema = z.object({
  taskId: z.string(),
  managerId: z.string(),
  managerEmail: z.string().email(),
});

export async function assignTaskToManager(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active management session');
  }

  const taskId = parseInt(formData.get('taskId') as string);
  const managerId = session.id;
  const managerEmail = session.email;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Атомарная блокировка строки в БД для предотвращения гонки условий
    const checkRes = await client.query(
      'SELECT assigned_to, status FROM public.scan_queue WHERE id = $1 FOR UPDATE',
      [taskId]
    );

    if (checkRes.rows.length === 0) {
      throw new Error('Задача не найдена');
    }

    const task = checkRes.rows[0];
    if (task.assigned_to) {
      throw new Error('Ошибка: Задача уже занята другим сотрудником');
    }

    await client.query(
      `UPDATE public.scan_queue 
       SET status = 'in_work', assigned_to = $1, manager_name = $2, assigned_at = NOW() 
       WHERE id = $3`,
      [managerId, managerEmail, taskId]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

export async function getManagerTasks() {
  const session = await getSession();
  if (!session) return [];
  
  const res = await pool.query(
    'SELECT * FROM public.scan_queue WHERE assigned_to = $1 ORDER BY assigned_at DESC',
    [session.id]
  );
  return res.rows;
}

export async function getAvailableTasks() {
  const session = await getSession();
  if (!session) return [];

  const res = await pool.query(
    "SELECT * FROM public.scan_queue WHERE assigned_to IS NULL AND status IN ('completed', 'failed') ORDER BY created_at DESC"
  );
  return res.rows;
}
