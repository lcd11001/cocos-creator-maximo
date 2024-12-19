import { BatchingUtility, Component, director, geometry, gfx, Mat4, Material, Mesh, MeshRenderer, Node, renderer, utils, Vec3, Vec4, _decorator } from "cc";
import { powerOfTwo } from "../../utils/math";
import { MeshData, saveGltf, toGltfMesh } from "./save-gltf";
import { StaticBatchComp } from "./static-batch-comp";

const { ccclass, executeInEditMode, property } = _decorator

@ccclass('SubMeshRenderer')
class SubMeshRenderer {
    index: number;
    mr: MeshRenderer

    constructor (index: number, mr: MeshRenderer) {
        this.index = index;
        this.mr = mr
    }
}

@ccclass('StaticAreaBatchBlock')
class StaticAreaBatchBlock {
    name = ''
    aabb = new geometry.AABB
    renderers: Map<Material, SubMeshRenderer[]> = new Map

    @property
    _totalCount = 0;
    @property
    get totalCount () {
        return this._totalCount;
    }

    _materialCount = 0
    @property
    get materialCount () {
        return this._materialCount;
    }
}

let tempVec3 = new Vec3


@ccclass('StaticAreaBatch')
@executeInEditMode
export class StaticAreaBatch extends Component {
    @property(Node)
    root: Node | undefined

    @property
    get merge () {
        return false
    }
    set merge (v) {
        this.doMerge()
    }

    @property
    get search () {
        return false
    }
    set search (v) {
        this.doSearch()
    }

    @property
    get revert () {
        return false
    }
    set revert (v) {
        this.doRevert()
    }

    @property
    get clear () {
        return false
    }
    set clear (v) {
        this.doClear()
    }

    @property
    blockSize = new Vec3(30, 30, 30)
    @property
    offset = new Vec3(-15, -15, -15)

    @property
    maxLightMapSize = 1024


    @property
    get totalBatch () {
        let count = 0
        this.blocks.forEach(b => {
            count += b.materialCount
        })
        return count
    }

    blockMap: Map<string, StaticAreaBatchBlock> = new Map

    @property(StaticAreaBatchBlock)
    blocks: StaticAreaBatchBlock[] = []

    doClear () {
        this.root.active = true;
        this.node.removeAllChildren()
        this.blocks.length = 0;
        this.blockMap.clear()
    }
    doRevert () {
        this.root.active = !this.root.active;
        let children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            children[i].active = !this.root.active
        }
    }

    totalRenderers: MeshRenderer[] = []

    @property
    _totalCount = 0;
    @property
    get totalCount () {
        return this._totalCount;
    }

    async doMerge () {
        await this.doSearch();

        let processedCount = 0;
        let toProcessCount = this._totalCount;

        let startTime = Date.now()


        let tempMin = new Vec3
        let tempMax = new Vec3
        let tempNormal = new Vec4
        let tempMat4 = new Mat4

        this.node.removeAllChildren();
        for (let blockPair of this.blockMap) {
            let block = blockPair[1];
            let center = block.aabb.center;
            let node = new Node(block.name)
            node.parent = this.node;
            node.position = center;
            node.active = false

            for (let rendPair of block.renderers) {
                let renderers = rendPair[1]

                let countPerRow = Math.ceil(Math.pow(renderers.length, 0.5));

                let startVerticeIdx = 0
                let meshData = new MeshData
                let min = new Vec3(Infinity, Infinity, Infinity)
                let max = new Vec3(-Infinity, -Infinity, -Infinity)
                let lightMapSize = 0;

                let subfix = 0;
                let end = async () => {
                    meshData.min.set(min).subtract(center);
                    meshData.max.set(max).subtract(center);

                    let mat = rendPair[0]
                    let name = block.name + '_' + mat.name;
                    let gltf = toGltfMesh(name, meshData);
                    let gltfUrl = `db://assets/${director.getScene().name}/merged-meshes/${name}.gltf`;
                    let meshUrl = gltfUrl + `/${name}.mesh`
                    let mesh = await saveGltf(gltf, gltfUrl, meshUrl)

                    let sub = new Node(mat.name + (subfix++));

                    let mr = sub.addComponent(MeshRenderer);
                    mr.mesh = mesh
                    mr.material = mat

                    sub.addComponent(StaticBatchComp);

                    mr.bakeSettings.bakeable = true;
                    mr.bakeSettings.castShadow = true;
                    mr.bakeSettings.receiveShadow = true;
                    mr.bakeSettings.lightmapSize = Math.min(this.maxLightMapSize, powerOfTwo(lightMapSize));

                    sub.parent = node;
                }

                for (let i = 0; i < renderers.length; i++) {
                    let mr = renderers[i].mr
                    let idx = renderers[i].index

                    let pos = mr.mesh.readAttribute(idx, gfx.AttributeName.ATTR_POSITION);
                    let mergedVertexCount = (meshData.vertices.length + pos.length) / 3
                    if (mergedVertexCount > 65535) {
                        console.warn(`${block.name}-${rendPair[0].name} vertex count overflow 65535`)

                        await end();

                        startVerticeIdx = 0
                        meshData = new MeshData
                        min = new Vec3(Infinity, Infinity, Infinity)
                        max = new Vec3(-Infinity, -Infinity, -Infinity)
                    }
                    for (let pi = 0; pi < pos.length; pi += 3) {
                        tempVec3.set(pos[pi], pos[pi + 1], pos[pi + 2])
                        Vec3.transformMat4(tempVec3, tempVec3, mr.node.worldMatrix)
                        meshData.vertices.push(tempVec3.x - center.x, tempVec3.y - center.y, tempVec3.z - center.z);
                    }

                    let uv0 = mr.mesh.readAttribute(idx, gfx.AttributeName.ATTR_TEX_COORD);
                    meshData.uv.push(...uv0);

                    Mat4.inverseTranspose(tempMat4, mr.node.worldMatrix);
                    let normals = mr.mesh.readAttribute(idx, gfx.AttributeName.ATTR_NORMAL);
                    for (let ni = 0; ni < normals.length; ni += 3) {
                        tempNormal.set(normals[ni], normals[ni + 1], normals[ni + 2], 0)
                        Vec4.transformMat4(tempNormal, tempNormal, tempMat4)
                        tempNormal.normalize();
                        meshData.normals.push(tempNormal.x, tempNormal.y, tempNormal.z)
                    }

                    mr.model.worldBounds.getBoundary(tempMin, tempMax);
                    Vec3.min(min, min, tempMin)
                    Vec3.max(max, max, tempMax)

                    let uv1 = mr.mesh.readAttribute(idx, gfx.AttributeName.ATTR_TEX_COORD1);
                    let uv1OffsetX = i % countPerRow;
                    let uv1OffsetY = Math.floor(i / countPerRow);
                    for (let uvi = 0; uvi < uv1.length; uvi += 2) {
                        meshData.uv1.push(
                            (uv1OffsetX + uv1[uvi]) / countPerRow,
                            (uv1OffsetY + uv1[uvi + 1]) / countPerRow
                        );
                    }


                    let indices = mr.mesh.readIndices(idx);
                    for (let i = 0; i < indices.length; i++) {
                        meshData.indices.push(indices[i] + startVerticeIdx);
                    }

                    startVerticeIdx += pos.length / 3;

                    lightMapSize += mr.bakeSettings.lightmapSize;

                    let totalProcess = ++processedCount / toProcessCount;
                    let costTime = (Date.now() - startTime) / 1000;
                    let leftTime = Math.floor((costTime / totalProcess) * (1 - totalProcess));

                    console.log(`static merge progress : ${totalProcess}, leftTime: ${leftTime}s`)
                }

                await end();

            }
        }

        this.doRevert()

        console.log(`finished static merge progress.`)
    }

    async doSearch () {
        if (!this.root) {
            return
        }

        this.root.active = true;
        globalThis.cce.Engine.repaintInEditMode()
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        })

        let mrs = this.root.getComponentsInChildren(MeshRenderer);
        mrs = mrs.filter(mr => {
            return mr.enabledInHierarchy;
        })

        this.totalRenderers = mrs;

        let blockSize = this.blockSize
        let blockMap = this.blockMap
        blockMap.clear()
        let blocks = this.blocks;
        blocks.length = 0
        mrs.forEach(mr => {
            let pos = mr.model.worldBounds.center;
            let x = Math.floor((pos.x + this.offset.x) / blockSize.x);
            let y = Math.floor((pos.y + this.offset.y) / blockSize.y);
            let z = Math.floor((pos.z + this.offset.z) / blockSize.z);

            let name = `${x}_${y}_${z}`
            let block = blockMap.get(name)
            if (!block) {
                block = new StaticAreaBatchBlock
                block.aabb.halfExtents.multiply(blockSize).multiplyScalar(0.5);
                block.aabb.center.set(x, y, z).multiply(blockSize)
                block.aabb.center.add(block.aabb.halfExtents)
                block.aabb.center.subtract(this.offset)
                block.name = name;

                blockMap.set(name, block)
                blocks.push(block)
            }

            mr.sharedMaterials.forEach((mat, idx) => {
                let smr = new SubMeshRenderer(idx, mr)
                if (!mat) {
                    console.warn(`${mr.model.node.name} material ${idx} is empty`)
                    return;
                }
                if (!mr.model.subModels[idx]) {
                    return;
                }
                let renderers = block.renderers.get(mat)
                if (!renderers) {
                    renderers = []
                    block._materialCount++;
                    block.renderers.set(mat, renderers);
                }
                block._totalCount++;
                this._totalCount++;
                renderers.push(smr);
            })
        })
    }
}

