
import nodemailer from 'nodemailer';
import { logger } from './logger';

/**
 * @fileOverview Email Delivery System for Audit Reports
 */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.humango.app',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'abuse@humango.app',
    pass: process.env.SMTP_PASS || 'password',
  },
});

export async function sendAuditEmail(domain: string, recipient: string) {
  try {
    // We call the local API internally to generate the PDF buffer
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const reportUrl = `${baseUrl}/api/admin/report-pdf?domain=${domain}`;
    
    logger.info(`Fetching report for email attachment: ${reportUrl}`);
    
    const response = await fetch(reportUrl);
    if (!response.ok) throw new Error('Failed to generate report for email');
    
    const pdfBuffer = await response.arrayBuffer();

    await transporter.sendMail({
      from: '"Humango Compliance Bot" <abuse@humango.app>',
      to: recipient,
      subject: `Statutory Compliance Audit Report for ${domain}`,
      text: `Hello,\n\nYour automated statutory compliance audit for ${domain} is complete. Please find the detailed PDF report attached to this email.\n\nBest regards,\nHumango Team`,
      attachments: [
        {
          filename: `Humango_Audit_${domain}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    });

    logger.info(`Email sent successfully to ${recipient} for domain ${domain}`);
    return true;
  } catch (error: any) {
    logger.error(`Email delivery failed: ${error.message}`);
    return false;
  }
}
