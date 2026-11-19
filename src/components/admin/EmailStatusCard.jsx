import React, { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from '../ui/Button';
import { EASE } from '../../theme/motion';

const MODE_LABEL = { brevo: 'Brevo API', smtp: 'Gmail SMTP' };

// The status line fades in when the server answers, and again whenever the state changes (on, off, failing)
const statusIn = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.25, ease: EASE.out } } };

/** Admin overview: shows how booking emails are sent, and sends a test to the signed-in admin. */
export default function EmailStatusCard() {
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/admin/email-status').then(({ data }) => setStatus(data)).catch(() => setStatus({ error: true }));
  }, []);

  const sendTest = async () => {
    setSending(true);
    try {
      const { data } = await api.post('/admin/test-email');
      setStatus(data.status);
      toast.success(data.message);
    } catch (err) {
      if (err.response?.data?.status) setStatus(err.response.data.status);
      toast.error(err.response?.data?.message || 'Could not send the test email');
    } finally {
      setSending(false);
    }
  };

  const last = status?.lastSend;
  const state = !status ? null : status.error ? 'unknown' : !status.mode ? 'off' : last?.ok === false ? 'failing' : 'on';
  const dot = { on: 'bg-[#1E8E4E]', failing: 'bg-danger', off: 'bg-muted', unknown: 'bg-muted' }[state] || 'bg-muted';

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-chip border border-line bg-surface p-5" aria-label="Email">
      <div className="flex min-w-0 items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className={`h-2 w-2 rounded-full transition-colors duration-300 ease-out ${dot}`} aria-hidden="true" />
            Booking emails{' '}
            {state === 'on' && <m.span key="on" {...statusIn} className="font-normal text-muted">· {MODE_LABEL[status.mode]} from {status.sender}</m.span>}
            {state === 'off' && <m.span key="off" {...statusIn} className="font-normal text-muted">· off</m.span>}
            {state === 'failing' && <m.span key="failing" {...statusIn} className="font-normal text-danger">· last send failed</m.span>}
          </p>
          <m.p key={state || 'checking'} {...statusIn} className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">
            {state === 'off' && 'Not set up on the server, so customers get no confirmations. See DEPLOY.md, "Booking emails".'}
            {state === 'failing' && last.error}
            {state === 'on' && (last?.ok ? `Last sent ${new Date(last.at).toLocaleString('en-IN')}.` : 'Send a test to check delivery.')}
            {state === 'unknown' && 'Could not read the email status.'}
          </m.p>
        </div>
      </div>
      <Button variant="secondary" size="sm" loading={sending} onClick={sendTest} disabled={state === 'off'}>
        Send test email
      </Button>
    </section>
  );
}
