'use client';

import type { ReactNode } from 'react';
import Modal from '@/app/components/Modal';
import type { ImmisMember } from '@/lib/api/immis';

function formatDate(iso: string | undefined | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,140px)_1fr] gap-1 sm:gap-3 py-2 border-b border-gray-100 last:border-0 text-sm">
      <dt className="text-gray-500 font-medium">{label}</dt>
      <dd className="text-gray-900 break-words">{value ?? '—'}</dd>
    </div>
  );
}

export type LinkedUser = { user_id: string; name: string; phone: string | null };

export default function ImmisMemberDetailModal({
  open,
  onClose,
  member,
  loading,
  linkedUser,
  canLink,
  onLinkUser,
  onUnlink,
}: {
  open: boolean;
  onClose: () => void;
  member: ImmisMember | null;
  loading?: boolean;
  linkedUser?: LinkedUser | null;
  canLink?: boolean;
  onLinkUser?: () => void;
  onUnlink?: () => void;
}) {
  if (!member && !open) return null;

  const m = member;

  return (
    <Modal open={open} onClose={onClose} title={m ? `Member #${m.id}` : 'Member details'} maxWidth="max-w-2xl">
      {loading && <div className="py-8 text-center text-sm text-gray-500">Loading latest details…</div>}
      {!loading && !m && <div className="py-8 text-center text-sm text-gray-500">No member selected.</div>}
      {m && (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Member</h3>
            <dl>
              <DetailRow label="Member ID" value={m.id} />
              <DetailRow label="Type" value={m.type} />
              <DetailRow label="Gender" value={m.gender} />
              <DetailRow label="Cluster" value={m.cluster} />
              <DetailRow label="Disability" value={m.disability || '—'} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Representative</h3>
            <dl>
              <DetailRow label="Name" value={m.representative_name} />
              <DetailRow label="Title" value={m.representative_title} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Registration & documents</h3>
            <dl>
              <DetailRow label="Document type" value={m.document_type} />
              <DetailRow label="Document number" value={m.document_number} />
              <DetailRow label="RCA number" value={m.rca_number} />
              <DetailRow label="Certificate issued" value={formatDate(m.certificate_issued_at)} />
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Contact</h3>
            <dl>
              <DetailRow label="Phone" value={m.phone} />
              <DetailRow label="Email" value={m.email} />
            </dl>
          </section>

          {m.organization && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Organization</h3>
              <dl>
                <DetailRow label="Name" value={m.organization.name} />
                <DetailRow label="Abbreviation" value={m.organization.abbreviation} />
                <DetailRow label="Phone" value={m.organization.phone} />
                <DetailRow label="Email" value={m.organization.email} />
              </dl>
            </section>
          )}

          {m.location && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Location</h3>
              <dl>
                <DetailRow label="Name" value={m.location.name} />
                <DetailRow label="Type" value={m.location.type} />
                {m.location.parent && <DetailRow label="Parent" value={`${m.location.parent.name} (${m.location.parent.type})`} />}
              </dl>
            </section>
          )}

          {m.group && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Group</h3>
              <dl>
                <DetailRow label="Name" value={m.group.name} />
              </dl>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Gemura user</h3>
            <dl>
              <DetailRow label="Linked account" value={linkedUser ? linkedUser.name : 'Not linked'} />
              {linkedUser?.phone && <DetailRow label="Phone" value={linkedUser.phone} />}
            </dl>
            {canLink && (onLinkUser || onUnlink) && (
              <div className="mt-2">
                {linkedUser ? (
                  <button
                    type="button"
                    onClick={onUnlink}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                  >
                    Unlink user
                  </button>
                ) : (
                  <button type="button" onClick={onLinkUser} className="btn btn-primary text-sm">
                    Link to Gemura user
                  </button>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Record</h3>
            <dl>
              <DetailRow label="Created" value={formatDate(m.created_at)} />
              <DetailRow label="Updated" value={formatDate(m.updated_at)} />
            </dl>
          </section>
        </div>
      )}
    </Modal>
  );
}

