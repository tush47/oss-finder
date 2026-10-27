"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, TOPICS } from "@/lib/constants";
import { clearAll, exportAll, importAll, useSettings } from "@/lib/storage";
import { ApiStatusNote } from "./ApiStatusNote";
import { DataSources } from "./DataSources";
import { ChipGroup, Notice, PageHeader } from "./ui";

export function SettingsPanel() {
  const [settings, setSettings, loaded] = useSettings();
  const [username, setUsername] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shownUsername = username ?? settings.githubUsername;

  function download() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `oss-finder-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function upload(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object") throw new Error();
      importAll(data);
      setMessage("Imported. Your bookmarks, contributions, and jobs were replaced with the file's contents.");
    } catch {
      setMessage("That file is not an OSS Finder export.");
    }
  }

  // The page renders after local storage loads, so jump to a #section link once it is there.
  useEffect(() => {
    if (loaded && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <PageHeader title="Settings" description="Your preferences are saved in this browser. Nothing is sent anywhere except the GitHub username, to look up your public PRs." />

      <div className="space-y-6">
        <section className="card space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSettings((current) => ({ ...current, githubUsername: shownUsername.trim().replace(/^@/, "") }));
              setUsername(null);
              setMessage("Username saved.");
            }}
          >
            <label className="flex-1">
              <span className="label">GitHub username</span>
              <input className="input" value={shownUsername} placeholder="your-username" onChange={(event) => setUsername(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary self-end">
              Save
            </button>
          </form>
          <ChipGroup
            label="Preferred languages"
            options={LANGUAGES.map((lang) => ({ value: lang.label, label: lang.label }))}
            selected={settings.languages}
            onChange={(languages) => setSettings((current) => ({ ...current, languages }))}
            hint="Used as the starting filter on Find Issues and Repositories, and for the relevance part of the score."
          />
          <ChipGroup
            label="Preferred topics"
            options={TOPICS.map((topic) => ({ value: topic.slug, label: topic.label }))}
            selected={settings.topics}
            onChange={(topics) => setSettings((current) => ({ ...current, topics }))}
            hint="Used only for scoring. They do not filter results."
          />
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">GitHub API</h2>
          <ApiStatusNote detailed />
        </section>

        <DataSources />

        <section className="card space-y-3">
          <h2 className="font-semibold">Your data</h2>
          <p className="muted text-sm">
            Bookmarks, contributions, jobs, and presets live in this browser&apos;s local storage. Export a backup before clearing browser data or
            switching computers.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={download}>
              Export JSON
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn text-red-700 dark:text-red-300"
              onClick={() => {
                if (window.confirm("Delete all bookmarks, contributions, jobs, presets, and settings from this browser?")) {
                  clearAll();
                  setMessage("All local data was cleared.");
                }
              }}
            >
              Clear all data
            </button>
          </div>
        </section>

        {message ? <Notice>{message}</Notice> : null}
      </div>
    </>
  );
}
