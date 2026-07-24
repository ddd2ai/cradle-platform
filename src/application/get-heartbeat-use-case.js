export class GetHeartbeatUseCase {
  constructor({ heartbeatModeStoreFactory }) {
    this.heartbeatModeStoreFactory = heartbeatModeStoreFactory;
  }

  async execute() {
    const mode = await this.heartbeatModeStoreFactory().getMode();

    return { mode };
  }
}
