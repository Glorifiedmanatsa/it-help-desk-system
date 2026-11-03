// Demo data: run with `npm run db:seed` (safe to re-run; sample tickets are only added once).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

const USERS = [
  { key: 'admin', name: 'Ada Admin', email: 'admin@helpdesk.test', role: 'ADMIN' },
  { key: 'staff', name: 'Sam Support', email: 'staff@helpdesk.test', role: 'IT_STAFF' },
  { key: 'staff2', name: 'Taylor Tech', email: 'staff2@helpdesk.test', role: 'IT_STAFF' },
  { key: 'employee', name: 'Emma Employee', email: 'employee@helpdesk.test', role: 'EMPLOYEE' },
  { key: 'employee2', name: 'Noah Newhire', email: 'employee2@helpdesk.test', role: 'EMPLOYEE' },
];

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = {};
  for (const { key, ...user } of USERS) {
    users[key] = await prisma.user.upsert({ where: { email: user.email }, update: {}, create: { ...user, passwordHash } });
  }
  return users;
}

async function createTicket({ history = [], comments = [], ...data }) {
  const ticket = await prisma.ticket.create({ data });
  await prisma.ticketHistory.create({
    data: { ticketId: ticket.id, changedById: data.submittedById, fieldChanged: 'created', newValue: 'OPEN', changedAt: data.createdAt },
  });
  for (const entry of history) {
    await prisma.ticketHistory.create({ data: { ticketId: ticket.id, ...entry } });
  }
  for (const comment of comments) {
    await prisma.ticketComment.create({ data: { ticketId: ticket.id, ...comment } });
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: comment.authorId,
        fieldChanged: comment.isInternal ? 'internal_note' : 'comment',
        changedAt: comment.createdAt,
      },
    });
  }
  return ticket;
}

async function seedTickets({ admin, staff, staff2, employee, employee2 }) {
  if ((await prisma.ticket.count()) > 0) {
    console.log('Tickets already exist — skipping sample tickets.');
    return;
  }

  await createTicket({
    title: 'Laptop will not turn on',
    description: 'My laptop does not power on even when plugged in. The charging light blinks orange.',
    category: 'HARDWARE',
    suggestedUrgency: 'HIGH',
    submittedById: employee.id,
    createdAt: hoursAgo(2),
  });

  await createTicket({
    title: 'Cannot connect to office VPN',
    description: 'VPN client shows "authentication failed" since this morning. I need it to reach the finance share.',
    category: 'NETWORK',
    suggestedUrgency: 'CRITICAL',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    submittedById: employee2.id,
    assignedToId: staff.id,
    createdAt: hoursAgo(5),
    firstResponseAt: hoursAgo(4.5),
    history: [
      { changedById: staff.id, fieldChanged: 'assigned_to', newValue: staff.name, changedAt: hoursAgo(4.5) },
      { changedById: staff.id, fieldChanged: 'status', oldValue: 'OPEN', newValue: 'ASSIGNED', changedAt: hoursAgo(4.5) },
      { changedById: staff.id, fieldChanged: 'priority', newValue: 'CRITICAL', changedAt: hoursAgo(4.4) },
      { changedById: staff.id, fieldChanged: 'status', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS', changedAt: hoursAgo(4.3) },
    ],
    comments: [
      { authorId: staff.id, body: 'Looking into this now — can you confirm you changed your password recently?', isInternal: false, createdAt: hoursAgo(4.3) },
      { authorId: staff.id, body: 'Account looks locked in AD after 5 failed attempts.', isInternal: true, createdAt: hoursAgo(4.2) },
    ],
  });

  await createTicket({
    title: 'Outlook keeps asking for password',
    description: 'Outlook prompts for my password every few minutes, even after I enter it correctly.',
    category: 'EMAIL',
    suggestedUrgency: 'MEDIUM',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    submittedById: employee.id,
    assignedToId: staff2.id,
    createdAt: hoursAgo(50),
    firstResponseAt: hoursAgo(46),
    resolvedAt: hoursAgo(30),
    resolutionNotes: 'Cleared cached credentials in Windows Credential Manager and re-added the account. Prompts stopped.',
    history: [
      { changedById: staff2.id, fieldChanged: 'assigned_to', newValue: staff2.name, changedAt: hoursAgo(46) },
      { changedById: staff2.id, fieldChanged: 'status', oldValue: 'OPEN', newValue: 'ASSIGNED', changedAt: hoursAgo(46) },
      { changedById: staff2.id, fieldChanged: 'status', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS', changedAt: hoursAgo(45) },
      { changedById: staff2.id, fieldChanged: 'status', oldValue: 'IN_PROGRESS', newValue: 'RESOLVED', changedAt: hoursAgo(30) },
    ],
  });

  const printer = await createTicket({
    title: 'Printer on 3rd floor jams constantly',
    description: 'The shared HP printer near the kitchen jams on almost every print job.',
    category: 'PRINTER',
    suggestedUrgency: 'LOW',
    priority: 'LOW',
    status: 'CLOSED',
    submittedById: employee2.id,
    assignedToId: staff.id,
    createdAt: hoursAgo(24 * 9),
    firstResponseAt: hoursAgo(24 * 5),
    resolvedAt: hoursAgo(24 * 4),
    closedAt: hoursAgo(24 * 3),
    resolutionNotes: 'Replaced worn pickup rollers in tray 2 and cleaned the paper path.',
  });

  await createTicket({
    title: 'Need access to the HR shared drive',
    description: 'I joined the HR team this week and need read/write access to \\\\files\\hr.',
    category: 'ACCOUNT_ACCESS',
    suggestedUrgency: 'MEDIUM',
    status: 'WAITING_ON_USER',
    priority: 'MEDIUM',
    submittedById: employee2.id,
    assignedToId: staff2.id,
    createdAt: hoursAgo(30),
    firstResponseAt: hoursAgo(29),
    comments: [
      { authorId: staff2.id, body: 'Could you ask your manager to approve the request in the access portal?', isInternal: false, createdAt: hoursAgo(28) },
    ],
  });

  await prisma.knowledgeArticle.create({
    data: {
      title: 'Fixing constant paper jams on HP office printers',
      problem: 'Shared HP LaserJet printers jam on most jobs, usually from tray 2.',
      solution: '1. Open tray 2 and the rear access door.\n2. Replace the pickup and separation rollers.\n3. Clean the paper path with a lint-free cloth.\n4. Print a test page.',
      category: 'PRINTER',
      tags: ['printer', 'hp', 'paper-jam'],
      ticketId: printer.id,
      createdById: staff.id,
    },
  });

  console.log(`Created sample tickets and a knowledge base article (admin: ${admin.email}).`);
}

async function main() {
  const users = await seedUsers();
  await seedTickets(users);
  console.log('\nDemo accounts (password for all: %s)', DEMO_PASSWORD);
  for (const user of USERS) console.log(`  ${user.role.padEnd(9)} ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
