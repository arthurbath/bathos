import { Boxes } from 'lucide-react';
import { HouseholdSetupCard } from '@/platform/households';

interface DrawersHouseholdSetupProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onCreate: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
}

export function DrawersHouseholdSetup({
  userId,
  displayName,
  onSignOut,
  onCreate,
  onJoin,
}: DrawersHouseholdSetupProps) {
  return (
    <HouseholdSetupCard
      moduleTitle="Drawers"
      moduleId="drawers"
      userId={userId}
      displayName={displayName}
      onSignOut={onSignOut}
      onCreate={onCreate}
      onJoin={onJoin}
      setupTitle="Drawers Setup"
      setupDescription="Create a new drawer household or join one using an invite code."
      createButtonLabel="Create Drawer Household"
      joinButtonLabel="Join Household"
      joinInputLabel="Invite Code"
      joinInputPlaceholder="Enter invite code"
      createErrorTitle="Failed to create drawer household"
      joinErrorTitle="Failed to join drawer household"
      icon={Boxes}
      showAppSwitcher
    />
  );
}
