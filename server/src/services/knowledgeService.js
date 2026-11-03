import { prisma } from '../prisma.js';
import { HttpError } from '../utils/httpError.js';
import { userSummarySelect } from '../utils/constants.js';
import { formatTicketCode } from '../utils/tickets.js';

const articleInclude = {
  createdBy: { select: userSummarySelect },
  ticket: { select: { id: true, title: true } },
};

export const canEditArticle = (article, user) => user.role === 'ADMIN' || article.createdById === user.id;

const serializeArticle = (article, user) => ({
  ...article,
  ticket: article.ticket ? { ...article.ticket, code: formatTicketCode(article.ticket.id) } : null,
  canEdit: canEditArticle(article, user),
  canDelete: user.role === 'ADMIN',
});

async function findArticleOr404(id) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, include: articleInclude });
  if (!article) throw new HttpError(404, 'Article not found');
  return article;
}

export async function searchArticles(query, user) {
  const where = {};
  if (query.category) where.category = query.category;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { problem: { contains: query.q, mode: 'insensitive' } },
      { solution: { contains: query.q, mode: 'insensitive' } },
      { tags: { has: query.q.toLowerCase() } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      include: articleInclude,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return { items: items.map((a) => serializeArticle(a, user)), total, page: query.page, pageSize: query.pageSize };
}

export async function getArticle(id, user) {
  return serializeArticle(await findArticleOr404(id), user);
}

export async function createArticle(data, user, ticketId = null) {
  if (ticketId !== null) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { knowledgeArticle: { select: { id: true } } } });
    if (!ticket) throw new HttpError(404, 'Ticket not found');
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new HttpError(409, 'Only resolved or closed tickets can be saved to the knowledge base');
    }
    if (ticket.knowledgeArticle) throw new HttpError(409, 'This ticket already has a knowledge base article');
  }

  const article = await prisma.knowledgeArticle.create({
    data: { ...data, ticketId, createdById: user.id },
    include: articleInclude,
  });
  return serializeArticle(article, user);
}

export async function updateArticle(id, data, user) {
  const article = await findArticleOr404(id);
  if (!canEditArticle(article, user)) throw new HttpError(403, 'You can only edit articles you created');
  const updated = await prisma.knowledgeArticle.update({ where: { id }, data, include: articleInclude });
  return serializeArticle(updated, user);
}

export async function deleteArticle(id) {
  await findArticleOr404(id);
  await prisma.knowledgeArticle.delete({ where: { id } });
}
