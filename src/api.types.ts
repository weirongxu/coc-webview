/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Thenable, Uri } from 'coc.nvim';

/**
 * Content settings for a webview.
 */
export interface WebviewOptions {
  /**
   * TODO
   *
   * Controls whether scripts are enabled in the webview content or not.
   *
   * Defaults to false (scripts-disabled).
   */
  readonly enableScripts?: boolean;

  /**
   * Set of root paths from which the webview can load local resources.
   */
  readonly localResourceRoots?: Uri[];

  // /**
  //  * Controls whether command uris are enabled in webview content or not.
  //  *
  //  * Defaults to false.
  //  */
  // readonly enableCommandUris?: boolean;

  // /**
  //  * Mappings of localhost ports used inside the webview.
  //  *
  //  * Port mapping allow webviews to transparently define how localhost ports are resolved. This can be used
  //  * to allow using a static localhost port inside the webview that is resolved to random port that a service is
  //  * running on.
  //  *
  //  * If a webview accesses localhost content, we recommend that you specify port mappings even if
  //  * the `webviewPort` and `extensionHostPort` ports are the same.
  //  *
  //  * *Note* that port mappings only work for `http` or `https` urls. Websocket urls (e.g. `ws://localhost:3000`)
  //  * cannot be mapped to another port.
  //  */
  // readonly portMapping?: readonly WebviewPortMapping[];
}

/**
 * Displays html content, similarly to an iframe.
 */
export interface Webview {
  /**
   * Content settings for the webview.
   */
  options: WebviewOptions;

  /**
   * HTML contents of the webview.
   *
   * This should be a complete, valid html document. Changing this property causes the webview to be reloaded.
   *
   * Webviews are sandboxed from normal extension process, so all communication with the webview must use
   * message passing. To send a message from the extension to the webview, use {@link Webview.postMessage `postMessage`}.
   * To send message from the webview back to an extension, use the `acquireVsCodeApi` function inside the webview
   * to get a handle to the editor's api and then call `.postMessage()`:
   *
   * ```html
   * <script>
   *     const vscode = acquireVsCodeApi(); // acquireVsCodeApi can only be invoked once
   *     vscode.postMessage({ message: 'hello!' });
   * </script>
   * ```
   *
   * To load a resources from the workspace inside a webview, use the `{@link Webview.asWebviewUri asWebviewUri}` method
   * and ensure the resource's directory is listed in {@link WebviewOptions.localResourceRoots `WebviewOptions.localResourceRoots`}.
   *
   * Keep in mind that even though webviews are sandboxed, they still allow running scripts and loading arbitrary content,
   * so extensions must follow all standard web security best practices when working with webviews. This includes
   * properly sanitizing all untrusted input (including content from the workspace) and
   * setting a [content security policy](https://aka.ms/vscode-api-webview-csp).
   */
  html: string;

  /**
   * Fired when the webview content posts a message.
   *
   * Webview content can post strings or json serializable objects back to an extension. They cannot
   * post `Blob`, `File`, `ImageData` and other DOM specific objects since the extension that receives the
   * message does not run in a browser environment.
   */
  readonly onDidReceiveMessage: Event<any>;

  /**
   * Post a message to the webview content.
   *
   * Messages are only delivered if the webview is live (either visible or in the
   * background with `retainContextWhenHidden`).
   *
   * @param message Body of the message. This must be a string or other json serializable object.
   */
  postMessage(message: any): Thenable<boolean>;

  /**
   * Convert a uri for the local file system to one that can be used inside webviews.
   *
   * Webviews cannot directly load resources from the workspace or local file system using `file:` uris. The
   * `asWebviewUri` function takes a local `file:` uri and converts it into a uri that can be used inside of
   * a webview to load the same resource:
   *
   * ```ts
   * webview.html = `<img src="${webview.asWebviewUri(Uri.file('/Users/codey/workspace/cat.gif'))}">`
   * ```
   */
  asWebviewUri(localResource: Uri): Uri;

  /**
   * TODO
   *
   * Content security policy source for webview resources.
   *
   * This is the origin that should be used in a content security policy rule:
   *
   * ```
   * img-src https: ${webview.cspSource} ...;
   * ```
   */
  readonly cspSource: string;
}

/**
 * Event fired when a webview panel's view state changes.
 */
export interface WebviewPanelOnDidChangeViewStateEvent {
  /**
   * Webview panel whose view state changed.
   */
  readonly webviewPanel: WebviewPanel;
}

/**
 * A panel that contains a webview.
 */
export interface WebviewPanel {
  /**
   * Identifies the type of the webview panel, such as `'markdown.preview'`.
   */
  readonly viewType: string;

  /**
   * Title of the panel shown in UI.
   */
  title: string;

  /**
   * TODO
   *
   * Icon for the panel shown in UI.
   */
  iconPath?: Uri | { light: Uri; dark: Uri };

  /**
   * {@link Webview `Webview`} belonging to the panel.
   */
  readonly webview: Webview;

  /**
   * Route name settings for the webview panel.
   */
  readonly routeName: string;

  /**
   * Whether the panel is active (focused by the user).
   */
  readonly active: boolean;

  /**
   * Whether the panel is visible.
   */
  readonly visible: boolean;

  /**
   * Fired when the panel's view state changes.
   */
  readonly onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;

  /**
   * Fired when the panel is disposed.
   *
   * This may be because the user closed the panel or because `.dispose()` was
   * called on it.
   *
   * Trying to use the panel after it has been disposed throws an exception.
   */
  readonly onDidDispose: Event<void>;

  /**
   * Highlight this webview and open to browser
   */
  reveal(options: { openURL: boolean }): void;

  /**
   * Dispose of the webview panel.
   *
   * This closes the panel if it showing and disposes of the resources owned by the webview.
   * Webview panels are also disposed when the user closes the webview panel. Both cases
   * fire the `onDispose` event.
   */
  dispose(): any;
}
