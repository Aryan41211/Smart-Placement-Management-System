/**
 * Client-side mirror of the backend recruitment state machine.
 *
 * The map only decides which buttons are *offered*. The authoritative check
 * lives in `applications.services.ALLOWED_TRANSITIONS`; a stale client can
 * never force an illegal transition because the server rejects it.
 */
export const APPLICATION_TRANSITIONS = {
  applied: ['under_review', 'shortlisted', 'rejected', 'withdrawn'],
  under_review: ['shortlisted', 'interview', 'rejected', 'withdrawn'],
  shortlisted: ['interview', 'selected', 'not_selected', 'rejected', 'withdrawn'],
  interview: ['selected', 'not_selected', 'rejected', 'withdrawn'],
  selected: [],
  rejected: [],
  withdrawn: [],
  not_selected: [],
};

/** Statuses that end the pipeline. */
export const TERMINAL_STATUSES = ['selected', 'rejected', 'withdrawn', 'not_selected'];

/** Human readable labels for the application statuses. */
export const APPLICATION_STATUS_LABELS = {
  applied: 'Applied',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  selected: 'Selected',
  rejected: 'Rejected',
  not_selected: 'Not selected',
  withdrawn: 'Withdrawn',
};

/** Return the statuses a given status may legally move to. */
export function transitionsFor(status) {
  return APPLICATION_TRANSITIONS[status] ?? [];
}
