import { useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  MapPin,
  Send,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { applicationApi, driveApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

/**
 * The placement drive catalogue for students.
 *
 * The eligibility verdict shown for every card comes from the server side
 * engine, never from a client side guess.
 */
export default function AvailableDrivesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [applying, setApplying] = useState(false);

  const { data, loading, error, reload } = useApi(
    () => driveApi.list({ ordering: 'application_deadline', page_size: 50 }),
    [],
  );
  const { data: myApplications } = useApi(() => applicationApi.mine(), []);

  const drives = Array.isArray(data) ? data : data?.results ?? [];
  const appliedDriveIds = new Set(
    (Array.isArray(myApplications) ? myApplications : []).map((row) => row.job_drive),
  );
  const visible = drives.filter((drive) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      drive.title.toLowerCase().includes(term) ||
      drive.company_name.toLowerCase().includes(term) ||
      drive.role_designation.toLowerCase().includes(term)
    );
  });

  async function openDrive(drive) {
    setSelected(drive);
    setEligibility(null);
    try {
      const result = await driveApi.eligibility(drive.id);
      setEligibility(result);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleApply() {
    if (!selected) return;
    setApplying(true);
    try {
      await applicationApi.submit({ job_drive: selected.id, resume_url: '' });
      toast.success(`Application submitted for ${selected.title}.`);
      setSelected(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Placement drives"
        description="Every published drive with its eligibility verdict computed by the server."
      />

      <div className="mb-5 max-w-md">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by role or company"
          className="input-base"
          aria-label="Search placement drives"
        />
      </div>

      {loading && <LoadingState label="Loading drives..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && visible.length === 0 && (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No drives available"
            description="The placement cell has not published a drive that matches your search yet."
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((drive) => (
          <Card key={drive.id} className="flex flex-col">
            <CardBody className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{drive.title}</h3>
                  <p className="truncate text-sm text-slate-500">{drive.company_name}</p>
                </div>
                <StatusBadge status={drive.status} />
              </div>

              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <dd>
                    {formatCurrency(drive.package_min, { compact: true })} -{' '}
                    {formatCurrency(drive.package_max, { compact: true })}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <dd>
                    Closes {formatDateTime(drive.application_deadline)}
                    {drive.days_to_deadline !== null && drive.days_to_deadline >= 0
                      ? ` (${drive.days_to_deadline} day(s) left)`
                      : ''}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <dd className="capitalize">{drive.drive_mode}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {drive.required_skills?.length ? (
                  drive.required_skills.map((entry) => (
                    <Badge key={entry.id} variant={entry.requirement_level === 'required' ? 'brand' : 'neutral'}>
                      {entry.skill_name}
                      {entry.requirement_level === 'required' ? ' *' : ''}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No specific skill requirements</span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => openDrive(drive)}
                >
                  Check eligibility
                </Button>
                {appliedDriveIds.has(drive.id) ? (
                  <Badge variant="info">Applied</Badge>
                ) : (
                  drive.status === 'published' && (
                    <Button size="sm" className="flex-1" onClick={() => openDrive(drive)}>
                      Apply
                    </Button>
                  )
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.title}
        description={selected ? `${selected.role_designation} at ${selected.company_name}` : ''}
        onClose={() => setSelected(null)}
        size="lg"
        footer={
          selected && (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button
                onClick={handleApply}
                loading={applying}
                disabled={
                  appliedDriveIds.has(selected.id) ||
                  selected.status !== 'published' ||
                  (eligibility && !eligibility.eligible)
                }
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {appliedDriveIds.has(selected.id) ? 'Already applied' : 'Submit application'}
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            {selected.description && (
              <p className="text-sm leading-relaxed text-slate-600">{selected.description}</p>
            )}

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Package</dt>
                <dd className="mt-1 text-slate-800">
                  {formatCurrency(selected.package_min)} - {formatCurrency(selected.package_max)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Job type</dt>
                <dd className="mt-1 capitalize text-slate-800">{selected.job_type}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Minimum CGPA</dt>
                <dd className="mt-1 text-slate-800">{selected.min_cgpa ?? 'No restriction'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Backlogs allowed</dt>
                <dd className="mt-1 text-slate-800">
                  {selected.max_active_backlogs ?? 'Not considered'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Departments</dt>
                <dd className="mt-1 text-slate-800">
                  {selected.allowed_department_names?.length
                    ? selected.allowed_department_names.join(', ')
                    : 'Open to all departments'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Applications</dt>
                <dd className="mt-1 text-slate-800">{selected.application_count}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Eligibility verdict</p>
              {!eligibility && <p className="mt-1 text-sm text-slate-500">Evaluating...</p>}
              {eligibility && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    {eligibility.eligible ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                        <span className="text-sm font-medium text-emerald-700">
                          You are eligible for this drive.
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
                        <span className="text-sm font-medium text-rose-700">
                          You are not eligible yet.
                        </span>
                      </>
                    )}
                  </div>
                  {eligibility.messages?.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {eligibility.messages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                  {eligibility.reasons?.length > 0 && (
                    <p className="mt-3 text-xs text-slate-400">
                      Reason codes: {eligibility.reasons.join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
