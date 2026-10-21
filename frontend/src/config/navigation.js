import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  FileText,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCircle,
  Users,
} from 'lucide-react';

/**
 * Role based navigation.
 *
 * The sidebar is a convenience only - the backend enforces every rule, so
 * hiding a link never grants or removes an ability.
 */
export const NAVIGATION = {
  student: [
    { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Placement Drives', to: '/student/drives', icon: Briefcase },
    { label: 'Eligibility Checker', to: '/student/eligibility', icon: ShieldCheck },
    { label: 'My Applications', to: '/student/applications', icon: FileText },
    { label: 'My Interviews', to: '/student/interviews', icon: CalendarClock },
    { label: 'My Skills', to: '/student/skills', icon: Sparkles },
    { label: 'My Profile', to: '/student/profile', icon: UserCircle },
  ],
  recruiter: [
    { label: 'Dashboard', to: '/recruiter/dashboard', icon: LayoutDashboard },
    { label: 'My Drives', to: '/recruiter/drives', icon: Briefcase },
    { label: 'Applicants', to: '/recruiter/applications', icon: Users },
    { label: 'Interviews', to: '/recruiter/interviews', icon: CalendarClock },
    { label: 'Company', to: '/recruiter/company', icon: Building2 },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Students', to: '/admin/students', icon: Users },
    { label: 'Companies', to: '/admin/companies', icon: Building2 },
    { label: 'Recruiters', to: '/admin/recruiters', icon: UserCheck },
    { label: 'Placement Drives', to: '/admin/drives', icon: Briefcase },
    { label: 'Applications', to: '/admin/applications', icon: FileText },
    { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
    { label: 'Audit Trail', to: '/admin/audit-logs', icon: ScrollText },
  ],
};

/** Links that are shown for every authenticated role. */
export const COMMON_NAVIGATION = [
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Profile & Security', to: '/profile', icon: Settings },
];

/** Return the navigation entries for a role. */
export function navigationFor(role) {
  return [...(NAVIGATION[role] ?? []), ...COMMON_NAVIGATION];
}

/** Return the landing route for a role. */
export function homeRouteFor(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'recruiter') return '/recruiter/dashboard';
  return '/student/dashboard';
}
