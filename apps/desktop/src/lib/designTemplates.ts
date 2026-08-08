// The Design gallery's data source (desktop only). The Rust side scans the
// bundled `skills-design` pack — each skill dir that ships an `example.html`
// becomes a card; decks add palette/typography metadata from `template.json`.
import { isTauri } from "./tauri";
import { previewUrl } from "./artifactFile";

export interface DesignTemplate {
  /** Skill directory name — also the skill id and the "design" preview scope path. */
  dir: string;
  kind: "wireframe" | "critique" | "deck";
  title: string;
  tagline: string;
  /** Palette hexes (bg, primary, text, muted) for decks; empty otherwise. */
  palette: string[];
  /** Deck "best for" blurb; empty for wireframe/critique. */
  bestFor: string;
}

/** All previewable bundled design templates, grouped-friendly (sorted). */
export async function listDesignTemplates(): Promise<DesignTemplate[]> {
  if (!isTauri) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesignTemplate[]>("list_design_templates");
}

/** Preview URL for a template's bundled example artifact (desktop only). */
export async function designPreviewUrl(dir: string): Promise<string | null> {
  return previewUrl(`${dir}/example.html`, "design");
}