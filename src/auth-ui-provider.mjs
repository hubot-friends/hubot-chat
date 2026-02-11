import { DefaultUIProvider } from './default-ui-provider.mjs'

/**
 * AuthUIProvider - Serves UI with authentication configuration
 * 
 * Extends DefaultUIProvider to inject authentication configuration
 * into the HTML. The client can read this config and render the
 * appropriate authentication UI (login form, SSO button, etc.)
 */
export class AuthUIProvider extends DefaultUIProvider {
  constructor (authConfig, options = {}) {
    super(options)
    this.authConfig = this.normalizeAuthConfig(authConfig)
  }

  normalizeAuthConfig (auth) {
    if (!auth) {
      return { type: 'nickname', fields: ['nickname'] }
    }

    return {
      type: auth.type || 'nickname',
      fields: auth.fields || this.getDefaultFields(auth.type),
      labels: auth.labels || {},
      hints: auth.hints || {},
      placeholder: auth.placeholder || {}
    }
  }

  getDefaultFields (type) {
    switch (type) {
      case 'login':
        return ['username', 'password']
      case 'sso':
        return ['provider']
      case 'token':
        return []
      case 'nickname':
      default:
        return ['nickname']
    }
  }

  async getIndexHtml (context) {
    let html = await super.getIndexHtml(context)
    
    // Inject auth configuration into the HTML
    const authConfigJson = JSON.stringify(this.authConfig)
    html = html.replace(/__AUTH_CONFIG__/g, authConfigJson)
    
    return html
  }
}

/**
 * CustomUIProvider - Serves completely custom UI from a specified directory
 * 
 * Allows consuming applications to provide their own HTML/CSS/JS files
 */
export class CustomUIProvider extends DefaultUIProvider {
  constructor (customPath) {
    super({ publicDir: customPath })
  }
}
