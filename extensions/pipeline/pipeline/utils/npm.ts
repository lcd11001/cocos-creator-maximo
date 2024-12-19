import { Asset, assetManager, resources, path as ccpath } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';

let useNpm = (EDITOR || globalThis.electron);

export const GAME_VIEW = (cc as any).GAME_VIEW
export const fse = useNpm && globalThis.require('fs-extra');
export const path = useNpm && globalThis.require('path');
export const Editor = useNpm && globalThis.Editor;
export const projectPath = EDITOR && Editor.Project.path;
export const projectAssetPath = EDITOR && path.join(projectPath, 'assets');
export const globby = useNpm && globalThis.require('globby');

export const InPlayMode = GAME_VIEW || !EDITOR

export const resUrl = 'db://assets/resources/'

export function readFile (path) {
    try {
        return fse.readFileSync(path, 'utf8');
    }
    catch (err) {
        console.error(err);
    }
}

export async function loadResource (url: string, cb?: Function): Promise<Asset> {
    let resourcePath = await getAssetPath(url);

    return new Promise((resolve, reject) => {
        function onLoad (err: Error, asset: Asset) {
            if (err) {
                // console.error(err);
                reject(err);
                return;
            }

            if (cb) {
                cb(asset);
            }
            resolve(asset);
        }

        if (!InPlayMode) {
            let metaPath = resourcePath + '.meta'
            try {
                let json = fse.readFileSync(metaPath, 'utf8');
                json = JSON.parse(json);
                assetManager.loadAny([json.uuid], onLoad);
            }
            catch (err) {
                // console.error(err);
            }
        }
        else {
            url = ccpath.changeExtname(url, '');
            resources.load(url, onLoad)
        }
    })
}

export async function getAssetPath (url: string) {
    return await Editor.Message.request('asset-db', 'query-path', url);
}


export async function saveString (relativePath: string, str: string) {
    let dst = await getAssetPath(relativePath);

    fse.ensureDirSync(path.dirname(dst));
    fse.writeFileSync(dst, str);
}

export async function loadResources (relDir: string) {
    if (!InPlayMode) {
        let absDir = await getAssetPath(relDir);
        let metaPaths = globby.sync(absDir + '/**/*.meta');
        if (metaPaths) {
            return await Promise.all(metaPaths.map(async metaPath => {
                return new Promise((resolve, reject) => {
                    let json = fse.readFileSync(metaPath, 'utf8');
                    json = JSON.parse(json);
                    assetManager.loadAny([json.uuid], (err: Error, asset: Asset) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(asset);
                    });
                })
            }))
        }
    }
    else {
        return await new Promise((resolve, reject) => {
            resources.loadDir(relDir, (err: Error, as: Asset[]) => {
                if (err) {
                    return reject(err);
                }

                resolve(as);
            })
        })
    }
}
