import { useState } from 'react';
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
import { BarChart3, Download, IndianRupee, Target, TrendingUp } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { reportApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDate, humanise } from '../../utils/format.js';

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

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

const EXPORTS = [
  { key: 'students', label: 'Student directory', filename: 'students.csv' },
  { key: 'applications', label: 'Application register', filename: 'applications.csv' },
  { key: 'companies', label: 'Company statistics', filename: 'company_statistics.csv' },
  { key: 'drives', label: 'Drive summary', filename: 'drive_summary.csv' },
];

/**
 * Placement analytics for the placement cell.
 *
 * Every figure comes from a SQL aggregation on the backend; nothing is
 * computed in the browser from raw rows.
 */
export default function ReportsAnalyticsPage() {
  const toast = useToast();
  const [downloading, setDownloading] = useState(null);
  const { data, loading, error, reload } = useApi(() => reportApi.analytics(), []);

  async function download(entry) {
    setDownloading(entry.key);
    try {
      await reportApi.download(entry.key, entry.filename);
      toast.success(`${entry.label} exported.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <LoadingState label="Crunching the placement analytics..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const departments = data?.departments ?? [];
  const companies = data?.companies ?? [];
  const funnel = data?.funnel ?? [];
  const topRecruiters = data?.top_recruiters ?? [];
  const drives = data?.drives ?? [];
  const packages = data?.packages ?? {};

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        description="Department, company and drive level placement performance, ready to export for the annual report."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Offers recorded"
          value={packages.count ?? 0}
          hint="Selected applications with a package"
          icon={Target}
          tone="brand"
        />
        <StatCard
          label="Average package"
          value={packages.average ? formatCurrency(packages.average, { compact: true }) : '—'}
          hint="Across every recorded offer"
          icon={IndianRupee}
          tone="emerald"
        />
        <StatCard
          label="Highest package"
          value={packages.highest ? formatCurrency(packages.highest, { compact: true }) : '—'}
          hint="Best offer on campus"
          icon={TrendingUp}
          tone="amber"
        />
        <StatCard
          label="Lowest package"
          value={packages.lowest ? formatCurrency(packages.lowest, { compact: true }) : '—'}
          hint="Entry level offer"
          icon={BarChart3}
          tone="sky"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="CSV exports"
          description="Downloads are generated server-side and sanitised against spreadsheet formula injection."
        />
        <CardBody className="flex flex-wrap gap-2">
          {EXPORTS.map((entry) => (
            <Button
              key={entry.key}
              variant="secondary"
              size="sm"
              loading={downloading === entry.key}
              onClick={() => download(entry)}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {entry.label}
            </Button>
          ))}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Application funnel"
            description="Applications currently sitting in each stage."
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

        <Card>
          <CardHeader
            title="Top recruiters"
            description="Companies that selected the most students."
          />
          <CardBody>
            {topRecruiters.length === 0 ? (
              <p className="text-sm text-navy-500">No offers recorded yet.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topRecruiters.map((row) => ({
                        name: row.company_name,
                        value: row.selected_count,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {topRecruiters.map((row, index) => (
                        <Cell key={row.company_id} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Placement by department"
          description="Placed students against the strength of each department."
        />
        <Table
          columns={[
            { key: 'department', header: 'Department' },
            { key: 'students', header: 'Students' },
            { key: 'applicants', header: 'Applicants' },
            { key: 'placed', header: 'Placed' },
            { key: 'rate', header: 'Placement rate' },
          ]}
        >
          {departments.map((row) => (
            <Tr key={row.department_id}>
              <Td className="font-medium text-navy-900">
                {row.department_code}
                <span className="block text-xs font-normal text-navy-400">
                  {row.department_name}
                </span>
              </Td>
              <Td>{row.student_count}</Td>
              <Td>{row.applicant_count}</Td>
              <Td>{row.placed_count}</Td>
              <Td>
                <Badge variant={row.placement_rate >= 50 ? 'success' : 'warning'}>
                  {row.placement_rate}%
                </Badge>
              </Td>
            </Tr>
          ))}
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Company performance"
          description="Applicants, selections and selection rate for every recruiting company."
        />
        <Table
          columns={[
            { key: 'company', header: 'Company' },
            { key: 'industry', header: 'Industry' },
            { key: 'drives', header: 'Drives' },
            { key: 'applicants', header: 'Applicants' },
            { key: 'selected', header: 'Selected' },
            { key: 'rate', header: 'Selection rate' },
          ]}
        >
          {companies.map((row) => (
            <Tr key={row.company_id}>
              <Td className="font-medium text-navy-900">{row.company_name}</Td>
              <Td className="capitalize text-navy-500">{row.industry.replace(/_/g, ' ')}</Td>
              <Td>{row.drive_count}</Td>
              <Td>{row.applicant_count}</Td>
              <Td>{row.selected_count}</Td>
              <Td>{row.selection_rate}%</Td>
            </Tr>
          ))}
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Drive summary"
          description="Applications, shortlists and selections for every drive."
        />
        <Table
          columns={[
            { key: 'drive', header: 'Drive' },
            { key: 'company', header: 'Company' },
            { key: 'status', header: 'Status' },
            { key: 'deadline', header: 'Deadline' },
            { key: 'applications', header: 'Applications' },
            { key: 'shortlisted', header: 'Shortlisted' },
            { key: 'selected', header: 'Selected' },
          ]}
        >
          {drives.map((row) => (
            <Tr key={row.drive_id}>
              <Td className="font-medium text-navy-900">{row.title}</Td>
              <Td>{row.company}</Td>
              <Td className="capitalize text-navy-500">{row.status}</Td>
              <Td className="whitespace-nowrap text-navy-500">{formatDate(row.deadline)}</Td>
              <Td>{row.application_count}</Td>
              <Td>{row.shortlisted_count}</Td>
              <Td>{row.selected_count}</Td>
            </Tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
