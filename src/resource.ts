import { Uri } from 'coc.nvim';
import { URL, URLSearchParams } from 'url';
import { readFile } from './util';

export class ResourceUri {
  static parse(urlOrStr: string): ResourceUri | undefined;
  static parse(urlOrStr: URL): ResourceUri;
  static parse(urlOrStr: URL | string) {
    let url: URL;
    try {
      url = typeof urlOrStr === 'string' ? new URL(urlOrStr) : urlOrStr;
    } catch (_) {
      return undefined;
    }
    return new ResourceUri(url);
  }

  public readonly params: URLSearchParams;
  public readonly isResource: boolean;
  public readonly fsPath: string | undefined;

  constructor(public readonly url: URL) {
    this.params = new URLSearchParams(this.url.search);
    this.isResource = this.url.pathname.startsWith('/resources');
    this.fsPath = this.params.get('fsPath') ?? undefined;
  }

  async readFile() {
    if (this.fsPath) {
      const content = await readFile(this.fsPath);
      return content;
    } else {
      return '';
    }
  }
}

/**
 * Construct a uri that can load resources inside a webview
 *
 * We encode the resource component of the uri so that on the main thread
 * we know where to load the resource from (remote or truly local):
 *
 * ```txt
 * ${scheme}://${resource-authority}/resources/resourceId=${resource_id}
 * ```
 *
 * @param resource Uri of the resource to load.
 */
export function asWebviewUri(resource: Uri, options: { host: string; port: number }): Uri {
  if (resource.scheme === 'http' || resource.scheme === 'http') {
    return resource;
  }

  return Uri.from({
    scheme: 'http',
    authority: `${options.host}:${options.port}`,
    path: `resources?fsPath=${encodeURIComponent(resource.fsPath)}`,
  });
}
