import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { buildCsv, getSummary } from '../services/reportService.js';
import { reportQuery } from '../schemas.js';

const router = Router();
router.use(requireAuth, requireRoles('ADMIN'));

router.get('/summary', validate({ query: reportQuery }), async (req, res) => {
  res.json(await getSummary(req.valid.query));
});

router.get('/export.csv', validate({ query: reportQuery }), async (req, res) => {
  const { from, to, includeTickets } = req.valid.query;
  const csv = await buildCsv({ from, to }, { includeTickets });
  const filename = `helpdesk-report-${from ?? 'all'}-to-${to ?? 'today'}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 names correctly.
  res.send(`﻿${csv}`);
});

export default router;
