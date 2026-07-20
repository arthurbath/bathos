import { PowerSyncContext } from '@powersync/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { connector } from './connector';
import { powerSync } from './database';
import { SystemContext, type SystemState } from './system-context';

export function SystemProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState>({ ready: false, session: null, error: null });

  useEffect(() => {
    let disposed = false;
    const unsubscribe = connector.subscribe((session) => {
      if (disposed) {
        return;
      }
      setState((current) => ({ ...current, session }));
      if (session) {
        void powerSync.connect(connector, { crudUploadThrottleMs: 100 });
      } else {
        void powerSync.disconnect();
      }
    });

    void (async () => {
      try {
        await powerSync.init();
        await connector.init();
        if (!disposed) {
          setState((current) => ({ ...current, ready: true }));
        }
      } catch (error) {
        if (!disposed) {
          setState((current) => ({ ...current, ready: true, error: readMessage(error) }));
        }
      }
    })();

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <PowerSyncContext.Provider value={powerSync}>
      <SystemContext.Provider value={value}>{children}</SystemContext.Provider>
    </PowerSyncContext.Provider>
  );
}

function readMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
