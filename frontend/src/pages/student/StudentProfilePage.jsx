import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Input, Textarea } from '../../components/ui/Field.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import { studentApi } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';

/**
 * The student edits their own academic profile and links.
 */
export default function StudentProfilePage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => studentApi.me(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      phone: data.phone ?? '',
      cgpa: data.cgpa ?? '',
      active_backlogs: data.active_backlogs ?? 0,
      graduation_year: data.graduation_year ?? '',
      current_semester: data.current_semester ?? '',
      resume_url: data.resume_url ?? '',
      portfolio_url: data.portfolio_url ?? '',
      linkedin_url: data.linkedin_url ?? '',
      bio: data.bio ?? '',
    });
  }, [data]);

  if (loading) return <LoadingState label="Loading your profile..." />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!form) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await studentApi.updateMe({
        phone: form.phone,
        cgpa: form.cgpa === '' ? null : Number(form.cgpa),
        active_backlogs: Number(form.active_backlogs || 0),
        graduation_year: Number(form.graduation_year),
        current_semester: Number(form.current_semester || 1),
        resume_url: form.resume_url,
        portfolio_url: form.portfolio_url,
        linkedin_url: form.linkedin_url,
        bio: form.bio,
      });
      toast.success('Profile updated.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My profile"
        description="Keep your academic record current - the eligibility engine reads these fields."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Identity" />
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">Full name</p>
              <p className="mt-1 font-medium text-navy-900">{data.user.full_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">E-mail</p>
              <p className="mt-1 text-navy-700">{data.user.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">Roll number</p>
              <p className="mt-1 text-navy-700">{data.roll_number}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">Department</p>
              <p className="mt-1 text-navy-700">
                {data.department_name} ({data.department_code})
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">Profile status</p>
              <div className="mt-1">
                <Badge variant={data.is_profile_complete ? 'success' : 'warning'}>
                  {data.is_profile_complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-400">Last updated</p>
              <p className="mt-1 text-navy-700">{formatDate(data.updated_at)}</p>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Academic record and links"
            description="CGPA, backlogs and graduation year decide your eligibility for a drive."
          />
          <CardBody>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="CGPA"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={form.cgpa}
                  onChange={(event) => setForm({ ...form, cgpa: event.target.value })}
                />
                <Input
                  label="Active backlogs"
                  type="number"
                  min="0"
                  max="50"
                  value={form.active_backlogs}
                  onChange={(event) => setForm({ ...form, active_backlogs: event.target.value })}
                />
                <Input
                  label="Graduation year"
                  type="number"
                  value={form.graduation_year}
                  onChange={(event) => setForm({ ...form, graduation_year: event.target.value })}
                />
                <Input
                  label="Current semester"
                  type="number"
                  min="1"
                  max="12"
                  value={form.current_semester}
                  onChange={(event) => setForm({ ...form, current_semester: event.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <Input
                  label="Resume link"
                  type="url"
                  placeholder="https://example.invalid/resume.pdf"
                  value={form.resume_url}
                  onChange={(event) => setForm({ ...form, resume_url: event.target.value })}
                  hint="A link to an externally hosted PDF - the portal stores the URL only."
                />
                <Input
                  label="Portfolio link"
                  type="url"
                  placeholder="https://example.invalid/portfolio"
                  value={form.portfolio_url}
                  onChange={(event) => setForm({ ...form, portfolio_url: event.target.value })}
                />
                <Input
                  label="LinkedIn link"
                  type="url"
                  placeholder="https://www.linkedin.com/in/example"
                  value={form.linkedin_url}
                  onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })}
                />
              </div>

              <Textarea
                label="Short bio"
                rows={4}
                maxLength={1000}
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
                placeholder="A short summary recruiters see on the applicant list."
              />

              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                Save profile
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
