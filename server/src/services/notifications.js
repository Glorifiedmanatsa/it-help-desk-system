import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { formatTicketCode } from '../utils/tickets.js';
import { renderTicketEmail, sendMail } from './email.js';

const ticketUrl = (id) => `${config.clientUrl}/tickets/${id}`;

async function loadTicket(ticketId) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      submittedBy: { select: { id: true, name: true, email: true, isActive: true } },
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });
}

async function send(ticket, recipient, { subject, heading, intro, body }) {
  if (!recipient?.isActive) return;
  const code = formatTicketCode(ticket.id);
  const { html, text } = renderTicketEmail({
    heading,
    intro,
    body,
    ticketCode: code,
    ticketTitle: ticket.title,
    ticketUrl: ticketUrl(ticket.id),
  });
  await sendMail({ to: recipient.email, subject: `[${code}] ${subject}`, html, text });
}

// Notifications are fire-and-forget: a mail failure must never fail the request.
function fireAndForget(task) {
  task().catch((err) => console.error('[email] failed to send notification:', err.message));
}

export const notifyAssigned = (ticketId) =>
  fireAndForget(async () => {
    const ticket = await loadTicket(ticketId);
    if (!ticket?.assignedTo) return;
    await send(ticket, ticket.assignedTo, {
      subject: 'Ticket assigned to you',
      heading: 'A ticket has been assigned to you',
      intro: `${ticket.submittedBy.name}'s ticket is now in your queue.`,
    });
    await send(ticket, ticket.submittedBy, {
      subject: 'Your ticket has been assigned',
      heading: 'Your ticket has been assigned',
      intro: `${ticket.assignedTo.name} from IT is now handling your request.`,
    });
  });

export const notifyResolved = (ticketId) =>
  fireAndForget(async () => {
    const ticket = await loadTicket(ticketId);
    if (!ticket) return;
    await send(ticket, ticket.submittedBy, {
      subject: 'Your ticket has been resolved',
      heading: 'Your ticket has been resolved',
      intro: 'IT has marked your ticket as resolved. If the problem is fixed you can close it; otherwise you can reopen it within 7 days.',
      body: ticket.resolutionNotes,
    });
  });

// Public comments go to "the other side": staff comments to the submitter, submitter comments to the assignee.
export const notifyComment = (ticketId, commentId) =>
  fireAndForget(async () => {
    const [ticket, comment] = await Promise.all([
      loadTicket(ticketId),
      prisma.ticketComment.findUnique({ where: { id: commentId }, include: { author: { select: { id: true, name: true } } } }),
    ]);
    if (!ticket || !comment) return;
    const recipient = comment.authorId === ticket.submittedById ? ticket.assignedTo : ticket.submittedBy;
    if (recipient?.id === comment.authorId) return;
    await send(ticket, recipient, {
      subject: 'New comment on your ticket',
      heading: `New comment from ${comment.author.name}`,
      intro: 'A new comment was added to this ticket:',
      body: comment.body,
    });
  });
