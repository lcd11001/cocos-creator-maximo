import { director, geometry, MobilityMode, Node, renderer, SphereLight, SpotLight, Vec3, Vec4, _decorator, clamp } from "cc";
import { EDITOR } from "cc/env";
import { HrefSetting } from "../../settings/href-setting";
import { cce, repaintInEditMode } from "../../utils/editor";
import { ClusterObject, WorldCluster } from "./world-cluster";

const { ccclass, executeInEditMode, property } = _decorator

let _sphere = new geometry.Sphere();
let tempVec3 = new Vec3

@ccclass('LightWorldCluster')
@executeInEditMode
export class LightWorldCluster extends WorldCluster<SphereLight | SpotLight> {
    onEnable () {
        globalThis.lightCluster = this;
    }
    onDisable () {
        if (globalThis.lightCluster === this) {
            globalThis.lightCluster = undefined;
        }
    }

    // 0: pos.x, pos.y, pos.z, isSpotLight
    // 1: rgb: color, w: intensity
    // 2: x: size, y: range, z: spotAngle
    // 3: xyz: dir
    pixelsPerObjectFloat = 4;

    addObjectData (light: renderer.scene.SphereLight | renderer.scene.SpotLight, index: number) {
        const dataInfoFloat = this.dataInfoFloat!;
        let dataInfoFloatIndex = index * this.dataInfoTextureFloat!.width * 4;

        let isSpotLight = light instanceof renderer.scene.SpotLight;

        // 0
        let pos = light.node!.worldPosition;
        dataInfoFloat[dataInfoFloatIndex++] = pos.x;
        dataInfoFloat[dataInfoFloatIndex++] = pos.y;
        dataInfoFloat[dataInfoFloatIndex++] = pos.z;
        dataInfoFloat[dataInfoFloatIndex++] = isSpotLight ? 1 : 0;

        // 1
        const color = light.color;
        dataInfoFloat[dataInfoFloatIndex++] = color.x;
        dataInfoFloat[dataInfoFloatIndex++] = color.y;
        dataInfoFloat[dataInfoFloatIndex++] = color.z;

        const lightMeterScale = 10000;
        const defaultExposure = 0.00002604165638331324;
        dataInfoFloat[dataInfoFloatIndex++] = light.luminance * defaultExposure * lightMeterScale;

        // 2
        if (isSpotLight) {
            let spot = (light as renderer.scene.SpotLight);

            const clampedInnerConeAngle = clamp(spot.size, 0.0, 89.0) * Math.PI / 180.0;
            const clampedOuterConeAngle = clamp(spot.angle / 2, clampedInnerConeAngle + 0.001, 89.0 * Math.PI / 180.0 + 0.001);

            let cosOuterCone = Math.cos(clampedOuterConeAngle);
            let cosInnerCone = Math.cos(clampedInnerConeAngle);
            let invCosConeDifference = 1.0 / (cosInnerCone - cosOuterCone);

            dataInfoFloat[dataInfoFloatIndex++] = light.range;
            dataInfoFloat[dataInfoFloatIndex++] = cosOuterCone;
            dataInfoFloat[dataInfoFloatIndex++] = invCosConeDifference;
        }
        else {
            dataInfoFloat[dataInfoFloatIndex++] = light.range;
            dataInfoFloat[dataInfoFloatIndex++] = light.size;
            dataInfoFloat[dataInfoFloatIndex++] = 0;
        }
        dataInfoFloat[dataInfoFloatIndex++] = 0;


        // 3
        if (isSpotLight) {
            light.update();
            let dir = (light as renderer.scene.SpotLight).direction;
            // Vec3.rotateX(tempVec3, dir, Vec3.ZERO, Math.PI * 0.5)
            // Vec3.rotateY(tempVec3, dir, Vec3.ZERO, Math.PI * 0.5)
            // tempVec3.normalize()
            dataInfoFloat[dataInfoFloatIndex++] = dir.x;
            dataInfoFloat[dataInfoFloatIndex++] = dir.y;
            dataInfoFloat[dataInfoFloatIndex++] = dir.z;
            dataInfoFloat[dataInfoFloatIndex++] = 0;
        }

    }

    getBoundingBox (light: renderer.scene.SphereLight | renderer.scene.SpotLight, clusteredObject: ClusterObject<SphereLight | SpotLight>) {
        let worldPos = light.node!.worldPosition;
        geometry.Sphere.set(_sphere, worldPos.x, worldPos.y, worldPos.z, light.range);
        _sphere.getBoundary(clusteredObject.min, clusteredObject.max);
        clusteredObject.radius = light.range;
        clusteredObject.center.set(worldPos);
    }

    lights = []
    findObjects () {
        let lights = this.lights;
        lights.length = 0;
        for (let i = 0; i < director.root.scenes.length; i++) {
            let sphereLights = director.root.scenes[i].sphereLights;
            for (let ii = 0; ii < sphereLights.length; ii++) {
                if (sphereLights[ii].node.activeInHierarchy && sphereLights[ii].node.mobility !== MobilityMode.Static) {
                    lights.push(sphereLights[ii])
                }
            }
            let spotLights = director.root.scenes[i].spotLights;
            for (let ii = 0; ii < spotLights.length; ii++) {
                if (spotLights[ii].node.activeInHierarchy && spotLights[ii].node.mobility !== MobilityMode.Static) {
                    lights.push(spotLights[ii])
                }
            }
        }

        return lights
    }

    dirty = true;

    @property
    forceUpdate = false;

    _dirtyTimeout: NodeJS.Timeout | null;
    update (dt) {
        if (!this.dirty && !this.forceUpdate && !HrefSetting.forceUpdateLighting) {
            return;
        }

        if (EDITOR) {
            repaintInEditMode()
        }

        super.update(dt)

        if (!this._dirtyTimeout) {
            this._dirtyTimeout = setTimeout(() => {
                this.dirty = false;
                this._dirtyTimeout = null
            }, 500)
        }

    }
}
