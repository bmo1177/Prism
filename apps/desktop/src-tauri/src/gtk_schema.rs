// On distros where gtk3's GSettings schema `org.gtk.Settings.FileChooser` is
// missing from XDG_DATA_DIRS (NixOS system profiles ship gtk4 only), opening
// any native file dialog aborts the whole app with
// "Settings schema 'org.gtk.Settings.FileChooser' is not installed"
// (GLib-GIO-ERROR -> SIGABRT). The loaded libgtk-3's own package always
// carries the schema; find that package from /proc/self/maps and point
// GSETTINGS_SCHEMA_DIR at its schemas dir before GIO initializes its
// settings backend. No-op when the schema is already findable, when no gtk3
// is loaded, or off Linux.
use std::path::{Path, PathBuf};

/// The gtk3 package root, from the mapped path of the loaded libgtk-3
/// (…/lib/libgtk-3.so.0 -> …). `None` when gtk3 is not loaded.
fn gtk_root_from_maps(maps: &str) -> Option<PathBuf> {
    for line in maps.lines() {
        let mut it = line.split_whitespace();
        let _ = it.next()?; // address range
        let _ = it.next()?; // perms
        let _ = it.next()?; // offset
        let _ = it.next()?; // dev
        let _ = it.next()?; // inode
        let path = it.next()?;
        if path.starts_with('/') && path.contains("libgtk-3.so") {
            return Path::new(path).parent()?.parent().map(Path::to_path_buf);
        }
    }
    None
}

/// The first schemas dir under `root` that holds a compiled schema database:
/// plain `share/glib-2.0/schemas`, plus every `share/gsettings-schemas/<pkg>/glib-2.0/schemas`
/// (the NixOS layout).
pub fn schema_dir_for_root(root: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = vec![root.join("share/glib-2.0/schemas")];
    let nix_dir = root.join("share/gsettings-schemas");
    if let Ok(entries) = std::fs::read_dir(&nix_dir) {
        for entry in entries.flatten() {
            candidates.push(entry.path().join("glib-2.0/schemas"));
        }
    }
    candidates
        .into_iter()
        .find(|dir| dir.join("gschemas.compiled").is_file())
}

/// Point GSETTINGS_SCHEMA_DIR at the loaded gtk3's schemas when it is not set.
/// Called twice: once at startup (before GTK loads — may silently no-op) and
/// again in the Tauri `.setup()` hook (after GTK is loaded — finds the schema
/// from `/proc/self/maps` on the second pass).
///
/// On NixOS the gtk3 package lives in the Nix store and its schemas are not on
/// the system XDG_DATA_DIRS, so without this the native file dialog aborts the
/// whole app with "Settings schema 'org.gtk.Settings.FileChooser' is not
/// installed" (GLib-GIO-ERROR → SIGABRT) the moment it opens.
pub fn ensure_file_chooser_schema() {
    if std::env::var_os("GSETTINGS_SCHEMA_DIR").is_some() {
        return;
    }
    // 1) Try the loaded gtk3 library from /proc/self/maps (works after GTK init).
    //    Maps entries can wrap across lines (the path may be split), so also
    //    search the raw text for the libgtk-3.so path as a fallback.
    if let Ok(maps) = std::fs::read_to_string("/proc/self/maps") {
        if let Some(root) = gtk_root_from_maps(&maps) {
            if let Some(dir) = schema_dir_for_root(&root) {
                eprintln!("[gtk_schema] using schema dir from /proc/self/maps: {}", dir.display());
                std::env::set_var("GSETTINGS_SCHEMA_DIR", &dir);
                return;
            }
        }
        // Fallback: regex search for any libgtk-3.so path in the maps text.
        if let Some(root) = gtk_root_from_raw_maps(&maps) {
            if let Some(dir) = schema_dir_for_root(&root) {
                eprintln!("[gtk_schema] using schema dir from raw maps search: {}", dir.display());
                std::env::set_var("GSETTINGS_SCHEMA_DIR", &dir);
                return;
            }
        }
    }
    // 2) Fallback: search the standard XDG data directories for the compiled
    //    schema database. This catches the case where the function runs before
    //    GTK is loaded (e.g. at the top of main) and /proc/self/maps has no
    //    libgtk-3.so entry yet.
    let xdg_dirs = std::env::var("XDG_DATA_DIRS")
        .unwrap_or_else(|_| "/usr/local/share:/usr/share".to_string());
    for base in xdg_dirs.split(':') {
        let candidate = Path::new(base).join("glib-2.0/schemas");
        if candidate.join("gschemas.compiled").is_file() {
            eprintln!("[gtk_schema] using schema dir from XDG_DATA_DIRS: {}", candidate.display());
            std::env::set_var("GSETTINGS_SCHEMA_DIR", &candidate);
            return;
        }
    }
    eprintln!("[gtk_schema] WARNING: no gtk3 schema dir found — native file dialogs may crash");
}

/// Fallback parser: search the raw /proc/self/maps text for any path containing
/// `libgtk-3.so` and derive the package root from it. This handles cases where
/// the line-based parser misses the entry (e.g. wrapped lines or unusual
/// formatting).
fn gtk_root_from_raw_maps(maps: &str) -> Option<PathBuf> {
    for line in maps.lines() {
        // Look for any path segment containing libgtk-3.so
        for word in line.split_whitespace() {
            if word.starts_with('/') && word.contains("libgtk-3.so") {
                let path = Path::new(word);
                // Derive root: …/<pkg>/lib/libgtk-3.so.0 -> …/<pkg>
                if let Some(root) = path.parent()?.parent() {
                    return Some(root.to_path_buf());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_finds_the_loaded_gtk() {
        let maps = "7f0000000000-7f0000010000 r-xp 00000000 00:30 123 /nix/store/abc-gtk+3-3.24.52/lib/libgtk-3.so.0\n\
                    7f0000010000-7f0000020000 r--p 00010000 00:30 124 /nix/store/abc-gtk+3-3.24.52/lib/libgtk-3.so.0";
        assert_eq!(
            gtk_root_from_maps(maps),
            Some(PathBuf::from("/nix/store/abc-gtk+3-3.24.52"))
        );
    }

    #[test]
    fn maps_ignores_other_libraries() {
        assert_eq!(gtk_root_from_maps("… /usr/lib/libgio-2.0.so.0\n"), None);
    }

    #[test]
    fn finds_plain_schemas_dir() {
        let dir = std::env::temp_dir().join("gtk-schema-probe-plain");
        std::fs::create_dir_all(dir.join("share/glib-2.0/schemas")).unwrap();
        std::fs::write(
            dir.join("share/glib-2.0/schemas/gschemas.compiled"),
            b"x",
        )
        .unwrap();
        assert_eq!(
            schema_dir_for_root(&dir),
            Some(dir.join("share/glib-2.0/schemas"))
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn finds_nixos_gsettings_schemas_dir() {
        let dir = std::env::temp_dir().join("gtk-schema-probe-nixos");
        std::fs::create_dir_all(
            dir.join("share/gsettings-schemas/gtk+3-3.24.52/glib-2.0/schemas"),
        )
        .unwrap();
        std::fs::write(
            dir.join("share/gsettings-schemas/gtk+3-3.24.52/glib-2.0/schemas/gschemas.compiled"),
            b"x",
        )
        .unwrap();
        assert_eq!(
            schema_dir_for_root(&dir),
            Some(
                dir.join("share/gsettings-schemas/gtk+3-3.24.52/glib-2.0/schemas")
            )
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn no_schemas_means_none() {
        let dir = std::env::temp_dir().join("gtk-schema-probe-none");
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(schema_dir_for_root(&dir), None);
        std::fs::remove_dir_all(&dir).ok();
    }
}
