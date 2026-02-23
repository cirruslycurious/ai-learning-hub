// Client
export {
  createEventBridgeClient,
  getDefaultClient,
  resetDefaultClient,
} from "./client.js";

// Emitter
export { emitEvent, type EventEntry } from "./emitter.js";

// Init helper — call once at module scope (cold start)
import { getDefaultClient as _getDefaultClient } from "./client.js";

export function requireEventBus() {
  const busName = process.env.EVENT_BUS_NAME;
  if (!busName && process.env.NODE_ENV !== "test")
    throw new Error("EVENT_BUS_NAME env var is not set");
  return { busName: busName ?? "", ebClient: _getDefaultClient() };
}

// Event catalog — Saves domain
export {
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
  type SaveCreatedRestoredDetail,
  type SaveUpdatedDetail,
  type SaveDeletedDetail,
  type SavesEventMap,
} from "./events/saves.js";
