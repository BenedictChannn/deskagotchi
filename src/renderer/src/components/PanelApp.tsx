import { useState } from "react";
import {
  Bath,
  Bone,
  Download,
  HeartPulse,
  Import,
  Moon,
  Pill,
  Settings,
  Sparkles,
  Stethoscope,
  SwitchCamera,
  X
} from "lucide-react";

import { CareActionType, PetSource, type PetStats } from "@shared/domain";
import type {
  DeskagotchiSnapshot,
  RuntimePetPackage,
  UpdateSettingsInput
} from "@shared/ipc";
import { PanelView } from "@shared/ipc";

import { PetSprite } from "./PetSprite";

/** Props for the full Deskagotchi control panel. */
interface PanelAppProps {
  /** Panel view selected by the route when the panel opens. */
  initialView: PanelView;
  /** Initial bridge snapshot used to seed local panel state. */
  snapshot: DeskagotchiSnapshot;
}

/**
 * Render the full control panel for status, pet selection, and settings.
 *
 * @param props - Initial view and application snapshot from the bridge.
 * @returns The panel renderer view.
 */
export function PanelApp({
  initialView,
  snapshot
}: PanelAppProps): React.JSX.Element {
  const activeView = initialView;

  const performAction = async (actionType: CareActionType): Promise<void> => {
    await window.deskagotchi.performAction({ type: actionType });
  };

  const selectView = (view: PanelView): void => {
    window.location.hash = `#/panel/${view}`;
  };

  return (
    <main className="panel-shell">
      <aside className="panel-sidebar">
        <div className="panel-brand">
          <img src={snapshot.activePackage.assetUrls.icon} alt="" />
          <div>
            <strong>Deskagotchi</strong>
            <span>{snapshot.activeState.nickname}</span>
          </div>
        </div>
        <PanelNavButton
          active={activeView === PanelView.Status}
          icon={<Stethoscope size={18} />}
          label="Status"
          onClick={() => selectView(PanelView.Status)}
        />
        <PanelNavButton
          active={activeView === PanelView.PetSelector}
          icon={<SwitchCamera size={18} />}
          label="Pets"
          onClick={() => selectView(PanelView.PetSelector)}
        />
        <PanelNavButton
          active={activeView === PanelView.Settings}
          icon={<Settings size={18} />}
          label="Settings"
          onClick={() => selectView(PanelView.Settings)}
        />
        <button
          type="button"
          className="panel-close-button"
          onClick={() => void window.deskagotchi.hidePanel()}
          aria-label="Close panel"
          title="Close panel"
        >
          <X size={18} />
        </button>
      </aside>

      <section className="panel-content">
        {activeView === PanelView.Status ? (
          <StatusView snapshot={snapshot} onAction={performAction} />
        ) : null}
        {activeView === PanelView.PetSelector ? (
          <PetSelectorView snapshot={snapshot} />
        ) : null}
        {activeView === PanelView.Settings ? (
          <SettingsView snapshot={snapshot} />
        ) : null}
      </section>
    </main>
  );
}

function StatusView({
  snapshot,
  onAction
}: {
  snapshot: DeskagotchiSnapshot;
  onAction: (actionType: CareActionType) => Promise<void>;
}): React.JSX.Element {
  const [miniGameTaps, setMiniGameTaps] = useState(0);

  const tapMiniGame = async (): Promise<void> => {
    const nextTaps = miniGameTaps + 1;
    if (nextTaps >= 5) {
      setMiniGameTaps(0);
      await onAction(CareActionType.Play);
      return;
    }
    setMiniGameTaps(nextTaps);
  };

  return (
    <div className="status-layout">
      <section className="status-pet">
        <PetSprite snapshot={snapshot} size={180} />
        <div>
          <h1>{snapshot.activeState.nickname}</h1>
          <p>
            {snapshot.activePackage.petPackage.species} - {snapshot.activeState.lifeStage}
          </p>
          <p>{snapshot.activePackage.petPackage.personality}</p>
        </div>
      </section>

      <section className="stats-grid">
        {statRows(snapshot.activeState.stats).map((row) => (
          <StatMeter key={row.id} label={row.label} value={row.value} />
        ))}
      </section>

      <section className="care-actions" aria-label="Care actions">
        <CommandButton
          icon={<Bone size={18} />}
          label="Meal"
          onClick={() => void onAction(CareActionType.FeedMeal)}
        />
        <CommandButton
          icon={<Sparkles size={18} />}
          label="Play"
          onClick={() => void onAction(CareActionType.Play)}
        />
        <CommandButton
          icon={<Bath size={18} />}
          label="Clean"
          onClick={() => void onAction(CareActionType.Clean)}
        />
        <CommandButton
          icon={<Pill size={18} />}
          label="Medicine"
          onClick={() => void onAction(CareActionType.Medicine)}
        />
        <CommandButton
          icon={<Moon size={18} />}
          label="Sleep"
          onClick={() => void onAction(CareActionType.ToggleSleep)}
        />
        <CommandButton
          icon={<HeartPulse size={18} />}
          label="Pet"
          onClick={() => void onAction(CareActionType.Pet)}
        />
      </section>

      <section className="care-history">
        <h2>Care History</h2>
        <dl>
          <div>
            <dt>Quality</dt>
            <dd>{Math.round(snapshot.activeState.careHistory.qualityScore)}%</dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{Math.floor(snapshot.activeState.ageHours)}h</dd>
          </div>
          <div>
            <dt>Messes</dt>
            <dd>{snapshot.activeState.messCount}</dd>
          </div>
          <div>
            <dt>Offline debt</dt>
            <dd>{Math.round(snapshot.activeState.offlineDebtHours)}h</dd>
          </div>
        </dl>
      </section>

      <section className="mini-game" aria-label="Play mini-game">
        <div>
          <h2>Play</h2>
        </div>
        <button
          className="mini-game-target"
          type="button"
          aria-label="Tap target"
          onClick={() => void tapMiniGame()}
          style={{
            "--target-offset": `${(miniGameTaps * 19) % 78}%`
          } as React.CSSProperties}
        >
          <span />
        </button>
        <strong>{miniGameTaps}/5</strong>
      </section>
    </div>
  );
}

function PetSelectorView({
  snapshot
}: {
  snapshot: DeskagotchiSnapshot;
}): React.JSX.Element {
  const switchPet = async (petPackage: RuntimePetPackage): Promise<void> => {
    await window.deskagotchi.switchPet(petPackage.petPackage.packageId);
  };

  const exportPet = async (petPackage: RuntimePetPackage): Promise<void> => {
    await window.deskagotchi.exportPet(petPackage.petPackage.packageId);
  };

  const importPet = async (): Promise<void> => {
    await window.deskagotchi.importPet();
  };

  return (
    <div className="panel-view">
      <header className="view-header">
        <div>
          <h1>Pets</h1>
          <p>Choose who keeps you company on the desktop.</p>
        </div>
        <CommandButton
          icon={<Import size={18} />}
          label="Import"
          onClick={() => void importPet()}
        />
      </header>
      <div className="pet-grid">
        {snapshot.packages.map((petPackage) => (
          <article
            className="pet-option"
            key={petPackage.petPackage.packageId}
            data-active={
              petPackage.petPackage.packageId === snapshot.activeState.packageId
            }
          >
            <img src={petPackage.assetUrls.preview} alt="" />
            <div>
              <h2>{petPackage.petPackage.name}</h2>
              <p>{petPackage.petPackage.description}</p>
              <span>{petPackage.petPackage.source}</span>
            </div>
            <button type="button" onClick={() => void switchPet(petPackage)}>
              Switch
            </button>
            {petPackage.petPackage.source === PetSource.Custom ? (
              <button type="button" onClick={() => void exportPet(petPackage)}>
                <Download size={15} />
                Export
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function SettingsView({
  snapshot
}: {
  snapshot: DeskagotchiSnapshot;
}): React.JSX.Element {
  const update = async (settings: UpdateSettingsInput): Promise<void> => {
    await window.deskagotchi.updateSettings(settings);
  };

  return (
    <div className="panel-view settings-view">
      <header className="view-header">
        <div>
          <h1>Settings</h1>
          <p>Desktop behavior, notifications, and recovery controls.</p>
        </div>
      </header>

      <div className="settings-list">
        <Toggle
          label="Always on top"
          checked={snapshot.save.settings.alwaysOnTop}
          onChange={(checked) => void update({ alwaysOnTop: checked })}
        />
        <Toggle
          label="Launch on startup"
          checked={snapshot.save.settings.launchOnStartup}
          onChange={(checked) => void update({ launchOnStartup: checked })}
        />
        <Toggle
          label="Sound"
          checked={snapshot.save.settings.soundEnabled}
          onChange={(checked) => void update({ soundEnabled: checked })}
        />
        <Toggle
          label="Reduced motion"
          checked={snapshot.save.settings.reducedMotion}
          onChange={(checked) => void update({ reducedMotion: checked })}
        />
        <Toggle
          label="Low maintenance"
          checked={snapshot.save.settings.lowMaintenanceMode}
          onChange={(checked) => void update({ lowMaintenanceMode: checked })}
        />
        <Toggle
          label="Notifications"
          checked={snapshot.save.settings.notificationsEnabled}
          onChange={(checked) => void update({ notificationsEnabled: checked })}
        />
      </div>

      <div className="recovery-actions">
        <CommandButton
          icon={<SwitchCamera size={18} />}
          label="Reset Position"
          onClick={() => void window.deskagotchi.resetPetWindow()}
        />
      </div>
      <details className="settings-advanced">
        <summary>Storage</summary>
        <p className="data-location">Data folder: {snapshot.userDataPath}</p>
      </details>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, onChange }: ToggleProps): React.JSX.Element {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function PanelNavButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button className="panel-nav-button" data-active={active} type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function CommandButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button className="command-button" type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function StatMeter({
  label,
  value
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="stat-meter">
      <div>
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <meter min={0} max={100} value={value} />
    </div>
  );
}

function statRows(stats: PetStats): Array<{ id: keyof PetStats; label: string; value: number }> {
  return [
    { id: "hunger", label: "Hunger", value: stats.hunger },
    { id: "happiness", label: "Happiness", value: stats.happiness },
    { id: "energy", label: "Energy", value: stats.energy },
    { id: "cleanliness", label: "Cleanliness", value: stats.cleanliness },
    { id: "health", label: "Health", value: stats.health },
    { id: "affection", label: "Affection", value: stats.affection },
    { id: "discipline", label: "Discipline", value: stats.discipline },
    { id: "weight", label: "Weight", value: Math.min(100, stats.weight) }
  ];
}

