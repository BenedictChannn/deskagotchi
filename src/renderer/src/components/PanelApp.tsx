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
  WandSparkles
} from "lucide-react";

import { CareActionType, PetSource, type PetStats } from "@shared/domain";
import type {
  DeskagotchiSnapshot,
  HatchDraftInput,
  RuntimePetPackage,
  UpdateSettingsInput
} from "@shared/ipc";
import { PanelView } from "@shared/ipc";

import { PetSprite } from "./PetSprite";

interface PanelAppProps {
  initialView: PanelView;
  snapshot: DeskagotchiSnapshot;
}

export function PanelApp({
  initialView,
  snapshot
}: PanelAppProps): React.JSX.Element {
  const [activeView, setActiveView] = useState(initialView);
  const [localSnapshot, setLocalSnapshot] = useState(snapshot);

  const refresh = async (): Promise<void> => {
    setLocalSnapshot(await window.deskagotchi.getSnapshot());
  };

  const performAction = async (actionType: CareActionType): Promise<void> => {
    setLocalSnapshot(await window.deskagotchi.performAction(actionType));
  };

  return (
    <main className="panel-shell">
      <aside className="panel-sidebar">
        <div className="panel-brand">
          <img src={localSnapshot.activePackage.assetUrls.icon} alt="" />
          <div>
            <strong>Deskagotchi</strong>
            <span>{localSnapshot.activeState.nickname}</span>
          </div>
        </div>
        <PanelNavButton
          active={activeView === PanelView.Status}
          icon={<Stethoscope size={18} />}
          label="Status"
          onClick={() => setActiveView(PanelView.Status)}
        />
        <PanelNavButton
          active={activeView === PanelView.PetSelector}
          icon={<SwitchCamera size={18} />}
          label="Pets"
          onClick={() => setActiveView(PanelView.PetSelector)}
        />
        <PanelNavButton
          active={activeView === PanelView.Hatch}
          icon={<WandSparkles size={18} />}
          label="Hatch"
          onClick={() => setActiveView(PanelView.Hatch)}
        />
        <PanelNavButton
          active={activeView === PanelView.Settings}
          icon={<Settings size={18} />}
          label="Settings"
          onClick={() => setActiveView(PanelView.Settings)}
        />
      </aside>

      <section className="panel-content">
        {activeView === PanelView.Status ? (
          <StatusView snapshot={localSnapshot} onAction={performAction} />
        ) : null}
        {activeView === PanelView.PetSelector ? (
          <PetSelectorView
            snapshot={localSnapshot}
            onChanged={(nextSnapshot) => setLocalSnapshot(nextSnapshot)}
          />
        ) : null}
        {activeView === PanelView.Hatch ? (
          <HatchView onInstalled={() => void refresh()} />
        ) : null}
        {activeView === PanelView.Settings ? (
          <SettingsView
            snapshot={localSnapshot}
            onChanged={(nextSnapshot) => setLocalSnapshot(nextSnapshot)}
          />
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
  return (
    <div className="status-layout">
      <section className="status-pet">
        <PetSprite snapshot={snapshot} size={180} />
        <div>
          <h1>{snapshot.activeState.nickname}</h1>
          <p>
            {snapshot.activePackage.petPackage.species} · {snapshot.activeState.lifeStage}
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
    </div>
  );
}

function PetSelectorView({
  snapshot,
  onChanged
}: {
  snapshot: DeskagotchiSnapshot;
  onChanged: (snapshot: DeskagotchiSnapshot) => void;
}): React.JSX.Element {
  const switchPet = async (petPackage: RuntimePetPackage): Promise<void> => {
    onChanged(await window.deskagotchi.switchPet(petPackage.petPackage.packageId));
  };

  const exportPet = async (petPackage: RuntimePetPackage): Promise<void> => {
    await window.deskagotchi.exportPet(petPackage.petPackage.packageId);
  };

  const importPet = async (): Promise<void> => {
    onChanged(await window.deskagotchi.importPet());
  };

  return (
    <div className="panel-view">
      <header className="view-header">
        <div>
          <h1>Pets</h1>
          <p>Built-in and local custom pet packages use the same manifest.</p>
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

function HatchView({
  onInstalled
}: {
  onInstalled: () => void;
}): React.JSX.Element {
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form, setForm] = useState<HatchDraftInput>({
    name: "",
    description: "",
    species: "",
    personality: "",
    preferredColors: ["#9bdbd4", "#4ecdc4", "#fff4d6"],
    accessory: "",
    theme: ""
  });
  const [message, setMessage] = useState<string>();

  const createDraft = async (): Promise<void> => {
    const result = await window.deskagotchi.hatchCreateDraft(form);
    if (result.installed) {
      setMessage("Installed local Hatch draft.");
      onInstalled();
      return;
    }
    setMessage(result.issues.map((issue) => issue.message).join(" "));
  };

  const regeneratePreview = (): void => {
    setPreviewVersion((currentVersion) => currentVersion + 1);
    setPreviewVisible(true);
    setMessage(undefined);
  };

  const rejectPreview = (): void => {
    setPreviewVisible(false);
    setMessage("Draft rejected.");
  };

  const previewUrl = createLocalHatchPreview(form, previewVersion);

  return (
    <div className="panel-view hatch-view">
      <header className="view-header">
        <div>
          <h1>Hatch</h1>
          <p>Create a custom pet draft, preview it, then approve installation.</p>
        </div>
      </header>

      <div className="hatch-layout">
        <form className="hatch-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={40}
            />
          </label>
          <label>
            Species or concept
            <input
              value={form.species}
              onChange={(event) =>
                setForm({ ...form, species: event.target.value })
              }
            />
          </label>
          <label>
            Personality
            <input
              value={form.personality}
              onChange={(event) =>
                setForm({ ...form, personality: event.target.value })
              }
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label>
            Accessory
            <input
              value={form.accessory}
              onChange={(event) =>
                setForm({ ...form, accessory: event.target.value })
              }
            />
          </label>
          <label>
            Theme
            <input
              value={form.theme}
              onChange={(event) => setForm({ ...form, theme: event.target.value })}
            />
          </label>
          <div className="color-row" aria-label="Preferred colors">
            {form.preferredColors.map((color, index) => (
              <input
                key={`${index}-${color}`}
                type="color"
                value={color}
                onChange={(event) => {
                  const nextColors = [...form.preferredColors];
                  nextColors[index] = event.target.value;
                  setForm({ ...form, preferredColors: nextColors });
                }}
              />
            ))}
          </div>
          <div className="hatch-actions">
            <button className="command-button" type="button" onClick={regeneratePreview}>
              <WandSparkles size={18} />
              Preview
            </button>
            <button className="command-button" type="button" onClick={regeneratePreview}>
              <Sparkles size={18} />
              Regenerate
            </button>
            <button className="command-button" type="button" onClick={rejectPreview}>
              Reject
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!previewVisible}
              onClick={() => void createDraft()}
            >
              <WandSparkles size={18} />
              Approve
            </button>
          </div>
          {message !== undefined ? <p className="form-message">{message}</p> : null}
        </form>

        <aside className="hatch-preview" aria-label="Hatch preview">
          {previewVisible ? (
            <img src={previewUrl} alt="Custom pet preview" />
          ) : (
            <div className="empty-preview" />
          )}
        </aside>
      </div>
    </div>
  );
}

function SettingsView({
  snapshot,
  onChanged
}: {
  snapshot: DeskagotchiSnapshot;
  onChanged: (snapshot: DeskagotchiSnapshot) => void;
}): React.JSX.Element {
  const update = async (settings: UpdateSettingsInput): Promise<void> => {
    onChanged(await window.deskagotchi.updateSettings(settings));
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
      <p className="data-location">Data: {snapshot.userDataPath}</p>
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

function createLocalHatchPreview(form: HatchDraftInput, version: number): string {
  const palette = normalizePreviewPalette(form.preferredColors, version);
  const [primary, secondary, outline, highlight] = palette;
  const accessory = form.accessory
    ? `<path d="M132 52 L158 30 L150 64 Z" fill="${highlight}" stroke="${outline}" stroke-width="6"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><g transform="translate(0 4)"><path d="M44 112 C42 70 72 48 100 60 C126 44 156 72 150 116 C144 156 116 162 98 150 C76 164 48 152 44 112 Z" fill="${primary}" stroke="${outline}" stroke-width="8" stroke-linejoin="round"/><ellipse cx="98" cy="114" rx="36" ry="24" fill="${secondary}" opacity="0.32"/><circle cx="78" cy="86" r="7" fill="${outline}"/><circle cx="118" cy="86" r="7" fill="${outline}"/><path d="M78 116 Q98 134 118 116" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/><circle cx="58" cy="105" r="7" fill="${secondary}" opacity="0.55"/><circle cx="138" cy="105" r="7" fill="${secondary}" opacity="0.55"/>${accessory}</g></svg>`;
  return `data:image/svg+xml;base64,${window.btoa(svg)}`;
}

function normalizePreviewPalette(colors: string[], version: number): string[] {
  const validColors = colors.filter((color) => /^#[0-9a-fA-F]{6}$/.test(color));
  const rotatedColors =
    validColors.length > 1
      ? validColors.map((_, index) => validColors[(index + version) % validColors.length])
      : validColors;
  const palette = rotatedColors.length >= 2 ? rotatedColors : ["#9bdbd4", "#4ecdc4"];
  return [
    palette[0] ?? "#9bdbd4",
    palette[1] ?? "#4ecdc4",
    "#243447",
    palette[2] ?? "#fff4d6"
  ];
}
