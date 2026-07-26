import { Users } from 'lucide-react';
import { HouseholdSetupCard } from '@/platform/households';

interface HouseholdSetupProps {
  userId: string;
  displayName: string;
  onSignOut: () => Promise<void> | void;
  onComplete: () => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
}

export function HouseholdSetup({ userId, displayName, onSignOut, onComplete, onJoin }: HouseholdSetupProps) {
  return (
    <HouseholdSetupCard
      moduleTitle="Budget"
      moduleId="budget"
      userId={userId}
      displayName={displayName}
      onSignOut={onSignOut}
      onCreate={onComplete}
      onJoin={onJoin}
      setupTitle="Get Started"
      setupDescription="Create a new household or join an existing one with an invite code."
      createButtonLabel="Create household"
      joinButtonLabel="Join Household"
      joinInputLabel="Invite Code"
      joinInputPlaceholder="Enter Invite Code from Your Partner"
      createErrorTitle="Failed to Create Household"
      joinErrorTitle="Failed to Join Household"
      icon={Users}
    />
  );
}
