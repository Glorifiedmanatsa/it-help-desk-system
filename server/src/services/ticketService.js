import { prisma } from '../prisma.js';
import { HttpError } from '../utils/httpError.js';
import { isStaff, userSummarySelect } from '../utils/constants.js';
import { serializeTicket } from '../utils/tickets.js';
import { resolveStoredFile } from '../middleware/upload.js';
import { allowedTransitions, firstResponsePatch, planTransition } from './workflow.js';
import { notifyAssigned, notifyComment, notifyResolved } from './notifications.js';

const CONFLICT = 'This ticket was changed by someone else. Refresh and try again.';

const listInclude = {
  submittedBy: { select: userSummarySelect },
  assignedTo: { select: userSummarySelect },
  _count: { select: { attachments: true } },
};

export const canViewTicket = (ticket, user) => isStaff(user) || ticket.submittedById === user.id;

function assertCanView(ticket, user) {
  if (!canViewTicket(ticket, user)) throw new HttpError(403, 'You do not have access to this ticket');
}

async function findTicketOr404(client, id) {
  const ticket = await client.ticket.findUnique({ where: { id } });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  return ticket;
}

const toText = (value) => (value === null || value === undefined ? null : String(value));

function writeHistory(tx, ticketId, actorId, entries, at) {
  return tx.ticketHistory.createMany({
    data: entries.map((entry) => ({
      ticketId,
      changedById: actorId,
      fieldChanged: entry.field,
      oldValue: toText(entry.old),
      newValue: toText(entry.new),
      changedAt: at,
    })),
  });
}

// Applies an update only if the ticket still matches what we read (optimistic concurrency).
async function updateIfUnchanged(tx, ticket, data) {
  const { count } = await tx.ticket.updateMany({
    where: { id: ticket.id, status: ticket.status, assignedToId: ticket.assignedToId },
    data,
  });
  if (count === 0) throw new HttpError(409, CONFLICT);
}

export async function createTicket(input, files, actor) {
  const now = new Date();
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        suggestedUrgency: input.suggestedUrgency,
        submittedById: actor.id,
        createdAt: now,
        attachments: {
          create: files.map((file) => ({
            uploadedById: actor.id,
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
          })),
        },
      },
    });
    await writeHistory(tx, created.id, actor.id, [{ field: 'created', old: null, new: 'OPEN' }], now);
    return created;
  });
  return getTicketDetail(ticket.id, actor);
}

export async function listTickets(user, query) {
  const where = {};
  if (!isStaff(user) || query.mine) where.submittedById = user.id;
  if (query.status) where.status = { in: query.status };
  if (query.priority) where.priority = { in: query.priority };
  if (query.category) where.category = { in: query.category };
  if (query.assignedTo === 'me') where.assignedToId = user.id;
  else if (query.assignedTo === 'unassigned') where.assignedToId = null;
  else if (query.assignedTo) where.assignedToId = Number(query.assignedTo);

  if (query.q) {
    const code = /^(?:HD-?)?(\d{1,9})$/i.exec(query.q);
    where.OR = [{ title: { contains: query.q, mode: 'insensitive' } }];
    if (code) where.OR.push({ id: Number(code[1]) });
  }

  const direction = query.order;
  const orderBy =
    query.sort === 'priority'
      ? [{ priority: { sort: direction, nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ [query.sort]: direction }, { id: direction }];

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy,
      include: listInclude,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  const now = new Date();
  return { items: items.map((t) => serializeTicket(t, now)), total, page: query.page, pageSize: query.pageSize };
}

export async function getTicketDetail(id, user) {
  const staff = isStaff(user);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      submittedBy: { select: userSummarySelect },
      assignedTo: { select: userSummarySelect },
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: userSummarySelect } },
      },
      comments: {
        where: staff ? {} : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: userSummarySelect } },
      },
      history: {
        where: staff ? {} : { fieldChanged: { not: 'internal_note' } },
        orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
        include: { changedBy: { select: userSummarySelect } },
      },
      knowledgeArticle: { select: { id: true, title: true } },
    },
  });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  assertCanView(ticket, user);

  const result = serializeTicket(ticket);
  result.allowedTransitions = allowedTransitions(ticket, user);
  if (!staff) delete result.knowledgeArticle;
  return result;
}

// Every status change goes through here (assignment reuses planTransition for OPEN → ASSIGNED).
export async function transitionTicket(ticketId, toStatus, actor, { resolutionNotes } = {}) {
  if (toStatus === 'ASSIGNED') throw new HttpError(400, 'Use the assign action to assign a ticket');

  await prisma.$transaction(async (tx) => {
    const ticket = await findTicketOr404(tx, ticketId);
    assertCanView(ticket, actor);
    const now = new Date();
    const { data, history } = planTransition(ticket, toStatus, actor, { resolutionNotes, now });
    await updateIfUnchanged(tx, ticket, data);
    await writeHistory(tx, ticket.id, actor.id, history, now);
  });

  if (toStatus === 'RESOLVED') notifyResolved(ticketId);
  return getTicketDetail(ticketId, actor);
}

export async function assignTicket(ticketId, assigneeId, actor) {
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || !assignee.isActive || !isStaff(assignee)) {
    throw new HttpError(400, 'Tickets can only be assigned to active IT staff or admins');
  }

  await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { assignedTo: { select: { name: true } } },
    });
    if (!ticket) throw new HttpError(404, 'Ticket not found');
    if (ticket.status === 'CLOSED') throw new HttpError(409, 'Closed tickets cannot be reassigned');
    if (ticket.assignedToId === assigneeId) throw new HttpError(409, `This ticket is already assigned to ${assignee.name}`);
    if (ticket.assignedToId && actor.role !== 'ADMIN') throw new HttpError(403, 'Only admins can reassign a ticket');

    const now = new Date();
    let data = { assignedToId: assigneeId, ...firstResponsePatch(ticket, actor, now) };
    const history = [{ field: 'assigned_to', old: ticket.assignedTo?.name, new: assignee.name }];
    if (ticket.status === 'OPEN') {
      const plan = planTransition(ticket, 'ASSIGNED', actor, { now });
      data = { ...data, ...plan.data };
      history.push(...plan.history);
    }

    await updateIfUnchanged(tx, ticket, data);
    await writeHistory(tx, ticket.id, actor.id, history, now);
  });

  notifyAssigned(ticketId);
  return getTicketDetail(ticketId, actor);
}

export async function setPriority(ticketId, priority, actor) {
  await prisma.$transaction(async (tx) => {
    const ticket = await findTicketOr404(tx, ticketId);
    if (ticket.status === 'CLOSED') throw new HttpError(409, 'Closed tickets cannot be changed');
    if (ticket.priority === priority) return;

    const now = new Date();
    await updateIfUnchanged(tx, ticket, { priority, ...firstResponsePatch(ticket, actor, now) });
    await writeHistory(tx, ticket.id, actor.id, [{ field: 'priority', old: ticket.priority, new: priority }], now);
  });
  return getTicketDetail(ticketId, actor);
}

export async function addComment(ticketId, { body, isInternal }, actor) {
  const comment = await prisma.$transaction(async (tx) => {
    const ticket = await findTicketOr404(tx, ticketId);
    assertCanView(ticket, actor);
    if (isInternal && !isStaff(actor)) throw new HttpError(403, 'Only IT staff can add internal notes');
    if (ticket.status === 'CLOSED') throw new HttpError(409, 'Closed tickets cannot receive new comments');

    const now = new Date();
    const created = await tx.ticketComment.create({
      data: { ticketId, authorId: actor.id, body, isInternal, createdAt: now },
    });
    // Internal notes aren't visible to the submitter, so they don't count as a response.
    const patch = isInternal ? {} : firstResponsePatch(ticket, actor, now);
    await tx.ticket.update({ where: { id: ticketId }, data: { ...patch, updatedAt: now } });
    await writeHistory(tx, ticketId, actor.id, [{ field: isInternal ? 'internal_note' : 'comment', old: null, new: null }], now);
    return created;
  });

  if (!comment.isInternal) notifyComment(ticketId, comment.id);
  return getTicketDetail(ticketId, actor);
}

export async function addAttachments(ticketId, files, actor) {
  await prisma.$transaction(async (tx) => {
    const ticket = await findTicketOr404(tx, ticketId);
    assertCanView(ticket, actor);
    if (ticket.status === 'CLOSED') throw new HttpError(409, 'Closed tickets cannot receive new attachments');

    const now = new Date();
    await tx.attachment.createMany({
      data: files.map((file) => ({
        ticketId,
        uploadedById: actor.id,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        createdAt: now,
      })),
    });
    await writeHistory(
      tx,
      ticketId,
      actor.id,
      files.map((file) => ({ field: 'attachment', old: null, new: file.originalname })),
      now,
    );
  });
  return getTicketDetail(ticketId, actor);
}

export async function getAttachmentForDownload(ticketId, attachmentId, user) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { select: { id: true, submittedById: true } } },
  });
  if (!attachment || attachment.ticketId !== ticketId) throw new HttpError(404, 'Attachment not found');
  assertCanView(attachment.ticket, user);
  return { ...attachment, path: resolveStoredFile(attachment.storedName) };
}
