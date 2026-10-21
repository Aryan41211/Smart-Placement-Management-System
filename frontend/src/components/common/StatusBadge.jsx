import Badge from '../ui/Badge.jsx';
import { humanise } from '../../utils/format.js';

const VARIANTS = {
  // Application pipeline
  applied: 'info',
  under_review: 'warning',
  shortlisted: 'brand',
  interview: 'brand',
  selected: 'success',
  rejected: 'danger',
  not_selected: 'danger',
  withdrawn: 'neutral',
  // Drive lifecycle
  draft: 'neutral',
  published: 'success',
  closed: 'slate',
  cancelled: 'danger',
  // Interview lifecycle
  scheduled: 'info',
  completed: 'success',
  // Outcomes
  passed: 'success',
  failed: 'danger',
  pending: 'warning',
  // Generic
  approved: 'success',
  rejected_status: 'danger',
  authorised: 'success',
  unauthorised: 'danger',
  active: 'success',
  inactive: 'neutral',
};

/**
 * Renders a backend status value with a consistent colour.
 *
 * @param {object} props component props
 */
export default function StatusBadge({ status, className = '' }) {
  const key = String(status || '').toLowerCase();
  return (
    <Badge variant={VARIANTS[key] ?? 'neutral'} className={className}>
      {humanise(status)}
    </Badge>
  );
}
