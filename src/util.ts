import { HelperLogger } from 'coc-helper';
import fs from 'fs';
import util from 'util';

export const logger = new HelperLogger('webview');

export const readFile = util.promisify(fs.readFile);
