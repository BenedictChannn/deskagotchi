import { runBackgroundTask } from "./backgroundTask";

describe("background task runner", () => {
  it("logs rejected fire-and-forget task failures", async () => {
    const failure = new Error("background failure");
    const logged: Array<[string, unknown]> = [];

    runBackgroundTask("simulation tick (timer)", async () => {
      throw failure;
    }, (message, error) => {
      logged.push([message, error]);
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(logged).toEqual([["simulation tick (timer) failed.", failure]]);
  });

  it("logs synchronous task failures before they become uncaught exceptions", () => {
    const failure = new Error("sync failure");
    const logged: Array<[string, unknown]> = [];

    runBackgroundTask("simulation tick (resume)", () => {
      throw failure;
    }, (message, error) => {
      logged.push([message, error]);
    });

    expect(logged).toEqual([["simulation tick (resume) failed.", failure]]);
  });
});
