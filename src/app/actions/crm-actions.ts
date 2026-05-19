
'use server';

import { pool, getManagersStats } from '@/lib/db';
import { getSession } from './auth-actions';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview CRM Server Actions - Atomic Locking & Lead Scoring Order
 */

export async function takeTaskInWork(taskId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ATOMIC LOCK: SELECT FOR UPDATE
    const checkRes = await client.query(
      'SELECT crm_status, assigned_to FROM public.scan_queue WHERE id = $1 FOR UPDATE',
      [taskId]
    );

    if (checkRes.rows.length === 0) {
      throw new Error("Задача не найдена");
    }

    const task = checkRes.rows[0];
    if (task.crm_status === 'in_work' || task.assigned_to !== null) {
      return { success: false, error: "Эта задача уже занята другим менеджером" };
    }

    // Assign to current manager
    await client.query(
      `UPDATE public.scan_queue 
       SET crm_status = 'in_work', 
           status = 'in_work', 
           assigned_to = $1, 
           manager_name = $2, 
           assigned_at = NOW() 
       WHERE id = $3`,
      [session.id, session.email, taskId]
    );

    await client.query('COMMIT');
    revalidatePath('/manager');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

export async function updateTaskStatusAction(taskId: number, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    // Verify ownership before updating
    const check = await pool.query(
      'SELECT assigned_to FROM public.scan_queue WHERE id = $1',
      [taskId]
    );

    if (parseInt(check.rows[0]?.assigned_to) !== parseInt(session.id)) {
      throw new Error("Access denied: You don't own this task.");
    }

    await pool.query(
      'UPDATE public.scan_queue SET status = $1 WHERE id = $2',
      [status, taskId]
    );

    revalidatePath('/manager');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getManagerStatsAction() {
  const session = await getSession();
  if (!session) return [];
  return await getManagersStats();
}

export async function getAvailableTasks() {
  const session = await getSession();
  if (!session) return [];

  // Logic: Priority Lead Scoring
  // MISSING_CORE_FRAMEWORK leads have 100+ priority points
  const res = await pool.query(`
    SELECT * FROM public.scan_queue 
    WHERE crm_status = 'free' 
      AND status IN ('completed', 'failed') 
      AND (violations_count > 0)
    ORDER BY priority DESC, violations_count DESC, created_at DESC
  `);
  return res.rows;
}

export async function getMyTasks() {
  const session = await getSession();
  if (!session) return [];

  const res = await pool.query(
    'SELECT * FROM public.scan_queue WHERE assigned_to = $1 ORDER BY assigned_at DESC',
    [session.id]
  );
  return res.rows;
}
