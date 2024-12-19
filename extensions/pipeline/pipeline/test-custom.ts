import { gfx, Material, renderer, rendering } from "cc";
import { EDITOR } from "cc/env";
import { getCameraUniqueID, getLoadOpOfClearFlag, getRenderArea, SRGBToLinear } from "./utils/utils";

const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx


export class GBufferInfo {
    color!: string;
    normal!: string;
    emissive!: string;
    ds!: string;
}
// deferred passes
export function buildGBufferPass (camera: renderer.scene.Camera,
    ppl: rendering.Pipeline) {
    const cameraID = getCameraUniqueID(camera);
    const area = getRenderArea(camera, camera.window.width, camera.window.height);
    const width = area.width;
    const height = area.height;
    const gBufferPassRTName = `gBufferPassColorCamera`;
    const gBufferPassNormal = `gBufferPassNormal`;
    const gBufferPassEmissive = `gBufferPassEmissive`;
    const gBufferPassDSName = `gBufferPassDSCamera`;
    if (!ppl.containsResource(gBufferPassRTName)) {
        const colFormat = Format.RGBA16F;
        ppl.addRenderTarget(gBufferPassRTName, colFormat, width, height, ResourceResidency.MANAGED);
        ppl.addRenderTarget(gBufferPassNormal, colFormat, width, height, ResourceResidency.MANAGED);
        ppl.addRenderTarget(gBufferPassEmissive, colFormat, width, height, ResourceResidency.MANAGED);
        ppl.addDepthStencil(gBufferPassDSName, Format.DEPTH_STENCIL, width, height, ResourceResidency.MANAGED);
    }
    // gbuffer pass
    const gBufferPass = ppl.addRasterPass(width, height, 'Geometry');
    gBufferPass.name = `CameraGBufferPass${cameraID}`;
    gBufferPass.setViewport(new Viewport(area.x, area.y, area.width, area.height));
    const rtColor = new Color(0, 0, 0, 0);
    if (camera.clearFlag & ClearFlagBit.COLOR) {
        if (ppl.pipelineSceneData.isHDR) {
            SRGBToLinear(rtColor, camera.clearColor);
        } else {
            rtColor.x = camera.clearColor.x;
            rtColor.y = camera.clearColor.y;
            rtColor.z = camera.clearColor.z;
        }
    }
    const passColorView = new RasterView('_',
        AccessType.WRITE, AttachmentType.RENDER_TARGET,
        LoadOp.CLEAR, StoreOp.STORE,
        camera.clearFlag,
        rtColor);
    const passNormalView = new RasterView('_',
        AccessType.WRITE, AttachmentType.RENDER_TARGET,
        LoadOp.CLEAR, StoreOp.STORE,
        camera.clearFlag,
        new Color(0, 0, 0, 0));
    const passEmissiveView = new RasterView('_',
        AccessType.WRITE, AttachmentType.RENDER_TARGET,
        LoadOp.CLEAR, StoreOp.STORE,
        camera.clearFlag,
        new Color(0, 0, 0, 0));
    const passDSView = new RasterView('_',
        AccessType.WRITE, AttachmentType.DEPTH_STENCIL,
        LoadOp.CLEAR, StoreOp.STORE,
        camera.clearFlag,
        new Color(camera.clearDepth, camera.clearStencil, 0, 0));
    gBufferPass.addRasterView(gBufferPassRTName, passColorView);
    gBufferPass.addRasterView(gBufferPassNormal, passNormalView);
    gBufferPass.addRasterView(gBufferPassEmissive, passEmissiveView);
    gBufferPass.addRasterView(gBufferPassDSName, passDSView);
    gBufferPass
        .addQueue(QueueHint.RENDER_OPAQUE)
        .addSceneOfCamera(camera, new LightInfo(), SceneFlags.OPAQUE_OBJECT | SceneFlags.CUTOUT_OBJECT | SceneFlags.DRAW_INSTANCING);
    const gBufferInfo = new GBufferInfo();
    gBufferInfo.color = gBufferPassRTName;
    gBufferInfo.normal = gBufferPassNormal;
    gBufferInfo.emissive = gBufferPassEmissive;
    gBufferInfo.ds = gBufferPassDSName;
    return gBufferInfo;
}


class LightingInfo {
    declare deferredLightingMaterial: Material;
    private _init () {
        this.deferredLightingMaterial = new Material();
        this.deferredLightingMaterial.name = 'builtin-deferred-material';
        this.deferredLightingMaterial.initialize({
            effectName: 'pipeline/deferred-lighting',
            defines: { CC_RECEIVE_SHADOW: 1 },
        });
        for (let i = 0; i < this.deferredLightingMaterial.passes.length; ++i) {
            this.deferredLightingMaterial.passes[i].tryCompile();
        }
    }
    constructor () {
        this._init();
    }
}

let lightingInfo: LightingInfo | null = null;
let clearMat: Material | undefined;
let EditorCameras = [
    'Main Camera',
    'scene:material-previewcamera',
    'Scene Gizmo Camera',
    'Editor UIGizmoCamera'
]

// deferred lighting pass
export function buildLightingPass (camera: renderer.scene.Camera, ppl: rendering.Pipeline, gBuffer: GBufferInfo) {
    if (!lightingInfo) {
        lightingInfo = new LightingInfo();
    }
    const cameraID = getCameraUniqueID(camera);
    const cameraName = `Camera${cameraID}`;
    // const cameraInfo = buildShadowPasses(cameraName, camera, ppl);
    const area = getRenderArea(camera, camera.window.width, camera.window.height);
    const width = area.width;
    const height = area.height;

    const deferredLightingPassRTName = `deferredLightingPassRTName`;
    const deferredLightingPassDS = `deferredLightingPassDS`;
    if (!ppl.containsResource(deferredLightingPassRTName)) {
        ppl.addRenderTarget(deferredLightingPassRTName, Format.RGBA8, width, height, ResourceResidency.MANAGED);
        ppl.addDepthStencil(deferredLightingPassDS, Format.DEPTH_STENCIL, width, height, ResourceResidency.MANAGED);
    }
    // lighting pass
    const lightingPass = ppl.addRasterPass(width, height, 'Lighting');
    lightingPass.name = `CameraLightingPass${cameraID}`;
    lightingPass.setViewport(new Viewport(area.x, area.y, width, height));
    // for (const dirShadowName of cameraInfo.mainLightShadowNames) {
    //     if (ppl.containsResource(dirShadowName)) {
    //         const computeView = new ComputeView();
    //         lightingPass.addComputeView(dirShadowName, computeView);
    //     }
    // }
    // for (const spotShadowName of cameraInfo.spotLightShadowNames) {
    //     if (ppl.containsResource(spotShadowName)) {
    //         const computeView = new ComputeView();
    //         lightingPass.addComputeView(spotShadowName, computeView);
    //     }
    // }
    if (ppl.containsResource(gBuffer.color)) {
        const computeView = new ComputeView();
        computeView.name = 'gbuffer_albedoMap';
        lightingPass.addComputeView(gBuffer.color, computeView);

        const computeNormalView = new ComputeView();
        computeNormalView.name = 'gbuffer_normalMap';
        lightingPass.addComputeView(gBuffer.normal, computeNormalView);

        const computeEmissiveView = new ComputeView();
        computeEmissiveView.name = 'gbuffer_emissiveMap';
        lightingPass.addComputeView(gBuffer.emissive, computeEmissiveView);

        const computeDepthView = new ComputeView();
        computeDepthView.name = 'depth_stencil';
        lightingPass.addComputeView(gBuffer.ds, computeDepthView);
    }
    const lightingClearColor = new Color(0, 0, 0, 0);
    if (camera.clearFlag & ClearFlagBit.COLOR) {
        lightingClearColor.x = camera.clearColor.x;
        lightingClearColor.y = camera.clearColor.y;
        lightingClearColor.z = camera.clearColor.z;
    }
    lightingClearColor.w = 0;
    const lightingPassView = new RasterView('_',
        AccessType.WRITE, AttachmentType.RENDER_TARGET,
        LoadOp.CLEAR, StoreOp.STORE,
        camera.clearFlag,
        lightingClearColor);
    lightingPass.addRasterView(deferredLightingPassRTName, lightingPassView);

    let material = globalThis.pipelineAssets.getMaterial('deferred-lighting') || lightingInfo.deferredLightingMaterial
    if (EDITOR && EditorCameras.includes(camera.name)) {
        if (!clearMat) {
            clearMat = new renderer.MaterialInstance({
                parent: material,
            })
            clearMat.recompileShaders({ CLEAR_LIGHTING: true })
        }
        material = clearMat;
    }

    lightingPass.addQueue(QueueHint.RENDER_TRANSPARENT).addCameraQuad(
        camera, material, 0,
        SceneFlags.VOLUMETRIC_LIGHTING,
    );
    lightingPass.addQueue(QueueHint.RENDER_TRANSPARENT).addSceneOfCamera(camera, new LightInfo(),
        SceneFlags.TRANSPARENT_OBJECT | SceneFlags.PLANAR_SHADOW | SceneFlags.GEOMETRY);
    return { rtName: deferredLightingPassRTName, dsName: deferredLightingPassDS };
}

class PostInfo {
    declare postMaterial: Material;
    private _init () {
        this.postMaterial = new Material();
        this.postMaterial.name = 'builtin-post-process-material';

        this.postMaterial.initialize({
            effectName: 'pipeline/post-process',
            defines: {
                // Anti-aliasing type, currently only fxaa, so 1 means fxaa
                ANTIALIAS_TYPE: 0,
            },
        });
        for (let i = 0; i < this.postMaterial.passes.length; ++i) {
            this.postMaterial.passes[i].tryCompile();
        }
    }
    constructor () {
        this._init();
    }
}

let postInfo: PostInfo | null = null;

export function buildPostprocessPass (camera: renderer.scene.Camera,
    ppl: rendering.Pipeline,
    inputTex: string) {
    if (!postInfo) {
        postInfo = new PostInfo();
    }
    const cameraID = getCameraUniqueID(camera);
    const area = getRenderArea(camera, camera.window.width, camera.window.height);
    const width = area.width;
    const height = area.height;
    const postprocessPassRTName = `postprocessPassRTName${cameraID}`;
    const postprocessPassDS = `postprocessPassDS${cameraID}`;
    if (!ppl.containsResource(postprocessPassRTName)) {
        ppl.addRenderTexture(postprocessPassRTName, Format.RGBA8, width, height, camera.window);
        ppl.addDepthStencil(postprocessPassDS, Format.DEPTH_STENCIL, width, height, ResourceResidency.MANAGED);
    }
    ppl.updateRenderWindow(postprocessPassRTName, camera.window);
    const postprocessPass = ppl.addRasterPass(width, height, 'Postprocess');
    postprocessPass.name = `CameraPostprocessPass${cameraID}`;
    postprocessPass.setViewport(new Viewport(area.x, area.y, area.width, area.height));
    if (ppl.containsResource(inputTex)) {
        const computeView = new ComputeView();
        computeView.name = 'outputResultMap';
        postprocessPass.addComputeView(inputTex, computeView);
    }
    const postClearColor = new Color(0, 0, 0, camera.clearColor.w);
    if (camera.clearFlag & ClearFlagBit.COLOR) {
        postClearColor.x = camera.clearColor.x;
        postClearColor.y = camera.clearColor.y;
        postClearColor.z = camera.clearColor.z;
    }
    const postprocessPassView = new RasterView('_',
        AccessType.WRITE, AttachmentType.RENDER_TARGET,
        getLoadOpOfClearFlag(camera.clearFlag, AttachmentType.RENDER_TARGET),
        StoreOp.STORE,
        camera.clearFlag,
        postClearColor);
    const postprocessPassDSView = new RasterView('_',
        AccessType.WRITE, AttachmentType.DEPTH_STENCIL,
        getLoadOpOfClearFlag(camera.clearFlag, AttachmentType.DEPTH_STENCIL),
        StoreOp.STORE,
        camera.clearFlag,
        new Color(camera.clearDepth, camera.clearStencil, 0, 0));
    postprocessPass.addRasterView(postprocessPassRTName, postprocessPassView);
    postprocessPass.addRasterView(postprocessPassDS, postprocessPassDSView);
    postprocessPass.addQueue(QueueHint.NONE).addFullscreenQuad(
        postInfo.postMaterial, 0, SceneFlags.NONE,
    );
    postprocessPass.addQueue(QueueHint.RENDER_TRANSPARENT).addSceneOfCamera(camera, new LightInfo(),
        SceneFlags.UI | SceneFlags.PROFILER);
    return { rtName: postprocessPassRTName, dsName: postprocessPassDS };
}

export function buildDeferred (camera: renderer.scene.Camera, ppl: rendering.Pipeline) {
    if (!camera.scene) {
        return;
    }
    // GBuffer Pass
    const gBufferInfo = buildGBufferPass(camera, ppl);
    // Lighting Pass
    const lightInfo = buildLightingPass(camera, ppl, gBufferInfo);
    // Postprocess
    buildPostprocessPass(camera, ppl, lightInfo.rtName);
}
