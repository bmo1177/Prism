import type { ProviderInfo } from "@ai4s/sdk";

export interface ModelOption {
  key: string;
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
}

/**
 * Free-tier models served by the bundled `opencode` provider — the live
 * roster (checked against `opencode models opencode`); every entry is
 * usable with no API key. Kept as a curated list so the UI can badge free
 * models even when the provider's display names change. The seeded default
 * (`opencode/crouton-alpha-free`, see FREE_DEFAULT_MODEL) must stay in this
 * set.
 */
export const FREE_MODEL_KEYS: ReadonlySet<string> = new Set([
  "opencode/crouton-alpha-free",
  "opencode/beam-free",
  "opencode/big-pickle",
  "opencode/deepseek-v4.1-flash-free",
  "opencode/flint-40b-free",
  "opencode/glm-5.3-flash-free",
  "opencode/iceman-free",
  "opencode/inkling-2-small-free",
  "opencode/mimo-v2.6-flash-free",
  "opencode/nemotron-3.5-lightning-free",
  "opencode/nemotron-3.5-super-vl-free",
]);

/** True when the model is served free with no API key. */
export function isFreeModel(providerID: string, modelID: string): boolean {
  return FREE_MODEL_KEYS.has(`${providerID}/${modelID}`);
}

export type ModelFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "provider"; providerID: string };

export function flattenModelOptions(providers: ProviderInfo[]): ModelOption[] {
  return providers.flatMap((provider) =>
    provider.models.map((model) => ({
      key: `${provider.id}/${model.id}`,
      providerID: provider.id,
      providerName: provider.name,
      modelID: model.id,
      modelName: model.name,
    })),
  );
}

/**
 * Where the configured default model should land after a provider change made
 * it dangling (provider removed, or its models renamed): null when the default
 * is still available — or nothing is available to fall back to — otherwise the
 * closest valid "provider/model" key: the same provider's first model when the
 * provider survived, else the first model of the first provider.
 */
export function fallbackDefaultModel(providers: ProviderInfo[], defaultModel: string): string | null {
  const options = flattenModelOptions(providers);
  if (options.length === 0 || options.some((m) => m.key === defaultModel)) return null;
  const providerID = defaultModel.split("/")[0];
  return (options.find((m) => m.providerID === providerID) ?? options[0]).key;
}

function baseOptions(
  options: ModelOption[],
  filter: ModelFilter,
  favorites: string[],
  recent: string[],
): ModelOption[] {
  if (filter.kind === "provider") return options.filter((m) => m.providerID === filter.providerID);
  if (filter.kind === "favorites") {
    const favoriteSet = new Set(favorites);
    return options.filter((m) => favoriteSet.has(m.key));
  }
  if (filter.kind === "recent") {
    const byKey = new Map(options.map((model) => [model.key, model]));
    return recent.flatMap((key) => {
      const model = byKey.get(key);
      return model ? [model] : [];
    });
  }
  return options;
}

export function filterModelOptions(
  options: ModelOption[],
  filter: ModelFilter,
  query: string,
  favorites: string[],
  recent: string[],
): ModelOption[] {
  const normalized = query.trim().toLocaleLowerCase();
  const candidates = baseOptions(options, filter, favorites, recent);
  if (!normalized) return candidates;
  return candidates.filter((model) =>
    [model.modelName, model.modelID, model.providerName, model.providerID]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}
