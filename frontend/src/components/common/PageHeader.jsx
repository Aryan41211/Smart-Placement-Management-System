import { ChevronRight } from 'lucide-react';

/**
 * Page title block with an optional action area.
 *
 * @param {object} props component props
 */
export default function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  icon: Icon,
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-xs text-navy-400">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                <span className={index === breadcrumbs.length - 1 ? 'font-medium text-navy-600' : ''}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="text-[1.375rem] font-semibold leading-tight text-navy-900">{title}</h1>
          </div>
        </div>
        {description && (
          <p className="mt-2 max-w-3xl text-[0.8125rem] leading-relaxed text-navy-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
