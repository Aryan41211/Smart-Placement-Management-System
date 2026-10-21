/**
 * Page title block with an optional action area.
 *
 * @param {object} props component props
 */
export default function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumbs && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{breadcrumbs}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
