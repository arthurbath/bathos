import { HouseholdSetup } from '@/components/HouseholdSetup';
import { AppShell } from '@/components/AppShell';
import { useHousehold } from '@/hooks/useHousehold';

const Index = () => {
  const { household, setHousehold } = useHousehold();

  if (!household) {
    return <HouseholdSetup onComplete={setHousehold} />;
  }

  return (
    <AppShell
      household={household}
      onReset={() => {
        localStorage.clear();
        setHousehold(null);
      }}
    />
  );
};

export default Index;
