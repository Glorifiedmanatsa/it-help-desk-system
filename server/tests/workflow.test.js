import { describe, expect, it } from 'vitest';
import { allowedTransitions, checkTransition, planTransition } from '../src/services/workflow.js';

const staff = { id: 2, role: 'IT_STAFF' };
const admin = { id: 1, role: 'ADMIN' };
const submitter = { id: 10, role: 'EMPLOYEE' };
const otherEmployee = { id: 11, role: 'EMPLOYEE' };
const now = new Date('2026-10-21T12:00:00Z');
const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

const ticket = (status, extra = {}) => ({
  id: 1,
  status,
  submittedById: submitter.id,
  assignedToId: status === 'OPEN' ? null : staff.id,
  firstResponseAt: null,
  resolvedAt: null,
  resolutionNotes: null,
  ...extra,
});

describe('status transitions', () => {
  it.each([
    ['OPEN', 'ASSIGNED'],
    ['ASSIGNED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'WAITING_ON_USER'],
    ['IN_PROGRESS', 'RESOLVED'],
    ['WAITING_ON_USER', 'IN_PROGRESS'],
    ['WAITING_ON_USER', 'RESOLVED'],
  ])('staff can move %s → %s', (from, to) => {
    expect(checkTransition(ticket(from), to, staff, now)).toBeNull();
  });

  it.each([
    ['OPEN', 'IN_PROGRESS'],
    ['OPEN', 'RESOLVED'],
    ['ASSIGNED', 'RESOLVED'],
    ['ASSIGNED', 'WAITING_ON_USER'],
    ['IN_PROGRESS', 'CLOSED'],
    ['WAITING_ON_USER', 'CLOSED'],
    ['CLOSED', 'IN_PROGRESS'],
    ['CLOSED', 'OPEN'],
  ])('rejects %s → %s', (from, to) => {
    expect(checkTransition(ticket(from), to, admin, now)).toMatchObject({ status: 409 });
  });

  it('does not let employees make staff transitions, even on their own ticket', () => {
    expect(checkTransition(ticket('ASSIGNED'), 'IN_PROGRESS', submitter, now)).toMatchObject({ status: 403 });
  });

  it('only the submitter can close a resolved ticket', () => {
    const resolved = ticket('RESOLVED', { resolvedAt: daysAgo(1) });
    expect(checkTransition(resolved, 'CLOSED', submitter, now)).toBeNull();
    expect(checkTransition(resolved, 'CLOSED', otherEmployee, now)).toMatchObject({ status: 403 });
    expect(checkTransition(resolved, 'CLOSED', staff, now)).toMatchObject({ status: 403 });
    expect(checkTransition(resolved, 'CLOSED', admin, now)).toMatchObject({ status: 403 });
  });

  it('allows the submitter to reopen within 7 days of resolution', () => {
    expect(checkTransition(ticket('RESOLVED', { resolvedAt: daysAgo(6.9) }), 'IN_PROGRESS', submitter, now)).toBeNull();
  });

  it('blocks reopening after 7 days', () => {
    expect(checkTransition(ticket('RESOLVED', { resolvedAt: daysAgo(7.1) }), 'IN_PROGRESS', submitter, now)).toMatchObject({
      status: 409,
    });
  });

  it('staff cannot reopen a resolved ticket', () => {
    expect(checkTransition(ticket('RESOLVED', { resolvedAt: daysAgo(1) }), 'IN_PROGRESS', staff, now)).toMatchObject({
      status: 403,
    });
  });
});

describe('planTransition', () => {
  it('requires non-empty resolution notes to resolve', () => {
    expect(() => planTransition(ticket('IN_PROGRESS'), 'RESOLVED', staff, { now })).toThrow(/Resolution notes/);
    expect(() => planTransition(ticket('IN_PROGRESS'), 'RESOLVED', staff, { resolutionNotes: '   ', now })).toThrow(
      /Resolution notes/,
    );
  });

  it('records resolved_at, notes and history when resolving', () => {
    const { data, history } = planTransition(ticket('IN_PROGRESS'), 'RESOLVED', staff, {
      resolutionNotes: ' Replaced the cable ',
      now,
    });
    expect(data).toMatchObject({ status: 'RESOLVED', resolvedAt: now, resolutionNotes: 'Replaced the cable' });
    expect(history).toEqual([
      { field: 'status', old: 'IN_PROGRESS', new: 'RESOLVED' },
      { field: 'resolution_notes', old: null, new: 'Replaced the cable' },
    ]);
  });

  it('clears resolved_at on reopen and sets closed_at on close', () => {
    const resolved = ticket('RESOLVED', { resolvedAt: daysAgo(1), firstResponseAt: daysAgo(2) });
    expect(planTransition(resolved, 'IN_PROGRESS', submitter, { now }).data).toEqual({ status: 'IN_PROGRESS', resolvedAt: null });
    expect(planTransition(resolved, 'CLOSED', submitter, { now }).data).toEqual({ status: 'CLOSED', closedAt: now });
  });

  it('sets first_response_at on the first staff action only', () => {
    expect(planTransition(ticket('ASSIGNED'), 'IN_PROGRESS', staff, { now }).data.firstResponseAt).toEqual(now);
    const responded = ticket('ASSIGNED', { firstResponseAt: daysAgo(1) });
    expect(planTransition(responded, 'IN_PROGRESS', staff, { now }).data).not.toHaveProperty('firstResponseAt');
  });
});

describe('allowedTransitions', () => {
  it('lists the moves available to each user', () => {
    expect(allowedTransitions(ticket('IN_PROGRESS'), staff, now)).toEqual(['WAITING_ON_USER', 'RESOLVED']);
    expect(allowedTransitions(ticket('IN_PROGRESS'), submitter, now)).toEqual([]);
    expect(allowedTransitions(ticket('RESOLVED', { resolvedAt: daysAgo(1) }), submitter, now)).toEqual(['CLOSED', 'IN_PROGRESS']);
    expect(allowedTransitions(ticket('OPEN'), staff, now)).toEqual([]);
  });
});
