/**
 * Utilities for main-process background work that intentionally runs without an
 * awaited caller.
 */

export type BackgroundTaskLogger = (message: string, error: unknown) => void;

/**
 * Run a fire-and-forget async task without leaking rejected promises.
 *
 * Args:
 *   label: Human-readable task label included in failure logs.
 *   task: Background operation to run.
 *   logError: Error logger used when the task throws or rejects.
 */
export function runBackgroundTask(
  label: string,
  task: () => Promise<void>,
  logError: BackgroundTaskLogger = console.error
): void {
  try {
    void task().catch((error: unknown) => {
      logError(`${label} failed.`, error);
    });
  } catch (error: unknown) {
    logError(`${label} failed.`, error);
  }
}
