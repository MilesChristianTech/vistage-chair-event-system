'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ConfirmAction from '@/components/confirm-action';
import { deleteAllPeopleAction } from './actions';

export default function DeleteAllButton({ totalCount }: { totalCount: number }) {
  const router = useRouter();

  if (totalCount === 0) return null;

  return (
    <ConfirmAction
      triggerLabel="Delete all"
      consequence={`This permanently deletes all ${totalCount} ${totalCount === 1 ? 'contact' : 'contacts'} in your database. Anyone who's part of an event invitation is kept automatically, to protect that event's history - everyone else is gone for good. This cannot be undone.`}
      confirmLabel="Delete all"
      onConfirm={async () => {
        const result = await deleteAllPeopleAction();
        if (result.ok && result.skippedCount) {
          toast.success(
            `Deleted ${result.deletedCount}. Kept ${result.skippedCount} ${result.skippedCount === 1 ? 'person who is' : 'people who are'} part of an event.`
          );
        }
        router.refresh();
        return result;
      }}
    />
  );
}
