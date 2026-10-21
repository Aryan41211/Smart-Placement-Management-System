import { useState } from 'react';
import { CheckCircle2, Search, ShieldCheck, XCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Select } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import { driveApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency } from '../../utils/format.js';

/**
 * Standalone eligibility checker.
 *
 * The student picks a drive and the server explains, in words, exactly which
 * criterion fails - or confirms that every criterion passes.
 */
export default function EligibilityCheckerPage() {
  const toast = useToast();
  const [driveId, setDriveId] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const { data, loading, error, reload } = useApi(
    () => driveApi.list({ status: 'published', ordering: 'application_deadline', page_size: 100 }),
    [],
  );

  const drives = Array.isArray(data) ? data : data?.results ?? [];
  const selected = drives.find((drive) => String(drive.id) === String(driveId));

  async function handleCheck(event) {
    event.preventDefault();
    if (!driveId) return;
    setChecking(true);
    setResult(null);
    try {
      const payload = await driveApi.eligibility(driveId);
      setResult(payload);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Eligibility checker"
        description="Test yourself against a drive before you apply. The verdict is computed on the server."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Choose a drive" />
          <CardBody>
            <form className="space-y-4" onSubmit={handleCheck}>
              <Select
                label="Placement drive"
                value={driveId}
                onChange={(event) => {
                  setDriveId(event.target.value);
                  setResult(null);
                }}
                required
              >
                <option value="">Select a drive</option>
                {drives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    {drive.title} - {drive.company_name}
                  </option>
                ))}
              </Select>
              <Button type="submit" loading={checking} className="w-full">
                <Search className="h-4 w-4" aria-hidden="true" />
                Check eligibility
              </Button>
            </form>

            {selected && (
              <div className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <p className="font-medium text-slate-800">{selected.title}</p>
                <p className="text-slate-600">{selected.company_name}</p>
                <p className="text-slate-500">
                  Package {formatCurrency(selected.package_min, { compact: true })} -{' '}
                  {formatCurrency(selected.package_max, { compact: true })}
                </p>
                <p className="text-slate-500">
                  Minimum CGPA {selected.min_cgpa ?? 'none'} &middot; Backlogs allowed{' '}
                  {selected.max_active_backlogs ?? 'not considered'}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Result" description="Every criterion the server evaluated." />
          <CardBody>
            {loading && <LoadingState label="Loading drives..." />}
            {!loading && error && <ErrorState error={error} onRetry={reload} />}

            {!loading && !error && !result && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <ShieldCheck className="h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm text-slate-500">
                  Select a drive and run the check to see the server side verdict.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-5">
                <div
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    result.eligible
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  {result.eligible ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-6 w-6 text-rose-600" aria-hidden="true" />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      result.eligible ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                  >
                    {result.eligible
                      ? 'You satisfy every requirement of this drive.'
                      : 'You do not satisfy every requirement of this drive yet.'}
                  </p>
                </div>

                {result.messages?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">What the engine checked</p>
                    <ul className="mt-2 space-y-2">
                      {result.messages.map((message) => (
                        <li key={message} className="flex gap-2 text-sm text-slate-600">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                          {message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.eligible && (
                  <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Every criterion passed. You can submit an application from the placement drives
                    screen.
                  </div>
                )}

                {result.reasons?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Reason codes</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.reasons.map((reason) => (
                        <Badge key={reason} variant="danger">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.details && Object.keys(result.details).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Evaluation details</p>
                    <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(result.details).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                          <dt className="text-xs uppercase tracking-wide text-slate-400">
                            {key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="mt-0.5 break-words text-slate-700">
                            {Array.isArray(value) ? value.join(', ') || 'none' : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
