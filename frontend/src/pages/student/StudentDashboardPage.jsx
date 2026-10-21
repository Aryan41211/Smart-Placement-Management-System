import { Link } from 'react-router-dom';
import {
  Award,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
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
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { applicationApi, reportApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDateTime } from '../../utils/format.js';

const PIPELINE_COLOURS = {
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
 * Student dashboard.
 *
 * Every number on this screen is produced by the backend aggregation service;
 * the client only formats what the API returns.
 */
export default function StudentDashboardPage() {
  const { data, loading, error, reload } = useApi(() => reportApi.dashboard(), []);
  const { data: applications } = useApi(() => applicationApi.mine(), []);
  const { data: summary } = useApi(() => applicationApi.summary(), []);

  if (loading) return <LoadingState label="Loading your dashboard..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const rows = Array.isArray(applications) ? applications : [];
  const funnel = (summary?.counts ?? []).map((row) => ({
    status: row.status,
    count: row.count,
  }));

  return (
    <>
      <PageHeader
        title="Your placement dashboard"
        description={`Live snapshot generated at ${formatDateTime(data.generated_at)}.`}
        actions={
          <Link to="/student/drives">
            <Button size="sm">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
              Browse drives
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Eligible drives"
          value={data.eligible_drives}
          hint={`${data.total_drives_open} drive(s) open right now`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <StatCard
          label="Applications"
          value={data.total_applications}
          hint={`${data.applications_in_progress} still in progress`}
          icon={FileText}
          tone="sky"
        />
        <StatCard
          label="Shortlisted"
          value={data.shortlisted}
          hint={`${data.interviews} at interview stage`}
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          label="Interviews"
          value={data.scheduled_interviews}
          hint="Scheduled for the future"
          icon={CalendarClock}
          tone="amber"
        />
      </div>

      {data.is_placed && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <p className="text-sm font-medium text-emerald-800">
            Congratulations - you have been selected. Your offer details are visible on the
            application record.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Your recent applications"
            description="The five most recent submissions and their current stage."
            action={
              <Link to="/student/applications" className="link-base text-sm">
                View all
              </Link>
            }
          />
          {rows.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No applications yet"
              description="Browse the placement drives and apply to the ones you are eligible for."
            />
          ) : (
            <Table
              columns={[
                { key: 'drive', header: 'Drive' },
                { key: 'company', header: 'Company' },
                { key: 'status', header: 'Status' },
                { key: 'applied', header: 'Applied on' },
              ]}
            >
              {rows.slice(0, 5).map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium text-slate-900">{row.job_drive_title}</Td>
                  <Td>{row.job_drive_company}</Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatDateTime(row.applied_at)}
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Pipeline snapshot" description="Where your applications stand today." />
          <CardBody>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="status" width={92} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnel.map((entry) => (
                      <Cell key={entry.status} fill={PIPELINE_COLOURS[entry.status] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
