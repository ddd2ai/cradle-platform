export class ArtifactMutationCoordinator {
  #tails = new Map();

  async runExclusive(artifactId, operation) {
    if (!artifactId || typeof operation !== "function") {
      throw new Error("ArtifactMutationCoordinator requires artifactId and operation");
    }

    const previous = this.#tails.get(artifactId) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => current);
    this.#tails.set(artifactId, tail);

    await previous.catch(() => {});
    try {
      return await operation();
    } finally {
      release();
      if (this.#tails.get(artifactId) === tail) {
        this.#tails.delete(artifactId);
      }
    }
  }
}

export const defaultArtifactMutationCoordinator =
  new ArtifactMutationCoordinator();
