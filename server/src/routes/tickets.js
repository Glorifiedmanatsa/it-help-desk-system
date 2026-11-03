import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { parse, validate } from '../middleware/validate.js';
import { removeFiles, uploadAttachments, verifyFileSignatures } from '../middleware/upload.js';
import { HttpError } from '../utils/httpError.js';
import { STAFF_ROLES } from '../utils/constants.js';
import { parseTicketId } from '../utils/tickets.js';
import * as tickets from '../services/ticketService.js';
import { createArticle } from '../services/knowledgeService.js';
import {
  articleSchema,
  assignSchema,
  attachmentParams,
  commentSchema,
  createTicketSchema,
  prioritySchema,
  statusSchema,
  ticketListQuery,
} from '../schemas.js';

const router = Router();
router.use(requireAuth);

const staffOnly = requireRoles(...STAFF_ROLES);
const ticketId = (req) => parseTicketId(req.params.id);

// Uploaded files are already on disk by the time the handler runs; delete them if anything fails.
const withUploadCleanup = (handler) => async (req, res) => {
  try {
    await verifyFileSignatures(req.files);
    await handler(req, res);
  } catch (err) {
    await removeFiles(req.files);
    throw err;
  }
};

router.post(
  '/',
  uploadAttachments,
  withUploadCleanup(async (req, res) => {
    const input = parse(createTicketSchema, req.body);
    res.status(201).json(await tickets.createTicket(input, req.files ?? [], req.user));
  }),
);

router.get('/', validate({ query: ticketListQuery }), async (req, res) => {
  res.json(await tickets.listTickets(req.user, req.valid.query));
});

router.get('/:id', async (req, res) => {
  res.json(await tickets.getTicketDetail(ticketId(req), req.user));
});

router.patch('/:id/assign', staffOnly, validate({ body: assignSchema }), async (req, res) => {
  res.json(await tickets.assignTicket(ticketId(req), req.valid.body.assigneeId, req.user));
});

router.patch('/:id/priority', staffOnly, validate({ body: prioritySchema }), async (req, res) => {
  res.json(await tickets.setPriority(ticketId(req), req.valid.body.priority, req.user));
});

// Staff and submitters both use this; the workflow service decides who may make which change.
router.patch('/:id/status', validate({ body: statusSchema }), async (req, res) => {
  const { status, resolutionNotes } = req.valid.body;
  res.json(await tickets.transitionTicket(ticketId(req), status, req.user, { resolutionNotes }));
});

router.post('/:id/comments', validate({ body: commentSchema }), async (req, res) => {
  res.status(201).json(await tickets.addComment(ticketId(req), req.valid.body, req.user));
});

router.post(
  '/:id/attachments',
  uploadAttachments,
  withUploadCleanup(async (req, res) => {
    if (!req.files?.length) throw new HttpError(400, 'Choose at least one file to upload');
    res.status(201).json(await tickets.addAttachments(ticketId(req), req.files, req.user));
  }),
);

router.get('/:id/attachments/:attachmentId', validate({ params: attachmentParams }), async (req, res) => {
  const attachment = await tickets.getAttachmentForDownload(ticketId(req), req.valid.params.attachmentId, req.user);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(attachment.path, attachment.originalName, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found on the server' });
  });
});

router.post('/:id/knowledge-article', staffOnly, validate({ body: articleSchema }), async (req, res) => {
  res.status(201).json(await createArticle(req.valid.body, req.user, ticketId(req)));
});

export default router;
