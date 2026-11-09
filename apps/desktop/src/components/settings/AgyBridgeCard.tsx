import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, Plug2, RefreshCw, Square, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProviderInfo } from "@ai4s/sdk";
import { getClient } from "@/lib/runtime";
import { agyBridgeStart, agyBridgeStatus, agyBridgeStop, agyDetect, isTauri, type AgyStatus } from "@/lib/tauri";
import { toast } from "@/lib/toast";

/** agy CLI bridge card: detect the `agy` (Google Antigravity) CLI, start the
 *  local OpenAI-compatible bridge that fronts it, and register `agy` as a
 *  custom provider in OpenCode so its models appear in the normal picker.
 *  agy runs its own agent loop, so bridged models answer in chat without
 *  OpenCode tool-calls — stated on the card, not hidden. */

interface AgyBridgeCardProps {
  providers: ProviderInfo[];
  busy: boolean;
  /** Refresh the provider list after registering/removing. */
  onChanged: () => void;
}

export function AgyBridgeCard({ providers, busy, onChanged }: AgyBridgeCardProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [status, setStatus] = useState<AgyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [acting, setActing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [detected, running] = await Promise.all([agyDetect(), agyBridgeStatus()]);
      setStatus(detected);
      setBridgeRunning(running);
    } catch {
      setStatus({ found: false, path: null, version: null, models: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isTauri) return null;

  const registered = providers.some((p) => p.id === "agy");
  const disabled = busy || acting || loading;

  const startAndRegister = async () => {
    const client = getClient();
    if (!client || !status?.found) return;
    setActing(true);
    try {
      const port = await agyBridgeStart();
      setBridgeRunning(true);
      const models = status.models.map((m) => m.id);
      await client.addCustomProvider("agy", {
        name: "agy (bridged)",
        npm: "@ai-sdk/openai-compatible",
        baseURL: `http://127.0.0.1:${port}/v1`,
        models,
        contexts: {},
      });
      toast.success(t("agyBridge.started"));
      toast.success(t("agyBridge.registrationAdded", { count: models.length }));
      onChanged();
    } catch (e) {
      toast.error(`${t("agyBridge.couldNotStart")}: ${e instanceof Error ? e.message : String(e)}`);
      setBridgeRunning(await agyBridgeStatus().catch(() => false));
    } finally {
      setActing(false);
    }
  };

  const stop = async () => {
    setActing(true);
    try {
      await agyBridgeStop();
      setBridgeRunning(false);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Terminal size={13} className="text-muted" />
        <span className="text-[13px] font-medium text-text">{t("agyBridge.title")}</span>
        <span
          className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${bridgeRunning ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}
        >
          {bridgeRunning ? t("agyBridge.bridgeRunning") : t("agyBridge.bridgeStopped")}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">{t("agyBridge.hint")}</p>

      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 size={12} className="animate-spin" /> {t("agyBridge.detecting")}
        </p>
      ) : !status?.found ? (
        <div className="rounded-input bg-surface-2 px-3 py-2.5">
          <p className="text-xs text-muted">{t("agyBridge.notFound")}</p>
          <p className="mt-1 text-xs text-muted">{t("agyBridge.installHint")}</p>
          <button
            className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline"
            onClick={() => void refresh()}
            disabled={disabled}
          >
            <RefreshCw size={11} /> {t("agyBridge.recheck")}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            {t("agyBridge.found", { version: status.version ?? "?", path: status.path ?? "" })}
          </p>
          {status.models.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {status.models.map((m) => (
                <span key={m.id} title={m.name} className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text">
                  {m.id}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="flex h-9 items-center gap-1.5 rounded-input bg-accent px-3.5 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent/90 disabled:bg-accent/50"
              onClick={() => void startAndRegister()}
              disabled={disabled || bridgeRunning || registered}
            >
              {acting ? <Loader2 size={12} className="animate-spin" /> : <Plug size={13} />}
              {registered ? t("agyBridge.registered") : t("agyBridge.startRegister")}
            </button>
            <button
              className="flex h-9 items-center gap-1.5 rounded-input bg-surface-2 px-3 text-[13px] text-text transition-colors hover:bg-border/50 disabled:text-muted"
              onClick={() => void stop()}
              disabled={disabled || !bridgeRunning}
            >
              <Square size={11} /> {t("agyBridge.stop")}
            </button>
            <button
              className="flex h-9 items-center gap-1 rounded-input px-2 text-xs text-muted transition-colors hover:text-text"
              onClick={() => void refresh()}
              disabled={disabled}
            >
              <RefreshCw size={11} /> {t("agyBridge.recheck")}
            </button>
          </div>
          {(registered || bridgeRunning) && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Plug2 size={11} /> {t("agyBridge.removeHint")}
            </p>
          )}
        </>
      )}
      <p className="text-[11px] leading-relaxed text-muted">{t("agyBridge.chatOnlyNote")}</p>
    </div>
  );
}
