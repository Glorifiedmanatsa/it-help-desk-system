import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { STAFF_ROLES, userPublicSelect, userSummarySelect } from '../utils/constants.js';
import { roleSchema, userIdParams, userListQuery, userUpdateSchema } from '../schemas.js';

const router = Router();
router.use(requireAuth);

// Assignable people, for the assign dropdown on tickets.
router.get('/staff', requireRoles(...STAFF_ROLES), async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES }, isActive: true },
    select: userSummarySelect,
    orderBy: { name: 'asc' },
  });
  res.json({ items: staff });
});

router.use(requireRoles('ADMIN'));

router.get('/', validate({ query: userListQuery }), async (req, res) => {
  const { q, role, active } = req.valid.query;
  const where = {};
  if (role) where.role = role;
  if (active) where.isActive = active === 'true';
  if (q) {
    where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
  }
  const users = await prisma.user.findMany({ where, select: userPublicSelect, orderBy: [{ role: 'desc' }, { name: 'asc' }] });
  res.json({ items: users });
});

async function updateUser(req, res, data) {
  const { id } = req.valid.params;
  // Prevents an admin from locking themselves (and possibly everyone) out.
  if (id === req.user.id && (data.isActive === false || (data.role && data.role !== 'ADMIN'))) {
    throw new HttpError(400, 'You cannot deactivate yourself or remove your own admin role');
  }
  const user = await prisma.user.update({ where: { id }, data, select: userPublicSelect });
  res.json({ user });
}

router.patch('/:id', validate({ params: userIdParams, body: userUpdateSchema }), (req, res) =>
  updateUser(req, res, req.valid.body),
);
router.patch('/:id/role', validate({ params: userIdParams, body: roleSchema }), (req, res) =>
  updateUser(req, res, { role: req.valid.body.role }),
);
router.patch('/:id/deactivate', validate({ params: userIdParams }), (req, res) => updateUser(req, res, { isActive: false }));
router.patch('/:id/activate', validate({ params: userIdParams }), (req, res) => updateUser(req, res, { isActive: true }));

export default router;
