/**
 * application-event-stream.js
 *
 * ⚠️  Backward-compatibility facade — 請勿在新程式碼中直接 import 此檔。
 *
 * 新架構請使用:
 *   import { RuntimeEventBus }       from './runtime-event-bus.js'
 *   import { RuntimeEventAggregator } from './runtime-event-aggregator.js'
 *   import { SseRuntimeEventTransport } from './runtime/sse-runtime-event-transport.js'
 *
 * 此 facade 確保現有測試與舊 import 路徑不需修改。
 */

export { RuntimeEventBus as ApplicationEventStream } from "./runtime-event-bus.js";

export {
  createApplicationEventResponse,
  formatServerSentEvent,
} from "../api/sse-transport.js";
