import { readFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { UIProvider } from './ui-provider.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const publicDir = join(__dirname, '../public')

/**
 * DefaultUIProvider - Serves the built-in chat UI
 * 
 * Provides the default nickname-based authentication experience
 * with vanilla HTML/CSS/JavaScript
 */
export class DefaultUIProvider extends UIProvider {
  constructor (options = {}) {
    super()
    this.publicDir = options.publicDir || publicDir
  }

  async getIndexHtml (context) {
    try {
      let html = await readFile(join(this.publicDir, 'index.html'), 'utf-8')
      html = html.replace(/__BASE_PATH__/g, context.basePath || '')
      return html
    } catch (error) {
      console.error('Failed to load index.html:', error)
      throw error
    }
  }

  async getStylesheet (context) {
    try {
      return await readFile(join(this.publicDir, 'style.css'), 'utf-8')
    } catch (error) {
      console.error('Failed to load style.css:', error)
      throw error
    }
  }

  async getClientScript (context) {
    try {
      return await readFile(join(this.publicDir, 'client.mjs'), 'utf-8')
    } catch (error) {
      console.error('Failed to load client.mjs:', error)
      throw error
    }
  }
}
