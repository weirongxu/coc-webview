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
    // viewType
    'markdown-preview-enhanced',
    // title
    `Preview ${path.basename(sourceUri.fsPath)}`,
    {
      // open in browser
      openURL: true,
      // route name
      routeName: 'markdown-preview-enhanced',
    },
    {
      localResourceRoots: [...],
      enableScripts: true,
    }
  );
}
```

## Configurations

Usage: https://github.com/neoclide/coc.nvim/wiki/Using-the-configuration-file

- `webview.debug`: Enable debug mode
- `webview.colorStrategy`: Color strategy for webview
- `webview.primaryColors`: Primary colors for webview
- `webview.host`: Listen host for webview service
- `webview.minPort`: Mix port for webview service
- `webview.maxPort`: Max port for webview service
- `webview.openCommand`: Command template for open webview, arguments(%u webview url), example: `chrome "%u"`

## TODO

- [x] dark mode
- [ ] reveal highlight
- [ ] display iconPath
- [ ] vim keybinding
- [ ] cspSource

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
