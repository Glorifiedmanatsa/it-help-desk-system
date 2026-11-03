import { HttpError } from './httpError.js';
import { SLA_TARGET_MINUTES } from './constants.js';

export const formatTicketCode = (id) => `HD-${String(id).padStart(4, '0')}`;

// Accepts "12", "HD-0012" or "hd-12".
export function parseTicketId(raw) {
  const match = /^(?:HD-?)?(\d{1,9})$/i.exec(String(raw ?? '').trim());
  if (!match) throw new HttpError(404, 'Ticket not found');
  return Number(match[1]);
}

// SLA is measured on time to first response against the (confirmed or suggested) priority.
export function slaInfo(ticket, now = new Date()) {
  const priority = ticket.priority ?? ticket.suggestedUrgency;
  const targetMinutes = SLA_TARGET_MINUTES[priority];
  const createdAt = new Date(ticket.createdAt);
  const respondedAt = ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null;
  const elapsedMinutes = ((respondedAt ?? now) - createdAt) / 60000;
  return {
    priority,
    targetMinutes,
    dueAt: new Date(createdAt.getTime() + targetMinutes * 60000),
    responded: Boolean(respondedAt),
    breached: elapsedMinutes > targetMinutes,
  };
}

export const serializeTicket = (ticket, now = new Date()) => ({
  ...ticket,
  code: formatTicketCode(ticket.id),
  sla: slaInfo(ticket, now),
});
