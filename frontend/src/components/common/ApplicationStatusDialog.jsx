import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { Input, Select, Textarea } from '../ui/Field.jsx';
import StatusBadge from './StatusBadge.jsx';
import { APPLICATION_STATUS_LABELS, transitionsFor } from '../../config/applicationStatus.js';

/**
 * Dialog used by placement officers and recruiters to move an application
 * through the recruitment pipeline.
 *
 * Only the transitions the backend permits are offered; the server still
 * validates the request, so the client cannot bypass the state machine.
 *
 * @param {object} props component props
 */
export default function ApplicationStatusDialog({
  open,
  application,
  loading = false,
  onSubmit,
  onClose,
}) {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [offerPackage, setOfferPackage] = useState('');

  const options = application ? transitionsFor(application.status) : [];

  useEffect(() => {
    if (open) {
      setNewStatus(options[0] ?? '');
      setReason('');
      setOfferPackage(application?.offer_package ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application?.id]);

  function handleSubmit() {
    if (!newStatus) return;
    const payload = { new_status: newStatus, reason };
    if (newStatus === 'selected' && offerPackage !== '') {
      payload.offer_package = Number(offerPackage);
    }
    onSubmit(payload);
  }

  return (
    <Modal
      open={open}
      title="Update application status"
      description={
        application
          ? `${application.student_name} - ${application.job_drive_title}`
          : ''
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!newStatus}>
            Apply transition
          </Button>
        </>
      }
    >
      {application && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-navy-50 px-4 py-3 text-sm text-navy-600">
            <span className="text-xs uppercase tracking-wide text-navy-400">Current</span>
            <StatusBadge status={application.status} />
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-navy-500">
              This application has reached a terminal state and cannot be moved any further.
            </p>
          ) : (
            <>
              <Select
                label="Move to"
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
              >
                {options.map((status) => (
                  <option key={status} value={status}>
                    {APPLICATION_STATUS_LABELS[status] ?? status}
                  </option>
                ))}
              </Select>

              <Textarea
                label="Reason (stored in the history trail)"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Shared with the student for rejection or withdrawal."
              />

              {newStatus === 'selected' && (
                <Input
                  label="Offer package (INR)"
                  type="number"
                  min="0"
                  value={offerPackage}
                  onChange={(event) => setOfferPackage(event.target.value)}
                  hint="Recorded on the application and shown to the student."
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
