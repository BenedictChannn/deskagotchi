export function buildManualExecutionBatches(fields = {}) {
  const installerPath = typeof fields.installerPath === "string" && fields.installerPath.length > 0
    ? fields.installerPath
    : "the installer path from the manual context";

  return [
    {
      name: "Visual acceptance",
      gateIds: [
        "visual.pets",
        "visual.animations",
        "visual.food",
        "visual.cohesion"
      ],
      when: "Can be done immediately from the generated pages.",
      action:
        "Review docs/qa/v2-visual-acceptance.html, docs/qa/pet-animation-gallery.html, and docs/qa/v2-visual-review-notes.md.",
      evidence:
        "Record whether all five pets read correctly, animation rows move acceptably, and food icons are identifiable enough for V2."
    },
    {
      name: "Interactive installer",
      gateIds: [
        "installer.install",
        "installer.launch",
        "installer.uninstall"
      ],
      when: "Can be done from the current release candidate.",
      action: `Run ${installerPath}, launch the installed app, then uninstall it.`,
      evidence:
        "Record installer path, install directory, launch result, uninstall path, and post-uninstall executable/process observation."
    },
    {
      name: "Startup on login",
      gateIds: [
        "startup.enable",
        "startup.login",
        "startup.disable"
      ],
      when: "Requires the packaged app plus a real sign out, sign in, or restart.",
      action:
        "Enable Launch on startup in the packaged app, restart or sign out/in, confirm exactly one app instance appears, then disable startup.",
      evidence:
        "Record restart method, timestamp, launch count, and confirmation that startup was disabled again."
    },
    {
      name: "Sleep and recovery",
      gateIds: [
        "sleep.visible",
        "sleep.state",
        "sleep.process"
      ],
      when: "Requires a real Windows sleep/wake cycle.",
      action:
        "Launch Deskagotchi, sleep the machine for at least five minutes, wake/unlock, inspect visibility/status refresh, and run the process check.",
      evidence:
        "Record sleep duration, pet visibility or tray recovery result, health/status refresh, and duplicate/stuck process result."
    },
    {
      name: "Physical monitor layouts",
      gateIds: [
        "monitors.right",
        "monitors.stacked",
        "monitors.dpi"
      ],
      when: "Requires changing Windows display arrangement or using suitable hardware.",
      action:
        "Test right-side, stacked, and mixed-DPI layouts where available; otherwise defer each unavailable layout with approver and risk.",
      evidence:
        "Record arrangement, scale factors, drag and relaunch restore observation, or a gate-specific deferral rationale."
    },
    {
      name: "Environment caveats",
      gateIds: [
        "environment.rdp",
        "environment.taskbar",
        "environment.smartscreen"
      ],
      when: "Run only when the environment is available; explicit deferral is acceptable for unavailable setups.",
      action:
        "Check RDP behavior, unusual taskbar placement or auto-hide, and SmartScreen/signing behavior for the current unsigned build.",
      evidence:
        "Record tested setup and result, or defer with an approver, reason unavailable, and remaining release risk."
    }
  ];
}
