
'use server';

import { adminDb, adminAuth, admin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { z } from 'zod';

const AssignTaskSchema = z.object({
  taskId: z.string(),
  managerId: z.string(),
  managerEmail: z.string().email(),
});

async function verifySession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_authenticated')?.value;
  
  if (sessionCookie !== 'true') {
    throw new Error('Unauthorized: No active management session');
  }
  // In a real production app, you would verify the Firebase ID Token here:
  // const decodedToken = await adminAuth.verifyIdToken(idToken);
  // return decodedToken;
  return true;
}

export async function assignTaskToManager(formData: FormData) {
  await verifySession();

  const taskId = formData.get('taskId') as string;
  const managerId = formData.get('managerId') as string;
  const managerEmail = formData.get('managerEmail') as string;

  try {
    const taskRef = adminDb.collection('scan_queue').doc(taskId);

    return await adminDb.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new Error('Task not found');
      }

      const data = taskDoc.data();
      
      if (data?.assignedTo || data?.status === 'in_work') {
        throw new Error('Ошибка: Задача уже занята другим сотрудником');
      }

      transaction.update(taskRef, {
        status: 'in_work',
        assignedTo: managerId,
        managerName: managerEmail,
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getManagerTasks(managerId: string) {
  await verifySession();
  
  const snapshot = await adminDb.collection('scan_queue')
    .where('assignedTo', '==', managerId)
    .orderBy('assignedAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function getAvailableTasks() {
  await verifySession();

  const snapshot = await adminDb.collection('scan_queue')
    .where('assignedTo', '==', null)
    .where('status', 'in', ['completed', 'failed'])
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
