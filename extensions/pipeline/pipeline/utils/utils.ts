
import { gfx, Mesh, director, utils, Vec3, RenderTexture, geometry, renderer, rendering, IVec4Like } from "cc";

const { Sphere, intersect } = geometry
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx
const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { ShadowType, LightType, SKYBOX_FLAG, CSMLevel } = renderer.scene

let _quadMesh: Mesh | null = null;
export function getQuadMesh () {
    if (!_quadMesh) {
        _quadMesh = utils.createMesh({
            positions: [-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0],
            uvs: [0, 0, 0, 1, 1, 1, 1, 0],
            indices: [0, 2, 1, 0, 3, 2],
            minPos: new Vec3(-1, -1, 0),
            maxPos: new Vec3(1, 1, 0)
        });
        _quadMesh.initialize();

    }
    return _quadMesh;
}

let _quadIA: gfx.InputAssembler | null = null;
export function getQuadIA () {
    if (!_quadIA) {
        const pipeline = director.root!.pipeline!;
        const device = pipeline.device;

        let mesh = getQuadMesh();
        _quadIA = device.createInputAssembler(mesh.renderingSubMeshes[0]!.iaInfo);
    }
    return _quadIA;
}


export function readPixels (rt: RenderTexture, buffer: any, index = 0) {
    const gfxTexture = rt.window.framebuffer.colorTextures[index];

    const bufferViews: ArrayBufferView[] = [];
    const regions: gfx.BufferTextureCopy[] = [];

    const region0 = new gfx.BufferTextureCopy();
    region0.texOffset.x = 0;
    region0.texOffset.y = 0;
    region0.texExtent.width = rt.width;
    region0.texExtent.height = rt.height;
    regions.push(region0);

    bufferViews.push(buffer);
    director.root.device.copyTextureToBuffers(gfxTexture, bufferViews, regions);
}



export class CameraInfo {
    shadowEnabled = false;
    mainLightShadowNames = new Array<string>();
    spotLightShadowNames = new Array<string>();
}

const _cameras: renderer.scene.Camera[] = [];
export function getCameraUniqueID (camera: renderer.scene.Camera) {
    if (!_cameras.includes(camera)) {
        _cameras.push(camera);
    }
    return camera.name + '_' + _cameras.indexOf(camera);
}

export function getRenderArea (out: gfx.Rect, camera: renderer.scene.Camera, width: number, height: number, light: renderer.scene.Light | null = null, level = 0) {
    const vp = camera.viewport;
    const w = width;
    const h = height;
    out.x = vp.x * w;
    out.y = vp.y * h;
    out.width = vp.width * w;
    out.height = vp.height * h;
    if (light) {
        switch (light.type) {
            case LightType.DIRECTIONAL: {
                const mainLight = light as renderer.scene.DirectionalLight;
                if (mainLight.shadowFixedArea || mainLight.csmLevel === CSMLevel.LEVEL_1) {
                    out.x = 0;
                    out.y = 0;
                    out.width = w;
                    out.height = h;
                } else {
                    out.x = level % 2 * 0.5 * w;
                    out.y = (1 - Math.floor(level / 2)) * 0.5 * h;
                    out.width = 0.5 * w;
                    out.height = 0.5 * h;
                }
                break;
            }
            case LightType.SPOT: {
                out.x = 0;
                out.y = 0;
                out.width = w;
                out.height = h;
                break;
            }
            default:
        }
    }

    out.width = Math.floor(out.width);
    out.height = Math.floor(out.height);

    return out;
}


export function getLoadOpOfClearFlag (clearFlag: gfx.ClearFlagBit, attachment: rendering.AttachmentType): gfx.LoadOp {
    let loadOp = LoadOp.CLEAR;
    if (!(clearFlag & ClearFlagBit.COLOR)
        && attachment === AttachmentType.RENDER_TARGET) {
        if (clearFlag & SKYBOX_FLAG) {
            loadOp = LoadOp.CLEAR;
        } else {
            loadOp = LoadOp.LOAD;
        }
    }
    if ((clearFlag & ClearFlagBit.DEPTH_STENCIL) !== ClearFlagBit.DEPTH_STENCIL
        && attachment === AttachmentType.DEPTH_STENCIL) {
        if (!(clearFlag & ClearFlagBit.DEPTH)) loadOp = LoadOp.LOAD;
        if (!(clearFlag & ClearFlagBit.STENCIL)) loadOp = LoadOp.LOAD;
    }
    return loadOp;
}

export function validPunctualLightsCulling (pipeline: rendering.Pipeline, camera: renderer.scene.Camera) {
    const sceneData = pipeline.pipelineSceneData;
    const validPunctualLights = sceneData.validPunctualLights;
    validPunctualLights.length = 0;
    const _sphere = Sphere.create(0, 0, 0, 1);
    const { spotLights } = camera.scene!;
    for (let i = 0; i < spotLights.length; i++) {
        const light = spotLights[i];
        if (light.baked) {
            continue;
        }

        Sphere.set(_sphere, light.position.x, light.position.y, light.position.z, light.range);
        if (intersect.sphereFrustum(_sphere, camera.frustum)) {
            validPunctualLights.push(light);
        }
    }

    const { sphereLights } = camera.scene!;
    for (let i = 0; i < sphereLights.length; i++) {
        const light = sphereLights[i];
        if (light.baked) {
            continue;
        }
        Sphere.set(_sphere, light.position.x, light.position.y, light.position.z, light.range);
        if (intersect.sphereFrustum(_sphere, camera.frustum)) {
            validPunctualLights.push(light);
        }
    }
}

export function SRGBToLinear (out: IVec4Like, gamma: IVec4Like) {
    // out.x = Math.pow(gamma.x, 2.2);
    // out.y = Math.pow(gamma.y, 2.2);
    // out.z = Math.pow(gamma.z, 2.2);
    out.x = gamma.x * gamma.x;
    out.y = gamma.y * gamma.y;
    out.z = gamma.z * gamma.z;
}
