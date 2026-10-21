import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { studentApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/format.js';

/**
 * A single student record with the placement officer's account controls.
 */
export default function StudentDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useApi(() => studentApi.detail(id), [id]);
  const { data: skills } = useApi(() => studentApi.studentSkills(id), [id]);

  const skillRows = Array.isArray(skills) ? skills : skills?.results ?? [];

  async function toggleActive(action) {
    setBusy(true);
    try {
      await studentApi.setActive(id, action);
      toast.success(`Student account ${action}d.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading the student record..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={`${data.full_name}`}
        description={`${data.roll_number} - ${data.department_name}`}
        breadcrumbs={['Placement cell', 'Student directory', data.full_name]}
        actions={
          <>
            <Link to="/admin/students">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to directory
              </Button>
            </Link>
            {data.placed ? (
              <Badge variant="success">Placed</Badge>
            ) : (
              <Badge variant="neutral">Not placed yet</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Academic record" />
          <CardBody className="space-y-3 text-sm">
            <Row label="E-mail" value={data.email} />
            <Row label="Department" value={`${data.department_name} (${data.department_code})`} />
            <Row label="CGPA" value={data.cgpa} />
            <Row label="Active backlogs" value={data.active_backlogs} />
            <Row label="Graduation year" value={data.graduation_year} />
            <Row label="Current semester" value={data.current_semester} />
            <Row label="Phone" value={data.phone || '—'} />
            <Row label="Applications" value={data.application_count} />
            <Row
              label="Profile status"
              value={
                data.is_profile_complete ? 'Complete' : 'Incomplete - not eligible for restricted drives'
              }
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Skills on the profile"
            description="Skills used by the eligibility engine when a drive lists requirements."
          />
          {skillRows.length === 0 ? (
            <CardBody className="text-sm text-slate-500">No skills listed.</CardBody>
          ) : (
            <Table
              columns={[
                { key: 'skill', header: 'Skill' },
                { key: 'level', header: 'Proficiency' },
                { key: 'certified', header: 'Certified' },
              ]}
            >
              {skillRows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-slate-900">{row.skill_name}</Td>
                  <Td>{row.proficiency_level}/5</Td>
                  <Td>
                    {row.is_certified ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="neutral">No</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Account controls"
          description="Deactivating a student blocks new sign-ins without deleting the academic record."
        />
        <CardBody className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Every control action is written to the audit trail.
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => toggleActive('activate')}
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Activate account
            </Button>
            <Button variant="danger" loading={busy} onClick={() => toggleActive('deactivate')}>
              <UserX className="h-4 w-4" aria-hidden="true" />
              Deactivate account
            </Button>
          </div>
        </CardBody>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Record created {formatDateTime(data.created_at)}.
      </p>
    </>
  );
}

/** Label / value pair used inside the detail card. */
function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
