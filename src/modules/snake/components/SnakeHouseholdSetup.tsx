import { Worm } from 'lucide-react';
import { HouseholdSetupCard } from '@/platform/households';

interface SnakeHouseholdSetupProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onCreate: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
}

export function SnakeHouseholdSetup({
  userId,
  displayName,
  onSignOut,
  onCreate,
  onJoin,
}: SnakeHouseholdSetupProps) {
  return (
    <HouseholdSetupCard
      moduleTitle="Snake"
      moduleId="snake"
      userId={userId}
      displayName={displayName}
      onSignOut={onSignOut}
      onCreate={onCreate}
      onJoin={onJoin}
      setupTitle="Snake Setup"
      setupDescription="Create a new snake household or join one using an invite code."
      createButtonLabel="Create Snake Household"
      joinButtonLabel="Join Household"
      joinInputLabel="Invite Code"
      joinInputPlaceholder="Enter invite code"
      createErrorTitle="Failed to create snake household"
      joinErrorTitle="Failed to join snake household"
      icon={Worm}
      showAppSwitcher
    />
  );
}
