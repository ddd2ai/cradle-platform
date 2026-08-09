export class RuntimeEventClient {
  connect() {}

  disconnect() {}

  subscribe(_listener) {
    throw new Error("subscribe(listener) must be implemented");
  }

  subscribeConnection(_listener) {
    throw new Error("subscribeConnection(listener) must be implemented");
  }
}
