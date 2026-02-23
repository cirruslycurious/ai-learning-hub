// Client
export {
  createEventBridgeClient,
  getDefaultClient,
  resetDefaultClient,
} from "./client.js";

// Emitter
export { emitEvent, type EventEntry } from "./emitter.js";

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
