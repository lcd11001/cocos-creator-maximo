import { EDITOR as _EDITOR } from 'cc/env';

import { log as cclog, warn as ccwarn, error as ccerror } from 'cc';

export const EDITOR = _EDITOR;

export const io = EDITOR && (window as any).require('socket.io');
export const ws = EDITOR && (window as any).require('ws');
export const path = EDITOR && (window as any).require('path');
export const fse = EDITOR && (window as any).require('fs-extra');
export const base642arraybuffer = EDITOR && (window as any).require('base64-arraybuffer');
export const Sharp = EDITOR && (window as any).require('sharp');
export const Buffer = EDITOR && (window as any).Buffer;
export const globby = EDITOR && (window as any).require('globby');
export const request = EDITOR && (window as any).require('request');

globalThis.fse = fse
globalThis.path = path
globalThis.globby = globby

if (Sharp) {
    Sharp.cache(false);
}

export function formatPath (p: string) {
    return p.replace(/\\/g, '/');
}

export function relpaceExt (fspath: string, extname: string) {
    let basename = path.basename(fspath).replace(path.extname(fspath), extname)
    return path.join(path.dirname(fspath), basename);
}


export const cce = EDITOR && (window as any).cce;
export const EditorExtends = EDITOR && (window as any).EditorExtends;
export const Editor = EDITOR && (window as any).Editor;
export const projectPath = EDITOR && formatPath(Editor.Project.path);
export const projectAssetPath = EDITOR && formatPath(path.join(projectPath, 'assets'));
export const projectTempPath = EDITOR && formatPath(path.join(projectPath, 'temp'));


export function log (...args: any[]) {
    ccwarn(...args);
}
export function warn (...args: any[]) {
    ccwarn(...args);
}

export function error (...args: any[]) {
    ccerror(...args);
}

export function download (url: string, path: string) {
    return new Promise((resolve, reject) => {
        request.head(url, (err: Error, res: any, body: any) => {
            if (err) {
                return reject(err)
            }
            request(url)
                .pipe(fse.createWriteStream(path))
                .on('close', () => {
                    resolve(null)
                })
        })
    })
}

export function repaintInEditMode () {
    cce.Engine.repaintInEditMode()
}
