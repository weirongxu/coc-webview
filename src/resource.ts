import { isWindows } from 'coc-helper';
import { Uri } from 'coc.nvim';
import path from 'path';
import { URL } from 'url';
import { baseHost, ServerBinded, ServerRoute } from './server';
import { logger, readFile } from './util';

const fsPathSet = new Set<string>();
const resourceRootSet = new Set<string>();
const resourceRouteName = 'resources';

export class ResourceUri {
  static parse(urlOrStr: string, binded: ServerBinded): ResourceUri | undefined;
  static parse(urlOrStr: URL, binded: ServerBinded): ResourceUri;
  static parse(urlOrStr: URL | string, binded: ServerBinded) {
    let url: URL;
    try {
      url = typeof urlOrStr === 'string' ? new URL(urlOrStr) : urlOrStr;
    } catch (_) {
      return undefined;
    }
    return new ResourceUri(url, binded);
  }

  public readonly forbidden: boolean;
  public readonly isResource: boolean;
  public readonly localPath: string | undefined;

  constructor(public readonly url: URL, readonly binded: ServerBinded) {
    [this.isResource, this.localPath] = this.parseLocalPath(binded);
    this.forbidden = this.getForbidden();
  }

  private parseLocalPath(binded: ServerBinded): [isResource: boolean, localPath: string | undefined] {
    if (this.url.hostname !== binded.host) {
      return [false, undefined];
    }
    const [, routeName, ...remainPath] = this.url.pathname.split('/');
    if (routeName !== resourceRouteName) {
      return [false, undefined];
    }
    let localPath = remainPath.join('/');
    if (!isWindows) {
      localPath = `/${localPath}`;
    }
    return [true, path.resolve(localPath)];
  }

  private getForbidden() {
    if (!this.localPath) {
      return true;
    }
    if (fsPathSet.has(this.localPath)) {
      return false;
    }
    for (const root of resourceRootSet) {
      if (this.localPath.startsWith(root)) {
        return false;
      }
    }
    return true;
  }

  async readFile(): Promise<Buffer> {
    if (this.forbidden || !this.localPath) {
      throw new Error('forbidden');
    }
    const content = await readFile(this.localPath);
    return content;
  }
}

/**
 * Construct a uri that can load resources inside a webview
 *
 * We encode the resource component of the uri so that on the main thread
 * we know where to load the resource from (remote or truly local):
 *
 * @param resource Uri of the resource to load.
 */
export function asWebviewUri(resource: Uri, binded: ServerBinded): Uri {
  if (resource.scheme === 'http' || resource.scheme === 'http') {
    return resource;
  }

  const fsPath = resource.fsPath;
  fsPathSet.add(fsPath);
  const uri = Uri.from({
    scheme: 'http',
    authority: baseHost(binded),
    path: path.join(resourceRouteName, fsPath),
  });

  return uri;
}

export function updateRoutes(routes: Map<string, ServerRoute>) {
  resourceRootSet.clear();
  for (const [, route] of routes) {
    if (route.localResourceRoots) {
      for (const root of route.localResourceRoots) {
        resourceRootSet.add(root.fsPath);
      }
    }
  }
}
