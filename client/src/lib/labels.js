export const STAFF_ROLES = ['IT_STAFF', 'ADMIN'];
export const isStaff = (user) => STAFF_ROLES.includes(user?.role);

export const STATUS_LABELS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
export const PRIORITY_LABELS = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
export const CATEGORY_LABELS = {
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  NETWORK: 'Network',
  ACCOUNT_ACCESS: 'Account & access',
  EMAIL: 'Email',
  PRINTER: 'Printer',
  OTHER: 'Other',
};
export const ROLE_LABELS = { EMPLOYEE: 'Employee', IT_STAFF: 'IT staff', ADMIN: 'Admin' };

export const PRIORITY_HINTS = {
  CRITICAL: 'Nobody can work / business stopped',
  HIGH: 'I can’t do my job',
  MEDIUM: 'Work is slowed down',
  LOW: 'Minor issue or request',
};
export const SLA_LABELS = { CRITICAL: '1 hour', HIGH: '4 hours', MEDIUM: '1 day', LOW: '3 days' };

export const ACTIVE_STATUSES = 'OPEN,ASSIGNED,IN_PROGRESS,WAITING_ON_USER,RESOLVED';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatDate = (value) => (value ? dateOnly.format(new Date(value)) : '—');

export function formatMinutes(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  const days = Math.floor(m / (24 * 60));
  return `${days}d ${Math.floor((m % (24 * 60)) / 60)}h`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const toIsoDate = (date) => date.toISOString().slice(0, 10);
