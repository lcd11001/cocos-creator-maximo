
import { Mat4, renderer, RenderingSubMesh, Vec3 } from 'cc';

function normalizeGPU (v: number[]) {
    let d = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
    d = 1 / Math.sqrt(d);
    return [v[0] * d, v[1] * d, v[2] * d]
}
function crossGPU (a: number[], b: number[]) {
    let ax = a[0], ay = a[1], az = a[2];
    let bx = b[0], by = b[1], bz = b[2];

    return [
        ay * bz - az * by,
        az * bx - ax * bz,
        ax * by - ay * bx,
    ]
}
function dotGPU (a: number[], b: number[]) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function lengthGPU (a: number[]) {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

function newVec3 (x: number, y: number, z: number) {
    return [x, y, z]
}
function subtract (a: number[], b: number[]) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function add (a: number[], b: number[]) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}



function rayAABB (o: number[], d: number[], min: number[], max: number[]) {
    const EPSILON = 10e-6;

    const ix = 1 / d[0]; const iy = 1 / d[1]; const iz = 1 / d[2];
    const t1 = (min[0] - o[0]) * ix;
    const t2 = (max[0] - o[0]) * ix;
    const t3 = (min[1] - o[1]) * iy;
    const t4 = (max[1] - o[1]) * iy;
    const t5 = (min[2] - o[2]) * iz;
    const t6 = (max[2] - o[2]) * iz;
    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
    if (tmax < 0 || tmin > tmax) { return 0; }
    return tmin > 0 ? tmin : tmax; // ray origin inside aabb
}
function mul (a: number[], scale: number) {
    return [a[0] * scale, a[1] * scale, a[2] * scale]
}
function mulV3 (a: number[], b: number[]) {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]
}

function rayTriangle (ro: number[], rd: number[], v0: number[], v1: number[], v2: number[]) {
    const EPSILON = 10e-6;

    var ab = subtract(v1, v0);
    var ac = subtract(v2, v0);

    var pvec = crossGPU(rd, ac);
    var det = dotGPU(ab, pvec);
    if (det < EPSILON && (/*!doubleSided ||*/ det > -EPSILON)) { return 0; }

    var inv_det = 1 / det;

    var tvec = subtract(ro, v0);
    var u = dotGPU(tvec, pvec) * inv_det;
    if (u < -EPSILON || u > (1 + EPSILON)) { return 0; }

    var qvec = crossGPU(tvec, ab);
    var v = dotGPU(rd, qvec) * inv_det;
    if (v < -EPSILON || u + v > (1 + EPSILON)) { return 0; }

    var t = dotGPU(ac, qvec) * inv_det;
    return t < 0 ? 0 : t;
}
function inverseMat4 (
    a00: number, a01: number, a02: number, a03: number,
    a10: number, a11: number, a12: number, a13: number,
    a20: number, a21: number, a22: number, a23: number,
    a30: number, a31: number, a32: number, a33: number
) {
    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (det === 0) {
        return createEmptyMat4();
    }
    det = 1.0 / det;

    var out = createEmptyMat4();
    out[0][0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[0][1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[0][2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[0][3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[1][0] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[1][1] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[1][2] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[1][3] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[2][0] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[2][1] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[2][2] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[2][3] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[3][0] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[3][1] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[3][2] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[3][3] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
}

function createEmptyMat4 () {
    return [
        [0, 0, 0, 0,],
        [0, 0, 0, 0,],
        [0, 0, 0, 0,],
        [0, 0, 0, 0,],
    ];
}
function initMat4 (m: number[], start: number) {
    var arr = createEmptyMat4();
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            arr[x][y] = m[y + x * 4 + start];
        }
    }
    return arr;
}
function v3_lv3 (v: number[],
    m00: number, m01: number, m02: number, m03: number,
    m10: number, m11: number, m12: number, m13: number,
    m20: number, m21: number, m22: number, m23: number,
    m30: number, m31: number, m32: number, m33: number) {

    let im = inverseMat4(
        m00, m01, m02, m03,
        m10, m11, m12, m13,
        m20, m21, m22, m23,
        m30, m31, m32, m33,
    );

    let x = v[0];
    let y = v[1];
    let z = v[2];
    let rhw = im[0][3] * x + im[1][3] * y + im[2][3] * z + im[3][3];
    rhw = (rhw !== 0) ? Math.abs(1 / rhw) : 1;

    let out = newVec3(
        (im[0][0] * x + im[1][0] * y + im[2][0] * z + im[3][0]) * rhw,
        (im[0][1] * x + im[1][1] * y + im[2][1] * z + im[3][1]) * rhw,
        (im[0][2] * x + im[1][2] * y + im[2][2] * z + im[3][2]) * rhw
    );
    return out;

}

let _gpu: any;
function getGPU () {
    if (!_gpu) {
        // @ts-ignore
        _gpu = new GPU({
            // mode: 'dev'
            // mode: 'gpu'
            // mode: 'webgl'
            // mode: 'webgl2'
        })

        _gpu.addFunction(newVec3)
        _gpu.addFunction(subtract)
        _gpu.addFunction(add)
        _gpu.addFunction(createEmptyMat4)
        _gpu.addFunction(initMat4)
        _gpu.addFunction(inverseMat4)
        _gpu.addFunction(v3_lv3)
        _gpu.addFunction(rayTriangle)
        _gpu.addFunction(mul)
        _gpu.addFunction(mulV3)
        _gpu.addFunction(rayAABB)

        _gpu.addFunction(dotGPU)
        _gpu.addFunction(normalizeGPU)
        _gpu.addFunction(lengthGPU)
        _gpu.addFunction(crossGPU)
    }

    return _gpu;
}

let _kernel: any;
let _meshBuffer: Float32Array | undefined;
let _subModelCount = 0;

export default {
    maxDirection: 0,
    cornersCount: 0,

    createKernel (models: renderer.scene.Model[], maxDirection: number, cornersCount: number) {
        if (this.maxDirection === maxDirection && this.cornersCount === cornersCount) {
            return;
        }

        this.maxDirection = maxDirection;
        this.cornersCount = cornersCount;

        let subModels: renderer.scene.SubModel[] = []
        for (let mi = 0; mi < models.length; mi++) {
            let m = models[mi];

            for (let smi = 0; smi < m.subModels.length; ++smi) {
                subModels.push(m.subModels[smi]);
            }
        }
        _subModelCount = subModels.length;

        let directionSize = (Math.floor(Math.sqrt(maxDirection)) + 1);
        let threadSize = [directionSize, directionSize, cornersCount]

        // @ts-ignore
        let gpu = getGPU();

        // @ts-ignore
        _kernel = gpu.createKernel(function (buffer, norners, points, subModelCount) {
            // @ts-ignore
            var nornerOffset = this.thread.z * 3;
            var ro = newVec3(norners[nornerOffset + 0], norners[nornerOffset + 1], norners[nornerOffset + 2]);

            // @ts-ignore
            var pointsOffset = (this.thread.x + this.thread.y * this.constants.threadXCount) * 3;
            var point = newVec3(points[pointsOffset], points[pointsOffset + 1], points[pointsOffset + 2]);

            var rd = subtract(point, ro);
            rd = normalizeGPU(rd);

            var closedDistance = 10e6;
            var closedModelIndex = -1;

            var subModelOffset = 0;

            var testResult = -1;
            var subModelIndex = 0;

            var maxIBCount = -1;
            var loopCount = 0;
            var ibIndex = 0;
            while (subModelIndex < subModelCount) {
                while (subModelIndex < subModelCount) {

                    var vbOffset = buffer[subModelOffset++];
                    var vbCount = buffer[subModelOffset++];
                    var ibOffset = buffer[subModelOffset++];
                    var ibCount = buffer[subModelOffset++];
                    var modelIndex = buffer[subModelOffset++];

                    // model info
                    var modelOffset = buffer[subModelOffset++];

                    var mat = initMat4(buffer, modelOffset);
                    modelOffset += 16;

                    var worldScale = newVec3(buffer[modelOffset++], buffer[modelOffset++], buffer[modelOffset++]);

                    // broad phase
                    var worldBoundCenter = newVec3(buffer[modelOffset++], buffer[modelOffset++], buffer[modelOffset++]);
                    var worldBoundHalfE = newVec3(buffer[modelOffset++], buffer[modelOffset++], buffer[modelOffset++]);
                    var broadPhaseDistance = rayAABB(ro, rd, subtract(worldBoundCenter, worldBoundHalfE), add(worldBoundCenter, worldBoundHalfE));
                    if (broadPhaseDistance <= 0) {
                        subModelIndex++;
                        continue;
                    }

                    testResult = -2;

                    // narraw phase
                    var lro = v3_lv3(
                        ro,
                        mat[0][0], mat[0][1], mat[0][2], mat[0][3],
                        mat[1][0], mat[1][1], mat[1][2], mat[1][3],
                        mat[2][0], mat[2][1], mat[2][2], mat[2][3],
                        mat[3][0], mat[3][1], mat[3][2], mat[3][3],
                    );
                    var lrd = v3_lv3(
                        point,
                        mat[0][0], mat[0][1], mat[0][2], mat[0][3],
                        mat[1][0], mat[1][1], mat[1][2], mat[1][3],
                        mat[2][0], mat[2][1], mat[2][2], mat[2][3],
                        mat[3][0], mat[3][1], mat[3][2], mat[3][3],
                    );
                    lrd = subtract(lrd, lro);
                    lrd = normalizeGPU(lrd);

                    var distanceScale = lengthGPU(mulV3(lrd, worldScale));

                    maxIBCount = Math.max(maxIBCount, ibCount);

                    ibIndex = 0;
                    while (ibIndex < ibCount) {
                        while (ibIndex < ibCount) {
                            var v1 = buffer[ibOffset + ibIndex] * 3;
                            var v2 = buffer[ibOffset + ibIndex + 1] * 3;
                            var v3 = buffer[ibOffset + ibIndex + 2] * 3;

                            var a = newVec3(buffer[vbOffset + v1], buffer[vbOffset + v1 + 1], buffer[vbOffset + v1 + 2]);
                            var b = newVec3(buffer[vbOffset + v2], buffer[vbOffset + v2 + 1], buffer[vbOffset + v2 + 2]);
                            var c = newVec3(buffer[vbOffset + v3], buffer[vbOffset + v3 + 1], buffer[vbOffset + v3 + 2]);

                            var distance = rayTriangle(lro, lrd, a, b, c);
                            distance *= distanceScale;
                            if (distance > 0) {
                                testResult = -3;
                                if (distance < closedDistance) {
                                    closedDistance = distance;
                                    closedModelIndex = modelIndex;
                                }
                            }

                            ibIndex += 3;
                            loopCount++;
                        }
                    }

                    subModelIndex++;
                }
            }

            testResult = -maxIBCount;

            if (closedModelIndex < 0) {
                closedModelIndex = testResult;
            }
            return closedModelIndex;
        }, {
            constants: { threadXCount: threadSize[0], threadYCount: threadSize[1], cornersCount },
            output: threadSize,
            // output: [maxDirection, cornersCount],
        })

        this.createMeshBuffer(models);


        if (!_gpu._hacked) {
            _gpu._hacked = true;

            for (let name in _gpu.context) {
                if (typeof _gpu.context[name] === 'function') {
                    let _ori = _gpu.context[name]
                    _gpu.context[name] = function () {
                        // if (name === 'texStorage2D') {
                        //     var b = 1;
                        // }
                        // if (name === 'bufferSubData') {
                        //     var b = 1;
                        // }
                        // if (name === 'bufferData') {
                        //     var b = 1;
                        // }
                        // if (name === 'useProgram') {
                        //     var b = 1;
                        // }
                        // if (name === 'uniform1f') {
                        //     var b = 1;
                        //     if (arguments[1] === 1) {
                        //         debugger;
                        //     }
                        // }

                        // let args = '';//'   : '
                        // // for (var i = 0; i < arguments.length; i++) {
                        // //     args += arguments[i] + ', '
                        // // }

                        // console.time('--- gl.' + name + args)
                        var ret = _ori.apply(_gpu.context, arguments)
                        // console.timeEnd('--- gl.' + name + args)
                        return ret;
                    }
                }
            }
        }


        // console.time('_kernel.build');
        // _kernel.build(_meshBuffer, new Array(cornersCount * 3).fill(0), new Array(maxDirection * 3).fill(0))
        // console.timeEnd('_kernel.build');

    },

    createMeshBuffer (models: renderer.scene.Model[]) {
        console.time('prepare buffers');

        let subModels: renderer.scene.SubModel[] = []
        let meshes: RenderingSubMesh[] = [];
        let bufferCount = 0;
        let submodelBuffers: number[] = []
        let modelBuffers: number[] = [];
        for (let mi = 0; mi < models.length; mi++) {
            let m = models[mi];

            for (let smi = 0; smi < m.subModels.length; ++smi) {
                subModels.push(m.subModels[smi]);

                const subMesh = m.subModels[smi].subMesh;
                const subMeshAny = subMesh as any;
                let meshIndex = meshes.indexOf(subMesh);
                if (meshIndex === -1) {
                    meshIndex = meshes.length;
                    meshes.push(subMesh);


                    subMeshAny._vbOffset = bufferCount;
                    subMeshAny._vbCount = subMesh.geometricInfo.positions!.length;
                    bufferCount += subMesh.geometricInfo.positions.length;

                    subMeshAny._ibOffset = bufferCount;
                    subMeshAny._ibCount = subMesh.geometricInfo.indices!.length;
                    bufferCount += subMesh.geometricInfo.indices!.length;
                }

                submodelBuffers.push(subMeshAny._vbOffset)
                submodelBuffers.push(subMeshAny._vbCount)
                submodelBuffers.push(subMeshAny._ibOffset)
                submodelBuffers.push(subMeshAny._ibCount)
                submodelBuffers.push(mi);
                submodelBuffers.push(modelBuffers.length);
            }

            Mat4.toArray(modelBuffers, m.node.worldMatrix, modelBuffers.length);

            let worldScale = m.node.worldScale;
            modelBuffers.push(worldScale.x, worldScale.y, worldScale.z);

            let center = m.worldBounds.center;
            let halfExtents = m.worldBounds.halfExtents;
            modelBuffers.push(center.x, center.y, center.z);
            modelBuffers.push(halfExtents.x, halfExtents.y, halfExtents.z);

        }

        const extraInfoCount = 1;

        _meshBuffer = new Float32Array(extraInfoCount + bufferCount + modelBuffers.length + submodelBuffers.length);
        for (let i = 0; i < submodelBuffers.length; i += 6) {
            submodelBuffers[i] += submodelBuffers.length + modelBuffers.length;
            submodelBuffers[i + 2] += submodelBuffers.length + modelBuffers.length;
            submodelBuffers[i + 5] += submodelBuffers.length;
        }
        _meshBuffer.set(submodelBuffers);
        _meshBuffer.set(modelBuffers, submodelBuffers.length);

        let triangleCount = 0;

        let bufferOffset = 0;
        meshes.forEach(m => {
            _meshBuffer!.set(m.geometricInfo.positions, bufferOffset + submodelBuffers.length + modelBuffers.length);
            bufferOffset += m.geometricInfo.positions.length;

            _meshBuffer!.set(m.geometricInfo.indices!, bufferOffset + submodelBuffers.length + modelBuffers.length);
            bufferOffset += m.geometricInfo.indices!.length;

            triangleCount += m.geometricInfo.indices!.length / 3;
        })
        console.timeEnd('prepare buffers');

        console.log('submodelBuffers.length : ' + submodelBuffers.length);
        console.log('modelBuffers.length : ' + modelBuffers.length);
        console.log('_meshBuffer.length : ' + _meshBuffer.length);
    },

    raycastModels (models: renderer.scene.Model[], froms: Vec3[], points: Vec3[]) {
        let resultModels: renderer.scene.Model[] = []
        if (!_kernel) {
            return resultModels;
        }

        let pointsBuffer: number[] = []
        points.forEach(d => pointsBuffer.push(d.x, d.y, d.z))
        let fromsBuffer: number[] = []
        froms.forEach(f => fromsBuffer.push(f.x, f.y, f.z))

        // console.time('build _kernel');
        // _kernel.build.apply(_kernel, [_meshBuffer, fromsBuffer, pointsBuffer, _subModelCount]);
        // console.timeEnd('build _kernel');

        // console.time('do _kernel');
        let raycastResults = _kernel(_meshBuffer, fromsBuffer, pointsBuffer, _subModelCount) as Float32Array[][];
        // console.timeEnd('do _kernel');

        raycastResults.forEach(results => {
            results.forEach(results => {
                results.forEach(index => {
                    let model = models[index];
                    if (model && resultModels.indexOf(model) === -1) {
                        resultModels.push(model);
                    }
                })
            })
        })

        return resultModels;
    },
}
