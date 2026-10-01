import type { PhysicsState } from './PhysicsEngine';

export interface WheelieHistoryRecord {
  timestamp: number;
  distance: number;
}

/** Detects wheelie lift-off and the single touchdown that completes it. */
export class WheelieHistoryTracker {
  private wheelieInProgress = false;
  private lastDistance = 0;

  public reset() {
    this.wheelieInProgress = false;
    this.lastDistance = 0;
  }

  /**
   * Returns the completed wheelie distance exactly once, on touchdown.
   * Engine-off and crash transitions cancel an unfinished wheelie instead of
   * turning it into a history record.
   */
  public update(state: PhysicsState, engineRunning: boolean): number | null {
    if (!engineRunning || state.isCrashed) {
      this.reset();
      return null;
    }

    if (state.pitch > 0) {
      this.wheelieInProgress = true;
      this.lastDistance = Math.max(this.lastDistance, state.wheelieDistance);
      return null;
    }

    if (!this.wheelieInProgress) return null;

    const completedDistance = this.lastDistance;
    this.reset();
    return completedDistance;
  }
}
