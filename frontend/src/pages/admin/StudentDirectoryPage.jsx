import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Filter, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import SearchInput from '../../components/common/SearchInput.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Table, Td, Tr } from '../../components/ui/Table.jsx';
import { reportApi, studentApi } from '../../api/endpoints.js';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';

const PAGE_SIZE = 20;

/**
 * The administrative student directory with server side filters.
 */
export default function StudentDirectoryPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [placed, setPlaced] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');
  const debouncedSearch = useDebounced(search);

  const params = {
    page,
    page_size: PAGE_SIZE,
    ordering: 'roll_number',
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (department) params.department = department;
  if (placed) params.placed = placed;
  if (minCgpa) params.min_cgpa = minCgpa;
  if (maxCgpa) params.max_cgpa = maxCgpa;

  const { data, loading, error, reload } = useApi(() => studentApi.directory(params), [page, debouncedSearch, department, placed, minCgpa, maxCgpa]);
  const { data: departments } = useApi(() => studentApi.departments(), []);

  const rows = data?.results ?? [];
  const departmentRows = Array.isArray(departments) ? departments : departments?.results ?? [];

  function resetFilters() {
    setSearch('');
    setDepartment('');
    setPlaced('');
    setMinCgpa('');
    setMaxCgpa('');
    setPage(1);
  }

  async function handleExport() {
    try {
      await reportApi.download('students', 'students.csv');
      toast.success('Student directory exported.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Student directory"
        description="Every student registered with the placement cell, filterable by department, CGPA and placement status."
        actions={
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Roll number, name or e-mail"
            className="xl:col-span-2"
          />
          <Select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departmentRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
          <Select
            value={placed}
            onChange={(event) => {
              setPlaced(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by placement status"
          >
            <option value="">Placed and unplaced</option>
            <option value="true">Placed only</option>
            <option value="false">Unplaced only</option>
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="Min CGPA"
            value={minCgpa}
            onChange={(event) => {
              setMinCgpa(event.target.value);
              setPage(1);
            }}
            aria-label="Minimum CGPA"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="Max CGPA"
            value={maxCgpa}
            onChange={(event) => {
              setMaxCgpa(event.target.value);
              setPage(1);
            }}
            aria-label="Maximum CGPA"
          />
        </div>
        <div className="flex items-center justify-between border-t border-navy-200 px-4 py-2">
          <p className="text-xs text-navy-500">
            <Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {data?.count ?? 0} student(s) matched
          </p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      </Card>

      {loading && <LoadingState label="Loading the student directory..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students matched"
              description="Adjust the filters or clear them to see the full directory."
            />
          ) : (
            <Table
              columns={[
                { key: 'roll', header: 'Roll number' },
                { key: 'name', header: 'Student' },
                { key: 'department', header: 'Department' },
                { key: 'cgpa', header: 'CGPA' },
                { key: 'backlogs', header: 'Backlogs' },
                { key: 'year', header: 'Graduation' },
                { key: 'applications', header: 'Applications' },
                { key: 'status', header: 'Placement' },
                { key: 'actions', header: '' },
              ]}
            >
              {rows.map((student) => (
                <Tr key={student.id}>
                  <Td className="font-mono text-xs text-navy-500">{student.roll_number}</Td>
                  <Td className="font-medium text-navy-900">
                    {student.full_name}
                    <span className="block text-xs font-normal text-navy-400">{student.email}</span>
                  </Td>
                  <Td>
                    {student.department_code}
                    <span className="block text-xs text-navy-400">{student.department_name}</span>
                  </Td>
                  <Td>{student.cgpa}</Td>
                  <Td>{student.active_backlogs}</Td>
                  <Td>{student.graduation_year}</Td>
                  <Td>{student.application_count}</Td>
                  <Td>
                    {student.placed ? (
                      <Badge variant="success">Placed</Badge>
                    ) : (
                      <Badge variant="neutral">Unplaced</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link to={`/admin/students/${student.id}`} className="link-base text-sm">
                      View
                    </Link>
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
    </>
  );
}
