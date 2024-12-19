import { Asset, assetManager, Component, Mesh, MeshRenderer, Node, path, _decorator } from "cc";

import { Editor, globby, path as npmPath, projectPath, fse } from './npm'

const { ccclass, property } = _decorator;

@ccclass('SwitchLod')
export class SwitchLod extends Component {
    @property
    lodLevel = 0

    @property
    get switch () {
        return false
    }
    set switch (s) {
        this.doSwitch()
    }

    @property(Node)
    target: Node | undefined

    async doSwitch () {
        if (!this.target) return

        console.log('start switch lod')

        let startTime = Date.now()

        let mrs = this.target.getComponentsInChildren(MeshRenderer);
        await Promise.all(mrs.map(async (mr, i) => {
            let url = mr.mesh.nativeUrl
            let uuid = path.basename(url)
            uuid = uuid.split('@')[0]

            let p = await Editor.Message.request('asset-db', 'query-path', uuid);
            if (!path.basename(p).startsWith('lod_')) {
                return;
            }

            let gltfs = globby.sync(path.dirname(p) + '/**/*.gltf');
            gltfs.sort((a, b) => {
                return a.localeCompare(b)
            })

            let gltfPath = gltfs[Math.min(gltfs.length - 1, this.lodLevel)]
            let relPath = npmPath.relative(projectPath, gltfPath).replace(/\\/g, '/')
            let meshName = npmPath.basename(npmPath.dirname(gltfPath))
            let gltfUrl = `db://${relPath}/${meshName}.mesh`;
            console.log(`switch progress : ${i / (mrs.length - 1)}`)

            let gltfUuid = await Editor.Message.request('asset-db', 'query-uuid', gltfUrl);
            let mesh: Mesh = await new Promise((resolve, reject) => {
                assetManager.loadAny([gltfUuid], (err: Error, asset: Mesh) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(asset);
                });
            })

            mr.mesh = mesh
        }))

        console.log(`finish switch lod : ${(Date.now() - startTime) / 1000}s`)
    }
}
