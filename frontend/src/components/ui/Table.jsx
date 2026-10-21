/**
 * Data table with a consistent header and empty state.
 *
 * Columns are declared as objects so alignment and width are controlled from
 * one place instead of being re-specified on every `<Td>`.
 *
 * @param {object} props component props
 */
export function Table({ columns, children, className = '' }) {
  return (
    <div className={`scrollbar-thin overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-[var(--app-border)] text-sm">
        <thead className="table-head">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key ?? column.header}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`px-4 py-3 text-left ${
                  column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                } ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-100 bg-white">{children}</tbody>
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
    <tr
      className={`table-row ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
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
    <td className={`px-4 py-3 align-middle text-navy-700 ${className}`} {...rest}>
      {children}
    </td>
  );
}
