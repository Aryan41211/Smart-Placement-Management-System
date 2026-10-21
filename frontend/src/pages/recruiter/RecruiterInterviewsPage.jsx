import { useState } from 'react';
import { CalendarClock, ClipboardCheck, Plus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { applicationApi, driveApi, interviewApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

const SCHEDULABLE = ['applied', 'under_review', 'shortlisted', 'interview'];

const EMPTY_SCHEDULE = {
  drive: '',
  round: '',
  application: '',
  scheduled_at: '',
  duration_minutes: 45,
  mode: 'online',
  venue: '',
  meeting_link: '',
};

const EMPTY_OUTCOME = { status: 'completed', outcome: 'passed', feedback: '' };

/**
 * Interview scheduling and outcome recording for a recruiting company.
 */
export default function RecruiterInterviewsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [outcome, setOutcome] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE);
  const [scheduling, setScheduling] = useState(false);
  const [outcomeTarget, setOutcomeTarget] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState(EMPTY_OUTCOME);
  const [recording, setRecording] = useState(false);

  const params = { page, page_size: PAGE_SIZE, ordering: 'scheduled_at' };
  if (status) params.status = status;
  if (outcome) params.outcome = outcome;

  const { data, loading, error, reload } = useApi(
    () => interviewApi.list(params),
    [page, status, outcome],
  );
  const { data: drives } = useApi(() => driveApi.list({ page_size: 100, ordering: '-created_at' }), []);
  const { data: applications } = useApi(
    () => applicationApi.list({ page_size: 200, ordering: '-applied_at' }),
    [],
  );

  const roundsByDrive = useApi(
    () =>
      scheduleForm.drive
        ? interviewApi.rounds({ job_drive: scheduleForm.drive })
        : Promise.resolve([]),
    [scheduleForm.drive],
    { enabled: Boolean(scheduleForm.drive) },
  );

  const rows = data?.results ?? [];
  const driveOptions = drives?.results ?? [];
  const applicationRows = (applications?.results ?? []).filter((row) =>
    SCHEDULABLE.includes(row.status),
  );
  const roundOptions = Array.isArray(roundsByDrive.data)
    ? roundsByDrive.data
    : roundsByDrive.data?.results ?? [];
  const applicationsForDrive = scheduleForm.drive
    ? applicationRows.filter((row) => String(row.job_drive) === String(scheduleForm.drive))
    : applicationRows;

  async function handleSchedule(event) {
    event.preventDefault();
    setScheduling(true);
    try {
      await interviewApi.schedule({
        application: Number(scheduleForm.application),
        round: Number(scheduleForm.round),
        scheduled_at: scheduleForm.scheduled_at,
        duration_minutes: Number(scheduleForm.duration_minutes),
        mode: scheduleForm.mode,
        venue: scheduleForm.venue,
        meeting_link: scheduleForm.meeting_link,
      });
      toast.success('Interview scheduled and the student notified.');
      setScheduleOpen(false);
      setScheduleForm(EMPTY_SCHEDULE);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScheduling(false);
    }
  }

  async function handleOutcome(event) {
    event.preventDefault();
    if (!outcomeTarget) return;
    setRecording(true);
    try {
      await interviewApi.recordOutcome(outcomeTarget.id, outcomeForm);
      toast.success('Interview outcome recorded.');
      setOutcomeTarget(null);
      setOutcomeForm(EMPTY_OUTCOME);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRecording(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Schedule rounds for your shortlisted candidates and record the results."
        actions={
          <Button size="sm" onClick={() => setScheduleOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Schedule interview
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by interview status"
          >
            <option value="">Any interview status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No show</option>
          </Select>
          <Select
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by outcome"
          >
            <option value="">Any outcome</option>
            <option value="pending">Pending</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading interviews..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No interviews scheduled"
              description="Once you schedule a round for a candidate it appears here with its outcome."
            />
          ) : (
            <Table
              columns={[
                { key: 'candidate', header: 'Candidate' },
                { key: 'round', header: 'Round' },
                { key: 'when', header: 'Scheduled for' },
                { key: 'mode', header: 'Mode' },
                { key: 'status', header: 'Status' },
                { key: 'outcome', header: 'Outcome' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((interview) => (
                <Tr key={interview.id}>
                  <Td className="font-medium text-navy-900">
                    {interview.student_name}
                    <span className="block font-mono text-xs font-normal text-navy-400">
                      {interview.student_roll_number}
                    </span>
                  </Td>
                  <Td>
                    {interview.round_name}
                    <span className="block text-xs text-navy-400">
                      {interview.job_drive_title}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-navy-500">
                    {formatDateTime(interview.scheduled_at)}
                  </Td>
                  <Td className="capitalize text-navy-500">
                    {interview.mode}
                    {interview.mode === 'offline' && interview.venue && (
                      <span className="block text-xs text-navy-400">{interview.venue}</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={interview.status} />
                  </Td>
                  <Td>
                    <StatusBadge status={interview.outcome} />
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setOutcomeTarget(interview);
                        setOutcomeForm({
                          status: interview.status === 'scheduled' ? 'completed' : interview.status,
                          outcome: interview.outcome === 'pending' ? 'passed' : interview.outcome,
                          feedback: interview.feedback || '',
                        });
                      }}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Record outcome
                    </Button>
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
        open={scheduleOpen}
        title="Schedule an interview"
        description="The candidate receives an in-app notification as soon as the round is booked."
        onClose={() => setScheduleOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} loading={scheduling}>
              Schedule
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSchedule}>
          <Select
            label="Drive"
            value={scheduleForm.drive}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, drive: event.target.value, round: '', application: '' })
            }
            required
          >
            <option value="">Select a drive</option>
            {driveOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </Select>

          <Select
            label="Interview round"
            value={scheduleForm.round}
            onChange={(event) => setScheduleForm({ ...scheduleForm, round: event.target.value })}
            required
            disabled={!scheduleForm.drive}
            hint={
              scheduleForm.drive && roundOptions.length === 0
                ? 'No rounds defined for this drive yet. Add one from the My drives screen.'
                : undefined
            }
          >
            <option value="">Select a round</option>
            {roundOptions.map((round) => (
              <option key={round.id} value={round.id}>
                {round.sequence}. {round.name}
              </option>
            ))}
          </Select>

          <Select
            label="Candidate"
            value={scheduleForm.application}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, application: event.target.value })
            }
            required
            disabled={!scheduleForm.drive}
          >
            <option value="">Select an applicant</option>
            {applicationsForDrive.map((application) => (
              <option key={application.id} value={application.id}>
                {application.student_name} ({application.student_roll_number}) -{' '}
                {application.status}
              </option>
            ))}
          </Select>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Scheduled at"
              type="datetime-local"
              value={scheduleForm.scheduled_at}
              onChange={(event) =>
                setScheduleForm({ ...scheduleForm, scheduled_at: event.target.value })
              }
              required
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min="5"
              value={scheduleForm.duration_minutes}
              onChange={(event) =>
                setScheduleForm({ ...scheduleForm, duration_minutes: event.target.value })
              }
            />
            <Select
              label="Mode"
              value={scheduleForm.mode}
              onChange={(event) => setScheduleForm({ ...scheduleForm, mode: event.target.value })}
            >
              <option value="online">Online</option>
              <option value="offline">In person</option>
              <option value="phone">Phone</option>
            </Select>
            {scheduleForm.mode === 'offline' ? (
              <Input
                label="Venue"
                value={scheduleForm.venue}
                onChange={(event) =>
                  setScheduleForm({ ...scheduleForm, venue: event.target.value })
                }
                placeholder="Placement cell, Block A"
              />
            ) : (
              <Input
                label="Meeting link"
                type="url"
                value={scheduleForm.meeting_link}
                onChange={(event) =>
                  setScheduleForm({ ...scheduleForm, meeting_link: event.target.value })
                }
                placeholder="https://meet.example.com/abc"
              />
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(outcomeTarget)}
        title="Record the interview outcome"
        description={
          outcomeTarget
            ? `${outcomeTarget.student_name} - ${outcomeTarget.round_name}`
            : ''
        }
        onClose={() => setOutcomeTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOutcomeTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleOutcome} loading={recording}>
              Save outcome
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleOutcome}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Interview status"
              value={outcomeForm.status}
              onChange={(event) => setOutcomeForm({ ...outcomeForm, status: event.target.value })}
            >
              <option value="completed">Completed</option>
              <option value="scheduled">Still scheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No show</option>
            </Select>
            <Select
              label="Outcome"
              value={outcomeForm.outcome}
              onChange={(event) => setOutcomeForm({ ...outcomeForm, outcome: event.target.value })}
            >
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </Select>
          </div>
          <Textarea
            label="Feedback (shared with the placement cell)"
            rows={3}
            value={outcomeForm.feedback}
            onChange={(event) => setOutcomeForm({ ...outcomeForm, feedback: event.target.value })}
          />

          {outcomeTarget && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-navy-50 px-4 py-3 text-xs text-navy-500">
              <Badge variant="neutral">Current</Badge>
              <StatusBadge status={outcomeTarget.status} />
              <StatusBadge status={outcomeTarget.outcome} />
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
