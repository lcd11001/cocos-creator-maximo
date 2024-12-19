import { Color, Component, director, geometry, GeometryRenderer, gfx, Mat4, Quat, Vec3, Vec4, _decorator } from 'cc';
import { getGeometryRenderer } from '../../utils/debug';
import { roundUp, vec3_min, vec3_max, vec3_floor, vec3_ceil } from '../../utils/math';

const { ccclass, property, executeInEditMode } = _decorator;

const maxTextureSize = 4096;    // maximum texture size allowed to work on all devices

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();

export class ClusterObject<T> {
    object: T | null = null;
    min = new Vec3;
    max = new Vec3;
    radius = 0;
    center = new Vec3;

    minCell = new Vec3
    maxCell = new Vec3
}


@ccclass('WorldCluster')
@executeInEditMode
export class WorldCluster<T extends Component> extends Component {
    _cellsLimit = new Vec3();
    @property
    _cells = new Vec3(12, 12, 12);
    @property
    get cells () {
        return this._cells;
    }
    set cells (value) {
        // make sure we have whole numbers
        tempVec3.set(value);
        vec3_floor(tempVec3, tempVec3);

        if (!this._cells.equals(tempVec3)) {
            this._cells.set(tempVec3);
            this._cellsLimit.set(tempVec3).subtract(Vec3.ONE);
            this._cellsDirty = true;
        }
    }


    @property
    _maxCellObjectCount = 0;
    @property
    get maxCellObjectCount () {
        return this._maxCellObjectCount;
    }
    set maxCellObjectCount (count) {

        // each cell stores 4 lights (xyzw), so round up the count
        const maxCellObjectCount = roundUp(count, 4);
        this._maxCellObjectCount = count;
        this._pixelsPerCellCount = maxCellObjectCount / 4;
        this._cellsDirty = true;
    }

    _usedObjects: ClusterObject<T>[] = [new ClusterObject];

    dataInfoFloat: Float32Array | undefined;
    dataInfoTextureFloat: gfx.Texture | undefined;

    infoTextureInvSizeData = new Vec4;

    clusterTexture: gfx.Texture | undefined;
    clustersData: Uint8Array | undefined;
    clustersCounts: Int32Array | undefined;
    clustersDistances: Float32Array | undefined;
    clusterCellsMaxData = new Vec4;
    clusterCellsDotData = new Vec4;
    clusterTextureSizeData = new Vec4;
    clusterCellsCountByBoundsSizeData = new Vec4;

    // bounds of all lights
    _bounds = new geometry.AABB();

    // bounds of all light volumes (volume covered by the clusters)
    boundsMin = new Vec3();
    boundsMax = new Vec3();
    boundsDelta = new Vec3();

    // using 8 bit index so this is maximum supported number
    maxCount = 255;

    // number of times a warning was reported
    reportCount = 0;

    _cellsDirty = true;
    _pixelsPerCellCount = 0;

    pixelsPerObjectFloat = 1; // 0: pos.x, pos.y, pos.z, radius


    // constructor (cells: Vec3, maxCellObjectCount: number) {
    //     this.cells = cells;
    //     this.maxCellObjectCount = maxCellObjectCount;
    // }

    getBoundingBox (obj: any, clusteredObject: ClusterObject<T>) { }
    addObjectData (obj: any, index: number) { }

    createTexture (width: number, height: number, format: gfx.Format) {
        let texture = director.root!.device.createTexture(new gfx.TextureInfo(
            gfx.TextureType.TEX2D,
            gfx.TextureUsageBit.SAMPLED | gfx.TextureUsageBit.TRANSFER_DST,
            format,
            width,
            height
        ));

        return texture;
    }

    __preload () {
        this.maxCellObjectCount = this.maxCellObjectCount;
        this._cellsLimit.set(this._cells).subtract(Vec3.ONE);

        this.initTexture()
    }

    initTexture () {
        let pixelsPerObjectFloat = this.pixelsPerObjectFloat;

        // float texture
        this.dataInfoFloat = new Float32Array(4 * pixelsPerObjectFloat * this.maxCount);
        this.dataInfoTextureFloat = this.createTexture(pixelsPerObjectFloat, this.maxCount, gfx.Format.RGBA32F);

        // inverse sizes for both textures
        this.infoTextureInvSizeData.x = 1.0 / this.dataInfoTextureFloat!.width;
        this.infoTextureInvSizeData.y = 1.0 / this.dataInfoTextureFloat!.height;
    }

    updateCells () {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // storing 4 lights per pixels
            const numCells = cx * cy * cz;
            const totalPixels = this._pixelsPerCellCount * numCells;

            // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
            let width = Math.ceil(Math.sqrt(totalPixels));
            width = roundUp(width, this._pixelsPerCellCount);
            const height = Math.ceil(totalPixels / width);

            // if the texture is allowed size
            if (width > maxTextureSize || height > maxTextureSize) {
                // #if _DEBUG
                console.error("LightCluster parameters cause the texture size to be over the limit.");
                // #endif
            }

            // maximum range of cells
            this.clusterCellsMaxData.x = cx;
            this.clusterCellsMaxData.y = cy;
            this.clusterCellsMaxData.z = cz;

            // vector to allow single dot product to convert from world coordinates to cluster index
            this.clusterCellsDotData.x = this._pixelsPerCellCount;
            this.clusterCellsDotData.y = cx * cz * this._pixelsPerCellCount;
            this.clusterCellsDotData.z = cx * this._pixelsPerCellCount;

            // cluster data and number of lights per cell
            this.clustersData = new Uint8Array(4 * width * height);
            this.clustersCounts = new Int32Array(numCells);
            this.clustersDistances = new Float32Array(4 * width * height);

            this.clusterTextureSizeData.x = width;
            this.clusterTextureSizeData.y = 1.0 / width;
            this.clusterTextureSizeData.z = 1.0 / height;

            if (this.clusterTexture) {
                this.clusterTexture.destroy();
            }
            this.clusterTexture = this.createTexture(width, height, gfx.Format.RGBA8);
        }
    }

    collectObjects (objects: T[]) {

        // skip index 0 as that is used for unused light
        const usedObjects = this._usedObjects;
        let objIndex = 1;

        for (let i = 0; i < objects.length; i++) {
            // use enabled and visible lights
            const obj = objects[i];
            // if (!obj.enabledInHierarchy) {
            //     continue;
            // }

            // within light limit
            if (objIndex < this.maxCount) {

                // reuse allocated spot
                let clusteredObject;
                if (objIndex < usedObjects.length) {
                    clusteredObject = usedObjects[objIndex];
                } else {
                    // allocate new spot
                    clusteredObject = new ClusterObject<T>();
                    usedObjects.push(clusteredObject);
                }

                // store light properties
                clusteredObject.object = obj;
                this.getBoundingBox(obj, clusteredObject);

                objIndex++;
            } else {
                console.warn("Clustered lighting: more than " + (this.maxCount - 1) + " lights in the frame, ignoring some.");
                break;
            }
        }

        usedObjects.length = objIndex;
    }

    // evaluate the area all lights cover
    evaluateBounds () {
        const usedObjects = this._usedObjects;

        // bounds of the area the lights cover
        const min = this.boundsMin;
        const max = this.boundsMax;

        // if at least one light (index 0 is null, so ignore that one)
        if (usedObjects.length > 1) {

            // AABB of the first light
            Vec3.copy(min, usedObjects[1].min);
            Vec3.copy(max, usedObjects[1].max);

            for (let i = 2; i < usedObjects.length; i++) {

                // expand by AABB of this light
                vec3_min(min, min, usedObjects[i].min);
                vec3_max(max, max, usedObjects[i].max);
            }
        } else {

            // any small volume if no lights
            min.set(0, 0, 0);
            max.set(1, 1, 1);
        }

        // bounds range
        Vec3.subtract(this.boundsDelta, max, min);

        const boundsDelta = this.boundsDelta;
        this.clusterCellsCountByBoundsSizeData.x = this._cells.x / boundsDelta.x;
        this.clusterCellsCountByBoundsSizeData.y = this._cells.y / boundsDelta.y;
        this.clusterCellsCountByBoundsSizeData.z = this._cells.z / boundsDelta.z;
        this.clusterCellsCountByBoundsSizeData.w = this._pixelsPerCellCount;

        if (usedObjects.length > 1) {
            for (let i = 0; i < usedObjects.length; i++) {
                let clusteredObject = usedObjects[i];
                this.evalCellMinMax(clusteredObject, clusteredObject.minCell, clusteredObject.maxCell);
            }
        }
    }

    // evaluates min and max coordinates of AABB of the object in the cell space
    evalCellMinMax (clusteredObject: ClusterObject<T>, min: Vec3, max: Vec3) {
        // min point of AABB in cell space
        min.set(clusteredObject.min);
        min.subtract(this.boundsMin);
        min.divide(this.boundsDelta);
        min.multiply(this._cells);
        vec3_floor(min, min);

        // max point of AABB in cell space
        max.set(clusteredObject.max);
        max.subtract(this.boundsMin);
        max.divide(this.boundsDelta);
        max.multiply(this._cells);
        vec3_floor(max, max);

        // clamp to limits
        vec3_max(min, min, Vec3.ZERO as Vec3);
        vec3_min(max, max, this._cellsLimit);
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

        const center = new Vec3
        let filterObjects = []
        let sort = (a: ClusterObject<T>, b: ClusterObject<T>) => {
            let da = Vec3.distance(a.center, center);
            let db = Vec3.distance(b.center, center);
            return da - db
        }
        for (let y = 0; y < divY; y++) {
            for (let z = 0; z < divZ; z++) {
                for (let x = 0; x < divX; x++) {

                    filterObjects.length = 0;
                    for (let i = 1; i < usedObjects.length; i++) {
                        const clusteredObject = usedObjects[i];
                        if (clusteredObject.minCell.x > x || clusteredObject.minCell.y > y || clusteredObject.minCell.z > z ||
                            clusteredObject.maxCell.x < x || clusteredObject.maxCell.y < y || clusteredObject.maxCell.z < z) {
                            continue;
                        }
                        filterObjects.push(clusteredObject);
                    }
                    (center.set(this.boundsDelta) as Vec3).multiply3f((x + 0.5) / divX, (y + 0.5) / divY, (z + 0.5) / divZ).add(this.boundsMin);
                    filterObjects.sort(sort)

                    const clusterIndex = x + divX * (z + y * divZ);
                    let count = counts[clusterIndex];
                    for (let i = 0; i < filterObjects.length; i++) {
                        const clusteredObject = filterObjects[i];

                        if (count < limit) {
                            clusters[pixelsPerCellCount * clusterIndex * 4 + count] = usedObjects.indexOf(clusteredObject);
                            counts[clusterIndex] = ++count;
                        }
                        else {
                            // console.log(`light cluster out of limit [${x}, ${y}, ${z}]`)
                        }
                    }
                }
            }
        }

    }

    findObjects () {
        return []
    }

    update (dt) {
        let objects = this.findObjects();
        this.collectObjects(objects);
        this.evaluateBounds();
        this.updateCells();
        this.updateClusters();
        this.uploadTextures();

        this.drawDebug();
    }

    uploadTextures () {
        let device = director.root!.device;

        let clusterTexture = this.clusterTexture;
        let clustersData = this.clustersData;
        if (clusterTexture && clustersData) {
            let region = new gfx.BufferTextureCopy(undefined, undefined, clusterTexture.height, undefined, new gfx.Extent(clusterTexture.width, clusterTexture.height));
            device.copyBuffersToTexture([clustersData], clusterTexture, [region]);
        }

        let dataInfoFloat = this.dataInfoFloat;
        let dataInfoTextureFloat = this.dataInfoTextureFloat;
        if (dataInfoFloat && dataInfoTextureFloat) {
            let region = new gfx.BufferTextureCopy(undefined, undefined, dataInfoTextureFloat.height, undefined, new gfx.Extent(dataInfoTextureFloat.width, dataInfoTextureFloat.height));
            device.copyBuffersToTexture([dataInfoFloat], dataInfoTextureFloat, [region]);
        }
    }

    onDestroy () {
        this.clusterTexture?.destroy();
        this.dataInfoTextureFloat?.destroy();
    }

    @property
    renderDebug = false

    drawDebug () {
        if (!this.renderDebug) {
            return;
        }

        let geometryRenderer = getGeometryRenderer()
        if (!geometryRenderer) {
            return;
        }

        this.drawCluster(geometryRenderer)
        // this.drawObjects()
    }

    drawCluster (geometryRenderer: GeometryRenderer) {
        let cells = this.cells;
        (tempVec3.set(this.boundsDelta) as Vec3).divide(cells);
        let xStep = tempVec3.x;
        let yStep = tempVec3.y;
        let zStep = tempVec3.z;

        let tempMatrix = new Mat4
        let identityAABB = new geometry.AABB(0, 0, 0, 0.5, 0.5, 0.5);
        let areaColor = new Color(255, 255, 255, 50)

        let start = new Vec3(0, 0, 0);
        let end = cells;

        for (let x = start.x; x < end.x; x++) {
            for (let y = start.y; y < end.y; y++) {
                for (let z = start.z; z < end.z; z++) {
                    (tempMin3.set(this.boundsMin) as Vec3).add3f(xStep * (x + 0.5), yStep * (y + 0.5), zStep * (z + 0.5));

                    tempVec3.set(xStep, yStep, zStep);
                    tempMatrix.fromRTS(Quat.IDENTITY as Quat, tempMin3 as Vec3, tempVec3);

                    geometryRenderer.addBoundingBox(identityAABB, areaColor, false, false, undefined, true, tempMatrix);


                    // drawer.color.set(255, 255, 255, 255);
                    // // tempVec3.set(100, 100, 100)
                    // drawer.matrix.fromRTS(Quat.IDENTITY as Quat, tempMin3 as Vec3, Vec3.ONE);
                    // drawer.type = DrawType.Solid;
                    // drawer.text(`${x}_${y}_${z}`)

                    // tempMin3.y += 1;
                    // drawer.matrix.fromRTS(Quat.IDENTITY as Quat, tempMin3 as Vec3, Vec3.ONE);
                    // const clusterIndex = x + this._cells.x * (z + y * this._cells.z);
                    // let count = this.clustersCounts![clusterIndex]
                    // let info = `${count}:`
                    // for (let i = 0; i < count; i++) {
                    //     info += '_' + this.clustersData![this._pixelsPerCellCount * clusterIndex * 4 + i]
                    // }
                    // drawer.text(info)
                }
            }
        }
    }

    // drawObjects () {
    //     let objs = this._usedObjects;

    //     const drawer = this._drawer!;
    //     drawer.color.set(255, 0, 0, 50);
    //     drawer.frameWireColor.set(255, 0, 0, 100);
    //     drawer.type = DrawType.FrameWire | DrawType.Solid;

    //     objs.forEach(obj => {
    //         tempVec3.set(obj.radius, obj.radius, obj.radius);
    //         drawer.matrix.fromRTS(Quat.IDENTITY as Quat, obj.center, tempVec3);
    //         drawer.sphere();
    //     })
    // }
}
