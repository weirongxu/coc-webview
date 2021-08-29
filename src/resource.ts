import { Uri } from 'coc.nvim';
import { v1 as uuidV1 } from 'uuid';
import { readFile } from './util';

export const resourceStores = new Map<string, string>();

export async function readResourceFile(resourceId: string) {
  const fsPath = resourceStores.get(resourceId);
  if (fsPath) {
    const content = await readFile(fsPath);
    return content;
  } else {
    return '';
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function asWebviewUri(resource: Uri, options: { host: string; port: number }): Uri {
  if (resource.scheme === 'http' || resource.scheme === 'http') {
    return resource;
  }

  const resourceId = uuidV1();
  resourceStores.set(resourceId, resource.fsPath);
  return Uri.from({
    scheme: 'http',
    authority: `${options.host}:${options.port}`,
    path: `resources/${resourceId}`,
  });
}
