import { useState } from 'react';
import type { WeeklyPlan } from '../../types';
import { buildShareText, buildShortSummary } from '../../lib/shareContent';
import { Button } from '../shared/Button';

interface ShareSheetProps {
  plan: WeeklyPlan;
}

export function ShareSheet({ plan }: ShareSheetProps) {
  const [status, setStatus] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleNativeShare() {
    try {
      await navigator.share({ title: 'Grocery plan', text: buildShareText(plan) });
    } catch {
      // user cancelled the share sheet — not an error
    }
  }

  function handleEmail() {
    const subject = encodeURIComponent('Grocery plan');
    const body = encodeURIComponent(buildShortSummary(plan));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    setStatus('Generating PDF…');
    try {
      const { generatePlanPdf } = await import('../../lib/pdf');
      await generatePlanPdf(plan);
      setStatus(null);
    } catch {
      setStatus('Could not generate PDF.');
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-warm">
      <h3 className="mb-3 text-sm font-semibold text-stone-700">Share your shopping list</h3>
      <div className="flex flex-wrap gap-2">
        {canNativeShare && (
          <Button variant="secondary" onClick={handleNativeShare}>
            Share…
          </Button>
        )}
        <Button variant="secondary" onClick={handleEmail}>
          Email (summary)
        </Button>
        <Button variant="secondary" onClick={handleDownloadPdf}>
          Download PDF
        </Button>
        <Button variant="secondary" onClick={handlePrint}>
          Print
        </Button>
      </div>
      {status && <p className="mt-2 text-xs text-stone-500">{status}</p>}
      {!canNativeShare && (
        <p className="mt-2 text-xs text-stone-400">
          Native share (Mail, Messages, AirDrop, etc.) isn't available in this browser — try on a mobile device, or
          use Email/PDF/Print above.
        </p>
      )}
    </div>
  );
}
