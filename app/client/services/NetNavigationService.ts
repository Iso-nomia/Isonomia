// ============================================================================
// Types
// ============================================================================

export interface NavigationState {
  selectedSchemes: string[];
  highlightedDependencies: Array<{ source: string; target: string }>;
  focusedScheme?: string;
  viewportCenter?: { x: number; y: number };
  zoom?: number;
}

export interface NavigationAction {
  type: "select-scheme" | "highlight-dependency" | "focus-scheme" | "reset";
  payload?: any;
  animated?: boolean;
  duration?: number;
}

// ============================================================================
// Navigation Service
// ============================================================================

export class NetNavigationService {
  private listeners: Array<(state: NavigationState) => void> = [];
  private currentState: NavigationState = {
    selectedSchemes: [],
    highlightedDependencies: [],
  };

  /**
   * Subscribe to navigation state changes
   */
  public subscribe(listener: (state: NavigationState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Dispatch navigation action
   */
  public dispatch(action: NavigationAction): void {
    switch (action.type) {
      case "select-scheme":
        this.selectScheme(action.payload.schemeId, action.animated);
        break;
      case "highlight-dependency":
        this.highlightDependency(
          action.payload.sourceId,
          action.payload.targetId,
          action.animated
        );
        break;
      case "focus-scheme":
        this.focusScheme(action.payload.schemeId, action.animated);
        break;
      case "reset":
        this.reset();
        break;
    }
  }

  /**
   * Select a scheme
   */
  private selectScheme(schemeId: string, animated = true): void {
    this.currentState = {
      ...this.currentState,
      selectedSchemes: [schemeId],
      highlightedDependencies: [],
      focusedScheme: schemeId,
    };

    this.notifyListeners();

    if (animated) {
      this.animateToScheme(schemeId);
    }
  }

  /**
   * Highlight a dependency
   */
  private highlightDependency(
    sourceId: string,
    targetId: string,
    animated = true
  ): void {
    this.currentState = {
      ...this.currentState,
      selectedSchemes: [sourceId, targetId],
      highlightedDependencies: [{ source: sourceId, target: targetId }],
    };

    this.notifyListeners();

    if (animated) {
      this.animateToDependency(sourceId, targetId);
    }
  }

  /**
   * Focus on a specific scheme
   */
  private focusScheme(schemeId: string, animated = true): void {
    this.currentState = {
      ...this.currentState,
      focusedScheme: schemeId,
    };

    this.notifyListeners();

    if (animated) {
      this.animateToScheme(schemeId);
    }
  }

  /**
   * Reset navigation state
   */
  private reset(): void {
    this.currentState = {
      selectedSchemes: [],
      highlightedDependencies: [],
    };

    this.notifyListeners();
  }

  /**
   * Animate viewport to scheme
   */
  private animateToScheme(schemeId: string): void {
    const element = document.getElementById(`scheme-${schemeId}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });

      // Add pulse animation
      element.classList.add("animate-pulse");
      setTimeout(() => {
        element.classList.remove("animate-pulse");
      }, 2000);
    }
  }

  /**
   * Animate viewport to dependency
   */
  private animateToDependency(sourceId: string, targetId: string): void {
    // Find midpoint between source and target
    const sourceElement = document.getElementById(`scheme-${sourceId}`);
    const targetElement = document.getElementById(`scheme-${targetId}`);

    if (sourceElement && targetElement) {
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();

      const midX = (sourceRect.left + targetRect.left) / 2;
      const midY = (sourceRect.top + targetRect.top) / 2;

      // Scroll to midpoint
      window.scrollTo({
        top: midY - window.innerHeight / 2,
        left: midX - window.innerWidth / 2,
        behavior: "smooth",
      });
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.currentState);
    });
  }

  /**
   * Get current state
   */
  public getState(): NavigationState {
    return { ...this.currentState };
  }
}

// Singleton instance
export const netNavigationService = new NetNavigationService();
