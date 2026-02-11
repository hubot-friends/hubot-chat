/**
 * UIProvider - Abstract interface for serving chat UI assets
 * 
 * This interface defines the contract for serving HTML, CSS, and JavaScript
 * assets for the chat application. Implementations can provide different
 * UI experiences (default, auth-aware, custom, etc.)
 */
export class UIProvider {
  /**
   * Get the main HTML page
   * @param {object} context - Request context { basePath, request }
   * @returns {Promise<string>} HTML content
   */
  async getIndexHtml (context) {
    throw new Error('UIProvider.getIndexHtml() must be implemented')
  }

  /**
   * Get the stylesheet
   * @param {object} context - Request context { basePath, request }
   * @returns {Promise<string>} CSS content
   */
  async getStylesheet (context) {
    throw new Error('UIProvider.getStylesheet() must be implemented')
  }

  /**
   * Get the client-side JavaScript
   * @param {object} context - Request context { basePath, request }
   * @returns {Promise<string>} JavaScript content
   */
  async getClientScript (context) {
    throw new Error('UIProvider.getClientScript() must be implemented')
  }

  /**
   * Optional: Get additional assets (images, fonts, etc.)
   * @param {string} assetPath - Path to the asset
   * @param {object} context - Request context
   * @returns {Promise<{content: Buffer|string, contentType: string}>}
   */
  async getAsset (assetPath, context) {
    return null
  }
}

/**
 * NullUIProvider - Disables UI serving (headless mode)
 */
export class NullUIProvider extends UIProvider {
  async getIndexHtml (context) {
    return null
  }

  async getStylesheet (context) {
    return null
  }

  async getClientScript (context) {
    return null
  }
}
