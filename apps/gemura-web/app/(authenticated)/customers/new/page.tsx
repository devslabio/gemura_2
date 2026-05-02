'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import Icon, { faTimes } from '@/app/components/Icon';
import CreateCustomerForm from '../CreateCustomerForm';

export default function CreateCustomerPage() {
  const router = useRouter();
  const { currentAccount } = useAuthStore();
  const role = (currentAccount?.role ?? '').toLowerCase();
  const isReadOnlyTeamRole = role === 'agent' || role === 'collector' || role === 'veterinary' || role === 'veterinarian' || role === 'veternary' || role === 'milkreceptionist' || role === 'milk_receptionist';

  useEffect(() => {
    if (isReadOnlyTeamRole) {
      router.replace('/customers');
    }
  }, [isReadOnlyTeamRole, router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Add Customer</h1>
        <Link href="/customers" className="btn btn-secondary">
          <Icon icon={faTimes} size="sm" className="mr-2" />
          Cancel
        </Link>
      </div>
      <div className="bg-white border border-gray-200 rounded-sm p-6">
        <CreateCustomerForm onSuccess={() => router.push('/customers')} onCancel={() => router.back()} />
      </div>
    </div>
  );
}
