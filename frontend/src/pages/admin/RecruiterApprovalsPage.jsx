import { useState } from 'react';
import { Building2, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Checkbox, Input, Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { companyApi, recruiterApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  email: '',
  full_name: '',
  password: '',
  company: '',
  designation: '',
  phone: '',
  is_authorized: true,
  can_post_jobs: true,
};

/**
 * Placement-cell administration of recruiter accounts.
 *
 * A recruiter account is provisioned by the placement cell (there is no public
 * recruiter sign-up), then authorised against a single company.
 */
export default function RecruiterApprovalsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [authorised, setAuthorised] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: '-created_at' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (authorised) params.is_authorized = authorised;

  const { data, loading, error, reload } = useApi(
    () => recruiterApi.list(params),
    [page, debouncedSearch, authorised],
  );
  const { data: companies } = useApi(() => companyApi.list({ page_size: 100, ordering: 'name' }), []);

  const rows = data?.results ?? [];
  const companyOptions = companies?.results ?? [];

  async function handleProvision(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await recruiterApi.provision({ ...form, company: Number(form.company) });
      toast.success(`Recruiter ${form.email} provisioned.`);
      setFormOpen(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAuthorisation(recruiter) {
    setBusyId(recruiter.id);
    try {
      if (recruiter.is_authorized) {
        await recruiterApi.revoke(recruiter.id);
        toast.success(`${recruiter.email} is no longer authorised.`);
      } else {
        await recruiterApi.authorize(recruiter.id);
        toast.success(`${recruiter.email} authorised to manage drives.`);
      }
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
        title="Recruiters"
        description="Company accounts provisioned by the placement cell, with their drive-management authorisation."
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Provision recruiter
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Recruiter name, e-mail or company"
          />
          <Select
            value={authorised}
            onChange={(event) => {
              setAuthorised(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by authorisation"
          >
            <option value="">All recruiter accounts</option>
            <option value="true">Authorised only</option>
            <option value="false">Pending authorisation</option>
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading recruiter accounts..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No recruiter accounts"
              description="Provision a recruiter account for a company so it can post drives."
            />
          ) : (
            <Table
              columns={[
                { key: 'recruiter', header: 'Recruiter' },
                { key: 'company', header: 'Company' },
                { key: 'designation', header: 'Designation' },
                { key: 'post', header: 'Posting' },
                { key: 'authorisation', header: 'Authorisation' },
                { key: 'created', header: 'Provisioned' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((recruiter) => (
                <Tr key={recruiter.id}>
                  <Td className="font-medium text-slate-900">
                    {recruiter.full_name}
                    <span className="block text-xs font-normal text-slate-400">
                      {recruiter.email}
                    </span>
                  </Td>
                  <Td>{recruiter.company_name}</Td>
                  <Td className="text-slate-500">{recruiter.designation || '—'}</Td>
                  <Td>
                    {recruiter.can_post_jobs ? (
                      <Badge variant="info">Allowed</Badge>
                    ) : (
                      <Badge variant="neutral">Blocked</Badge>
                    )}
                  </Td>
                  <Td>
                    {recruiter.is_authorized ? (
                      <Badge variant="success">Authorised</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatDate(recruiter.created_at)}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant={recruiter.is_authorized ? 'ghost' : 'primary'}
                      size="sm"
                      loading={busyId === recruiter.id}
                      onClick={() => toggleAuthorisation(recruiter)}
                    >
                      {recruiter.is_authorized ? (
                        <>
                          <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                          Revoke
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Authorise
                        </>
                      )}
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
        open={formOpen}
        title="Provision a recruiter account"
        description="The account is created immediately; the recruiter can sign in with the password you set."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleProvision} loading={saving}>
              Create account
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleProvision}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              required
            />
            <Input
              label="Work e-mail"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
            <Input
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              hint="At least 8 characters and not entirely numeric."
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <Select
              label="Company"
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
              required
            >
              <option value="">Select a company</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
            <Input
              label="Designation"
              value={form.designation}
              onChange={(event) => setForm({ ...form, designation: event.target.value })}
              placeholder="Talent Acquisition Lead"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              label="Authorise to manage drives immediately"
              checked={form.is_authorized}
              onChange={(event) => setForm({ ...form, is_authorized: event.target.checked })}
            />
            <Checkbox
              label="Allow creating draft job postings"
              checked={form.can_post_jobs}
              onChange={(event) => setForm({ ...form, can_post_jobs: event.target.checked })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
