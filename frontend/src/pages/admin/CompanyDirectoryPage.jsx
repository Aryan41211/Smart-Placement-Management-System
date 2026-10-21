import { useState } from 'react';
import { Building2, Mail, Pencil, Plus, Power } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Checkbox, Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { companyApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';

const PAGE_SIZE = 15;

/** Industry options mirroring ``Company.Industry`` on the backend. */
const INDUSTRIES = [
  { value: 'it', label: 'Information Technology' },
  { value: 'it_services', label: 'IT Services' },
  { value: 'product', label: 'Product & Startup' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'energy', label: 'Energy' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  name: '',
  industry: 'it',
  website: '',
  logo_url: '',
  location: '',
  description: '',
  hr_contact_email: '',
  hr_contact_phone: '',
  is_active: true,
};

/**
 * The placement cell's company directory.
 *
 * Companies can be added, edited and retired (deactivated) here. Drives that
 * already reference a company keep their history because the backend treats a
 * delete of a company with drives as a deactivation.
 */
export default function CompanyDirectoryPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const debouncedSearch = useDebounced(search);

  const params = { page, page_size: PAGE_SIZE, ordering: 'name' };
  if (debouncedSearch) params.search = debouncedSearch;
  if (industry) params.industry = industry;

  const { data, loading, error, reload } = useApi(
    () => companyApi.list(params),
    [page, debouncedSearch, industry],
  );

  const rows = data?.results ?? [];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(company) {
    setEditing(company);
    setForm({
      name: company.name,
      industry: company.industry,
      website: company.website || '',
      logo_url: company.logo_url || '',
      location: company.location || '',
      description: company.description || '',
      hr_contact_email: company.hr_contact_email || '',
      hr_contact_phone: company.hr_contact_phone || '',
      is_active: company.is_active,
    });
    setFormOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await companyApi.update(editing.id, form);
        toast.success(`${form.name} updated.`);
      } else {
        await companyApi.create(form);
        toast.success(`${form.name} added to the directory.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!target) return;
    setRemoving(true);
    try {
      await companyApi.remove(target.id);
      toast.success(`${target.name} retired from the directory.`);
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every recruiting organisation on campus, with the number of authorised recruiters and published drives."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add company
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
            placeholder="Company name, location or industry"
          />
          <Select
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by industry"
          >
            <option value="">All industries</option>
            {INDUSTRIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading && <LoadingState label="Loading the company directory..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add the first recruiting company to start publishing placement drives."
            />
          ) : (
            <Table
              columns={[
                { key: 'name', header: 'Company' },
                { key: 'industry', header: 'Industry' },
                { key: 'location', header: 'Location' },
                { key: 'contact', header: 'HR contact' },
                { key: 'recruiters', header: 'Recruiters' },
                { key: 'drives', header: 'Drives' },
                { key: 'status', header: 'Status' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((company) => (
                <Tr key={company.id}>
                  <Td className="font-medium text-slate-900">{company.name}</Td>
                  <Td className="capitalize">{company.industry.replace(/_/g, ' ')}</Td>
                  <Td className="text-slate-500">{company.location || '—'}</Td>
                  <Td className="text-slate-500">
                    {company.hr_contact_email ? (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {company.hr_contact_email}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{company.recruiter_count}</Td>
                  <Td>{company.drive_count}</Td>
                  <Td>
                    {company.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(company)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTarget(company)}>
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                        Retire
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
        title={editing ? `Edit ${editing.name}` : 'Add a company'}
        description="Company records are maintained by the placement cell."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Save changes' : 'Create company'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Company name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Select
              label="Industry"
              value={form.industry}
              onChange={(event) => setForm({ ...form, industry: event.target.value })}
            >
              {INDUSTRIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Bengaluru"
            />
            <Input
              label="Website"
              type="url"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              placeholder="https://example.com"
            />
            <Input
              label="HR contact e-mail"
              type="email"
              value={form.hr_contact_email}
              onChange={(event) => setForm({ ...form, hr_contact_email: event.target.value })}
            />
            <Input
              label="HR contact phone"
              value={form.hr_contact_phone}
              onChange={(event) => setForm({ ...form, hr_contact_phone: event.target.value })}
            />
          </div>
          <Input
            label="Logo URL"
            type="url"
            value={form.logo_url}
            onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
          />
          <Textarea
            label="About the company"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <Checkbox
            label="Company is active and may publish drives"
            checked={form.is_active}
            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(target)}
        title={`Retire ${target?.name ?? 'this company'}?`}
        description="A company with existing drives is deactivated rather than deleted so the recruitment history is preserved."
        confirmLabel="Retire company"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
