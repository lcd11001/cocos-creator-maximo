import { Component, geometry, Vec3, _decorator } from "cc";
import { CullingBlock } from "./static-occlusion-block";
const { ccclass, type, property } = _decorator

@ccclass('sync.StaticOcclusionArea')
export class StaticOcclusionArea extends Component {
    @property
    blockCells = new Vec3();

    @property(({ type: CullingBlock, visible: false }))
    blocks: CullingBlock[] = []

    @property
    get blockCount () {
        return this.blocks.length;
    }

    @property
    get isEmpty () {
        for (let i = 0; i < this.blocks.length; i++) {
            if (!this.blocks[i].rendererCount) {
                return true
            }
        }
        return false;
    }

    @property
    blockSize = 3
    @property
    useSelfBlockSize = false

    @property
    discardCulling = false

    @property
    get bake () {
        return false
    }
    set bake (v) {
        let culling = this.node.parent.getComponent('sync.StaticOcclusionCulling') as any
        if (culling) {
            culling.startBake([this])
        }
    }

    initBlocks (culling) {
        let blockSize = culling.blockSize;
        if (this.useSelfBlockSize) {
            blockSize = this.blockSize;
        }
        let halfBlockSize = blockSize / 2;
        let blocks = this.blocks;
        blocks.length = 0;

        if (this.discardCulling) {
            this.blockCells.set(0, 0, 0);
            return;
        }

        let wolrdPos = this.node.worldPosition;
        let worldScale = this.node.getWorldScale();

        let xCount = Math.max(Math.floor(worldScale.x / blockSize), 1);
        let yCount = Math.max(Math.floor(worldScale.y / blockSize), 1);
        let zCount = Math.max(Math.floor(worldScale.z / blockSize), 1);

        this.blockCells.set(xCount, yCount, zCount);

        for (let x = 0; x < xCount; x++) {
            for (let y = 0; y < yCount; y++) {
                for (let z = 0; z < zCount; z++) {
                    let blockIdx = x * yCount * zCount + y * zCount + z;

                    let block = blocks[blockIdx] = new CullingBlock;
                    block.blockIdx = blockIdx;
                    block.center
                        .set(wolrdPos)
                        .add3f(x * blockSize, y * blockSize, z * blockSize)
                        .add3f(halfBlockSize, halfBlockSize, halfBlockSize)
                        .subtract3f(worldScale.x / 2, worldScale.y / 2, worldScale.z / 2);
                    block.halfExtents.set(halfBlockSize, halfBlockSize, halfBlockSize);
                }
            }
        }
    }
}
