import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Builds a simple, email-client-safe HTML message with a link back to the ticket.
export function renderTicketEmail({ heading, intro, ticketCode, ticketTitle, ticketUrl, body }) {
  const text = [heading, '', intro, body ? `\n${body}\n` : '', `${ticketCode}: ${ticketTitle}`, ticketUrl].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
    <tr><td>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;letter-spacing:.04em;text-transform:uppercase">IT Help Desk · ${escapeHtml(ticketCode)}</p>
      <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;line-height:1.5">${escapeHtml(intro)}</p>
      <p style="margin:0 0 16px;font-weight:600">${escapeHtml(ticketTitle)}</p>
      ${body ? `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-left:3px solid #2563eb;white-space:pre-wrap">${escapeHtml(body)}</blockquote>` : ''}
      <a href="${escapeHtml(ticketUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px">View ticket ${escapeHtml(ticketCode)}</a>
    </td></tr>
  </table>
</body></html>`;
  return { html, text };
}

export async function sendMail({ to, subject, html, text }) {
  if (!to || (Array.isArray(to) && to.length === 0)) return;
  if (!transporter) {
    if (!config.isTest) console.log(`[email:dev] To: ${[].concat(to).join(', ')} | Subject: ${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, html, text });
}
