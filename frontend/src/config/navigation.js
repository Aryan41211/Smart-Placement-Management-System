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
 *
 * Each role gets its links split into labelled sections so the sidebar reads
 * as a hierarchy rather than a flat list of twenty items.
 */
export const NAVIGATION = {
  student: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard }],
    },
    {
      section: 'Placement',
      items: [
        { label: 'Open Drives', to: '/student/drives', icon: Briefcase },
        { label: 'Eligibility Checker', to: '/student/eligibility', icon: ShieldCheck },
        { label: 'My Applications', to: '/student/applications', icon: FileText },
        { label: 'My Interviews', to: '/student/interviews', icon: CalendarClock },
      ],
    },
    {
      section: 'My Profile',
      items: [
        { label: 'My Skills', to: '/student/skills', icon: Sparkles },
        { label: 'My Profile', to: '/student/profile', icon: UserCircle },
      ],
    },
  ],
  recruiter: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', to: '/recruiter/dashboard', icon: LayoutDashboard }],
    },
    {
      section: 'Recruitment',
      items: [
        { label: 'My Drives', to: '/recruiter/drives', icon: Briefcase },
        { label: 'Applicants', to: '/recruiter/applications', icon: Users },
        { label: 'Interviews', to: '/recruiter/interviews', icon: CalendarClock },
      ],
    },
    {
      section: 'Organisation',
      items: [{ label: 'Company Profile', to: '/recruiter/company', icon: Building2 }],
    },
  ],
  admin: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }],
    },
    {
      section: 'People',
      items: [
        { label: 'Students', to: '/admin/students', icon: Users },
        { label: 'Recruiters', to: '/admin/recruiters', icon: UserCheck },
      ],
    },
    {
      section: 'Recruitment',
      items: [
        { label: 'Companies', to: '/admin/companies', icon: Building2 },
        { label: 'Placement Drives', to: '/admin/drives', icon: Briefcase },
        { label: 'Applications', to: '/admin/applications', icon: FileText },
      ],
    },
    {
      section: 'Insights',
      items: [
        { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
        { label: 'Audit Trail', to: '/admin/audit-logs', icon: ScrollText },
      ],
    },
  ],
};

/** Links that are shown for every authenticated role. */
export const COMMON_NAVIGATION = [
  { section: 'Workspace', items: [{ label: 'Notifications', to: '/notifications', icon: Bell }] },
  {
    section: 'Account',
    items: [{ label: 'Profile & Security', to: '/profile', icon: Settings }],
  },
];

/** Return the navigation entries for a role, grouped into sections. */
export function navigationFor(role) {
  const primary = NAVIGATION[role] ?? [];
  return [...primary, ...COMMON_NAVIGATION];
}

/** Return a flat list of navigation entries for a role. */
export function flatNavigationFor(role) {
  return navigationFor(role).flatMap((group) => group.items);
}

/** Return the landing route for a role. */
export function homeRouteFor(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'recruiter') return '/recruiter/dashboard';
  return '/student/dashboard';
}

/**
 * Titles for the top bar, keyed by route. A route without an entry falls back
 * to a title derived from the last URL segment.
 */
export const PAGE_TITLES = {
  '/student/dashboard': 'Student dashboard',
  '/student/drives': 'Open placement drives',
  '/student/eligibility': 'Eligibility checker',
  '/student/applications': 'My applications',
  '/student/interviews': 'My interviews',
  '/student/skills': 'My skills',
  '/student/profile': 'My profile',
  '/admin/dashboard': 'Placement dashboard',
  '/admin/students': 'Student directory',
  '/admin/companies': 'Company directory',
  '/admin/recruiters': 'Recruiter approvals',
  '/admin/drives': 'Placement drives',
  '/admin/applications': 'Application pipeline',
  '/admin/reports': 'Reports & analytics',
  '/admin/audit-logs': 'Audit trail',
  '/recruiter/dashboard': 'Recruiter dashboard',
  '/recruiter/drives': 'Our job drives',
  '/recruiter/applications': 'Applicant tracker',
  '/recruiter/interviews': 'Interview schedule',
  '/recruiter/company': 'Company profile',
  '/notifications': 'Notifications',
  '/profile': 'Profile & security',
};

/** Return the human readable title of the current route. */
export function titleForPath(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const segment = pathname.split('/').filter(Boolean).pop() || 'Dashboard';
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Return the breadcrumb trail for the current route. */
export function breadcrumbsFor(pathname) {
  const trail = [];
  if (pathname.startsWith('/student')) trail.push('Student portal');
  if (pathname.startsWith('/admin')) trail.push('Placement cell');
  if (pathname.startsWith('/recruiter')) trail.push('Recruiter portal');
  if (trail.length) trail.push(titleForPath(pathname));
  return trail;
}
