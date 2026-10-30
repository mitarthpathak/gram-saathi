import { useSettings } from '@/lib/settings';
import { EligibilityWizard } from './EligibilityWizard';

export function EligibilityScreen() {
  const { language } = useSettings();
  // Questions come back in the session language, so a language switch restarts the wizard.
  return (
    <div className="px-4 py-5">
      <EligibilityWizard key={language} />
    </div>
  );
}
