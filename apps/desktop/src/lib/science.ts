import { isTauri } from "./tauri";

/** One bundled science skill, as listed by `list_science_skills`. */
export interface ScienceSkill {
  /** Skill id / folder name, e.g. "stats-integrity". */
  dir: string;
  /** Human-facing display title, e.g. "Stats Integrity". */
  title: string;
  /** The SKILL.md frontmatter description (the "use when" contract). */
  tagline: string;
}

/** The bundled science skills behind the Science gallery (desktop only). */
export async function listScienceSkills(): Promise<ScienceSkill[]> {
  if (!isTauri) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<ScienceSkill[]>("list_science_skills", {});
  } catch {
    return [];
  }
}

/** Prompt a "use this skill" click fires: the agent reads the bundled SKILL.md
 *  and applies it, asking first when the target file isn't obvious. */
export function scienceSkillPrompt(s: ScienceSkill): string {
  const notes = s.tagline ? ` Skill description: ${s.tagline}` : "";
  return (
    `Use the bundled ${s.dir} science skill — its SKILL.md holds the exact protocol. ` +
    `Ask me which file or analysis it applies to if that is not obvious from the workspace, ` +
    `then run the skill, write its result into the workspace, and tell me the path.${notes}`
  );
}