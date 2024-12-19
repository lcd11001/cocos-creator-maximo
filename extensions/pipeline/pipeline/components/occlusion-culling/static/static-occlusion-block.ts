import { InstancedBuffer, MeshRenderer, Vec3, _decorator } from "cc"

const { ccclass, property } = _decorator

@ccclass('sync.CullingBlock')
export class CullingBlock {
    @property
    center = new Vec3
    @property
    halfExtents = new Vec3

    @property({ visible: false })
    rendererIDs: number[] = []

    @property
    get rendererCount () {
        return this.rendererIDs.length;
    }

    @property
    blockIdx = 0;

    getCorners () {
        let corners: Vec3[] = [this.center];
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    corners.push(new Vec3(this.center).add3f(this.halfExtents.x * x, this.halfExtents.y * y, this.halfExtents.z * z));
                }
            }
        }

        return corners;
    }

    get bakingProcess () {
        if (this.bakingTotalCount === 0) {
            return this.rendererIDs.length ? 1 : 0;
        }
        return (this.bakingTotalCount - this.bakingDirections.length) / this.bakingTotalCount;
    }
    bakingTotalCount = 0
    bakingDirections: Vec3[]
}
