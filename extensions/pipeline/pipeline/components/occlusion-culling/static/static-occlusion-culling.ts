import { Camera, Component, director, geometry, gfx, MeshRenderer, Node, Quat, renderer, Vec2, Vec3, _decorator, ccenum, Color, Mat4, InstancedBuffer, instantiate, assetManager, Material, Vec4, Layers, RenderTexture, game, js, Director, CCObject, primitives } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { Pool } from './utils/pool';
import raycast from './utils/raycast';
import raycastGpu from './utils/raycast-gpu';
import { StaticOcclusionArea } from './static-occlusion-area';
import { CullingBlock } from './static-occlusion-block';
import { modelPoints, sphereDirections } from './utils/utils';
import { getGeometryRenderer } from '../../../utils/debug';
import { NodeIDManager } from '../../node-id-manager';
import { StaticOcclusionBaker } from './static-occlusion-baker';
import { NodeID } from '../../node-id';

const { ccclass, property, type, executeInEditMode } = _decorator;

let _tempOBB = new geometry.OBB();
let _tempRay = new geometry.Ray();

enum CornerType {
    Center,
    Corner8_Center,
    Seprate_Corner8_Center,
}
ccenum(CornerType);


@ccclass('sync.StaticOcclusionCulling')
@executeInEditMode
export class StaticOcclusionCulling extends Component {
    @type(Node)
    root: Node | null = null;

    @type(Node)
    target: Node | null = null;

    @property
    _blockSize = 3;
    @property
    get blockSize () {
        return this._blockSize;
    }
    set blockSize (v) {
        this._blockSize = v;
    }

    @property
    _rendererCount = 0;
    @property
    get rendererCount () {
        return this._rendererCount;
    }

    _backer: StaticOcclusionBaker | undefined
    @property
    get bake () {
        return false;
    }
    set bake (v) {
        this.startBake(this.areas.concat())
    }

    @property
    get stop () {
        return false;
    }
    set stop (v) {
        if (this._backer) {
            this._backer.stop();
        }
    }

    @property
    get checkEmptyArea () {
        return false
    }
    set checkEmptyArea (v) {
        console.log('--------------')
        this._updateAreas()
        this.areas.forEach(a => {
            if (a.isEmpty) {
                console.log(`Area [${a.node.name}] is empty`)
            }
        })
    }

    @property
    renderBlocks = false;

    @property
    _enabledCulling = true;
    @property
    get enabledCulling () {
        return this._enabledCulling;
    }
    set enabledCulling (v) {
        this._enabledCulling = v;

        if (!v) {
            let renderers = this.renderers;
            for (let i = 0; i < renderers.length; i++) {
                if (renderers[i] && renderers[i].model) {
                    renderers[i].model.enabled = true;
                }
            }
        }

        this._lastLocatedBlock = null;

        (window as any).cce.Engine.repaintInEditMode();
    }

    nodeIDManager: NodeIDManager | undefined

    _renderers: MeshRenderer[] = []
    get renderers () {
        return this._renderers;
    }

    _loadCompeleted = false;
    _currentLocatedBlock: CullingBlock | null = null
    _lastLocatedBlock: CullingBlock | null = null

    areas: StaticOcclusionArea[] = []
    _updateAreas () {
        this.areas = this.getComponentsInChildren(StaticOcclusionArea);
    }

    onDisable () {
        let renderers = this.renderers;
        for (let i = 0; i < renderers.length; i++) {
            if (renderers[i] && renderers[i].model) {
                renderers[i].model.enabled = true;
            }
        }
        this._lastLocatedBlock = null;
    }

    start () {
        this._init();
    }

    startBake (areas: StaticOcclusionArea[]) {
        this._backer = new StaticOcclusionBaker(this, areas)
        this._backer.start()
    }

    _findIDManager () {
        this.nodeIDManager = null;
        let root = this.root
        while (!this.nodeIDManager && root) {
            this.nodeIDManager = root.getComponent(NodeIDManager);
            root = root.parent;
        }
    }

    _init () {
        this._updateAreas();
        this._findIDManager();

        let ids = this.root?.getComponentsInChildren(NodeID);
        this._renderers = ids.map(id => id.getComponent(MeshRenderer))
        this._loadCompeleted = true;
    }

    calcCulling () {
        if (!this.target || !this.target.isValid || !this._loadCompeleted || this._backer || !this.target) {
            return
        }

        this._currentLocatedBlock = null;

        let renderers = this.renderers;
        let worldPos = this.target.worldPosition;
        let areas = this.areas;
        for (let i = 0; i < areas.length; i++) {
            let area = areas[i];
            if (!area.enabledInHierarchy) {
                continue;
            }

            _tempOBB.center.set(area.node.worldPosition);
            let worldScale = area.node.getWorldScale();
            _tempOBB.halfExtents.set(worldScale.x / 2, worldScale.y / 2, worldScale.z / 2);

            if (!geometry.intersect.obbPoint(_tempOBB, worldPos as Vec3)) {
                continue;
            }

            if (area.discardCulling) {
                this._currentLocatedBlock = null;
                for (let i = 0; i < renderers.length; i++) {
                    let model = renderers[i] && renderers[i].model;
                    if (model) {
                        model.enabled = true;
                    }
                }
                return;
            }

            let blockSize = this.blockSize;
            if (area.useSelfBlockSize) {
                blockSize = area.blockSize;
            }
            let x = Math.floor((worldPos.x - (_tempOBB.center.x - _tempOBB.halfExtents.x)) / blockSize);
            let y = Math.floor((worldPos.y - (_tempOBB.center.y - _tempOBB.halfExtents.y)) / blockSize);
            let z = Math.floor((worldPos.z - (_tempOBB.center.z - _tempOBB.halfExtents.z)) / blockSize);

            let xCount = Math.floor(worldScale.x / blockSize);
            let yCount = Math.floor(worldScale.y / blockSize);
            let zCount = Math.floor(worldScale.z / blockSize);

            let blocks = area.blocks;
            let index = x * yCount * zCount + y * zCount + z;
            let block = blocks[index];
            if (!block) {
                continue;
            }

            this._currentLocatedBlock = block;

            break;
        }

        if (this._lastLocatedBlock === this._currentLocatedBlock) {
            return;
        }

        if (!this._currentLocatedBlock) {
            for (let i = 0; i < renderers.length; i++) {
                let model = renderers[i] && renderers[i].model;
                if (model) {
                    model.enabled = true;
                }
            }
        }
        else {
            let block = this._currentLocatedBlock;

            for (let i = 0; i < renderers.length; i++) {
                let model = renderers[i] && renderers[i].model;
                if (model) {
                    model.enabled = false;
                }
            }

            let rendererIDs = block.rendererIDs
            for (let i = 0; i < rendererIDs.length; i++) {
                let r = this.nodeIDManager.mrMap.get(rendererIDs[i])
                let model = r && r.model;
                if (model) {
                    // if (!model.enabled) {
                    //     model._uboDirty = true
                    // }
                    model.enabled = true;
                }
            }

        }

        this._lastLocatedBlock = this._currentLocatedBlock;
    }

    update () {
        if (EDITOR_NOT_IN_PREVIEW) {
            this._updateAreas();
        }

        if (this._enabledCulling) {
            this.calcCulling();
        }

        if (EDITOR_NOT_IN_PREVIEW) {
            if (this._backer) {
                (window as any).cce.Engine.repaintInEditMode();
            }
            if (this.renderBlocks) {
                this.debugDraw();
            }
        }
    }

    debugDraw () {
        let geometryRenderer = getGeometryRenderer();
        if (!geometryRenderer) {
            return;
        }

        let areaColor = new Color(0, 0, 0, 100);
        let blockColor = new Color(255, 0, 0, 100);
        let locateBlockColor = new Color(0, 0, 255, 20);
        let tempMatrix = new Mat4();
        let identityAABB = new geometry.AABB(0, 0, 0, 0.5, 0.5, 0.5);

        for (let i = 0; i < this.areas.length; i++) {
            let area = this.areas[i];
            if (!area.enabledInHierarchy) continue;
            geometryRenderer.addBoundingBox(identityAABB, areaColor, false, false, undefined, true, area.node.worldMatrix);
        }

        if (this._currentLocatedBlock) {
            let block = this._currentLocatedBlock

            let tempScale = Pool.Vec3.get().set(block.halfExtents.x * 2, block.halfExtents.y * 2, block.halfExtents.z * 2 * block.bakingProcess);
            tempMatrix.fromRTS(Quat.IDENTITY as Quat, block.center as Vec3, tempScale);
            Pool.Vec3.put(tempScale);

            geometryRenderer.addBoundingBox(identityAABB, blockColor, false, false, undefined, true, tempMatrix);

            let corners = block.getCorners()
            corners.forEach(c => {
                geometryRenderer.addSphere(c, 0.1, blockColor, 5, 5);
            })
        }


        // this.areas.forEach(area => {
        //     let blocks = area.blocks;
        //     for (let i = 0; i < blocks.length; i++) {
        //         let block = blocks[i];

        //         let tempScale = Pool.Vec3.get().set(block.halfExtents.x * 2, block.halfExtents.y * 2, block.halfExtents.z * 2 * block.bakingProcess);
        //         tempMatrix.fromRTS(Quat.IDENTITY as Quat, block.center as Vec3, tempScale);
        //         Pool.Vec3.put(tempScale);

        //         let color = blockColor;
        //         if (block === this._currentLocatedBlock) {
        //             color = locateBlockColor;
        //         }

        //         geometryRenderer.addBoundingBox(identityAABB, color, false, false, undefined, true, tempMatrix);

        //         // if (this.renderRaycast /*&& block === this._currentLocatedBlock*/) {
        //         //     drawer.type = DrawType.Line;
        //         //     drawer.matrix.fromRTS(Quat.IDENTITY as Quat, Vec3.ZERO as Vec3, Vec3.ONE as Vec3);

        //         //     let lines: Vec3[][] = []
        //         //     if (this.shouldFastBack) {
        //         //         let directions = sphereDirections(this.sphereBakeCount)
        //         //         for (let i = 0; i < directions.length; i++) {
        //         //             directions[i].multiplyScalar(this.renderRaycastLength).add(block.center)
        //         //             lines.push([block.center, directions[i]])
        //         //         }
        //         //     }
        //         //     else {
        //         //         let corners: Vec3[] = [block.center];
        //         //         // for (let x = -1; x <= 1; x += 2) {
        //         //         //     for (let y = -1; y <= 1; y += 2) {
        //         //         //         for (let z = -1; z <= 1; z += 2) {
        //         //         //             corners.push(new Vec3(block.center).add3f(block.halfExtents.x * x, block.halfExtents.y * y, block.halfExtents.z * z));
        //         //         //         }
        //         //         //     }
        //         //         // }

        //         //         if (!this.useGpu) {
        //         //             for (let i = 0; i < corners.length; i++) {
        //         //                 let points = modelPoints(this.models);
        //         //                 points.forEach(p => {
        //         //                     lines.push([corners[i], p])
        //         //                 })
        //         //             }
        //         //         }
        //         //         else {
        //         //             // let results = raycastGpu.raycastModels(models, corners, points);
        //         //             // results.forEach(m => {
        //         //             //     let r = m.node.getComponent(MeshRenderer);
        //         //             //     if (r && block.renderers.indexOf(r) === -1) {
        //         //             //         block.renderers.push(r);
        //         //             //     }
        //         //             // })
        //         //         }
        //         //     }

        //         //     drawer.line(...lines)
        //         // }
        //     }
        // })
    }
}
