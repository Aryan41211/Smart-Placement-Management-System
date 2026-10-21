/**
 * Surface primitives used across the application.
 *
 * Every page in the product composes these three pieces, which is what keeps
 * spacing, borders and shadows identical from the dashboard to a modal.
 *
 * @param {object} props component props
 */
export function Card({ className = '', children, interactive = false, ...rest }) {
  return (
    <div className={`card ${interactive ? 'card-interactive' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * Card with a title, optional description and an action slot.
 *
 * @param {object} props component props
 */
export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
  eyebrow,
  className = '',
}) {
  return (
    <div className={`card-header ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="truncate text-[0.9375rem] font-semibold text-navy-900">{title}</h2>
          {description && <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-navy-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Body of a card.
 *
 * @param {object} props component props
 */
export function CardBody({ className = '', children }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

/**
 * Footer of a card.
 *
 * @param {object} props component props
 */
export function CardFooter({ className = '', children }) {
  return (
    <div className={`border-t border-[var(--app-border)] bg-navy-50/40 px-5 py-3 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
