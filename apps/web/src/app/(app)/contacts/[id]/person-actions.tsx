'use client';

import { useRouter } from 'next/navigation';
import ConfirmAction from '@/components/confirm-action';
import { setPersonActiveAction, deletePersonAction } from '../actions';

export default function PersonActions({
  person,
}: {
  person: { id: string; is_active: boolean; first_name: string; last_name: string };
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {person.is_active ? (
        <ConfirmAction
          triggerLabel="Mark inactive"
          triggerClassName="btn-secondary"
          consequence={`${person.first_name} ${person.last_name} will be hidden from active contact lists, but every past event and note stays intact. You can reactivate them anytime.`}
          confirmLabel="Mark inactive"
          onConfirm={async () => {
            const result = await setPersonActiveAction(person.id, false);
            router.refresh();
            return result;
          }}
        />
      ) : (
        <button
          className="btn-secondary"
          onClick={async () => {
            await setPersonActiveAction(person.id, true);
            router.refresh();
          }}
        >
          Reactivate
        </button>
      )}

      <ConfirmAction
        triggerLabel="Delete"
        consequence={`This permanently deletes ${person.first_name} ${person.last_name}. If they're part of any event's history, deletion will be blocked and you'll be asked to mark them inactive instead.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          const result = await deletePersonAction(person.id);
          if (result.ok) router.push('/contacts');
          return result;
        }}
      />
    </div>
  );
}
