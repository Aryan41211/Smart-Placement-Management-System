import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Field.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeRouteFor } from '../../config/navigation.js';

const schema = z.object({
  email: z.string().min(1, 'E-mail address is required.').email('Enter a valid e-mail address.'),
  password: z.string().min(1, 'Password is required.'),
});

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
      title="Sign in"
      subtitle="Use the account issued by your placement cell."
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
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {serverError}
          </div>
        )}

        <Input
          label="E-mail address"
          type="email"
          autoComplete="email"
          placeholder="you@example.invalid"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" className="w-full" loading={isSubmitting}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
