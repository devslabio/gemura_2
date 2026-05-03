'use client';

import GateArrivalsPanel from '@/app/(authenticated)/collections/GateArrivalsPanel';

export default function OperationsGatePage() {
  return (
    <div className="space-y-4">
      <GateArrivalsPanel showPageHeading />
    </div>
  );
}
