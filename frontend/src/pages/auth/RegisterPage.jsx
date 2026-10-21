import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Field.jsx';
import { studentApi } from '../../api/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CURRENT_YEAR = new Date().getFullYear();

const schema = z
  .object({
    full_name: z.string().min(3, 'Enter your full name.'),
    email: z.string().min(1, 'E-mail address is required.').email('Enter a valid e-mail address.'),
    roll_number: z
      .string()
      .min(2, 'Roll number is required.')
      .max(20, 'Roll number must be 20 characters or fewer.')
      .regex(/^[A-Za-z0-9]+$/, 'Roll number may only contain letters and digits.'),
    department: z.string().min(1, 'Select your department.'),
    cgpa: z.coerce
      .number({ invalid_type_error: 'CGPA must be a number.' })
      .min(0, 'CGPA cannot be negative.')
      .max(10, 'CGPA cannot exceed 10.'),
    active_backlogs: z.coerce.number().int().min(0).max(50).default(0),
    graduation_year: z.coerce
      .number()
      .int()
      .min(1950, 'Enter a valid graduation year.')
      .max(2200, 'Enter a valid graduation year.'),
    current_semester: z.coerce.number().int().min(1).max(12).default(1),
    phone: z.string().max(20).optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long.')
      .regex(/[A-Za-z]/, 'Password must contain a letter.')
      .regex(/\d/, 'Password must contain a digit.'),
    password_confirm: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.password_confirm, {
    path: ['password_confirm'],
    message: 'Passwords do not match.',
  });

/**
 * Student self-registration.
 *
 * Placement officer and recruiter accounts are provisioned by the placement
 * cell, so only students can use this screen.
 */
export default function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    let cancelled = false;
    studentApi
      .departments()
      .then((result) => {
        if (!cancelled) setDepartments(Array.isArray(result) ? result : result?.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      roll_number: '',
      department: '',
      cgpa: '',
      active_backlogs: 0,
      graduation_year: CURRENT_YEAR + 1,
      current_semester: 1,
      phone: '',
      password: '',
      password_confirm: '',
    },
  });

  async function onSubmit(values) {
    setServerError('');
    try {
      await registerAccount({
        ...values,
        department: Number(values.department),
        cgpa: Number(values.cgpa),
        active_backlogs: Number(values.active_backlogs),
        graduation_year: Number(values.graduation_year),
        current_semester: Number(values.current_semester),
      });
      navigate('/student/dashboard', { replace: true });
    } catch (error) {
      setServerError(error.message || 'Registration failed.');
    }
  }

  return (
    <AuthLayout
      title="Create a student account"
      subtitle="The placement cell verifies every academic detail before publishing drives."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="link-base">
            Sign in
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
          label="Full name"
          placeholder="Aarav Sharma"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Input
          label="E-mail address"
          type="email"
          placeholder="aarav@example.invalid"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Roll number"
            placeholder="CSE2026"
            error={errors.roll_number?.message}
            {...register('roll_number')}
          />
          <Select
            label="Department"
            error={errors.department?.message}
            {...register('department')}
          >
            <option value="">Select a department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="CGPA"
            type="number"
            step="0.01"
            min="0"
            max="10"
            placeholder="8.50"
            error={errors.cgpa?.message}
            {...register('cgpa')}
          />
          <Input
            label="Backlogs"
            type="number"
            min="0"
            max="50"
            error={errors.active_backlogs?.message}
            {...register('active_backlogs')}
          />
          <Input
            label="Graduation year"
            type="number"
            error={errors.graduation_year?.message}
            {...register('graduation_year')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Current semester"
            type="number"
            min="1"
            max="12"
            error={errors.current_semester?.message}
            {...register('current_semester')}
          />
          <Input
            label="Phone (optional)"
            placeholder="+91 90000 00000"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={errors.password_confirm?.message}
            {...register('password_confirm')}
          />
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
