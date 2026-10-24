import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../utils/constants.js';
import * as kb from '../services/knowledgeService.js';
import { articleIdParams, articleListQuery, articleSchema, articleUpdateSchema } from '../schemas.js';

const router = Router();
// FR26: the knowledge base is never available to employees.
router.use(requireAuth, requireRoles(...STAFF_ROLES));

router.get('/', validate({ query: articleListQuery }), async (req, res) => {
  res.json(await kb.searchArticles(req.valid.query, req.user));
});

router.post('/', validate({ body: articleSchema }), async (req, res) => {
  res.status(201).json(await kb.createArticle(req.valid.body, req.user));
});

router.get('/:id', validate({ params: articleIdParams }), async (req, res) => {
  res.json(await kb.getArticle(req.valid.params.id, req.user));
});

router.patch('/:id', validate({ params: articleIdParams, body: articleUpdateSchema }), async (req, res) => {
  res.json(await kb.updateArticle(req.valid.params.id, req.valid.body, req.user));
});

router.delete('/:id', requireRoles('ADMIN'), validate({ params: articleIdParams }), async (req, res) => {
  await kb.deleteArticle(req.valid.params.id);
  res.status(204).end();
});

export default router;
