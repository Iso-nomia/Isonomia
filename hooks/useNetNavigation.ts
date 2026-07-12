import { useEffect, useState } from "react";
import {
  netNavigationService,
  NavigationState,
  NavigationAction,
} from "@/app/client/services/NetNavigationService";

export function useNetNavigation() {
  const [state, setState] = useState<NavigationState>(
    netNavigationService.getState()
  );

  useEffect(() => {
    const unsubscribe = netNavigationService.subscribe(setState);
    return unsubscribe;
  }, []);

  const dispatch = (action: NavigationAction) => {
    netNavigationService.dispatch(action);
  };

  return { state, dispatch };
}
