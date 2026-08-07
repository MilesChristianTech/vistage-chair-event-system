'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FieldsManager from '@/components/fields-manager';
import { markContactFieldsOnboardedAction, type CustomFieldDefinition } from '@/app/(app)/contacts/actions';

export default function OnboardingFieldsClient({ initialFields }: { initialFields: CustomFieldDefinition[] }) {
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);

  async function finish() {
    setIsFinishing(true);
    await markContactFieldsOnboardedAction();
    router.push('/contacts/import');
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl mb-1">What matters about a contact?</h1>
      <p className="text-navy-500 text-sm mb-5">
        First name, last name, company, title, and email are always included. Add anything else you personally track
        - a phone number, revenue, LinkedIn, whatever you actually use - and every import will automatically slot
        data into these fields for you from now on. You can add or remove fields anytime later in Settings.
      </p>
      <FieldsManager initialFields={initialFields} />
      <div className="flex items-center gap-3 mt-6 pt-5 border-t border-navy-100">
        <button className="btn-primary" onClick={finish} disabled={isFinishing}>
          {isFinishing ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
