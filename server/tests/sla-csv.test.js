import { describe, expect, it } from 'vitest';
import { formatTicketCode, parseTicketId, slaInfo } from '../src/utils/tickets.js';
import { csvCell, toCsv } from '../src/utils/csv.js';

const created = new Date('2026-10-21T09:00:00Z');
const minutesLater = (m) => new Date(created.getTime() + m * 60000);

describe('SLA', () => {
  it('uses the confirmed priority, falling back to suggested urgency', () => {
    expect(slaInfo({ createdAt: created, priority: null, suggestedUrgency: 'HIGH' }, created).targetMinutes).toBe(240);
    expect(slaInfo({ createdAt: created, priority: 'CRITICAL', suggestedUrgency: 'LOW' }, created).targetMinutes).toBe(60);
  });

  it('flags a breach when there is no response past the target', () => {
    const ticket = { createdAt: created, priority: 'CRITICAL', suggestedUrgency: 'CRITICAL', firstResponseAt: null };
    expect(slaInfo(ticket, minutesLater(59)).breached).toBe(false);
    expect(slaInfo(ticket, minutesLater(61)).breached).toBe(true);
  });

  it('measures against the first response once there is one', () => {
    const ticket = { createdAt: created, priority: 'HIGH', suggestedUrgency: 'HIGH', firstResponseAt: minutesLater(30) };
    expect(slaInfo(ticket, minutesLater(10000)).breached).toBe(false);
  });
});

describe('ticket codes', () => {
  it('formats and parses HD codes', () => {
    expect(formatTicketCode(7)).toBe('HD-0007');
    expect(formatTicketCode(12345)).toBe('HD-12345');
    expect(parseTicketId('HD-0007')).toBe(7);
    expect(parseTicketId('7')).toBe(7);
    expect(() => parseTicketId('7; DROP TABLE tickets')).toThrow();
  });
});

describe('CSV', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'line\nbreak']])).toBe('"a,b","say ""hi""","line\nbreak"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
});
