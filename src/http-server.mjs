/**
 * HTTP Server - Registers HTTP routes for serving chat UI assets
 * 
 * This module is responsible only for HTTP asset serving.
 * It delegates to a UIProvider for the actual content.
 * 
 * Separation: HTTP routing is separate from WebSocket protocol.
 */

function normalizeBasePath (basePath) {
  if (!basePath) return ''
  if (basePath === '/') return ''
  if (!basePath.startsWith('/')) basePath = '/' + basePath
  return basePath.replace(/\/$/, '')
}

/**
 * Register HTTP routes for serving UI assets
 * @param {object} router - Express-compatible router
 * @param {UIProvider} uiProvider - Provider for UI assets
 * @param {string} basePath - Base path for routes
 */
export function registerHttpRoutes (router, uiProvider, basePath = '') {
  if (!router) {
    console.warn('No router provided - HTTP routes not registered')
    return
  }

  if (!uiProvider) {
    console.log('No UI provider - running in headless mode')
    return
  }

  basePath = normalizeBasePath(basePath)

  // Serve index.html
  router.get(basePath + '/', async (req, res) => {
    try {
      const html = await uiProvider.getIndexHtml({ basePath, request: req })
      if (html === null) {
        res.status(404).send('Not Found')
        return
      }
      res.type('html').send(html)
    } catch (error) {
      console.error('Error serving index.html:', error)
      res.status(500).send('Internal Server Error')
    }
  })

  // Serve style.css
  router.get(basePath + '/style.css', async (req, res) => {
    try {
      const css = await uiProvider.getStylesheet({ basePath, request: req })
      if (css === null) {
        res.status(404).send('Not Found')
        return
      }
      res.type('text/css').send(css)
    } catch (error) {
      console.error('Error serving style.css:', error)
      res.status(500).send('Internal Server Error')
    }
  })

  // Serve client.mjs
  router.get(basePath + '/client.mjs', async (req, res) => {
    try {
      const js = await uiProvider.getClientScript({ basePath, request: req })
      if (js === null) {
        res.status(404).send('Not Found')
        return
      }
      res.type('text/javascript').send(js)
    } catch (error) {
      console.error('Error serving client.mjs:', error)
      res.status(500).send('Internal Server Error')
    }
  })
}
