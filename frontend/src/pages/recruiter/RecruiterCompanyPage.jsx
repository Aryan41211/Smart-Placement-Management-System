import { Building2, Globe, Mail, MapPin, Phone, ShieldCheck, ShieldOff } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { companyApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate } from '../../utils/format.js';

/**
 * The company profile of the signed-in recruiter.
 *
 * Company records are edited by the placement cell, so this screen is a
 * read-only view of the organisation the recruiter represents.
 */
export default function RecruiterCompanyPage() {
  const { user } = useAuth();
  const profile = user?.recruiter_profile ?? null;
  const companyId = profile?.company ?? null;

  const { data, loading, error, reload } = useApi(
    () => (companyId ? companyApi.detail(companyId) : Promise.resolve(null)),
    [companyId],
    { enabled: Boolean(companyId) },
  );
  const { data: drives } = useApi(
    () => (companyId ? companyApi.drives(companyId) : Promise.resolve([])),
    [companyId],
    { enabled: Boolean(companyId) },
  );

  if (!companyId) {
    return (
      <>
        <PageHeader title="Company" />
        <Card>
          <EmptyState
            icon={Building2}
            title="No company linked"
            description="Your recruiter account is not linked to a company yet. Contact the placement cell."
          />
        </Card>
      </>
    );
  }

  if (loading) return <LoadingState label="Loading your company profile..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const driveRows = Array.isArray(drives) ? drives : drives?.results ?? [];

  return (
    <>
      <PageHeader
        title={data?.name ?? 'Company'}
        description="The organisation your recruiter account represents on campus."
        actions={
          <Badge variant={profile.is_authorized ? 'success' : 'warning'}>
            {profile.is_authorized ? 'Authorised recruiter' : 'Awaiting authorisation'}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Company details" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Industry" value={data?.industry?.replace(/_/g, ' ') ?? '—'} />
            <Row
              label="Location"
              value={
                data?.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {data.location}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="Website"
              value={
                data?.website ? (
                  <a
                    href={data.website}
                    target="_blank"
                    rel="noreferrer"
                    className="link-base inline-flex items-center gap-1.5"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    Visit
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="HR e-mail"
              value={
                data?.hr_contact_email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {data.hr_contact_email}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="HR phone"
              value={
                data?.hr_contact_phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {data.hr_contact_phone}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row
              label="Status"
              value={data?.is_active ? 'Active' : 'Inactive'}
            />
            <Row label="Recruiters" value={data?.recruiter_count ?? '—'} />
            <Row label="Total drives" value={data?.drive_count ?? '—'} />
            <Row label="Onboarded" value={data?.created_at ? formatDate(data.created_at) : '—'} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Your authorisation"
            description="What the placement cell has granted your account."
          />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              {profile.is_authorized ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <ShieldOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
              )}
              <span className="text-slate-700">
                {profile.is_authorized
                  ? 'You can create drives and manage applicants for this company.'
                  : 'You can browse drives, but creating drives is disabled until approved.'}
              </span>
            </div>
            <Row
              label="Can post jobs"
              value={profile.can_post_jobs ? 'Yes' : 'No'}
            />
            <Row label="Designation" value={profile.designation || '—'} />
            <Row label="Contact phone" value={profile.phone || '—'} />
            <p className="text-xs text-slate-400">
              Company details are maintained by the placement cell. Contact them to update the
              profile.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Company drives"
          description="Every drive published under this company, newest first."
        />
        {driveRows.length === 0 ? (
          <CardBody className="text-sm text-slate-500">No drives created yet.</CardBody>
        ) : (
          <Table
            columns={[
              { key: 'drive', header: 'Drive' },
              { key: 'role', header: 'Role' },
              { key: 'status', header: 'Status' },
              { key: 'applications', header: 'Applications' },
            ]}
          >
            {driveRows.map((drive) => (
              <Tr key={drive.id}>
                <Td className="font-medium text-slate-900">{drive.title}</Td>
                <Td className="text-slate-500">{drive.role_designation}</Td>
                <Td>
                  <StatusBadge status={drive.status} />
                </Td>
                <Td>{drive.application_count}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/** Label / value pair used inside the detail cards. */
function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right capitalize text-slate-700">{value}</dd>
    </div>
  );
}
