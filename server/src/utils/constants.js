// Mirrors the enums in prisma/schema.prisma. Kept as plain arrays so validation
// and pure logic (and their tests) don't need a generated Prisma client.
export const ROLES = ['EMPLOYEE', 'IT_STAFF', 'ADMIN'];
export const STAFF_ROLES = ['IT_STAFF', 'ADMIN'];
export const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const CATEGORIES = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'EMAIL', 'PRINTER', 'OTHER'];

// Target time to first response, in minutes.
export const SLA_TARGET_MINUTES = {
  CRITICAL: 60,
  HIGH: 4 * 60,
  MEDIUM: 24 * 60,
  LOW: 3 * 24 * 60,
};

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);

// Public fields for embedding a user in another resource.
export const userSummarySelect = { id: true, name: true, email: true, role: true };
export const userPublicSelect = { ...userSummarySelect, isActive: true, createdAt: true };
