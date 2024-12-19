import { Camera, Component, director, geometry, gfx, MeshRenderer, Node, Quat, renderer, Vec2, Vec3, _decorator, ccenum, Color, Mat4, InstancedBuffer, instantiate, assetManager, Material, Vec4, Layers, RenderTexture, game, js, Director, CCObject, primitives } from 'cc';
import { EDITOR } from 'cc/env';
import { StaticOcclusionArea } from './static-occlusion-area';
import { CameraSetting } from '../../../camera-setting';
import { settings } from '../../../passes/setting';
import { sequence } from '../../../utils/async';
import { RenderIDMaterial } from './render-id-material';
import { StaticOcclusionCulling } from './static-occlusion-culling';
import { CullingBlock } from './static-occlusion-block';

const { ccclass, property, type, executeInEditMode } = _decorator;

let _tempOBB = new geometry.OBB();
let _tempRay = new geometry.Ray();

let _cornerResults: Map<string, renderer.scene.Model[]> = new Map

enum CornerType {
    Center,
    Corner8_Center,
    Seprate_Corner8_Center,
}
ccenum(CornerType);


const faces = [
    new Vec3(0, 0, 0),
    new Vec3(0, 90, 0),
    new Vec3(0, 180, 0),
    new Vec3(0, 270, 0),
    new Vec3(90, 0, 0),
    new Vec3(-90, 0, 0),
]

export class StaticOcclusionBaker {
    constructor (culling: StaticOcclusionCulling, areasToBake: StaticOcclusionArea[]) {
        this.culling = culling
        this._areasToBake = areasToBake;
    }

    culling: StaticOcclusionCulling

    _bakingBlockIndex = 0;

    _startTime = 0;
    _startBlockTime = 0;
    _areasToBake: StaticOcclusionArea[] = []

    stop () {
        this.culling._backer = null;
        this.culling = null;
    }

    tempRoot: Node | undefined
    tempCameras: Camera[] = []
    tempBuffer: Float32Array
    async _initTemp () {
        let now = Date.now()

        let root = new Node('test-bake')
        root.parent = director.getScene()
        // root.hideFlags = CCObject.Flags.DontSave;// | CCObject.Flags.HideInHierarchy;
        this.tempRoot = root;

        let culling = this.culling;

        let targetRoot = instantiate(culling.root);
        targetRoot.name = 'temp-root';
        (targetRoot as any)._prefab = null;
        targetRoot.parent = root;

        let loads = targetRoot.getComponentsInChildren('load_in_editor');
        loads.forEach(l => {
            l.enabled = false
        });

        let mat: Material = await new Promise((resolve) => {
            assetManager.loadAny('a9bbb759-771b-43cc-b648-59db0bace2d6', (err, mat: Material) => {
                resolve(mat)
            })
        });

        let width = game.canvas.width * 0.25;
        let height = game.canvas.height * 0.25;

        this.tempCameras = faces.map(face => {
            let cameraNode = new Node('render-id-camera')
            cameraNode.eulerAngles = face
            cameraNode.parent = root

            let cam = cameraNode.addComponent(Camera)
            cam.visibility = Layers.Enum['RENDER-ID']
            cam.fov = 90;
            cam.near = 0.1;
            cam.far = 1000;

            let s = cam.addComponent(CameraSetting)
            s.pipeline = 'forward'
            s.isMainCamera = false

            let rt = new RenderTexture()
            rt.reset({
                width: width,
                height: height,
                passInfo: new gfx.RenderPassInfo(
                    [new gfx.ColorAttachment(gfx.Format.RGBA32F)],
                    new gfx.DepthStencilAttachment(gfx.Format.DEPTH_STENCIL)
                )
            })
            cam.targetTexture = rt

            settings.renderCameras.push(cam.camera);

            return cam
        })

        this.tempBuffer = new Float32Array(width * height * 4)

        let tempMRS = this.tempRoot.getComponentsInChildren(MeshRenderer);
        tempMRS.forEach((mr, mrIdx) => {
            let render = mr.addComponent(RenderIDMaterial)

            let cullMode = mr.sharedMaterials[0].passes[0].rasterizerState.cullMode
            render.cullMode = cullMode
            render.material = mat

            render.setOCCMaterial()

            mr.node.layer = Layers.Enum['RENDER-ID']
        })
        // }

        console.log(`initBake: ${(Date.now() - now) / 1000}s`);

        (globalThis.cce).Camera._camera.visibility &= ~Layers.Enum['RENDER-ID'];

    }

    _targetActive = true
    async start () {
        let culling = this.culling;
        if (!culling) {
            return;
        }
        this.culling._findIDManager();

        _cornerResults.clear();

        this._bakingBlockIndex = 0;

        culling._renderers = culling.root!.getComponentsInChildren(MeshRenderer);
        culling._renderers.forEach((r, ri) => {
            if (r.model) {
                r.model.enabled = true
            }
        });
        culling._rendererCount = culling._renderers.length

        await this._initTemp();

        this._areasToBake.forEach(a => {
            a.initBlocks(this.culling)
        })

        this._startTime = Date.now();
        this._startBlockTime = Date.now()

        this._targetActive = culling.root.active
        culling.root.active = false

        this._bake()
    }

    async _bakeBlock (block: CullingBlock) {
        let corners = block.getCorners()

        let now = Date.now()
        let map = {}
        let cameras = this.tempCameras;

        await sequence(corners.map((corner, idx) => {
            return async () => {

                await new Promise(resolve => {
                    // console.log('bake corner : ' + idx);

                    cameras.forEach(cam => {
                        cam.node.worldPosition = corner;
                    });

                    (window as any).cce.Engine.repaintInEditMode();

                    cameras[cameras.length - 1].node.once('rendered', () => {
                        setTimeout(() => {
                            cameras.forEach(cam => {
                                let rt = cam.targetTexture;

                                let pixels = rt.readPixels(0, 0, rt.width, rt.height, this.tempBuffer as any)

                                for (let i = 0; i < pixels.length; i += 4) {
                                    let idx = pixels[i]
                                    map[idx] = 1
                                }

                            })

                            // console.log('bake corner end : ' + idx)

                            resolve(null)
                        }, 10)
                    })
                })
            }
        }))

        let ids = []
        for (let idx in map) {
            ids.push(parseInt(idx))
        }

        block.rendererIDs = ids
    }

    async _bake () {
        let culling = this.culling;
        if (!culling || !culling.root) {
            return;
        }

        if (!this._areasToBake.length) {
            return;
        }

        let area = this._areasToBake[this._areasToBake.length - 1]
        let blocks = area.blocks;

        let totalCount = area.blockCount;

        let block = blocks[this._bakingBlockIndex];
        if (block) {
            await this._bakeBlock(block);
        }

        let totalProcess = this._bakingBlockIndex / totalCount;
        console.log(`baking process : area - ${area.node.name},  block ${this._bakingBlockIndex}, progress - ${totalProcess}`)

        let costTime = (Date.now() - this._startBlockTime) / 1000;
        let leftTime = (costTime / totalProcess) * (1 - totalProcess);
        console.log(`left time : ${leftTime} s`)

        this._bakingBlockIndex++;

        if (this._bakingBlockIndex >= area.blocks.length) {
            this.onEndArea();
        }

        if (this._areasToBake.length <= 0) {
            this.onEnd();
            return;
        }

        setTimeout(() => {
            this._bake();
        }, 10)
    }

    onEndArea () {
        this._bakingBlockIndex = 0
        this._areasToBake.length -= 1;
        this._startBlockTime = Date.now()
    }

    onEnd () {
        let culling = this.culling;
        this.tempCameras.forEach(cam => {
            js.array.remove(settings.renderCameras, cam.camera)

            let tex = cam.targetTexture
            cam.targetTexture = null
            tex.destroy();
        })

        this.tempRoot.parent = null
        this.tempRoot = null

        culling._backer = null;
        culling.root.active = this._targetActive;

        (window as any).cce.Engine.repaintInEditMode();

        console.log(`bake static culling : ${(Date.now() - this._startTime) / 1000} s`)
    }
}
