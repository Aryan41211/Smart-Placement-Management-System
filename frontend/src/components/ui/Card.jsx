/**
 * Surface primitives used across the application.
 *
 * @param {object} props component props
 */
export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * Card with a title, optional description and an action slot.
 *
 * @param {object} props component props
 */
export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 ${className}`}
    >
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Body of a card.
 *
 * @param {object} props component props
 */
export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/**
 * Footer of a card.
 *
 * @param {object} props component props
 */
export function CardFooter({ className = '', children }) {
  return (
    <div className={`border-t border-slate-200 px-5 py-3 ${className}`}>{children}</div>
  );
}
