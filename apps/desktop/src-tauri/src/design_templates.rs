// The bundled design templates behind the Design gallery (`/design`). The
// `skills-design` resource pack ships 13 skills, each with its own example
// artifact: the 8 `html-ppt-zhangzara-*` decks carry a `template.json` (name,
// one-line tagline, palette, "best for" blurb); the wireframe/critique skills
// carry only a SKILL.md whose frontmatter `description:` becomes the tagline.
// A listing command hands the frontend dir/kind/preview fields so the gallery
// can render iframe previews and fire "use this style" prompts.

use std::path::Path;
use std::path::PathBuf;
use serde::Serialize;
use tauri::{AppHandle, Manager, path::BaseDirectory};

/// One gallery card: a bundled design skill whose example artifact can be
/// previewed. `dir` doubles as the skill id and the path under the "design"
/// preview scope (e.g. `html-ppt-zhangzara-blue-professional`).
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesignTemplate {
    pub dir: String,
    pub kind: String,
    pub title: String,
    pub tagline: String,
    /// Palette hexes (bg, primary, text, muted) for decks; empty otherwise.
    pub palette: Vec<String>,
    /// The deck's "best for" blurb; empty for wireframe/critique.
    pub best_for: String,
}

/// Folder the bundled design pack lives in (mapped to `skills-design/` in
/// tauri.conf.json). None when running without the resources (dev without
/// `fetch-skills.sh`, etc.).
pub fn bundled_design_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve("skills-design", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.is_dir())
}

/// Scan a design pack root for previewable templates. Any skill dir that has
/// both `SKILL.md` and `example.html` is listed; decks add their `meta.json`.
/// Sorted for a stable gallery: wireframes, critique, then decks (by title).
pub fn scan(root: &Path) -> Vec<DesignTemplate> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut out: Vec<DesignTemplate> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir() && p.join("SKILL.md").is_file() && p.join("example.html").is_file())
        .filter_map(|p| parse_dir(&p))
        .collect();
    let order = |k: &str| match k {
        "wireframe" => 0,
        "critique" => 1,
        _ => 2,
    };
    out.sort_by(|a, b| {
        order(&a.kind)
            .cmp(&order(&b.kind))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    out
}

#[tauri::command]
pub fn list_design_templates(app: AppHandle) -> Vec<DesignTemplate> {
    match bundled_design_dir(&app) {
        Some(root) => scan(&root),
        None => Vec::new(),
    }
}

fn parse_dir(dir: &Path) -> Option<DesignTemplate> {
    let dir_name = dir.file_name()?.to_str()?.to_string();
    let example_path = dir.join("example.html");
    if !example_path.is_file() {
        return None;
    }
    if let Some(deck) = parse_deck(dir) {
        return Some(deck.with_dir(dir_name));
    }
    // Wireframe / critique skills: kind comes from the dir name; the tagline
    // from the SKILL.md frontmatter description. No example artifacts staged.
    let skill = std::fs::read_to_string(dir.join("SKILL.md")).ok()?;
    let kind = if dir_name.starts_with("wireframe-") {
        "wireframe"
    } else if dir_name.starts_with("critique") {
        "critique"
    } else {
        "skill"
    };
    let title = humanize(&dir_name);
    let tagline = frontmatter_description(&skill).unwrap_or_default();
    Some(DesignTemplate {
        dir: dir_name,
        kind: kind.to_string(),
        title,
        tagline,
        palette: Vec::new(),
        best_for: String::new(),
    })
}

/// Decks are fully described by their `template.json` — the SKILL.md is
/// generated from it and adds nothing the gallery needs.
fn parse_deck(dir: &Path) -> Option<DesignTemplate> {
    let json = std::fs::read_to_string(dir.join("template.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&json).ok()?;
    let palette_keys: &[&[&str]] = &[
        &["palette", "bg"],
        &["palette", "primary"],
        &["palette", "text"],
        &["palette", "text_muted"],
    ];
    let palette = palette_keys
        .iter()
        .filter_map(|p| string_of(&v, p))
        .collect();
    Some(DesignTemplate {
        dir: String::new(), // filled by parse_dir so the dir name survives
        kind: "deck".to_string(),
        title: string_of(&v, &["name"]).unwrap_or_else(|| {
            dir.file_name()
                .and_then(|n| n.to_str())
                .map(humanize)
                .unwrap_or_default()
        }),
        tagline: string_of(&v, &["tagline"]).unwrap_or_default(),
        palette,
        best_for: string_of(&v, &["best_for"]).unwrap_or_default(),
    })
}

impl DesignTemplate {
    fn with_dir(mut self, dir: String) -> Self {
        self.dir = dir;
        self
    }
}

fn string_of(v: &serde_json::Value, path: &[&str]) -> Option<String> {
    let mut cur = v;
    for key in path {
        cur = cur.get(*key)?;
    }
    cur.as_str().map(str::to_string)
}

/// `wireframe-greybox` → `Wireframe Greybox`, `critique` → `Critique`.
pub(crate) fn humanize(name: &str) -> String {
    let mut out = String::new();
    let mut cap = true;
    for ch in name.chars() {
        if ch == '-' || ch == '_' {
            out.push(' ');
            cap = true;
        } else if cap {
            out.extend(ch.to_uppercase());
            cap = false;
        } else {
            out.push(ch);
        }
    }
    out
}

fn frontmatter_block(text: &str) -> Option<&str> {
    let t = text
        .trim_start_matches('\u{feff}')
        .trim_start()
        .strip_prefix("---")?;
    t.split_once("\n---").map(|(front, _)| front)
}

/// The `description:` from the frontmatter, whether block style (`|` followed
/// by indented lines) or a single quoted line. Block text collapses to one line.
pub(crate) fn frontmatter_description(text: &str) -> Option<String> {
    let front = frontmatter_block(text)?;
    let mut lines = front.lines();
    while let Some(line) = lines.next() {
        let t = line.trim();
        let Some(rest) = t.strip_prefix("description:") else {
            continue;
        };
        let rest = rest.trim();
        if rest == "|" {
            let mut out: Vec<String> = Vec::new();
            for l in lines.by_ref() {
                if l.trim().is_empty() {
                    continue;
                }
                if !l.starts_with(' ') && !l.starts_with('\t') {
                    break; // the closing `---`
                }
                out.push(l.trim().to_string());
            }
            return Some(out.join(" "));
        }
        return Some(rest.trim_matches(['"', '\'']).to_string());
    }
    None
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
        let root = std::env::temp_dir().join(format!("ai4s-design-tpl-{}-{}", std::process::id(), n));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn make_skill(root: &Path, name: &str, description: &str) {
        let dir = root.join(name);
        std::fs::create_dir_all(&dir).ok();
        std::fs::write(dir.join("SKILL.md"), format!("---\nname: {name}\ndescription: |\n  {description}\n---\n\nbody\n")).ok();
        std::fs::write(dir.join("example.html"), "<html></html>").ok();
    }

    #[test]
    fn wireframe_and_critique_get_kind_title_and_tagline() {
        let root = fixture();
        make_skill(&root, "wireframe-greybox", "A crisp blueprint wire — grey blocks, text bars, a redline accent.");
        make_skill(&root, "critique", "A five-dimension design review with a radar chart.");

        let list = scan(&root);
        assert_eq!(list.len(), 2);
        let wf = list.iter().find(|t| t.kind == "wireframe").unwrap();
        assert_eq!(wf.title, "Wireframe Greybox");
        assert!(wf.tagline.contains("grey blocks"));
        let cr = list.iter().find(|t| t.kind == "critique").unwrap();
        assert_eq!(cr.title, "Critique");
        assert!(cr.tagline.starts_with("A five-dimension"));
        assert_eq!(cr.palette, Vec::<String>::new());
    }

    #[test]
    fn decks_read_metadata_and_palette_from_template_json() {
        let root = fixture();
        let deck = root.join("html-ppt-zhangzara-blue-professional");
        std::fs::create_dir_all(&deck).ok();
        std::fs::write(deck.join("SKILL.md"), "---\nname: deckx\n---\n\nbody\n").ok();
        std::fs::write(deck.join("example.html"), "<html></html>").ok();
        std::fs::write(
            deck.join("template.json"),
            r##"{"name":"Blue Professional","tagline":"Cream paper with cobalt blue.","best_for":"B2B SaaS pitches.","palette":{"bg":"#FDFAE7","primary":"#1E2BFA","text":"#111111","text_muted":"#6B6B6B"}}"##,
        )
        .ok();

        let list = scan(&root);
        assert_eq!(list.len(), 1);
        let d = &list[0];
        assert_eq!(d.kind, "deck");
        assert_eq!(d.title, "Blue Professional");
        assert_eq!(d.palette, ["#FDFAE7", "#1E2BFA", "#111111", "#6B6B6B"]);
        assert_eq!(d.best_for, "B2B SaaS pitches.");
    }

    #[test]
    fn sorts_wireframes_before_critique_before_decks() {
        let root = fixture();
        make_skill(&root, "wireframe-sketch", "a sketch");
        make_skill(&root, "critique", "a review");
        let deck = root.join("html-zzz");
        std::fs::create_dir_all(&deck).ok();
        std::fs::write(deck.join("SKILL.md"), "---\nname: x\n---\n").ok();
        std::fs::write(deck.join("example.html"), "<html></html>").ok();
        std::fs::write(deck.join("template.json"), r##"{"name":"Zeds"}"##).ok();

        let templates = scan(&root);
        let kinds: Vec<&str> = templates.iter().map(|t| t.kind.as_str()).collect();
        assert_eq!(kinds, ["wireframe", "critique", "deck"]);
    }

    #[test]
    fn frontmatter_description_handles_block_and_quoted_forms() {
        assert_eq!(
            frontmatter_description("---\nname: x\ndescription: |\n  line one\n  line two\n---\nbody"),
            Some("line one line two".to_string())
        );
        assert_eq!(
            frontmatter_description("---\ndescription: \"quoted value\"\n---\n"),
            Some("quoted value".to_string())
        );
        assert_eq!(frontmatter_description("---\nname: x\n---\n"), None);
    }

    #[test]
    fn humanize_capitalizes_dash_separated_words() {
        assert_eq!(humanize("wireframe-greybox"), "Wireframe Greybox");
        assert_eq!(humanize("critique"), "Critique");
        assert_eq!(humanize("html-ppt-retro-windows"), "Html Ppt Retro Windows");
    }
}