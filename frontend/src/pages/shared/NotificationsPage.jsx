import { useState } from 'react';
import { Bell, CheckCheck, Inbox, Megaphone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/Loading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Field.jsx';
import { useApi } from '../../hooks/useApi.js';
import { notificationApi } from '../../api/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatRelative } from '../../utils/format.js';

const KIND_TONES = {
  application: 'info',
  interview: 'brand',
  result: 'success',
  drive: 'warning',
  announcement: 'neutral',
  general: 'neutral',
};

/**
 * In-app notification centre.
 */
export default function NotificationsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({
    title: '',
    message: '',
    audience: 'all',
    kind: 'announcement',
  });
  const [sending, setSending] = useState(false);

  const { data, loading, error, reload } = useApi(
    () => notificationApi.list(unreadOnly ? { is_read: 'false', page_size: 50 } : { page_size: 50 }),
    [unreadOnly],
  );

  const notifications = Array.isArray(data) ? data : data?.results ?? [];

  async function handleMarkAll() {
    try {
      const result = await notificationApi.markAllRead();
      toast.success(`${result.marked_read} notification(s) marked as read.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleMarkRead(id) {
    try {
      await notificationApi.markRead(id);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleBroadcast(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await notificationApi.broadcast(broadcast);
      toast.success(`Notice delivered to ${result.delivered} account(s).`);
      setBroadcastOpen(false);
      setBroadcast({ title: '', message: '', audience: 'all', kind: 'announcement' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every status change, interview invitation and campus notice lands here."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleMarkAll}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setBroadcastOpen(true)}>
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                Broadcast notice
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-navy-600">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
            className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500"
          />
          Show unread only
        </label>
      </div>

      {loading && <LoadingState label="Loading notifications..." />}

      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <Card>
          {notifications.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No notifications"
              description="You will be notified here when an application moves forward or a drive is published."
            />
          ) : (
            <ul className="divide-y divide-navy-100">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 px-5 py-4 ${item.is_read ? 'bg-white' : 'bg-brand-50/40'}`}
                >
                  <span className="mt-0.5 rounded-lg bg-white p-2 text-brand-600 shadow-sm">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-navy-900">{item.title}</p>
                      <Badge variant={KIND_TONES[item.kind] ?? 'neutral'}>{item.kind}</Badge>
                      {!item.is_read && <Badge variant="danger">New</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-navy-600">{item.message}</p>
                    <p className="mt-1 text-xs text-navy-400">{formatRelative(item.created_at)}</p>
                  </div>
                  {!item.is_read && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkRead(item.id)}>
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={broadcastOpen}
        title="Broadcast a campus notice"
        description="The notice is delivered to every account in the selected audience."
        onClose={() => setBroadcastOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBroadcast} loading={sending}>
              Send notice
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleBroadcast}>
          <Input
            label="Title"
            value={broadcast.title}
            onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })}
            required
          />
          <Textarea
            label="Message"
            value={broadcast.message}
            onChange={(event) => setBroadcast({ ...broadcast, message: event.target.value })}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Audience"
              value={broadcast.audience}
              onChange={(event) => setBroadcast({ ...broadcast, audience: event.target.value })}
            >
              <option value="all">Everyone</option>
              <option value="students">Students only</option>
              <option value="recruiters">Recruiters only</option>
            </Select>
            <Select
              label="Kind"
              value={broadcast.kind}
              onChange={(event) => setBroadcast({ ...broadcast, kind: event.target.value })}
            >
              <option value="announcement">Announcement</option>
              <option value="general">General</option>
              <option value="drive">Drive</option>
            </Select>
          </div>
          <CardBody className="rounded-lg bg-navy-50 p-3 text-xs text-navy-500">
            The broadcast is written to the audit trail of the placement cell.
          </CardBody>
        </form>
      </Modal>
    </>
  );
}
