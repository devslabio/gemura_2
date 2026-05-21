'use client';

import { useState } from 'react';
import Modal from '@/app/components/Modal';
import { isViewableDataUrl } from './onboardingDocumentUtils';

type Props = {
  label: string;
  fileName?: string;
  dataUrl?: string;
  mimeType?: string;
  compact?: boolean;
};

export default function OnboardingDocumentViewer({ label, fileName, dataUrl, mimeType, compact }: Props) {
  const [open, setOpen] = useState(false);
  const canView = Boolean(dataUrl && isViewableDataUrl(dataUrl));
  const isPdf = (mimeType || dataUrl || '').includes('pdf');
  const displayName = fileName || label;

  if (!canView) {
    return (
      <span className="text-sm text-gray-500">
        {displayName ? (
          <>
            <span className="text-gray-700">{displayName}</span>
            <span className="block text-xs text-amber-700 mt-0.5">No preview stored (uploaded before file save was enabled)</span>
          </>
        ) : (
          '—'
        )}
      </span>
    );
  }

  return (
    <>
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
        <span className="text-sm text-gray-700 truncate max-w-[200px]" title={displayName}>
          {displayName}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-[#004AAD] hover:underline"
        >
          View
        </button>
        {!compact && !isPdf && (
          <img
            src={dataUrl}
            alt={label}
            className="max-h-24 rounded border border-gray-200 object-contain bg-gray-50"
          />
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={label} maxWidth="max-w-4xl">
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{displayName}</p>
          {isPdf ? (
            <iframe
              src={dataUrl}
              title={label}
              className="w-full h-[70vh] min-h-[320px] rounded border border-gray-200 bg-gray-50"
            />
          ) : (
            <img
              src={dataUrl}
              alt={label}
              className="max-w-full max-h-[70vh] mx-auto rounded border border-gray-200 object-contain"
            />
          )}
        </div>
      </Modal>
    </>
  );
}
