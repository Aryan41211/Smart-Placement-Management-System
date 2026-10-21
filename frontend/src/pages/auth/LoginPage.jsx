import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, LogIn, Mail, UserRound } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeRouteFor } from '../../config/navigation.js';

const schema = z.object({
  email: z.string().min(1, 'E-mail address is required.').email('Enter a valid e-mail address.'),
  password: z.string().min(1, 'Password is required.'),
});

const ROLES = [
  { role: 'Placement officer', detail: 'Drives, students, reports', tone: 'brand' },
  { role: 'Student', detail: 'Apply & track applications', tone: 'sky' },
  { role: 'Recruiter', detail: 'Shortlist applicants', tone: 'violet' },
];

/**
 * Sign-in screen for every role.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      const user = await login(values);
      const target = location.state?.from || homeRouteFor(user.role);
      navigate(target, { replace: true });
    } catch (error) {
      setServerError(error.message || 'Sign in failed.');
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with the account issued by your placement cell."
      footer={
        <>
          New student?{' '}
          <Link to="/register" className="link-base">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[0.8125rem] text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        <Input
          label="E-mail address"
          type="email"
          autoComplete="email"
          placeholder="you@college.edu"
          leadingIcon={Mail}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          leadingIcon={UserRound}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </Button>
      </form>

      <div className="mt-6 border-t border-[var(--app-border)] pt-5">
        <p className="eyebrow mb-3">Demo roles</p>
        <ul className="space-y-2">
          {ROLES.map((item) => (
            <li key={item.role} className="flex items-center justify-between gap-3">
              <span className="text-[0.8125rem] font-medium text-navy-800">{item.role}</span>
              <span className="text-2xs text-navy-400">{item.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-2xs leading-relaxed text-navy-400">
          Demo accounts are created locally with{' '}
          <code className="rounded bg-navy-100 px-1 py-0.5 font-mono text-navy-600">
            python manage.py create_demo_users
          </code>
          . Passwords are never stored in this repository.
        </p>
      </div>
    </AuthLayout>
  );
}
