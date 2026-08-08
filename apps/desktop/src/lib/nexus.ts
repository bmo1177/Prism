// The app's single NexusClient (packages/sdk): the one door the UI uses to
// reach OpenCode and the platform's HTTP services. `initNexus` runs once at
// connect time with the live OpenCodeClient; in the gateway-served web client
// the run/provenance services point at the same-origin /v1 contract, so the
// identical desktop behavior works from a phone browser. Desktop mode wires
// only the OpenCode client (run/provenance persistence stays on Tauri
// commands); `getNexus()` then returns null until connect.
import { createNexusClient, type NexusClient, type OpenCodeClient } from "@ai4s/sdk";
import { gatewayOrigin, gatewayToken, isGatewayWeb } from "./webMode";

let nexus: NexusClient | null = null;

export function initNexus(openCode: OpenCodeClient): NexusClient {
  nexus = createNexusClient({
    openCode,
    runUrl: isGatewayWeb ? gatewayOrigin() : undefined,
    provenanceUrl: isGatewayWeb ? gatewayOrigin() : undefined,
    password: isGatewayWeb ? gatewayToken() ?? undefined : undefined,
  });
  return nexus;
}

export function getNexus(): NexusClient | null {
  return nexus;
}
