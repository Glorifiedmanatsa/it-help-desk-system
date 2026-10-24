import { useEffect, useState } from 'react';
import { api, download } from '../api.js';
import { ErrorBox, PageHeader } from '../components/ui.jsx';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatMinutes, toIsoDate } from '../lib/labels.js';

const daysAgo = (n) => toIsoDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null },
];
const presetRange = (days) => (days ? { from: daysAgo(days - 1), to: daysAgo(0) } : { from: '', to: '' });

function StatTile({ label, value, note, tone }) {
  return (
    <div className={`stat-tile ${tone ? `stat-${tone}` : ''}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {note && <p className="stat-note">{note}</p>}
    </div>
  );
}

// Single-series magnitude comparison: one hue, values as text so it doubles as a table.
function BarList({ title, rows, labels }) {
  const max = Math.max(1, ...rows.map((r) => r.tickets));
  const total = rows.reduce((sum, r) => sum + r.tickets, 0);
  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="bar-list">
        {rows.map((row) => {
          const share = total ? Math.round((row.tickets / total) * 100) : 0;
          const label = labels[row.key] ?? row.key;
          return (
            <li key={row.key} className="bar-row" title={`${label}: ${row.tickets} tickets (${share}%)`}>
              <span className="bar-label">{label}</span>
              <span className="bar-track" aria-hidden="true">
                {row.tickets > 0 && <span className="bar-fill" style={{ width: `${(row.tickets / max) * 100}%` }} />}
              </span>
              <span className="bar-value">{row.tickets}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MetricsTable({ title, rows, labelHeader, renderLabel, extraColumn }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="table-scroll">
        <table className="table table-compact numeric">
          <thead>
            <tr>
              <th>{labelHeader}</th>
              {extraColumn && <th>{extraColumn.header}</th>}
              <th>Tickets</th>
              <th>Avg first response</th>
              <th>Avg resolution</th>
              <th>SLA breaches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td data-label={labelHeader}>{renderLabel(row)}</td>
                {extraColumn && <td data-label={extraColumn.header}>{extraColumn.render(row)}</td>}
                <td data-label="Tickets">{row.tickets}</td>
                <td data-label="Avg first response">{formatMinutes(row.avgFirstResponseMinutes)}</td>
                <td data-label="Avg resolution">{formatMinutes(row.avgResolutionMinutes)}</td>
                <td data-label="SLA breaches">
                  {row.slaBreaches > 0 ? (
                    <span className="breach-count">
                      <span aria-hidden="true">⚠ </span>
                      {row.slaBreaches}
                    </span>
                  ) : (
                    row.slaBreaches
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Reports() {
  const [range, setRange] = useState(presetRange(30));
  const [applied, setApplied] = useState(range);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [includeTickets, setIncludeTickets] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setError(null);
    api('/reports/summary', { query: applied }).then(setSummary).catch(setError);
  }, [applied]);

  const applyPreset = (days) => {
    const next = presetRange(days);
    setRange(next);
    setApplied(next);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await download('/reports/export.csv', { ...applied, includeTickets }, 'helpdesk-report.csv');
    } catch (err) {
      setError(err);
    } finally {
      setExporting(false);
    }
  };

  const overall = summary?.overall;
  const breachRate = overall?.tickets ? Math.round((overall.slaBreaches / overall.tickets) * 100) : 0;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Response times, resolution times and SLA performance for tickets created in the selected range." />

      <div className="filters card">
        <div className="preset-row" role="group" aria-label="Date range presets">
          {PRESETS.map((p) => {
            const active = JSON.stringify(presetRange(p.days)) === JSON.stringify(applied);
            return (
              <button key={p.label} className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={() => applyPreset(p.days)}>
                {p.label}
              </button>
            );
          })}
        </div>
        <form className="range-form" onSubmit={(e) => {
          e.preventDefault();
          setApplied(range);
        }}>
          <label className="filter">
            <span>From</span>
            <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </label>
          <label className="filter">
            <span>To</span>
            <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </label>
          <button className="btn btn-secondary">Apply</button>
        </form>
        <div className="export-box">
          <label className="checkbox">
            <input type="checkbox" checked={includeTickets} onChange={(e) => setIncludeTickets(e.target.checked)} />
            Include ticket rows
          </label>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <ErrorBox error={error} />
      {!summary && !error && <p className="muted">Loading report…</p>}

      {summary && (
        <>
          <div className="stat-row">
            <StatTile label="Tickets created" value={overall.tickets} />
            <StatTile label="Avg first response" value={formatMinutes(overall.avgFirstResponseMinutes)} note="Created → first IT response" />
            <StatTile label="Avg resolution" value={formatMinutes(overall.avgResolutionMinutes)} note="Created → resolved" />
            <StatTile
              label="SLA breaches"
              value={overall.slaBreaches}
              note={overall.tickets ? `${breachRate}% of tickets missed the first-response target` : 'No tickets in range'}
              tone={overall.slaBreaches > 0 ? 'critical' : undefined}
            />
          </div>

          <MetricsTable
            title="By priority"
            labelHeader="Priority"
            rows={summary.byPriority}
            renderLabel={(row) => PRIORITY_LABELS[row.key]}
            extraColumn={{ header: 'Response target', render: (row) => formatMinutes(summary.slaTargetsMinutes[row.key]) }}
          />

          <div className="two-col">
            <BarList title="By status" rows={summary.byStatus} labels={STATUS_LABELS} />
            <BarList title="By category" rows={summary.byCategory} labels={CATEGORY_LABELS} />
          </div>

          <MetricsTable
            title="By assignee"
            labelHeader="Assignee"
            rows={summary.byAssignee}
            renderLabel={(row) => (row.userId ? row.key : <span className="muted">Unassigned</span>)}
          />
          <p className="muted small">
            Priority uses the confirmed priority, or the employee’s suggested urgency if IT hasn’t confirmed one. Tickets without a
            response yet count as breached once their target time has passed.
          </p>
        </>
      )}
    </div>
  );
}
