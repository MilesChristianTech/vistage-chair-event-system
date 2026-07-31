import { AppPageHeader, AppPageBody } from '@/components/page-header';
import ImportWizard from './import-wizard';

export default function ImportContactsPage() {
  return (
    <>
      <AppPageHeader title="Import contacts" description="Drop in a spreadsheet — no template required." />
      <AppPageBody>
        <ImportWizard />
      </AppPageBody>
    </>
  );
}
