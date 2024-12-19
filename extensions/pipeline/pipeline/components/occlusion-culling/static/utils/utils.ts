import { gfx, renderer, Vec3 } from "cc";
import { HaltonUtils } from "./halton";
import { Pool } from "./pool";

export function sphereDirections (count: number) {
    let directions = []

    let goldenRatio = (1 + Math.sqrt(5)) / 2;
    let angleIncrement = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < count; i++) {
        let t = i / count;
        let inclination = Math.acos(1 - 2 * t);
        let azimuth = angleIncrement * i;

        let x = Math.sin(inclination) * Math.cos(azimuth);
        let y = Math.sin(inclination) * Math.sin(azimuth);
        let z = Math.cos(inclination);

        let d = Pool.Vec3.get() || new Vec3;
        d.set(x, y, z)
        directions.push(d);
    }

    return directions;
}

const ModelSampleCount = 36;

let _tempMin = new Vec3
let _tempMax = new Vec3
export function modelPoints (models: renderer.scene.Model[]) {
    let points = []

    for (let i = 0; i < models.length; i++) {
        let cur = models[i];
        let mat = cur.node.worldMatrix;

        cur.worldBounds.getBoundary(_tempMin, _tempMax);

        let totalVertices = 0
        let subModels = cur.subModels
        for (let j = 0; j < subModels.length; j++) {
            let subMesh = subModels[j].subMesh;
            const { positions } = subMesh.geometricInfo;
            totalVertices += positions.length / 3;
        }

        if (totalVertices > ModelSampleCount) {
            for (let i = 0; i < ModelSampleCount; i++) {
                let offset = HaltonUtils.instance.Generate3DRandomOffset(ModelSampleCount);
                let p = new Vec3(cur.worldBounds.halfExtents)
                p.multiplyScalar(2).multiply(offset);
                p.add(_tempMin);
                Vec3.transformMat4(p, p, mat);
                points.push(p);
            }
        }
        else {
            let subModels = cur.subModels
            for (let j = 0; j < subModels.length; j++) {
                let subMesh = subModels[j].subMesh;
                const { positions: vb, indices: ib, doubleSided: sides } = subMesh.geometricInfo;

                if (subMesh.primitiveMode === gfx.PrimitiveMode.TRIANGLE_LIST && ib && vb) {
                    for (let j = 0; j < vb.length; j += 3) {
                        let d = Pool.Vec3.get().set(vb[j], vb[j + 1], vb[j + 2]);
                        Vec3.transformMat4(d, d, mat);
                        points.push(d);
                    }
                }
            }
        }
    }

    return points;
}
