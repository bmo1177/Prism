import { useState } from "react";
import { Check, ExternalLink, KeyRound, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProviderInfo } from "@ai4s/sdk";
import { getClient } from "@/lib/runtime";
import { isTauri, openExternal } from "@/lib/tauri";
import { toast } from "@/lib/toast";
import { inputCls } from "./inputCls";

/** Guided BYOK quick-connect for the two shapes of user-supplied keys:
 *  a *free* key (OpenRouter, NVIDIA — sign up, copy, paste) and a *paid or
 *  custom* key/endpoint (any OpenAI- or Anthropic-compatible URL, via the
 *  custom-endpoint form further down). The catalog connect flow above already
 *  accepts every provider key; these cards just make the two common journeys
 *  one click, link straight to the key page, and say which tier is free.
 */

interface KeyCard {
  providerID: string;
  titleKey: "byok.openrouterTitle" | "byok.nvidiaTitle";
  hintKey: "byok.openrouterHint" | "byok.nvidiaHint";
  freeKey: "byok.openrouterFree" | "byok.nvidiaFree";
  keyUrl: string;
}

const FREE_KEY_CARDS: readonly KeyCard[] = [
  {
    providerID: "openrouter",
    titleKey: "byok.openrouterTitle",
    hintKey: "byok.openrouterHint",
    freeKey: "byok.openrouterFree",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    providerID: "nvidia",
    titleKey: "byok.nvidiaTitle",
    hintKey: "byok.nvidiaHint",
    freeKey: "byok.nvidiaFree",
    keyUrl: "https://build.nvidia.com/settings/api-keys",
  },
];

interface ByokQuickConnectProps {
  providers: ProviderInfo[];
  busy: boolean;
  /** Ask the page to open the custom-endpoint form (paid / self-hosted keys). */
  onOpenCustom: () => void;
  /** Refresh the provider list after a key lands. */
  onConnected: () => void;
}

export function ByokQuickConnect({ providers, busy, onOpenCustom, onConnected }: ByokQuickConnectProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const saveKey = async (providerID: string) => {
    const key = (keys[providerID] ?? "").trim();
    const client = getClient();
    if (!client || !key || saving) return;
    setSaving(providerID);
    try {
      await client.setProviderApiKey(providerID, key);
      setKeys((k) => ({ ...k, [providerID]: "" }));
      toast.success(t("toast.providerConnected", { providerID }));
      onConnected();
    } catch (e) {
      toast.error(`${t("toast.couldNotSaveKey")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  if (!isTauri) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">{t("byok.hint")}</p>
      <div className="grid gap-2 md:grid-cols-2">
        {FREE_KEY_CARDS.map((card) => {
          const connected = providers.some((p) => p.id === card.providerID);
          const savingThis = saving === card.providerID;
          return (
            <div key={card.providerID} className="rounded-input border border-border bg-surface-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <KeyRound size={13} className="shrink-0 text-muted" />
                <span className="text-[13px] font-medium text-text">{t(card.titleKey)}</span>
                <span className="ml-auto rounded-full bg-ok/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ok">
                  {t(card.freeKey)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t(card.hintKey)}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="password"
                  value={keys[card.providerID] ?? ""}
                  onChange={(e) => setKeys((k) => ({ ...k, [card.providerID]: e.target.value }))}
                  placeholder={t("byok.apiKeyPlaceholder")}
                  aria-label={`${t(card.titleKey)} ${t("byok.apiKeyPlaceholder")}`}
                  className={inputCls("min-w-0 flex-1 font-mono")}
                />
                <button
                  className="flex h-9 shrink-0 items-center gap-1 rounded-input bg-accent px-3 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent/90 disabled:text-muted disabled:bg-surface-2"
                  onClick={() => void saveKey(card.providerID)}
                  disabled={busy || savingThis || !(keys[card.providerID] ?? "").trim()}
                >
                  {savingThis ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                  {connected ? t("byok.replace") : t("byok.connect")}
                </button>
              </div>
              <button
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                onClick={() => void openExternal(card.keyUrl)}
              >
                <ExternalLink size={11} /> {t("byok.getFreeKey", { url: card.keyUrl.replace("https://", "") })}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-input border border-border bg-surface-2 px-3 py-2.5">
        <span className="text-[13px] font-medium text-text">{t("byok.customTitle")}</span>
        <span className="min-w-0 flex-1 text-xs text-muted">{t("byok.customHint")}</span>
        <button
          className="flex h-8 shrink-0 items-center gap-1 rounded-input border border-border bg-surface px-2.5 text-xs text-text transition-colors hover:bg-border/40"
          onClick={onOpenCustom}
        >
          <Plus size={12} /> {t("byok.customConnect")}
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">{t("byok.storageNote")}</p>
    </div>
  );
}
