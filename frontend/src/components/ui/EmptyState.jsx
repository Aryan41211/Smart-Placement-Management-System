import { Inbox } from 'lucide-react';

/**
 * Placeholder shown when a list has no rows.
 *
 * @param {object} props component props
 */
export default function EmptyState({
  title = 'Nothing to show yet',
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${
        compact ? 'px-6 py-8' : 'px-6 py-14'
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-400 ring-1 ring-inset ring-navy-100">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-1 text-sm font-semibold text-navy-800">{title}</h3>
      {description && (
        <p className="max-w-sm text-[0.8125rem] leading-relaxed text-navy-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
