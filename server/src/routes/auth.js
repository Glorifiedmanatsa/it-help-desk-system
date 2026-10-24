import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { userPublicSelect } from '../utils/constants.js';
import { loginSchema, registerSchema } from '../schemas.js';

export const BCRYPT_ROUNDS = 12;

// A precomputed hash so login takes the same time whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const router = Router();

// Self-registration always creates an EMPLOYEE; admins promote users afterwards.
router.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const { name, email, password } = req.valid.body;
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), role: 'EMPLOYEE' },
    select: userPublicSelect,
  });
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw new HttpError(401, 'Invalid email or password');
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated. Contact an administrator.');

  const { passwordHash, ...publicUser } = user;
  res.json({ token: signToken(user), user: publicUser });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
