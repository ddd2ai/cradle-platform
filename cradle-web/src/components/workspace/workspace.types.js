/**
 * @typedef {"directory" | "file"} WorkspaceNodeType
 *
 * @typedef {object} WorkspaceNode
 * @property {string} name
 * @property {string} path
 * @property {WorkspaceNodeType} type
 * @property {number=} size
 * @property {string=} mimeType
 * @property {string=} modifiedAt
 * @property {boolean=} hasChildren
 * @property {WorkspaceNode[]=} children
 * @property {boolean=} childrenLoaded
 *
 * @typedef {object} WorkspaceFilePreview
 * @property {string} name
 * @property {string} path
 * @property {string} mimeType
 * @property {number} size
 * @property {string=} modifiedAt
 * @property {string=} encoding
 * @property {string=} content
 * @property {boolean} truncated
 * @property {boolean} previewable
 */

export {};
