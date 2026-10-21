import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  Building2,
  CalendarClock,
  FileText,
  IndianRupee,
  Target,
  TrendingUp,
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
import { formatCurrency, formatDateTime, humanise } from '../../utils/format.js';

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
 * Placement officer dashboard built from the backend aggregation service.
 */
export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useApi(() => reportApi.dashboard(), []);
  const { data: funnel } = useApi(() => reportApi.funnel(), []);
  const { data: departments } = useApi(() => reportApi.departments(), []);
  const { data: analytics } = useApi(() => reportApi.analytics(), []);

  if (loading) return <LoadingState label="Loading the placement dashboard..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const funnelRows = Array.isArray(funnel) ? funnel : [];
  const departmentRows = Array.isArray(departments) ? departments : [];
  const activity = analytics?.recent_activity ?? [];

  return (
    <>
      <PageHeader
        title="Placement dashboard"
        description={`Live snapshot generated at ${formatDateTime(data.generated_at)}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={data.total_students}
          hint={`${data.eligible_students} graduating this year or later`}
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="Companies"
          value={data.total_companies}
          hint={`${data.total_drives} drive(s) created in total`}
          icon={Building2}
          tone="brand"
        />
        <StatCard
          label="Active drives"
          value={data.active_drives}
          hint="Published with an open deadline"
          icon={Briefcase}
          tone="emerald"
        />
        <StatCard
          label="Applications"
          value={data.total_applications}
          hint={`${data.scheduled_interviews} interview(s) scheduled`}
          icon={FileText}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Placed students"
          value={data.placed_students}
          hint={`${data.unplaced_students} still seeking placement`}
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label="Placement rate"
          value={`${data.placement_rate}%`}
          hint="Selected students over total students"
          icon={Target}
          tone="brand"
        />
        <StatCard
          label="Average package"
          value={data.average_package ? formatCurrency(data.average_package, { compact: true }) : '—'}
          hint="Across all selected offers"
          icon={IndianRupee}
          tone="emerald"
        />
        <StatCard
          label="Interviews"
          value={data.scheduled_interviews}
          hint="Rounds currently scheduled"
          icon={CalendarClock}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Application funnel"
            description="How many applications sit in each stage of the pipeline."
          />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelRows} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status" tickFormatter={humanise} fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {funnelRows.map((entry) => (
                      <Cell key={entry.status} fill={FUNNEL_COLOURS[entry.status] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Placement by department"
            description="Placed students against the department strength."
          />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentRows.map((row) => ({
                      name: row.department_code,
                      value: row.placed_count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {departmentRows.map((row, index) => (
                      <Cell
                        key={row.department_id}
                        fill={['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'][index % 6]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent activity"
          description="The latest status changes recorded in the recruitment pipeline."
        />
        {activity.length === 0 ? (
          <CardBody className="text-sm text-slate-500">No activity recorded yet.</CardBody>
        ) : (
          <Table
            columns={[
              { key: 'student', header: 'Student' },
              { key: 'drive', header: 'Drive' },
              { key: 'change', header: 'Change' },
              { key: 'by', header: 'Changed by' },
              { key: 'when', header: 'When' },
            ]}
          >
            {activity.map((row) => (
              <Tr key={`${row.application_id}-${row.changed_at}`}>
                <Td className="font-medium text-slate-900">
                  {row.student_name}
                  <span className="block text-xs font-normal text-slate-400">{row.roll_number}</span>
                </Td>
                <Td>
                  {row.job_drive}
                  <span className="block text-xs text-slate-400">{row.company}</span>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={row.from_status} />
                    <TrendingUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <StatusBadge status={row.to_status} />
                  </span>
                </Td>
                <Td className="text-slate-500">{row.changed_by}</Td>
                <Td className="whitespace-nowrap text-slate-500">{formatDateTime(row.changed_at)}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
