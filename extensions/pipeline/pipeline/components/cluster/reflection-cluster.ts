import { director, gfx, math, ReflectionProbe, Vec3, _decorator } from "cc";
import { ClusterCubemapAtlas, packCubemapAtlas } from "./utils";
import { ClusterObject, WorldCluster } from "./world-cluster";

const { ccclass, property } = _decorator

let tempVec3 = new Vec3

@ccclass('sync.ReflectionWorldCluster')
export class ReflectionWorldCluster extends WorldCluster<ReflectionProbe> {
    _atlas: ClusterCubemapAtlas | undefined;

    // 0: pos.x, pos.y, pos.z, radius
    // 1: offset.xyzw
    // 2: x: averageBrightness, yzw: waste
    pixelsPerObjectFloat = 3;

    @property
    forceUpdateAtlas = false;

    dirty = true

    probes: ReflectionProbe[] = []
    findObjects () {
        this.probes = director.getScene().getComponentsInChildren(ReflectionProbe);

        if (!this._atlas || this.forceUpdateAtlas) {
            let cubemaps = this.probes.map(probe => {
                return probe._cubemap;
            })
            this._atlas = packCubemapAtlas(cubemaps);
            this.forceUpdateAtlas = false;
        }

        return this.probes;
    }

    update (dt) {
        if (!this.dirty) {
            return;
        }
        this.dirty = false;

        super.update(dt);
    }

    updateClusters () {

        // clear clusters
        this.clustersCounts!.fill(0);
        this.clustersData!.fill(0);
        this.clustersDistances!.fill(Infinity);

        // local accessors
        const divX = this._cells.x;
        const divY = this._cells.y;
        const divZ = this._cells.z;
        const counts = this.clustersCounts!;
        const distances = this.clustersDistances!;
        const limit = this._maxCellObjectCount;
        const clusters = this.clustersData!;
        const pixelsPerCellCount = this._pixelsPerCellCount;
        let tooManyObjects = false;

        const usedObjects = this._usedObjects;
        // started from index 1, zero is "no-light" index
        for (let i = 1; i < usedObjects.length; i++) {
            const clusteredObject = usedObjects[i];
            const object = clusteredObject.object;

            // add light data into textures
            if (object) {
                this.addObjectData(object, i);
            }
        }

        for (let y = 0; y < divY; y++) {
            for (let z = 0; z < divZ; z++) {
                for (let x = 0; x < divX; x++) {

                    const clusterIndex = x + divX * (z + y * divZ);
                    const center = (tempVec3.set(this.boundsDelta) as Vec3).multiply3f((x + 0.5) / divX, (y + 0.5) / divY, (z + 0.5) / divZ).add(this.boundsMin);

                    let count = counts[clusterIndex];
                    for (let i = 1; i < usedObjects.length; i++) {
                        const clusteredObject = usedObjects[i];
                        let dist = Vec3.squaredDistance(center, clusteredObject.center);

                        if (count < limit) {
                            clusters[pixelsPerCellCount * clusterIndex * 4 + count] = usedObjects.indexOf(clusteredObject);
                            counts[clusterIndex] = count;
                            distances[clusterIndex] = dist;
                            count++;
                        }
                        else {
                            for (let i = limit; i >= 0; i--) {
                                let testIndex = pixelsPerCellCount * clusterIndex * 4 + i;
                                if (dist < distances[testIndex]) {
                                    clusters[testIndex] = usedObjects.indexOf(clusteredObject);
                                    distances[testIndex] = dist;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        // #if _DEBUG
        // if (tooManyObjects) {
        //     const reportLimit = 5;
        //     if (this.reportCount < reportLimit) {
        //         console.warn(`Too many objects in cluster ${this.name}, please adjust parameters. ${this.reportCount == reportLimit - 1 ? " Giving up on reporting it." : ""}`);
        //         this.reportCount++;
        //     }
        // }
        // #endif
    }

    addObjectData (obj: ReflectionProbe, index: number) {
        const dataInfoFloat = this.dataInfoFloat!;
        let dataInfoFloatIndex = index * this.dataInfoTextureFloat!.width * 4;

        // pos and radius
        let pos = obj.node.worldPosition;
        let radius = Math.max(obj.size.x, obj.size.y, obj.size.z);
        dataInfoFloat[dataInfoFloatIndex++] = pos.x;
        dataInfoFloat[dataInfoFloatIndex++] = pos.y;
        dataInfoFloat[dataInfoFloatIndex++] = pos.z;
        dataInfoFloat[dataInfoFloatIndex++] = radius;

        // offsets
        let indexInAtlas = this._atlas!.cubemaps.indexOf(obj.cubemap);
        let offsets = this._atlas!.offsets[indexInAtlas];
        if (offsets) {
            dataInfoFloat[dataInfoFloatIndex++] = offsets[0];
            dataInfoFloat[dataInfoFloatIndex++] = offsets[1];
            dataInfoFloat[dataInfoFloatIndex++] = offsets[2];
            dataInfoFloat[dataInfoFloatIndex++] = offsets[3];
        }

        //
        // dataInfoFloat[dataInfoFloatIndex++] = obj.averageBrightness;
        // dataInfoFloat[dataInfoFloatIndex++] = obj.brightness;
    }

    getBoundingBox (obj: ReflectionProbe, clusteredObject: ClusterObject<ReflectionProbe>) {
        let radius = Math.max(obj.size.x, obj.size.y, obj.size.z);
        let pos = obj.node.worldPosition;
        clusteredObject.min.set(pos.x - radius, pos.y - radius, pos.z - radius)
        clusteredObject.max.set(pos.x + radius, pos.y + radius, pos.z + radius)

        clusteredObject.radius = radius;
        clusteredObject.center.set(pos);
    }

    drawObjects () {
        // this._usedObjects.forEach(obj => {
        //     if (obj.object) {
        //         obj.object.drawDebug(this._drawer!)
        //     }
        // })
    }

}
