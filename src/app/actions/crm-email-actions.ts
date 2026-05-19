
'use server';

import nodemailer from 'nodemailer';
import { pool } from '@/lib/db';
import { generatePdfReport } from '@/lib/report-generator';

/**
 * @fileOverview CRM Email Action - Sends Audit Report to Client
 */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.beget.com',
  port: 2525,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendAuditEmailAction(taskId: number, managerEmail: string, targetEmail: string, body: string) {
  try {
    // 1. Fetch scan data and findings
    const res = await pool.query(
      'SELECT url, audit_findings FROM public.scan_queue WHERE id = $1',
      [taskId]
    );

    if (res.rows.length === 0) {
      return { success: false, error: "Task not found" };
    }

    const task = res.rows[0];
    const url = new URL(task.url);
    const domain = url.hostname;

    // 2. Generate PDF Buffer (Using the same logic as download button)
    const findings = task.audit_findings || [];
    const pdfBuffer = await generatePdfReport(domain, findings);

    if (!pdfBuffer) {
      return { success: false, error: "Failed to generate PDF report" };
    }

    // 3. Send Email
    await transporter.sendMail({
      from: `"Humango Compliance" <${process.env.SMTP_USER}>`,
      replyTo: managerEmail,
      to: targetEmail,
      subject: `Legal Audit Report for ${domain} - Critical Compliance Risks Detected`,
      text: body,
      attachments: [
        {
          filename: `Humango_Audit_${domain}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    // 4. Update Task Status
    await pool.query(
      'UPDATE public.scan_queue SET auto_message_sent = true, auto_message_sent_at = NOW() WHERE id = $1',
      [taskId]
    );

    return { success: true, message: "Email sent successfully!" };
  } catch (error: any) {
    console.error('[Email Action Error]', error);
    return { success: false, error: error.message };
  }
}
