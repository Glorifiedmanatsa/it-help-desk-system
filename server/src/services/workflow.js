import { HttpError } from '../utils/httpError.js';
import { isStaff } from '../utils/constants.js';

export const REOPEN_WINDOW_DAYS = 7;
const REOPEN_WINDOW_MS = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// The only legal status changes, and who may make each one.
// OPEN → ASSIGNED happens through the assign action, never directly.
export const TRANSITIONS = {
  OPEN: { ASSIGNED: 'staff' },
  ASSIGNED: { IN_PROGRESS: 'staff' },
  IN_PROGRESS: { WAITING_ON_USER: 'staff', RESOLVED: 'staff' },
  WAITING_ON_USER: { IN_PROGRESS: 'staff', RESOLVED: 'staff' },
  RESOLVED: { CLOSED: 'submitter', IN_PROGRESS: 'submitter' },
  CLOSED: {},
};

const isReopen = (from, to) => from === 'RESOLVED' && to === 'IN_PROGRESS';

// Returns null when allowed, otherwise { status, message }.
export function checkTransition(ticket, toStatus, actor, now = new Date()) {
  const from = ticket.status;
  const allowedBy = TRANSITIONS[from]?.[toStatus];
  if (!allowedBy) {
    return { status: 409, message: `A ${from} ticket cannot be moved to ${toStatus}` };
  }
  if (allowedBy === 'staff' && !isStaff(actor)) {
    return { status: 403, message: 'Only IT staff can make this change' };
  }
  if (allowedBy === 'submitter' && ticket.submittedById !== actor.id) {
    return { status: 403, message: 'Only the person who submitted this ticket can do this' };
  }
  if (isReopen(from, toStatus)) {
    const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;
    if (!resolvedAt || now - resolvedAt > REOPEN_WINDOW_MS) {
      return { status: 409, message: `Tickets can only be reopened within ${REOPEN_WINDOW_DAYS} days of being resolved` };
    }
  }
  return null;
}

// Statuses the actor can move this ticket to via the status endpoint (used to drive the UI).
export const allowedTransitions = (ticket, actor, now = new Date()) =>
  Object.keys(TRANSITIONS[ticket.status] ?? {}).filter(
    (to) => to !== 'ASSIGNED' && !checkTransition(ticket, to, actor, now),
  );

// The first action by IT staff (other than the submitter) counts as the first response.
export const firstResponsePatch = (ticket, actor, now) =>
  !ticket.firstResponseAt && isStaff(actor) && actor.id !== ticket.submittedById ? { firstResponseAt: now } : {};

// Validates a status change and returns the ticket update plus history rows to write.
export function planTransition(ticket, toStatus, actor, { resolutionNotes, now = new Date() } = {}) {
  const problem = checkTransition(ticket, toStatus, actor, now);
  if (problem) throw new HttpError(problem.status, problem.message);

  const data = { status: toStatus };
  const history = [{ field: 'status', old: ticket.status, new: toStatus }];

  if (toStatus === 'RESOLVED') {
    const notes = resolutionNotes?.trim();
    if (!notes) throw new HttpError(400, 'Resolution notes are required to resolve a ticket');
    data.resolvedAt = now;
    data.resolutionNotes = notes;
    if (notes !== ticket.resolutionNotes) {
      history.push({ field: 'resolution_notes', old: ticket.resolutionNotes, new: notes });
    }
  }
  if (toStatus === 'CLOSED') data.closedAt = now;
  if (isReopen(ticket.status, toStatus)) data.resolvedAt = null;

  return { data: { ...data, ...firstResponsePatch(ticket, actor, now) }, history };
}
