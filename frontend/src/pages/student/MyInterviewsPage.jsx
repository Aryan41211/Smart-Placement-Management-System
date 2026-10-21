import { useState } from 'react';
import { CalendarClock, MapPin, Video } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import { interviewApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDateTime } from '../../utils/format.js';

/**
 * The interviews scheduled for the authenticated student.
 */
export default function MyInterviewsPage() {
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const { data, loading, error, reload } = useApi(
    () => interviewApi.mine(upcomingOnly ? { upcoming: 'true' } : {}),
    [upcomingOnly],
  );

  const interviews = Array.isArray(data) ? data : data?.results ?? [];

  return (
    <>
      <PageHeader
        title="My interviews"
        description="Rounds scheduled by the recruiting company, with the recorded outcome."
        actions={
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(event) => setUpcomingOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Upcoming only
          </label>
        }
      />

      {loading && <LoadingState label="Loading your interviews..." />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          {interviews.length === 0 ? (
            <Card className="md:col-span-2">
              <EmptyState
                icon={CalendarClock}
                title="No interviews scheduled"
                description="When a recruiter schedules a round you will be notified immediately."
              />
            </Card>
          ) : (
            interviews.map((interview) => (
              <Card key={interview.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{interview.round_name}</p>
                      <p className="text-sm text-slate-500">
                        {interview.job_drive_title} &middot; {interview.job_drive_company}
                      </p>
                    </div>
                    <StatusBadge status={interview.status} />
                  </div>

                  <dl className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <dd>
                        {formatDateTime(interview.scheduled_at)} &middot;{' '}
                        {interview.duration_minutes} min
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      <dd className="capitalize">
                        {interview.mode}
                        {interview.venue ? ` - ${interview.venue}` : ''}
                      </dd>
                    </div>
                    {interview.meeting_link && (
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <dd>
                          <a
                            href={interview.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="link-base break-all"
                          >
                            {interview.meeting_link}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {interview.outcome && (
                    <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Outcome</p>
                      <div className="mt-1">
                        <StatusBadge status={interview.outcome} />
                      </div>
                      {interview.feedback && (
                        <p className="mt-2 text-sm text-slate-600">{interview.feedback}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge variant="neutral">Round {interview.round_sequence}</Badge>
                    <Badge variant="info">{interview.application_status}</Badge>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  );
}
