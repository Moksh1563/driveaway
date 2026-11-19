import React, { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Loader2, WifiOff, X } from 'lucide-react';
import api from '../../api/axios';
import { EASE } from '../../theme/motion';

const SLOW_AFTER = 3000; // the banner only appears when the ping is slower than this
const PING_TIMEOUT = 65000;

// The banner slides down from the top edge it hangs from and goes back up the same way, faster.
// The entrance is CSS (visible by default, never stranded at opacity 0 if the Framer chunk is slow
// or failed, which is exactly when this banner shows); only the exit needs Framer.
const BANNER_IN = 'animate-[rise_320ms_var(--ease-out)_backwards] [--rise:-24px]';
const bannerOut = { opacity: 0, y: -24, scale: 0.98, transition: { duration: 0.2, ease: EASE.in } };
// Waking → unreachable: the icon and message fade in place (CSS; keyed on the state so it replays)
const SWAP_IN = 'animate-[rise_200ms_var(--ease-out)_backwards] [--rise:0px]';

/**
 * The API runs on a free Render instance that sleeps when idle, so the first request after a quiet
 * spell can take up to a minute. On start the app pings /api/health; when it has not answered within
 * about three seconds this banner explains the wait. It never blocks the page and can be dismissed.
 */
export default function ServerWakeBanner() {
  const [state, setState] = useState('checking'); // checking | waking | awake | down
  const [run, setRun] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let settled = false;
    setState('checking');
    const slow = setTimeout(() => { if (!settled) setState('waking'); }, SLOW_AFTER);
    api.get('/health', { timeout: PING_TIMEOUT, signal: controller.signal })
      .then(() => { settled = true; setState('awake'); })
      .catch((err) => {
        settled = true;
        if (controller.signal.aborted) return;
        // Any HTTP answer (a 503 "degraded" included) means the server itself is awake
        setState(err.response?.status ? 'awake' : 'down');
      })
      .finally(() => clearTimeout(slow));
    return () => {
      controller.abort();
      clearTimeout(slow);
    };
  }, [run]);

  const show = !dismissed && (state === 'waking' || state === 'down');

  return (
    <AnimatePresence>
      {show && (
        <m.div
          exit={bannerOut}
          role="status"
          style={{ transformOrigin: 'top center' }}
          className={`fixed inset-x-4 top-[84px] z-[60] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-ink shadow-lift ${BANNER_IN}`}
        >
          <span key={`icon-${state}`} className={`mt-0.5 grid flex-shrink-0 ${SWAP_IN}`}>
            {state === 'waking'
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <WifiOff className="h-4 w-4" aria-hidden="true" />}
          </span>
          <p key={`text-${state}`} className={`flex-1 ${SWAP_IN}`}>
            {state === 'waking' ? (
              'Waking up the server: free hosting sleeps when idle, so this can take up to a minute.'
            ) : (
              <>
                Could not reach the server, so some pages may not load.{' '}
                <button type="button" onClick={() => setRun((r) => r + 1)} className="font-semibold underline">Try again</button>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="hit-area -my-1 -mr-1 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
