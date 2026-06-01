// Stealth Init Script — runs on every page before any other scripts
// Patches all known bot detection vectors

(() => {
  // 1. navigator.webdriver — primary automation flag
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    enumerable: true,
    configurable: true
  });

  // 2. window.chrome — real Chrome has this object
  if (!window.chrome) {
    window.chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {}
    };
  }

  // 3. navigator.plugins — headless has 0 plugins, real Chrome has PDF + others
  const mockPlugins = [
    {
      name: 'Chrome PDF Plugin',
      filename: 'internal-pdf-viewer',
      description: 'Portable Document Format',
      version: undefined,
      length: 1,
      item: () => mockPlugins[0],
      namedItem: () => mockPlugins[0]
    },
    {
      name: 'Native Client',
      filename: 'internal-nacl-plugin',
      description: 'Native Client module loader',
      version: undefined,
      length: 2,
      item: (idx) => mockPlugins[1 + idx],
      namedItem: (name) => undefined
    }
  ];
  Object.defineProperty(navigator, 'plugins', {
    get: () => mockPlugins,
    enumerable: true,
    configurable: true
  });

  // 4. navigator.languages — realistic locale list
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    enumerable: true,
    configurable: true
  });

  // 5. Permissions API — headless returns prompt instantly, patch to look realistic
  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );
  }

  // 6. WebGL fingerprint — patch vendor/renderer
  const getParameterProxyHandler = {
    apply: function(target, thisArg, args) {
      const param = args[0];
      if (param === 37445) return 'Intel Inc.';           // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return target.apply(thisArg, args);
    }
  };

  const proxyGetParameter = new Proxy(WebGLRenderingContext.prototype.getParameter, getParameterProxyHandler);
  WebGLRenderingContext.prototype.getParameter = proxyGetParameter;
  if (WebGL2RenderingContext) {
    WebGL2RenderingContext.prototype.getParameter = proxyGetParameter;
  }

  // 7. Canvas fingerprint — add subtle noise
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const imageData = originalGetImageData.apply(this, args);
    // Add imperceptible noise (±1 on random pixels)
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (Math.random() < 0.05) {
        imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (Math.random() > 0.5 ? 1 : -1)));
      }
    }
    return imageData;
  };

  // 8. Notification API — headless has permission 'default', patch if needed
  if (Notification.permission === 'denied') {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'default',
      enumerable: true,
      configurable: true
    });
  }

  // 9. Remove automation-controlled CSS
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(options) {
    const shadow = originalAttachShadow.call(this, options);
    const style = document.createElement('style');
    style.textContent = `
      * { -webkit-appearance: none; }
      ::-webkit-scrollbar { width: 10px; }
    `;
    shadow.appendChild(style);
    return shadow;
  };

  // 10. Patch automation property on document
  if (window.document.documentElement.getAttribute('webdriver')) {
    window.document.documentElement.removeAttribute('webdriver');
  }

  // 11. Override Permissions.query for specific automation-related permissions
  const permissionsProxy = {
    query: async (parameters) => {
      const { name } = parameters;
      if (name === 'accelerometer' || name === 'gyroscope' || name === 'magnetometer') {
        return { state: 'denied', onchange: null };
      }
      return originalQuery ? originalQuery(parameters) : { state: 'prompt', onchange: null };
    }
  };
  Object.defineProperty(navigator, 'permissions', {
    get: () => permissionsProxy,
    enumerable: true,
    configurable: true
  });

  // 12. Screen properties — make consistent with viewport
  Object.defineProperty(screen, 'width', { get: () => 1920, enumerable: true, configurable: true });
  Object.defineProperty(screen, 'height', { get: () => 1080, enumerable: true, configurable: true });
  Object.defineProperty(screen, 'availWidth', { get: () => 1920, enumerable: true, configurable: true });
  Object.defineProperty(screen, 'availHeight', { get: () => 1040, enumerable: true, configurable: true });
  Object.defineProperty(screen, 'colorDepth', { get: () => 24, enumerable: true, configurable: true });
  Object.defineProperty(screen, 'pixelDepth', { get: () => 24, enumerable: true, configurable: true });

  // 13. History length — fresh headless starts at 1, real browser usually 2+
  if (window.history.length === 1) {
    Object.defineProperty(window.history, 'length', {
      get: () => Math.floor(Math.random() * 3) + 2,
      enumerable: true,
      configurable: true
    });
  }

  console.log('🔒 Stealth patches applied');
})();
