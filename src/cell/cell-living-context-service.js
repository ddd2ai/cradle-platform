import fs from "fs/promises";

import {
  createLivingContext,
  normalizeLivingContext,
} from "../living-context/living-context-schema.js";

export class CellLivingContextService {
  constructor({ cell } = {}) {
    if (!cell) {
      throw new Error("CellLivingContextService requires cell");
    }

    this.cell = cell;
  }

  async prepareLivingContext() {
    await fs.mkdir(this.cell.rootDir, {
      recursive: true,
    });

    let profile = null;

    try {
      profile = await this.cell.readProfile();
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    const safeProfile =
      profile && typeof profile === "object"
        ? profile
        : {};

    const profileResponsibilities =
      Array.isArray(safeProfile.responsibilities)
        ? safeProfile.responsibilities
        : [];

    const existingContext =
      await this.cell.readLivingContext();

    if (!existingContext) {
      const context = createLivingContext({
        cellId: this.cell.id,

        purpose:
          typeof safeProfile.purpose === "string"
            ? safeProfile.purpose
            : "",

        responsibilities:
          profileResponsibilities,
      });

      await this.cell.writeLivingContext(context);

      return context;
    }

    const mergedContext =
      normalizeLivingContext({
        ...existingContext,

        cellId: this.cell.id,

        responsibilities: [
          ...(existingContext.responsibilities ?? []),
          ...profileResponsibilities,
        ],
      });

    const previousResponsibilities =
      normalizeLivingContext({
        ...existingContext,
        cellId: this.cell.id,
      }).responsibilities;

    const responsibilitiesChanged =
      JSON.stringify(previousResponsibilities) !==
      JSON.stringify(
        mergedContext.responsibilities
      );

    if (responsibilitiesChanged) {
      await this.cell.writeLivingContext(
        mergedContext
      );
    }

    return mergedContext;
  }
}
