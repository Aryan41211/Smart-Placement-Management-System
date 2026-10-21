import { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Pencil,
  Plus,
  Send,
  XCircle,
} from 'lucide-react';
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
import { companyApi, driveApi, skillApi, studentApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  title: '',
  company: '',
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
 * Placement-cell management of every recruitment drive.
 *
 * The full lifecycle is available here: create a draft, publish it, close or
 * cancel it once the process ends. The backend validates every transition and
 * writes an audit entry for each one.
 */
export default function DriveManagementPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-created_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (status) params.status = status;
  if (company) params.company = company;

  const { data, loading, error, reload } = useApi(
    () => driveApi.list(params),
    [page, debouncedSearch, status, company],
  );
  const { data: companies } = useApi(() => companyApi.list({ page_size: 200, ordering: 'name' }), []);
  const { data: departments } = useApi(() => studentApi.departments(), []);
  const { data: skills } = useApi(() => skillApi.list({ page_size: 200, ordering: 'name' }), []);

  const rows = data?.results ?? [];
  const companyOptions = companies?.results ?? [];
  const departmentOptions = Array.isArray(departments) ? departments : departments?.results ?? [];
  const skillOptions = skills?.results ?? [];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedDepartments([]);
    setSelectedSkills([]);
    setFormOpen(true);
  }

  function openEdit(drive) {
    setEditing(drive);
    setForm({
      title: drive.title,
      company: String(drive.company),
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
    setSelectedDepartments(drive.allowed_departments ?? []);
    setSelectedSkills((drive.required_skills ?? []).map((entry) => entry.skill_id));
    setFormOpen(true);
  }

  function buildPayload() {
    const payload = {
      title: form.title,
      company: Number(form.company),
      role_designation: form.role_designation,
      description: form.description,
      job_type: form.job_type,
      drive_mode: form.drive_mode,
      package_min: form.package_min === '' ? 0 : Number(form.package_min),
      package_max: form.package_max === '' ? 0 : Number(form.package_max),
      allowed_departments: selectedDepartments,
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
        toast.success(`${payload.title} created as a draft.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTransition(drive, action) {
    setBusyId(drive.id);
    try {
      await action(drive.id);
      toast.success(`Drive "${drive.title}" updated.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Placement drives"
        description="Publish, monitor and retire every recruitment drive on campus."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New drive
          </Button>
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
            placeholder="Drive, role or company"
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
          <Select
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by company"
          >
            <option value="">All companies</option>
            {companyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading placement drives..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No placement drives"
              description="Create a drive, attach the eligibility criteria and publish it to the students."
            />
          ) : (
            <Table
              columns={[
                { key: 'drive', header: 'Drive' },
                { key: 'package', header: 'Package' },
                { key: 'deadline', header: 'Deadline' },
                { key: 'criteria', header: 'Criteria' },
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
                      {drive.company_name} &middot; {drive.role_designation}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatCurrency(drive.package_min, { compact: true })} -{' '}
                    {formatCurrency(drive.package_max, { compact: true })}
                  </Td>
                  <Td className="whitespace-nowrap text-navy-500">
                    {formatDateTime(drive.application_deadline)}
                  </Td>
                  <Td className="text-xs text-navy-500">
                    CGPA {drive.min_cgpa ?? 'any'} &middot; Backlogs{' '}
                    {drive.max_active_backlogs ?? 'any'}
                  </Td>
                  <Td>{drive.application_count}</Td>
                  <Td>
                    <StatusBadge status={drive.status} />
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {drive.status === 'draft' && (
                        <Button
                          variant="success"
                          size="sm"
                          loading={busyId === drive.id}
                          onClick={() => runTransition(drive, driveApi.publish)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Publish
                        </Button>
                      )}
                      {drive.status === 'published' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busyId === drive.id}
                          onClick={() => runTransition(drive, driveApi.close)}
                        >
                          Close
                        </Button>
                      )}
                      {!['cancelled', 'closed'].includes(drive.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === drive.id}
                          onClick={() => runTransition(drive, driveApi.cancel)}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Cancel
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(drive)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
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
        open={formOpen}
        title={editing ? `Edit ${editing.title}` : 'Create a placement drive'}
        description="Draft drives are invisible to students until a placement officer publishes them."
        onClose={() => setFormOpen(false)}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {editing ? 'Save changes' : 'Create draft'}
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
            <Select
              label="Company"
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              required
            >
              <option value="">Select a company</option>
              {companyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
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
            <Input
              label="Minimum package (INR)"
              type="number"
              min="0"
              value={form.package_min}
              onChange={(event) => setForm({ ...form, package_min: event.target.value })}
            />
            <Input
              label="Maximum package (INR)"
              type="number"
              min="0"
              value={form.package_max}
              onChange={(event) => setForm({ ...form, package_max: event.target.value })}
            />
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

            <p className="mt-4 text-sm font-medium text-navy-700">Allowed departments</p>
            <p className="text-xs text-navy-500">
              Leave all unchecked to open the drive to every department.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {departmentOptions.map((department) => (
                <label
                  key={department.id}
                  className="inline-flex items-center gap-2 text-sm text-navy-700"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedDepartments.includes(department.id)}
                    onChange={(event) =>
                      setSelectedDepartments((current) =>
                        event.target.checked
                          ? [...current, department.id]
                          : current.filter((id) => id !== department.id),
                      )
                    }
                  />
                  {department.code}
                </label>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium text-navy-700">Required skills</p>
            <p className="text-xs text-navy-500">
              The eligibility engine checks that the student lists each required skill.
            </p>
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

          {editing && (
            <div className="flex items-center gap-2 rounded-lg bg-navy-50 px-4 py-3 text-xs text-navy-500">
              <Badge variant="neutral">Current status</Badge>
              <StatusBadge status={editing.status} />
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
