import { useState } from 'react';
import { Briefcase, ListOrdered, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
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
import { driveApi, interviewApi, skillApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  title: '',
  role_designation: '',
  description: '',
  job_type: 'full_time',
  drive_mode: 'on_campus',
  package_min: '',
  package_max: '',
  min_cgpa: '',
  max_active_backlogs: '',
  min_graduation_year: '',
  max_graduation_year: '',
  application_deadline: '',
  eligibility_notes: '',
};

/**
 * Drive management for a recruiting company.
 *
 * Recruiters create draft drives, attach their eligibility criteria and submit
 * them for placement-cell approval. Publishing stays with the placement cell.
 */
export default function RecruiterDrivesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const companyId = user?.recruiter_profile?.company ?? null;
  const authorised = Boolean(user?.recruiter_profile?.is_authorized);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [roundsTarget, setRoundsTarget] = useState(null);
  const [newRound, setNewRound] = useState({ name: '', sequence: 1, description: '' });
  const [roundBusy, setRoundBusy] = useState(false);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-created_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status) params.status = status;

  const { data, loading, error, reload } = useApi(
    () => driveApi.list(params),
    [page, debouncedSearch, status],
  );
  const { data: skills } = useApi(() => skillApi.list({ page_size: 200, ordering: 'name' }), []);

  const rows = data?.results ?? [];
  const skillOptions = skills?.results ?? [];

  const { data: rounds, reload: reloadRounds } = useApi(
    () => (roundsTarget ? interviewApi.rounds({ job_drive: roundsTarget.id }) : Promise.resolve([])),
    [roundsTarget?.id],
    { enabled: Boolean(roundsTarget) },
  );
  const roundRows = Array.isArray(rounds) ? rounds : rounds?.results ?? [];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedSkills([]);
    setFormOpen(true);
  }

  function openEdit(drive) {
    setEditing(drive);
    setForm({
      title: drive.title,
      role_designation: drive.role_designation,
      description: drive.description || '',
      job_type: drive.job_type,
      drive_mode: drive.drive_mode,
      package_min: drive.package_min ?? '',
      package_max: drive.package_max ?? '',
      min_cgpa: drive.min_cgpa ?? '',
      max_active_backlogs: drive.max_active_backlogs ?? '',
      min_graduation_year: drive.min_graduation_year ?? '',
      max_graduation_year: drive.max_graduation_year ?? '',
      application_deadline: drive.application_deadline
        ? drive.application_deadline.slice(0, 16)
        : '',
      eligibility_notes: drive.eligibility_notes || '',
    });
    setSelectedSkills((drive.required_skills ?? []).map((entry) => entry.skill_id));
    setFormOpen(true);
  }

  function buildPayload() {
    const payload = {
      title: form.title,
      company: companyId,
      role_designation: form.role_designation,
      description: form.description,
      job_type: form.job_type,
      drive_mode: form.drive_mode,
      package_min: form.package_min === '' ? 0 : Number(form.package_min),
      package_max: form.package_max === '' ? 0 : Number(form.package_max),
      application_deadline: form.application_deadline,
      eligibility_notes: form.eligibility_notes,
      required_skills: selectedSkills.map((skillId) => ({
        skill: skillId,
        requirement_level: 'required',
        min_proficiency: 1,
      })),
    };
    if (form.min_cgpa !== '') payload.min_cgpa = Number(form.min_cgpa);
    if (form.max_active_backlogs !== '') {
      payload.max_active_backlogs = Number(form.max_active_backlogs);
    }
    if (form.min_graduation_year !== '') {
      payload.min_graduation_year = Number(form.min_graduation_year);
    }
    if (form.max_graduation_year !== '') {
      payload.max_graduation_year = Number(form.max_graduation_year);
    }
    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await driveApi.update(editing.id, payload);
        toast.success(`${payload.title} updated.`);
      } else {
        await driveApi.create(payload);
        toast.success(`${payload.title} saved as a draft.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval(drive) {
    setBusyId(drive.id);
    try {
      await driveApi.submit(drive.id);
      toast.success(`${drive.title} submitted for placement-cell approval.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function createRound(event) {
    event.preventDefault();
    if (!roundsTarget) return;
    setRoundBusy(true);
    try {
      await interviewApi.createRound({
        job_drive: roundsTarget.id,
        name: newRound.name,
        sequence: Number(newRound.sequence),
        description: newRound.description,
      });
      toast.success(`Round "${newRound.name}" added.`);
      setNewRound({ name: '', sequence: roundRows.length + 2, description: '' });
      reloadRounds();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRoundBusy(false);
    }
  }

  async function removeRound(round) {
    setRoundBusy(true);
    try {
      await interviewApi.removeRound(round.id);
      toast.success(`Round "${round.name}" removed.`);
      reloadRounds();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRoundBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My drives"
        description="Draft, submit and monitor the placement drives your company is running on campus."
        actions={
          <Button size="sm" onClick={openCreate} disabled={!authorised || !companyId}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New drive
          </Button>
        }
      />

      {!authorised && (
        <Card className="mb-5">
          <div className="flex items-center gap-3 px-5 py-4 text-sm text-amber-800">
            <Badge variant="warning">Pending</Badge>
            Your recruiter account is awaiting authorisation. You can browse drives, but
            creating and submitting drives is disabled until the placement cell approves you.
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Drive title or role"
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
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading your drives..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No drives yet"
              description="Create a draft drive and submit it for approval to open applications."
            />
          ) : (
            <Table
              columns={[
                { key: 'drive', header: 'Drive' },
                { key: 'package', header: 'Package' },
                { key: 'deadline', header: 'Deadline' },
                { key: 'applications', header: 'Applications' },
                { key: 'status', header: 'Status' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((drive) => (
                <Tr key={drive.id}>
                  <Td className="font-medium text-navy-900">
                    {drive.title}
                    <span className="block text-xs font-normal text-navy-400">
                      {drive.role_designation}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatCurrency(drive.package_min, { compact: true })} -{' '}
                    {formatCurrency(drive.package_max, { compact: true })}
                  </Td>
                  <Td className="whitespace-nowrap text-navy-500">
                    {formatDateTime(drive.application_deadline)}
                  </Td>
                  <Td>{drive.application_count}</Td>
                  <Td>
                    <StatusBadge status={drive.status} />
                    {drive.status === 'draft' && drive.submitted_at && (
                      <span className="mt-1 block">
                        <Badge variant="info">Awaiting approval</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {drive.status === 'draft' && !drive.submitted_at && (
                        <Button
                          variant="success"
                          size="sm"
                          loading={busyId === drive.id}
                          onClick={() => submitForApproval(drive)}
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden="true" />
                          Submit
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setRoundsTarget(drive)}>
                        <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
                        Rounds
                      </Button>
                      {drive.status === 'draft' && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(drive)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                      )}
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
        open={formOpen}
        title={editing ? `Edit ${editing.title}` : 'Create a drive'}
        description="The drive is saved as a draft and becomes visible only after the placement cell publishes it."
        onClose={() => setFormOpen(false)}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {editing ? 'Save changes' : 'Save draft'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Drive title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
            <Input
              label="Role designation"
              value={form.role_designation}
              onChange={(event) => setForm({ ...form, role_designation: event.target.value })}
              required
            />
            <Input
              label="Application deadline"
              type="datetime-local"
              value={form.application_deadline}
              onChange={(event) => setForm({ ...form, application_deadline: event.target.value })}
              required
            />
            <Select
              label="Job type"
              value={form.job_type}
              onChange={(event) => setForm({ ...form, job_type: event.target.value })}
            >
              <option value="full_time">Full time</option>
              <option value="internship">Internship</option>
            </Select>
            <Select
              label="Drive mode"
              value={form.drive_mode}
              onChange={(event) => setForm({ ...form, drive_mode: event.target.value })}
            >
              <option value="on_campus">On campus</option>
              <option value="off_campus">Off campus</option>
              <option value="online">Online</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Min package"
                type="number"
                min="0"
                value={form.package_min}
                onChange={(event) => setForm({ ...form, package_min: event.target.value })}
              />
              <Input
                label="Max package"
                type="number"
                min="0"
                value={form.package_max}
                onChange={(event) => setForm({ ...form, package_max: event.target.value })}
              />
            </div>
          </div>

          <Textarea
            label="Role description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />

          <fieldset className="rounded-lg border border-navy-200 p-4">
            <legend className="px-1 text-sm font-semibold text-navy-700">
              Eligibility criteria
            </legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <Input
                label="Minimum CGPA"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={form.min_cgpa}
                onChange={(event) => setForm({ ...form, min_cgpa: event.target.value })}
              />
              <Input
                label="Max active backlogs"
                type="number"
                min="0"
                value={form.max_active_backlogs}
                onChange={(event) => setForm({ ...form, max_active_backlogs: event.target.value })}
              />
              <Input
                label="Earliest graduation year"
                type="number"
                value={form.min_graduation_year}
                onChange={(event) => setForm({ ...form, min_graduation_year: event.target.value })}
              />
              <Input
                label="Latest graduation year"
                type="number"
                value={form.max_graduation_year}
                onChange={(event) => setForm({ ...form, max_graduation_year: event.target.value })}
              />
            </div>

            <p className="mt-4 text-sm font-medium text-navy-700">Required skills</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {skillOptions.map((skill) => (
                <label
                  key={skill.id}
                  className="inline-flex items-center gap-2 text-sm text-navy-700"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={(event) =>
                      setSelectedSkills((current) =>
                        event.target.checked
                          ? [...current, skill.id]
                          : current.filter((id) => id !== skill.id),
                      )
                    }
                  />
                  {skill.name}
                </label>
              ))}
            </div>
          </fieldset>

          <Textarea
            label="Eligibility notes (shown to students)"
            rows={2}
            value={form.eligibility_notes}
            onChange={(event) => setForm({ ...form, eligibility_notes: event.target.value })}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(roundsTarget)}
        title={roundsTarget ? `Interview rounds - ${roundsTarget.title}` : ''}
        description="Rounds define the stages an applicant passes through. They are ordered by sequence."
        onClose={() => setRoundsTarget(null)}
        size="lg"
      >
        {roundsTarget && (
          <div className="space-y-5">
            {roundRows.length === 0 ? (
              <p className="text-sm text-navy-500">No rounds defined for this drive yet.</p>
            ) : (
              <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200">
                {roundRows.map((round) => (
                  <li key={round.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-navy-900">
                        {round.sequence}. {round.name}
                      </p>
                      {round.description && (
                        <p className="text-xs text-navy-500">{round.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{round.interview_count} interview(s)</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={roundBusy}
                        onClick={() => removeRound(round)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form className="space-y-3 rounded-lg bg-navy-50 p-4" onSubmit={createRound}>
              <p className="text-sm font-semibold text-navy-700">Add a round</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input
                  label="Round name"
                  className="sm:col-span-2"
                  value={newRound.name}
                  onChange={(event) => setNewRound({ ...newRound, name: event.target.value })}
                  required
                />
                <Input
                  label="Sequence"
                  type="number"
                  min="1"
                  value={newRound.sequence}
                  onChange={(event) => setNewRound({ ...newRound, sequence: event.target.value })}
                  required
                />
                <div className="flex items-end">
                  <Button type="submit" loading={roundBusy} className="w-full">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>
              </div>
              <Input
                label="Description"
                value={newRound.description}
                onChange={(event) =>
                  setNewRound({ ...newRound, description: event.target.value })
                }
              />
            </form>
          </div>
        )}
      </Modal>
    </>
  );
}
