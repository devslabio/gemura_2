'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { animalsApi, Animal } from '@/lib/api/animals';
import { useAuthStore } from '@/store/auth';
import CreateAnimalForm from '../../CreateAnimalForm';
import Icon, { faArrowLeft, faSpinner } from '@/app/components/Icon';
import { DetailPageSkeleton } from '@/app/components/SkeletonLoader';

export default function EditAnimalPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentAccount } = useAuthStore();
  const accountId = currentAccount?.account_id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [animal, setAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    animalsApi
      .getById(id, accountId)
      .then((res) => {
        if (res.code === 200 && res.data) setAnimal(res.data);
        else setError('Animal not found');
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e?.response?.data?.message || e?.message || 'Failed to load animal');
      })
      .finally(() => setLoading(false));
  }, [id, accountId]);

  if (loading) return <DetailPageSkeleton />;

  if (error && !animal) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
        <Link href="/animals" className="btn btn-secondary">
          <Icon icon={faArrowLeft} size="sm" className="mr-2" />
          Back to Animals
        </Link>
      </div>
    );
  }

  if (!animal) return null;

  const initialData = {
    id: animal.id,
    tag_number: animal.tag_number,
    name: animal.name ?? undefined,
    species_id: animal.species?.id ?? animal.species_id ?? '',
    breed_id: animal.breed?.id ?? '',
    gender: animal.gender,
    date_of_birth: animal.date_of_birth.slice(0, 10),
    source: animal.source,
    purchase_date: animal.purchase_date ? animal.purchase_date.slice(0, 10) : undefined,
    purchase_price: animal.purchase_price != null ? Number(animal.purchase_price) : undefined,
    mother_id: animal.mother_id ?? undefined,
    father_id: animal.father_id ?? undefined,
    status: animal.status,
    notes: animal.notes ?? undefined,
    farm_id: animal.farm_id ?? undefined,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/animals/${id}`} className="text-sm text-gray-600 hover:text-[var(--primary)] mb-2 inline-flex items-center">
            <Icon icon={faArrowLeft} size="sm" className="mr-2" />
            Back to Animal
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit Animal</h1>
          <p className="text-sm text-gray-500 mt-0.5">{animal.tag_number} {animal.name && ` · ${animal.name}`}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm p-6">
        <CreateAnimalForm
          initialData={initialData}
          onSuccess={() => router.push(`/animals/${id}`)}
          onCancel={() => router.push(`/animals/${id}`)}
        />
      </div>
    </div>
  );
}
