import { useState } from 'react';
import { Download, Eye, FileText, Filter, GitBranch, IndianRupee } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import StatusTimeline from '../../components/common/StatusTimeline.jsx';
import ApplicationStatusDialog from '../../components/common/ApplicationStatusDialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { applicationApi, reportApi, studentApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { APPLICATION_STATUS_LABELS, transitionsFor } from '../../config/applicationStatus.js';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

/**
 * The full application pipeline for the placement cell.
 *
 * Officers see every application on campus and can advance, reject or select
 * candidates. Each change is validated by the backend state machine and
 * written to the append-only status history.
 */
export default function ApplicationPipelinePage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [statusTarget, setStatusTarget] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-applied_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status) params.status = status;
  if (department) params.department = department;
  if (minCgpa) params.min_cgpa = minCgpa;

  const { data, loading, error, reload } = useApi(
    () => applicationApi.list(params),
    [page, debouncedSearch, status, department, minCgpa],
  );
  const { data: departments } = useApi(() => studentApi.departments(), []);

  const rows = data?.results ?? [];
  const departmentOptions = Array.isArray(departments) ? departments : [];

  function resetFilters() {
    setSearch('');
    setStatus('');
    setDepartment('');
    setMinCgpa('');
    setPage(1);
  }

  async function openDetail(application) {
    setDetail(application);
    setHistory([]);
    try {
      const entries = await applicationApi.history(application.id);
      setHistory(Array.isArray(entries) ? entries : []);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleTransition(payload) {
    if (!statusTarget) return;
    setUpdating(true);
    try {
      await applicationApi.changeStatus(statusTarget.id, payload);
      toast.success(
        `${statusTarget.student_name} moved to ${APPLICATION_STATUS_LABELS[payload.new_status]}.`,
      );
      setStatusTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const exportParams = {};
      if (status) exportParams.status = status;
      await reportApi.download('applications', 'applications.csv', exportParams);
      toast.success('Application register exported.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Application pipeline"
        description="Every application on campus, grouped by the stage of the recruitment process."
        actions={
          <Button variant="secondary" size="sm" loading={exporting} onClick={handleExport}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Student, roll number, drive or company"
          />
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="">Any status</option>
            {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departmentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="Minimum CGPA"
            value={minCgpa}
            onChange={(event) => {
              setMinCgpa(event.target.value);
              setPage(1);
            }}
            aria-label="Minimum CGPA"
          />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
          <p className="text-xs text-slate-500">
            <Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {data?.count ?? 0} application(s) matched
          </p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      </Card>

      {loading && <LoadingState label="Loading the application pipeline..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications matched"
              description="Once students start applying to published drives their records appear here."
            />
          ) : (
            <Table
              columns={[
                { key: 'student', header: 'Student' },
                { key: 'drive', header: 'Drive' },
                { key: 'department', header: 'Department' },
                { key: 'cgpa', header: 'CGPA' },
                { key: 'status', header: 'Status' },
                { key: 'applied', header: 'Applied on' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((application) => (
                <Tr key={application.id}>
                  <Td className="font-medium text-slate-900">
                    {application.student_name}
                    <span className="block font-mono text-xs font-normal text-slate-400">
                      {application.student_roll_number}
                    </span>
                  </Td>
                  <Td>
                    {application.job_drive_title}
                    <span className="block text-xs text-slate-400">
                      {application.job_drive_company}
                    </span>
                  </Td>
                  <Td className="text-slate-500">{application.student_department}</Td>
                  <Td>{application.student_cgpa}</Td>
                  <Td>
                    <StatusBadge status={application.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatDateTime(application.applied_at)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {transitionsFor(application.status).length > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setStatusTarget(application)}
                        >
                          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                          Advance
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openDetail(application)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Details
                      </Button>
                    </div>
                  </Td>
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

      <Modal
        open={Boolean(detail)}
        title={detail ? detail.student_name : ''}
        description={detail ? `${detail.job_drive_title} - ${detail.job_drive_company}` : ''}
        onClose={() => setDetail(null)}
        size="lg"
        footer={
          detail && (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              {transitionsFor(detail.status).length > 0 && (
                <Button
                  onClick={() => {
                    setStatusTarget(detail);
                    setDetail(null);
                  }}
                >
                  <GitBranch className="h-4 w-4" aria-hidden="true" />
                  Advance application
                </Button>
              )}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Roll number</dt>
                <dd className="mt-1 font-mono text-slate-700">{detail.student_roll_number}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Department</dt>
                <dd className="mt-1 text-slate-700">{detail.student_department}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">CGPA</dt>
                <dd className="mt-1 text-slate-700">{detail.student_cgpa}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Active backlogs</dt>
                <dd className="mt-1 text-slate-700">{detail.student_backlogs}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Interviews</dt>
                <dd className="mt-1 text-slate-700">{detail.interview_count}</dd>
              </div>
            </dl>

            {detail.offer_package && (
              <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <IndianRupee className="h-4 w-4" aria-hidden="true" />
                Offer package: {formatCurrency(detail.offer_package)}
              </p>
            )}

            {detail.rejection_reason && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {detail.rejection_reason}
              </p>
            )}

            {detail.internal_notes && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Internal notes (recruiters and officers only)
                </p>
                <p className="mt-1 text-sm text-slate-700">{detail.internal_notes}</p>
              </div>
            )}

            {detail.eligibility_snapshot && Object.keys(detail.eligibility_snapshot).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-800">Eligibility at submission</p>
                <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(detail.eligibility_snapshot)
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
              <p className="text-sm font-semibold text-slate-800">Status history</p>
              <StatusTimeline entries={history} />
            </div>
          </div>
        )}
      </Modal>

      <ApplicationStatusDialog
        open={Boolean(statusTarget)}
        application={statusTarget}
        loading={updating}
        onSubmit={handleTransition}
        onClose={() => setStatusTarget(null)}
      />
    </>
  );
}
