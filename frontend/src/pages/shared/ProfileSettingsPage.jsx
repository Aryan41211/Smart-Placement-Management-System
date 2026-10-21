import { useState } from 'react';
import { KeyRound, ShieldCheck, UserCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';

/**
 * Account overview and password change for every role.
 */
export default function ProfileSettingsPage() {
  const { user, role, changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Password updated.');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Profile & security"
        description="The account details issued by the placement cell and the password controls."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" description="Read only - maintained by the placement cell." />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <UserCircle className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-semibold text-navy-900">{user?.full_name}</p>
                <p className="text-sm text-navy-500">{user?.email}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Role</dt>
                <dd className="mt-1">
                  <Badge variant="brand">{role}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Member since</dt>
                <dd className="mt-1 text-navy-700">{formatDate(user?.date_joined)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Phone</dt>
                <dd className="mt-1 text-navy-700">{user?.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-navy-400">Status</dt>
                <dd className="mt-1">
                  <Badge variant="success">Active</Badge>
                </dd>
              </div>
            </dl>

            {user?.student_profile && (
              <div className="rounded-lg bg-navy-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-navy-700">
                  <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Student record
                </p>
                <p className="mt-2 text-sm text-navy-600">
                  Roll number {user.student_profile.roll_number} &middot;{' '}
                  {user.student_profile.department_name} &middot; CGPA{' '}
                  {user.student_profile.cgpa} &middot; {user.student_profile.active_backlogs} backlog(s)
                </p>
              </div>
            )}

            {user?.recruiter_profile && (
              <div className="rounded-lg bg-navy-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-navy-700">
                  <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Recruiter authorisation
                </p>
                <p className="mt-2 text-sm text-navy-600">
                  {user.recruiter_profile.company_name || 'No company assigned'} &middot;{' '}
                  {user.recruiter_profile.is_authorized ? 'Authorised' : 'Not authorised'}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Change password" description="Choose a password you have not used before." />
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                required
                value={form.current_password}
                onChange={(event) => setForm({ ...form, current_password: event.target.value })}
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                required
                value={form.new_password}
                onChange={(event) => setForm({ ...form, new_password: event.target.value })}
                hint="At least 8 characters with a letter and a digit."
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirm_password}
                onChange={(event) => setForm({ ...form, confirm_password: event.target.value })}
              />
              <Button type="submit" loading={saving}>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Update password
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
