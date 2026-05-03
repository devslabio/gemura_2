'use client';

import GateArrivalsPanel from '@/app/(authenticated)/collections/GateArrivalsPanel';

export default function OperationsGatePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gate arrivals</h1>
        <p className="text-sm text-gray-600 mt-1">Log bulk milk arrivals at the MCC gate before manifests or collections.</p>
      </div>
      <GateArrivalsPanel />
    </div>
  );
}
