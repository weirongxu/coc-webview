# coc-webview

Webview panel ported to coc.nvim

## Install

`:CocInstall coc-webview`

## Lists

`:CocList webview`

## Webview as API

Install the coc-webview to `devDependencies`

```typescript
// import only type
import type { WebviewAPI, WebviewPanel } from 'coc-webview';

// fetch API
let webviewExt: Extension<WebviewAPI> | undefined;

const getWebviewAPI = () => {
  if (!webviewExt) {
    webviewExt = extensions.all.find((ext) => ext.id === 'coc-webview') as Extension<WebviewAPI> | undefined;
  }
  if (!webviewExt) {
    void window.showErrorMessage('Please install the coc-webview extension');
    throw new Error('Please install the coc-webview extension');
  }
  return webviewExt.exports;
};

// create webview panel
export async function createPanel(): Promise<WebviewPanel> {
  return getWebviewAPI().createWebviewPanel(
    // webview title
    'markdown-preview-enhanced',
    `Preview ${path.basename(sourceUri.fsPath)}`,
    {
      // open webview in browser
      openURL: true,
      // webview route name
      routeName: 'markdown-preview-enhanced',
    },
    {
      localResourceRoots: [...],
      enableScripts: true,
    }
  );
}
```

## TODO

- [ ] dark mode
- [ ] reveal highlight
- [ ] display iconPath
- [ ] vim keybinding
- [ ] cspSource

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
