import { z } from 'zod';
import { CATEGORIES, PRIORITIES, ROLES, STATUSES } from './utils/constants.js';

const id = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');
const text = (min, max, label) =>
  z.string({ required_error: `${label} is required` }).trim().min(min, `${label} is required`).max(max, `${label} must be at most ${max} characters`);

// "OPEN,ASSIGNED" → ['OPEN', 'ASSIGNED']; repeated query keys also work.
const enumList = (values) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : [].concat(v).flatMap((s) => String(s).split(',')).filter(Boolean)),
    z.array(z.enum(values)).optional(),
  );
const booleanFlag = z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean());
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };

export const idParams = z.object({ id: z.string() });

// Auth
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(255);
export const registerSchema = z.object({
  name: text(2, 100, 'Name'),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(128) });

// Users
export const userListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export const userUpdateSchema = z
  .object({ name: text(2, 100, 'Name').optional(), role: z.enum(ROLES).optional(), isActive: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, 'Nothing to update');
export const roleSchema = z.object({ role: z.enum(ROLES) });
export const userIdParams = z.object({ id });

// Tickets
export const createTicketSchema = z.object({
  title: text(5, 200, 'Title'),
  description: text(10, 10000, 'Description'),
  category: z.enum(CATEGORIES),
  suggestedUrgency: z.enum(PRIORITIES),
});
export const ticketListQuery = z.object({
  status: enumList(STATUSES),
  priority: enumList(PRIORITIES),
  category: enumList(CATEGORIES),
  assignedTo: z.union([z.enum(['me', 'unassigned']), z.string().regex(/^\d+$/)]).optional(),
  mine: booleanFlag.optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...page,
});
export const assignSchema = z.object({ assigneeId: id });
export const prioritySchema = z.object({ priority: z.enum(PRIORITIES) });
export const statusSchema = z.object({
  status: z.enum(STATUSES),
  resolutionNotes: z.string().trim().max(10000).optional(),
});
export const commentSchema = z.object({
  body: text(1, 5000, 'Comment'),
  isInternal: z.boolean().default(false),
});
export const attachmentParams = z.object({ id: z.string(), attachmentId: id });

// Knowledge base
const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(10, 'At most 10 tags')
  .transform((list) => [...new Set(list)]);
export const articleSchema = z.object({
  title: text(5, 200, 'Title'),
  problem: text(10, 10000, 'Problem'),
  solution: text(10, 10000, 'Solution'),
  category: z.enum(CATEGORIES),
  tags: tags.default([]),
});
export const articleUpdateSchema = articleSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Nothing to update');
export const articleListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  ...page,
});
export const articleIdParams = z.object({ id });

// Reports
export const reportQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional(), includeTickets: booleanFlag.optional() })
  .refine((d) => !d.from || !d.to || d.from <= d.to, { message: '"From" must be on or before "To"', path: ['from'] });
