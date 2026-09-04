import { listSupportedArtifactTypes } from "../production/artifact-type-catalog.js";

export class ListArtifactTypesUseCase {
  execute() {
    return {
      items: listSupportedArtifactTypes(),
      defaultMode: "absorb",
      selectionAuthority: "explicit",
    };
  }
}
