
import { _decorator, renderer, gfx, builtinResMgr, Input, rendering, Material, CCString, Vec4, game, director, ReflectionProbe, TextureCube, sys, postProcess, } from "cc";
import { EDITOR, JSB } from "cc/env";
import { ExponentialHeightFog, fogUBO } from "../components/fog/height-fog";
import { ReflectionProbes } from "../components/reflection-probe-utils";
import { LightWorldCluster } from "../components/cluster/light-cluster";
import { HrefSetting } from "../settings/href-setting";
import { settings } from "./setting";

const { type, property, ccclass } = _decorator;
const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx

let EditorCameras = [
    'scene:material-previewcamera',
    'Scene Gizmo Camera',
    'Editor UIGizmoCamera',

    'Main Camera',
]

let tempVec4 = new Vec4

export class DeferredLightingPass extends postProcess.BasePass {
    materialMap: Map<renderer.scene.Camera, Material> = new Map
    tempMat: Material
    clearMat: renderer.MaterialInstance

    enableClusterLighting = 0;
    enableIBL = 0;
    enableShadow = 0;
    enableFog = 0;

    debugAlbedo = 0;
    debugNormal = 0;

    // uniquePass = true;

    probes: ReflectionProbe[] = []

    @property({ override: true })
    name = 'DeferredLightingPass'

    @property({ override: true })
    outputNames = ['DeferredLightingColor', 'gBufferDS']

    updateClusterUBO (setter: any, material: Material) {
        let cluster = globalThis.lightCluster as LightWorldCluster;
        if (!cluster) {
            return;
        }

        setter.setVec4('light_cluster_BoundsMin', tempVec4.set(cluster.boundsMin.x, cluster.boundsMin.y, cluster.boundsMin.z, 1))
        setter.setVec4('light_cluster_BoundsDelta', tempVec4.set(cluster.boundsDelta.x, cluster.boundsDelta.y, cluster.boundsDelta.z, 1))
        setter.setVec4('light_cluster_CellsDot', cluster.clusterCellsDotData)
        setter.setVec4('light_cluster_CellsMax', cluster.clusterCellsMaxData)
        setter.setVec4('light_cluster_TextureSize', cluster.clusterTextureSizeData)
        setter.setVec4('light_cluster_InfoTextureInvSize', cluster.infoTextureInvSizeData)
        setter.setVec4('light_cluster_CellsCountByBoundsSizeAndPixelsPerCell', cluster.clusterCellsCountByBoundsSizeData)

        // if (EDITOR) {
        //     material.setProperty('light_cluster_InfoTexture', cluster.dataInfoTextureFloat)
        //     material.setProperty('light_cluster_Texture', cluster.clusterTexture)

        //     let pass = material.passes[0];
        //     let pointSampler = director.root.pipeline.globalDSManager.pointSampler
        //     let binding = pass.getBinding('light_cluster_InfoTexture')
        //     pass.bindSampler(binding, pointSampler)
        //     binding = pass.getBinding('light_cluster_Texture')
        //     pass.bindSampler(binding, pointSampler)
        // }
        // else {
        setter.setTexture('light_cluster_InfoTexture', cluster.dataInfoTextureFloat);
        setter.setTexture('light_cluster_Texture', cluster.clusterTexture);

        let pointSampler = director.root.pipeline.globalDSManager.pointSampler
        setter.setSampler('light_cluster_InfoTexture', pointSampler)
        setter.setSampler('light_cluster_Texture', pointSampler)
        // }
    }

    recompileMat (material: Material, probes, enableIbl: number) {
        material.recompileShaders({
            // CC_USE_IBL: 0,
            CC_RECEIVE_SHADOW: 1,
            REFLECTION_PROBE_COUNT: probes.length,
            ENABLE_CLUSTER_LIGHTING: HrefSetting.clusterLighting,
            ENABLE_IBL: enableIbl,
            ENABLE_SHADOW: HrefSetting.shadow,
            ENABLE_FOG: HrefSetting.fog,
            DEBUG_ALBEDO: HrefSetting.debugAlbedo,
            DEBUG_NORMAL: HrefSetting.debugNormal,
        })

        this.enableClusterLighting = HrefSetting.clusterLighting
        this.enableIBL = enableIbl
        this.enableShadow = HrefSetting.shadow
        this.enableFog = HrefSetting.fog
        this.debugAlbedo = HrefSetting.debugAlbedo
        this.debugNormal = HrefSetting.debugNormal
    }

    public render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        ppl.enableCpuLightCulling = false;
        const slot0 = this.slotName(camera, 0);
        let slot1 = this.slotName(camera, 1);
        if (settings.gbufferPass) {
            slot1 = settings.gbufferPass.slotName(camera, 4);
        }

        // passUtils.clearFlag = gfx.ClearFlagBit.NONE;
        let context = this.context;
        context.clearBlack();
        context
            .updatePassViewPort()
            .addRenderPass('deferred-lighting', `Pass_${slot0}`)
            .setPassInput(this.lastPass.slotName(camera, 0), 'gbuffer_albedoMap')
            .setPassInput(this.lastPass.slotName(camera, 1), 'gbuffer_normalMap')
            .setPassInput(this.lastPass.slotName(camera, 2), 'gbuffer_emissiveMap')
            .setPassInput(this.lastPass.slotName(camera, 3), 'gbuffer_posMap');

        let setter = context.pass as any;
        let shadowPass = context.shadowPass;
        if (shadowPass) {
            for (const dirShadowName of shadowPass.mainLightShadows) {
                context.setPassInput(dirShadowName, 'cc_shadowMap');
            }

            // not work, will override by queue data
            // let frameBuffer = ppl.pipelineSceneData.shadowFrameBufferMap.get(camera.scene.mainLight);
            // if (frameBuffer) {
            //     setter.setTexture('cc_shadowMap', frameBuffer.colorTextures[0])

            //     let pointSampler = director.root.pipeline.globalDSManager.pointSampler
            //     setter.setSampler('cc_shadowMap', pointSampler)
            // }
        }

        context
            .addRasterView(slot0, Format.RGBA16F, true)
            // .addRasterView(slot1, Format.DEPTH_STENCIL, true)
            .version()

        let probes = ReflectionProbes.probes
        probes = probes.filter(p => {
            return p.enabledInHierarchy
        })

        let enableIbl = HrefSetting.ibl;
        if (settings.bakingReflection) {
            enableIbl = 0;
        }

        let sharedMaterial = globalThis.pipelineAssets.getMaterial('deferred-lighting')
        let material = this.materialMap.get(camera);
        if (!material || material.parent !== sharedMaterial) {
            if (EDITOR && EditorCameras.includes(camera.name)) {
                material = new renderer.MaterialInstance({
                    parent: sharedMaterial,
                })
                material.recompileShaders({ CLEAR_LIGHTING: true })
            }
            else {
                // director.root.pipeline.macros.CC_USE_IBL = 0;
                material = new renderer.MaterialInstance({
                    parent: sharedMaterial,
                })
                this.recompileMat(material, probes, enableIbl)
            }
            this.materialMap.set(camera, material);
        }

        if (probes.length !== this.probes.length ||
            this.enableClusterLighting !== HrefSetting.clusterLighting ||
            this.enableIBL !== enableIbl ||
            this.enableShadow !== HrefSetting.shadow ||
            this.enableFog !== HrefSetting.fog ||
            this.debugAlbedo !== HrefSetting.debugAlbedo ||
            this.debugNormal !== HrefSetting.debugNormal) {

            this.recompileMat(material, probes, enableIbl)
        }

        for (let i = 0; i < 3; i++) {
            let probe = probes[i];
            if (!probe) break;

            let pos = probe.node.worldPosition;
            let range = Math.max(probe.size.x, probe.size.y, probe.size.z)

            setter.setVec4('light_ibl_posRange' + i, tempVec4.set(pos.x, pos.y, pos.z, range))
            let cubemap: TextureCube = (probe as any)._cubemap
            // if (EDITOR) {
            //     material.setProperty('light_ibl_Texture' + i, cubemap)
            // }
            // else {
            setter.setTexture('light_ibl_Texture' + i, cubemap.getGFXTexture())
            setter.setSampler('light_ibl_Texture' + i, cubemap.getGFXSampler())
            // }
        }

        this.probes = probes;

        this.updateClusterUBO(setter, material);

        fogUBO.update(setter, material);

        context.pass
            .addQueue(QueueHint.RENDER_TRANSPARENT)
            .addCameraQuad(
                camera, material, 0,
                SceneFlags.VOLUMETRIC_LIGHTING,
            );

        // render transparent
        // todo: remove this pass
        if (HrefSetting.transparent) {
            context.clearFlag = gfx.ClearFlagBit.NONE;
            context
                .updatePassViewPort()
                .addRenderPass('default', `LightingTransparent${slot0}`)
                .addRasterView(slot0, Format.RGBA16F, true)
                .addRasterView(slot1, Format.DEPTH_STENCIL, true)
                .version()

            let flags = SceneFlags.PLANAR_SHADOW | SceneFlags.GEOMETRY;
            // if (sys.platform !== sys.Platform.IOS && sys.platform !== sys.Platform.MACOS) {
            flags = flags | SceneFlags.TRANSPARENT_OBJECT
            // }
            context.pass
                .addQueue(QueueHint.RENDER_TRANSPARENT)
                .addSceneOfCamera(
                    camera, new LightInfo(),
                    flags
                )
        }
    }
}
