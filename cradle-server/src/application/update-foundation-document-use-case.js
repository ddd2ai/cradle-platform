import { ApiError } from "../api/api-error.js";

export class UpdateFoundationDocumentUseCase {
  constructor({ foundationDocumentStore }) {
    this.foundationDocumentStore = foundationDocumentStore;
  }

  async execute({ documentId, content, expectedRevision }) {
    if (typeof expectedRevision !== "string" || expectedRevision.trim() === "") {
      throw new ApiError({
        status: 400,
        code: "FOUNDATION_REVISION_REQUIRED",
        message: "expectedRevision is required to update a Foundation document.",
      });
    }

    try {
      return {
        document: await this.foundationDocumentStore.write(documentId, {
          content,
          expectedRevision,
        }),
      };
    } catch (error) {
      if (error.code === "FOUNDATION_DOCUMENT_NOT_FOUND") {
        throw new ApiError({ status: 404, code: error.code, message: error.message });
      }
      if (error.code === "FOUNDATION_REVISION_CONFLICT") {
        throw new ApiError({
          status: 409,
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }
      if (error.code === "FOUNDATION_DOCUMENT_INVALID") {
        throw new ApiError({ status: 400, code: error.code, message: error.message });
      }
      throw error;
    }
  }
}
