import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { CATEGORIES, PRIORITIES, SLA_TARGET_MINUTES, STATUSES, userSummarySelect } from '../utils/constants.js';
import { formatTicketCode, slaInfo } from '../utils/tickets.js';
import { toCsv } from '../utils/csv.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates are YYYY-MM-DD in UTC; `to` is inclusive.
export function dateRange({ from, to }) {
  return {
    start: from ? new Date(`${from}T00:00:00.000Z`) : new Date(0),
    end: to ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS) : new Date('9999-12-31T00:00:00.000Z'),
  };
}

// Same rule as slaInfo(): time to first response (or now, if none yet) vs. the priority's target.
const slaTargetSql = Prisma.raw(
  `CASE COALESCE(t.priority, t.suggested_urgency) ${Object.entries(SLA_TARGET_MINUTES)
    .map(([priority, minutes]) => `WHEN '${priority}' THEN ${minutes}`)
    .join(' ')} END`,
);

const metricsSql = Prisma.sql`
  COUNT(*)::int AS tickets,
  (AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at))) / 60)::float8 AS "avgFirstResponseMinutes",
  (AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))) / 60)::float8 AS "avgResolutionMinutes",
  (COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (COALESCE(t.first_response_at, NOW()) - t.created_at)) / 60 > ${slaTargetSql}))::int AS "slaBreaches"`;

const round = (value) => (value === null || value === undefined ? null : Math.round(value * 10) / 10);
const cleanMetrics = ({ tickets, avgFirstResponseMinutes, avgResolutionMinutes, slaBreaches }) => ({
  tickets,
  avgFirstResponseMinutes: round(avgFirstResponseMinutes),
  avgResolutionMinutes: round(avgResolutionMinutes),
  slaBreaches,
});
const emptyMetrics = { tickets: 0, avgFirstResponseMinutes: null, avgResolutionMinutes: null, slaBreaches: 0 };

// Every enum value appears in the output, even with zero tickets.
const fillGroups = (keys, rows, empty) => {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return keys.map((key) => ({ key, ...(byKey.has(key) ? byKey.get(key) : empty) }));
};

export async function getSummary(range) {
  const { start, end } = dateRange(range);
  const where = Prisma.sql`WHERE t.created_at >= ${start} AND t.created_at < ${end}`;

  const [[overall], byPriority, byStatus, byCategory, byAssignee] = await Promise.all([
    prisma.$queryRaw`SELECT ${metricsSql} FROM tickets t ${where}`,
    prisma.$queryRaw`SELECT COALESCE(t.priority, t.suggested_urgency)::text AS key, ${metricsSql}
      FROM tickets t ${where} GROUP BY 1`,
    prisma.$queryRaw`SELECT t.status::text AS key, COUNT(*)::int AS tickets FROM tickets t ${where} GROUP BY 1`,
    prisma.$queryRaw`SELECT t.category::text AS key, COUNT(*)::int AS tickets FROM tickets t ${where} GROUP BY 1`,
    prisma.$queryRaw`SELECT u.id AS "userId", COALESCE(u.name, 'Unassigned') AS key, ${metricsSql}
      FROM tickets t LEFT JOIN users u ON u.id = t.assigned_to ${where}
      GROUP BY u.id, u.name ORDER BY tickets DESC, key ASC`,
  ]);

  return {
    range: { from: range.from ?? null, to: range.to ?? null },
    slaTargetsMinutes: SLA_TARGET_MINUTES,
    overall: cleanMetrics(overall),
    byPriority: fillGroups(
      [...PRIORITIES].reverse(),
      byPriority.map((row) => ({ key: row.key, ...cleanMetrics(row) })),
      emptyMetrics,
    ),
    byStatus: fillGroups(STATUSES, byStatus, { tickets: 0 }),
    byCategory: fillGroups(CATEGORIES, byCategory, { tickets: 0 }),
    byAssignee: byAssignee.map((row) => ({ userId: row.userId, key: row.key, ...cleanMetrics(row) })),
  };
}

const METRIC_HEADER = ['Section', 'Group', 'Tickets', 'Avg first response (min)', 'Avg resolution (min)', 'SLA breaches'];
const metricRow = (section, row) => [
  section,
  row.key,
  row.tickets,
  row.avgFirstResponseMinutes,
  row.avgResolutionMinutes,
  row.slaBreaches,
];

export async function buildCsv(range, { includeTickets }) {
  const summary = await getSummary(range);
  const rows = [
    ['IT Help Desk report', `From ${range.from ?? 'start'}`, `To ${range.to ?? 'today'}`],
    [],
    METRIC_HEADER,
    metricRow('Overall', { key: 'All tickets', ...summary.overall }),
    ...summary.byPriority.map((row) => metricRow('By priority', row)),
    ...summary.byAssignee.map((row) => metricRow('By assignee', row)),
    ...summary.byStatus.map((row) => ['By status', row.key, row.tickets]),
    ...summary.byCategory.map((row) => ['By category', row.key, row.tickets]),
  ];

  if (includeTickets) {
    const { start, end } = dateRange(range);
    const tickets = await prisma.ticket.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { id: 'asc' },
      include: { submittedBy: { select: userSummarySelect }, assignedTo: { select: userSummarySelect } },
    });
    const now = new Date();
    rows.push(
      [],
      ['Ticket', 'Title', 'Status', 'Priority', 'Suggested urgency', 'Category', 'Submitted by', 'Assigned to',
        'Created', 'First response', 'Resolved', 'Closed', 'SLA breached'],
      ...tickets.map((t) => [
        formatTicketCode(t.id),
        t.title,
        t.status,
        t.priority ?? '',
        t.suggestedUrgency,
        t.category,
        t.submittedBy.name,
        t.assignedTo?.name ?? '',
        t.createdAt,
        t.firstResponseAt,
        t.resolvedAt,
        t.closedAt,
        slaInfo(t, now).breached ? 'Yes' : 'No',
      ]),
    );
  }

  return toCsv(rows);
}
