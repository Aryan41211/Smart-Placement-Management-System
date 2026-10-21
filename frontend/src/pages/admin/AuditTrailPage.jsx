import { useState } from 'react';
import { ScrollText, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { reportApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { formatDateTime, humanise } from '../../utils/format.js';

const PAGE_SIZE = 25;

const ACTION_TONES = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  status_change: 'brand',
  login: 'neutral',
  logout: 'neutral',
  export: 'warning',
  approve: 'success',
  publish: 'success',
  close: 'neutral',
  cancel: 'danger',
};

const ACTIONS = [
  'create',
  'update',
  'delete',
  'status_change',
  'login',
  'logout',
  'export',
  'approve',
  'publish',
  'close',
  'cancel',
];

/**
 * The append-only administrative audit trail.
 *
 * Every significant change in the system lands here with the actor, the
 * affected entity and a timestamp. The endpoint is read-only.
 */
export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-created_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (action) params.action = action;
  if (entityType) params.entity_type = entityType;

  const { data, loading, error, reload } = useApi(
    () => reportApi.auditLogs(params),
    [page, debouncedSearch, action, entityType],
  );

  const rows = data?.results ?? [];

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="An immutable record of every administrative action, published drive and pipeline change."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg bg-navy-100 px-3 py-1.5 text-xs text-navy-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Read-only
          </span>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Actor, description or entity id"
          />
          <Select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by action"
          >
            <option value="">Any action</option>
            {ACTIONS.map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Entity type (e.g. JobDrive)"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by entity type"
          />
        </div>
      </Card>

      {loading && <LoadingState label="Loading the audit trail..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit entries matched"
              description="Administrative changes, drive publications and status transitions are recorded here."
            />
          ) : (
            <Table
              columns={[
                { key: 'when', header: 'When' },
                { key: 'actor', header: 'Actor' },
                { key: 'action', header: 'Action' },
                { key: 'entity', header: 'Entity' },
                { key: 'description', header: 'Description' },
                { key: 'ip', header: 'IP address' },
              ]}
            >
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="whitespace-nowrap text-navy-500">
                    {formatDateTime(row.created_at)}
                  </Td>
                  <Td className="text-navy-600">{row.actor_email || 'system'}</Td>
                  <Td>
                    <Badge variant={ACTION_TONES[row.action] ?? 'neutral'}>
                      {humanise(row.action)}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-navy-500">
                    {row.entity_type}
                    <span className="block font-mono text-navy-400">#{row.entity_id}</span>
                  </Td>
                  <Td className="max-w-md text-navy-600">{row.description}</Td>
                  <Td className="font-mono text-xs text-navy-400">{row.ip_address || '—'}</Td>
                </Tr>
              ))}
            </Table>
          )}
          <Pagination
            page={data?.page ?? 1}
            pages={data?.pages ?? 1}
            count={data?.count ?? 0}
            onChange={setPage}
          />
        </Card>
      )}

      <p className="mt-4 text-xs text-navy-400">
        <Button variant="ghost" size="sm" onClick={reload}>
          Refresh
        </Button>
        The trail is append-only; rows are never edited or deleted from the interface.
      </p>
    </>
  );
}
