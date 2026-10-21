import Badge from '../ui/Badge.jsx';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime, humanise } from '../../utils/format.js';

/**
 * Vertical timeline of application status history entries.
 *
 * @param {object} props component props
 * @param {Array} props.entries rows from `/applications/:id/history/`
 */
export default function StatusTimeline({ entries = [] }) {
  if (!entries.length) {
    return <p className="mt-2 text-sm text-navy-500">No history entries recorded yet.</p>;
  }

  return (
    <ol className="mt-3 space-y-3 border-l border-navy-200 pl-5">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{humanise(entry.from_status) || 'Created'}</Badge>
            <span className="text-navy-400">-&gt;</span>
            <StatusBadge status={entry.to_status} />
          </div>
          <p className="mt-1 text-xs text-navy-500">
            {formatDateTime(entry.changed_at)} &middot; {entry.changed_by_name}
            {entry.changed_by_role ? ` (${entry.changed_by_role})` : ''}
          </p>
          {entry.reason && <p className="mt-0.5 text-sm text-navy-600">{entry.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
