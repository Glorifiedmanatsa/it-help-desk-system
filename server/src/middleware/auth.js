import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { HttpError } from '../utils/httpError.js';
import { userPublicSelect } from '../utils/constants.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Verifies the bearer token and reloads the user, so deactivation and role
// changes take effect immediately rather than when the token expires.
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) }, select: userPublicSelect });
  if (!user || !user.isActive) throw new HttpError(401, 'This account is inactive or no longer exists');

  req.user = user;
  next();
}

export const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do this');
    next();
  };
