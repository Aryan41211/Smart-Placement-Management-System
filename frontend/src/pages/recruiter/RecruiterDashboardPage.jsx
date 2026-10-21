import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  IndianRupee,
  UserCheck,
  Users,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { reportApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { formatCurrency, formatDate, humanise } from '../../utils/format.js';

const FUNNEL_COLOURS = {
  applied: '#0ea5e9',
  under_review: '#f59e0b',
  shortlisted: '#6366f1',
  interview: '#8b5cf6',
  selected: '#10b981',
  rejected: '#f43f5e',
  not_selected: '#fb7185',
  withdrawn: '#94a3b8',
};

/**
 * Recruiter dashboard scoped to the signed-in recruiter's own company.
 */
export default function RecruiterDashboardPage() {
  const { data, loading, error, reload } = useApi(() => reportApi.dashboard(), []);
  const { data: analytics } = useApi(() => reportApi.analytics(), []);

  if (loading) return <LoadingState label="Loading your recruitment dashboard..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const funnel = analytics?.funnel ?? [];
  const drives = analytics?.drives ?? [];
  const packages = analytics?.packages ?? {};

  return (
    <>
      <PageHeader
        title={`${data.company_name ?? 'Your company'} recruitment dashboard`}
        description="Live counters for your drives, applicants and scheduled interviews."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total drives"
          value={data.total_drives}
          hint={`${data.active_drives} currently open, ${data.draft_drives} draft`}
          icon={Briefcase}
          tone="brand"
        />
        <StatCard
          label="Applicants"
          value={data.total_applicants}
          hint={`${data.shortlisted} shortlisted so far`}
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="In interview"
          value={data.in_interview}
          hint={`${data.interviews_scheduled} round(s) scheduled`}
          icon={CalendarClock}
          tone="amber"
        />
        <StatCard
          label="Selected"
          value={data.selected}
          hint={`${data.rejected} not progressed`}
          icon={UserCheck}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Offers recorded"
          value={packages.count ?? 0}
          hint="Selected candidates with a package"
          icon={CheckCircle2}
          tone="brand"
        />
        <StatCard
          label="Average offer"
          value={packages.average ? formatCurrency(packages.average, { compact: true }) : '—'}
          hint="Across your recorded offers"
          icon={IndianRupee}
          tone="emerald"
        />
        <StatCard
          label="Open applications"
          value={funnel.find((row) => row.status === 'applied')?.count ?? 0}
          hint="Awaiting your first review"
          icon={FileText}
          tone="amber"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Applicant funnel"
          description="Where your applicants currently sit in the pipeline."
        />
        <CardBody>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="status"
                  tickFormatter={humanise}
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnel.map((entry) => (
                    <Cell key={entry.status} fill={FUNNEL_COLOURS[entry.status] ?? '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Your drives" description="Applications and selections per drive." />
        {drives.length === 0 ? (
          <CardBody className="text-sm text-navy-500">
            You have not created a drive yet.
          </CardBody>
        ) : (
          <Table
            columns={[
              { key: 'drive', header: 'Drive' },
              { key: 'status', header: 'Status' },
              { key: 'deadline', header: 'Deadline' },
              { key: 'applications', header: 'Applications' },
              { key: 'shortlisted', header: 'Shortlisted' },
              { key: 'selected', header: 'Selected' },
            ]}
          >
            {drives.map((drive) => (
              <Tr key={drive.drive_id}>
                <Td className="font-medium text-navy-900">{drive.title}</Td>
                <Td>
                  <StatusBadge status={drive.status} />
                </Td>
                <Td className="whitespace-nowrap text-navy-500">{formatDate(drive.deadline)}</Td>
                <Td>{drive.application_count}</Td>
                <Td>{drive.shortlisted_count}</Td>
                <Td>{drive.selected_count}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
