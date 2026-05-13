import { shouldInstallDevDeskagotchiApi } from "./devBridgeGate";

describe("dev bridge gate", () => {
  it("allows plain localhost browser previews without a native bridge", () => {
    expect(
      shouldInstallDevDeskagotchiApi("localhost", false, "Mozilla/5.0 Chrome/126")
    ).toBe(true);
  });

  it("allows bracketed IPv6 localhost browser previews", () => {
    expect(
      shouldInstallDevDeskagotchiApi("[::1]", false, "Mozilla/5.0 Chrome/126")
    ).toBe(true);
  });

  it("does not mask missing preload in Electron dev renderers", () => {
    expect(
      shouldInstallDevDeskagotchiApi(
        "localhost",
        false,
        "Mozilla/5.0 Electron/41.5.0 Chrome/126"
      )
    ).toBe(false);
  });

  it("does not replace an existing native bridge", () => {
    expect(
      shouldInstallDevDeskagotchiApi("localhost", true, "Mozilla/5.0 Chrome/126")
    ).toBe(false);
  });
});
