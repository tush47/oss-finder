"use client";

import { useState } from "react";
import { newId } from "@/lib/storage";
import type { Preset } from "@/lib/types";

/** Save the current filters under a name, and re-apply saved ones later. */
export function PresetBar<T>({
  presets,
  current,
  onChange,
  onApply,
}: {
  presets: Preset<T>[];
  current: T;
  onChange: (next: Preset<T>[]) => void;
  onApply: (filters: T) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");

  function save() {
    const clean = name.trim();
    if (!clean) return;
    const others = presets.filter((preset) => preset.name.toLowerCase() !== clean.toLowerCase());
    onChange([...others, { id: newId(), name: clean, filters: current }]);
    setName("");
  }

  return (
    <div className="space-y-2">
      <p className="label">Saved presets</p>
      {presets.length ? (
        <div className="flex gap-2">
          <select className="input" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Saved preset">
            <option value="">Choose a preset…</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={!selected}
            onClick={() => {
              const preset = presets.find((item) => item.id === selected);
              if (preset) onApply(preset.filters);
            }}
          >
            Apply
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!selected}
            aria-label="Delete preset"
            onClick={() => {
              onChange(presets.filter((item) => item.id !== selected));
              setSelected("");
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="muted text-xs">None yet. Name the current filters to save them.</p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input className="input" value={name} placeholder="Preset name" onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="btn" disabled={!name.trim()}>
          Save
        </button>
      </form>
    </div>
  );
}
