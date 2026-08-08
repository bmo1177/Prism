// The bundled science skills behind the Science gallery (`/science`). The
// `skills-core` resource pack ships the app's self-authored science skills;
// each skill is a directory with a SKILL.md whose frontmatter `name:` and
// `description:` drive the gallery card. A listing command hands the frontend
// dir/title/tagline so the gallery can render cards and fire "use this skill"
// prompts — the same pattern as the design templates gallery, minus previews
// (scientific workflows produce analyses and figures, not HTML examples).

use std::path::{Path, PathBuf};
use serde::Serialize;
use tauri::{AppHandle, Manager, path::BaseDirectory};

use crate::design_templates::{frontmatter_description, humanize};

/// One gallery card: a bundled science skill usable on the current workspace.
/// `dir` is the skill id (e.g. `stats-integrity`) and its folder name.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScienceSkill {
    pub dir: String,
    /// Human-facing name, e.g. "Removing best practices" — humanized from the
    /// id so the card reads as a display title, not a directory.
    pub title: String,
    /// The skill's frontmatter description (the "use when" contract).
    pub tagline: String,
}

/// Folder the bundled science pack lives in (mapped to `skills-core/` in
/// tauri.conf.json, the same way `skills-design/` hosts the design pack). None
/// when running without the resources (dev without `fetch-skills.sh`, etc.).
pub fn bundled_science_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve("skills-core", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.is_dir())
}

/// Scan a science pack root for skills: any subdirectory carrying a `SKILL.md`
/// is a real, deployable skill, so unknown/empty placeholder directories are
/// skipped the same way the deployer treats them. Sorted for a stable gallery.
pub fn scan(root: &Path) -> Vec<ScienceSkill> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut out: Vec<ScienceSkill> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .filter_map(|p| parse_dir(&p))
        .collect();
    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    out
}

#[tauri::command]
pub fn list_science_skills(app: AppHandle) -> Vec<ScienceSkill> {
    match bundled_science_dir(&app) {
        Some(root) => scan(&root),
        None => Vec::new(),
    }
}

fn parse_dir(dir: &Path) -> Option<ScienceSkill> {
    let dir_name = dir.file_name()?.to_str()?.to_string();
    let skill = std::fs::read_to_string(dir.join("SKILL.md")).ok()?;
    Some(ScienceSkill {
        dir: dir_name.clone(),
        title: humanize(&dir_name),
        tagline: frontmatter_description(&skill).unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static FIXTURE_N: AtomicUsize = AtomicUsize::new(0);

    fn fixture() -> PathBuf {
        let n = FIXTURE_N.fetch_add(1, Ordering::Relaxed);
        // Unique per call — the tests in this module run in parallel and must
        // not fight over one shared temp dir.
        let root = std::env::temp_dir().join(format!("ai4s-science-tpl-{}-{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn make_skill(root: &Path, name: &str, description: &str) {
        let dir = root.join(name);
        std::fs::create_dir_all(&dir).ok();
        std::fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: |\n  {description}\n---\n\nbody\n"),
        )
        .ok();
    }

    #[test]
    fn lists_only_real_skills_with_title_and_tagline_sorted() {
        let root = fixture();
        make_skill(&root, "stats-integrity", "Enforces the execute-don't- interpret boundary.");
        make_skill(&root, "large-file", "Returns a memory pointer for files that dwarf the context window.");
        // An empty dir with no SKILL.md is a placeholder, not a skill.
        std::fs::create_dir_all(root.join("literature-review")).ok();

        let list = scan(&root);
        assert_eq!(list.len(), 2);
        let titles: Vec<&str> = list.iter().map(|s| s.title.as_str()).collect();
        assert_eq!(titles, ["Large File", "Stats Integrity"]);
        let lf = list.iter().find(|s| s.dir == "large-file").unwrap();
        assert!(lf.tagline.contains("memory pointer"));
        assert_eq!(lf.title, "Large File");
    }

    #[test]
    fn a_missing_pack_yields_an_empty_gallery() {
        assert_eq!(scan(&std::env::temp_dir().join("ai4s-does-not-exist")), Vec::new());
        // A root with no skill dirs is also empty, never an error.
        let root = fixture();
        assert_eq!(scan(&root), Vec::new());
    }

    #[test]
    fn humanizes_the_directive_style_science_ids() {
        assert_eq!(humanize("stats-integrity"), "Stats Integrity");
        assert_eq!(humanize("citation-reviewer"), "Citation Reviewer");
    }
}