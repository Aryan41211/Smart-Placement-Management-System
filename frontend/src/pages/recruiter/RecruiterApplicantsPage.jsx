import { useState } from 'react';
import { Eye, GitBranch, StickyNote, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import StatusTimeline from '../../components/common/StatusTimeline.jsx';
import ApplicationStatusDialog from '../../components/common/ApplicationStatusDialog.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { applicationApi, driveApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { APPLICATION_STATUS_LABELS, transitionsFor } from '../../config/applicationStatus.js';
import { formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

/**
 * The applicant tracker for a recruiting company.
 *
 * Recruiters only ever see applications for their own company's drives - the
 * scoping happens on the backend, not in this component.
 */
export default function RecruiterApplicantsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [drive, setDrive] = useState('');
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-applied_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status) params.status = status;
  if (drive) params.job_drive = drive;

  const { data, loading, error, reload } = useApi(
    () => applicationApi.list(params),
    [page, debouncedSearch, status, drive],
  );
  const { data: drives } = useApi(() => driveApi.list({ page_size: 100, ordering: '-created_at' }), []);

  const rows = data?.results ?? [];
  const driveOptions = drives?.results ?? [];

  async function openDetail(application) {
    setDetail(application);
    setHistory([]);
    setNotes(application.internal_notes || '');
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

  async function saveNotes() {
    if (!detail) return;
    setSavingNotes(true);
    try {
      await applicationApi.updateNotes(detail.id, { internal_notes: notes });
      toast.success('Internal notes saved.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Applicants"
        description="Every candidate who applied to one of your company's drives."
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Student name or roll number"
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
            value={drive}
            onChange={(event) => {
              setDrive(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by drive"
          >
            <option value="">All drives</option>
            {driveOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading your applicants..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No applicants yet"
              description="Applications to your published drives appear here as soon as students submit them."
            />
          ) : (
            <Table
              columns={[
                { key: 'student', header: 'Student' },
                { key: 'drive', header: 'Drive' },
                { key: 'cgpa', header: 'CGPA' },
                { key: 'backlogs', header: 'Backlogs' },
                { key: 'status', header: 'Status' },
                { key: 'applied', header: 'Applied on' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((application) => (
                <Tr key={application.id}>
                  <Td className="font-medium text-navy-900">
                    {application.student_name}
                    <span className="block font-mono text-xs font-normal text-navy-400">
                      {application.student_roll_number}
                    </span>
                  </Td>
                  <Td>
                    {application.job_drive_title}
                    <span className="block text-xs text-navy-400">
                      {application.student_department}
                    </span>
                  </Td>
                  <Td>{application.student_cgpa}</Td>
                  <Td>{application.student_backlogs}</Td>
                  <Td>
                    <StatusBadge status={application.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-navy-500">
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
        description={detail ? `${detail.job_drive_title} - ${detail.student_department}` : ''}
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
                <dt className="text-xs uppercase tracking-wide text-navy-400">Roll number</dt>
                <dd className="mt-1 font-mono text-navy-700">{detail.student_roll_number}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">CGPA</dt>
                <dd className="mt-1 text-navy-700">{detail.student_cgpa}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={detail.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Interviews</dt>
                <dd className="mt-1 text-navy-700">{detail.interview_count}</dd>
              </div>
            </dl>

            {detail.resume_url && (
              <p className="text-sm">
                <span className="text-xs uppercase tracking-wide text-navy-400">Resume</span>{' '}
                <a
                  href={detail.resume_url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-base break-all"
                >
                  {detail.resume_url}
                </a>
              </p>
            )}

            <div className="rounded-lg bg-navy-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-800">
                <StickyNote className="h-4 w-4 text-navy-400" aria-hidden="true" />
                Internal notes
              </p>
              <p className="mt-1 text-xs text-navy-500">
                Visible to your company and the placement cell only, never to students.
              </p>
              <Textarea
                className="mt-2"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Interviewer feedback, salary discussion, next steps..."
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" loading={savingNotes} onClick={saveNotes}>
                  Save notes
                </Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-navy-800">Status history</p>
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
