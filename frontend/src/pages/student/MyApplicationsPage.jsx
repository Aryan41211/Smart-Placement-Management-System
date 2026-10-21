import { useState } from 'react';
import { Clock, FileText, History, IndianRupee, XCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { applicationApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDateTime, humanise } from '../../utils/format.js';

const WITHDRAWABLE = ['applied', 'under_review', 'shortlisted', 'interview'];

/**
 * The student's own applications with the full status trail.
 */
export default function MyApplicationsPage() {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [withdrawing, setWithdrawing] = useState(false);

  const { data, loading, error, reload } = useApi(() => applicationApi.mine(), []);

  const applications = Array.isArray(data) ? data : data?.results ?? [];

  async function openHistory(application) {
    setSelected(application);
    try {
      const rows = await applicationApi.history(application.id);
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast.error(err.message);
      setHistory([]);
    }
  }

  async function handleWithdraw(application) {
    setWithdrawing(true);
    try {
      await applicationApi.changeStatus(application.id, {
        new_status: 'withdrawn',
        reason: 'Withdrawn by the student',
      });
      toast.success('Application withdrawn.');
      setSelected(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My applications"
        description="Track every submission through the recruitment pipeline."
      />

      {loading && <LoadingState label="Loading your applications..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {applications.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="You have not applied yet"
              description="Browse the placement drives, check your eligibility and submit your first application."
            />
          ) : (
            <Table
              columns={[
                { key: 'drive', header: 'Drive' },
                { key: 'company', header: 'Company' },
                { key: 'status', header: 'Status' },
                { key: 'package', header: 'Offer' },
                { key: 'applied', header: 'Applied on' },
                { key: 'actions', header: '' },
              ]}
            >
              {applications.map((application) => (
                <Tr key={application.id}>
                  <Td className="font-medium text-slate-900">{application.job_drive_title}</Td>
                  <Td>{application.job_drive_company}</Td>
                  <Td>
                    <StatusBadge status={application.status} />
                  </Td>
                  <Td>
                    {application.offer_package ? (
                      <span className="font-medium text-emerald-700">
                        {formatCurrency(application.offer_package)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatDateTime(application.applied_at)}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openHistory(application)}>
                      <History className="h-4 w-4" aria-hidden="true" />
                      History
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        title={selected ? `Application - ${selected.job_drive_title}` : ''}
        description={selected ? `${selected.job_drive_company} - ${selected.job_drive_role}` : ''}
        onClose={() => setSelected(null)}
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              {WITHDRAWABLE.includes(selected.status) && (
                <Button
                  variant="danger"
                  loading={withdrawing}
                  onClick={() => handleWithdraw(selected)}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Withdraw application
                </Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Current status</dt>
                <dd className="mt-1">
                  <StatusBadge status={selected.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Interviews</dt>
                <dd className="mt-1 text-slate-700">{selected.interview_count}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Last updated</dt>
                <dd className="mt-1 text-slate-700">{formatDateTime(selected.status_changed_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Offer package</dt>
                <dd className="mt-1 text-slate-700">
                  {selected.offer_package ? formatCurrency(selected.offer_package) : '—'}
                </dd>
              </div>
            </dl>

            {selected.rejection_reason && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p className="flex items-center gap-2 font-medium">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Reason recorded
                </p>
                <p className="mt-1">{selected.rejection_reason}</p>
              </div>
            )}

            {selected.eligibility_snapshot && (
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Eligibility snapshot at submission
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(selected.eligibility_snapshot)
                    .filter(([, value]) => value !== null && value !== undefined)
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          {key.replace(/_/g, ' ')}
                        </dt>
                        <dd className="mt-0.5 text-slate-700">{String(value)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Status trail
              </p>
              {history.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No history entries yet.</p>
              ) : (
                <ol className="mt-3 space-y-3 border-l border-slate-200 pl-5">
                  {history.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{humanise(entry.from_status) || 'Created'}</Badge>
                        <span className="text-slate-400">→</span>
                        <StatusBadge status={entry.to_status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(entry.changed_at)} &middot; {entry.changed_by_name}
                        {entry.changed_by_role ? ` (${entry.changed_by_role})` : ''}
                      </p>
                      {entry.reason && <p className="mt-0.5 text-sm text-slate-600">{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {selected.offer_package && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <IndianRupee className="h-4 w-4" aria-hidden="true" />
                Offer package: {formatCurrency(selected.offer_package)}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
