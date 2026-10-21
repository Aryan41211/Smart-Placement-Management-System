import { Inbox } from 'lucide-react';

/**
 * Placeholder shown when a list has no rows.
 *
 * @param {object} props component props
 */
export default function EmptyState({ title = 'Nothing to show yet', description, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}
