export class RuntimeEventTransport {
  publish(_event) {
    throw new Error("publish(event) must be implemented");
  }

  start() {}

  stop() {}
}
