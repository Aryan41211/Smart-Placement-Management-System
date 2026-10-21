/**
 * Data table with a consistent header and empty state.
 *
 * @param {object} props component props
 */
export function Table({ columns, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key ?? column.header}
                scope="col"
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * Table row.
 *
 * @param {object} props component props
 */
export function Tr({ children, className = '', onClick }) {
  return (
    <tr className={`${onClick ? 'cursor-pointer hover:bg-slate-50' : ''} ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

/**
 * Table cell.
 *
 * @param {object} props component props
 */
export function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-4 py-3 align-middle text-slate-700 ${className}`} {...rest}>
      {children}
    </td>
  );
}
