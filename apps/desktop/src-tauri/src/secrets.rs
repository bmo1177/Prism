// Provider API keys belong in the OS keychain (AGENTS.md safety default: "API
// keys go to the OS keychain / credential manager; never into provenance, logs,
// crash reports, git, or exported projects"). In practice the OpenCode sidecar
// keeps working copies of credentials in its app-private config files — it
// reads plain files by design — so this module makes the OS keychain the
// *persistent, user-deletable* authority for the BYOK keys Prism knows about:
// every key the app stores is mirrored in here, a startup pass mirrors keys
// that arrived from older installs or the sidecar's own config writes, and
// `forget_provider_key` (runtime command) purges the machine copies on user
// request.
//
// One entry per provider, keyed by user string `provider/<id>` under the
// com.prism.desktop service. Failures degrade gracefully: callers log them
// (without any secret content) and carry on with the plaintext sidecar copies
// they already have — a headless Linux session without a Secret Service daemon
// must not lose BYOK entirely.

use keyring::Entry;

const SERVICE: &str = "com.prism.desktop";

fn entry(provider: &str) -> Result<Entry, String> {
    let provider = provider.trim();
    if provider.is_empty() {
        return Err("empty provider".to_string());
    }
    Entry::new(SERVICE, &format!("provider/{provider}")).map_err(|e| format!("keychain entry: {e}"))
}

/// Store (or replace) a provider's API key in the OS keychain. Both inputs are
/// trimmed; empty ones are caller errors above the keychain surface.
pub fn store_provider_key(provider: &str, api_key: &str) -> Result<(), String> {
    let provider = provider.trim();
    let api_key = api_key.trim();
    if provider.is_empty() {
        return Err("empty provider".to_string());
    }
    if api_key.is_empty() {
        return Err("empty key".to_string());
    }
    entry(provider)?.set_password(api_key).map_err(keychain_err)
}

/// The stored key for a provider, or None when the keychain has no entry.
/// Used by the startup mirror (skip the rewrite when it already holds the
/// same key) and by the tests reading entries back.
pub fn provider_key(provider: &str) -> Result<Option<String>, String> {
    match entry(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        // "Not stored yet" is a normal state, distinct from a failing
        // platform store.
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keychain_err(e)),
    }
}

/// Delete a provider's keychain entry. Ok(false) when it was never stored.
pub fn forget_provider_key(provider: &str) -> Result<bool, String> {
    match entry(provider)?.delete_credential() {
        Ok(()) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(keychain_err(e)),
    }
}

/// Errors from the keychain never echo the secret itself (variants describe
/// the platform condition; message texts embed no credential content).
fn keychain_err(e: keyring::Error) -> String {
    match e {
        keyring::Error::PlatformFailure(m) => format!("keychain platform: {m}"),
        keyring::Error::NoStorageAccess(m) => format!("keychain inaccessible: {m}"),
        other => format!("keychain: {other}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn use_mock_store() {
        // Each test gets a ITS OWN in-memory store: entries never leak across
        // tests, and no platform keychain is touched.
        keyring_core::set_default_store(keyring_core::mock::Store::new().unwrap());
    }

    fn unique_provider(tag: &str) -> String {
        use std::sync::atomic::{AtomicU64, Ordering};
        static N: AtomicU64 = AtomicU64::new(0);
        format!("{tag}-{}", N.fetch_add(1, Ordering::Relaxed))
    }

    #[test]
    fn stores_reads_and_replaces_a_key() {
        use_mock_store();
        let p = unique_provider("openrouter");
        store_provider_key(&p, "sk-or-v1-test").unwrap();
        assert_eq!(provider_key(&p).unwrap().as_deref(), Some("sk-or-v1-test"));
        store_provider_key(&p, "sk-replaced").unwrap();
        assert_eq!(provider_key(&p).unwrap().as_deref(), Some("sk-replaced"));
    }

    #[test]
    fn read_for_a_missing_provider_is_none_not_an_error() {
        use_mock_store();
        let p = unique_provider("never-stored");
        assert_eq!(provider_key(&p).unwrap(), None);
    }

    #[test]
    fn forget_reports_whether_something_was_stored() {
        use_mock_store();
        let p = unique_provider("anthropic");
        assert!(!forget_provider_key(&p).unwrap());
        store_provider_key(&p, "sk-test").unwrap();
        assert!(forget_provider_key(&p).unwrap());
        // Gone, not just marked.
        assert_eq!(provider_key(&p).unwrap(), None);
        // Forgetting twice is still fine.
        assert!(!forget_provider_key(&p).unwrap());
    }

    #[test]
    fn empty_inputs_are_rejected_before_touching_the_keychain() {
        use_mock_store();
        assert!(store_provider_key("", "k").is_err());
        assert!(store_provider_key("  ", "k").is_err());
        assert!(store_provider_key("p", "  ").is_err());
        assert!(provider_key("").is_err());
        assert!(forget_provider_key("").is_err());
    }

    #[test]
    fn values_are_trimmed_on_the_way_in() {
        use_mock_store();
        let p = unique_provider("trimmed");
        store_provider_key(&p, "\n sk-test \n").unwrap();
        assert_eq!(provider_key(&p).unwrap().as_deref(), Some("sk-test"));
    }
}
