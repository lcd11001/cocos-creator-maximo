import { Material, Vec4, _decorator, game, gfx, postProcess, renderer, rendering } from "cc";
import { HrefSetting } from "../settings/href-setting";
import { settings } from "./setting";


const { type, property, ccclass } = _decorator;
const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx

export class DeferredPostPass extends postProcess.BasePass {
    get material () {
        return globalThis.pipelineAssets.getMaterial('final-post');
    }
    materialMap: Map<renderer.scene.Camera, Material> = new Map

    name = 'DeferredPostPass'
    outputNames = ['DeferredPostColor', 'DeferredPostDS']

    params1 = new Vec4
    params2 = new Vec4

    public render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        const context = this.context;

        const input0 = this.lastPass.slotName(camera, 0);
        const slot0 = this.slotName(camera, 0);

        context.clearFlag = camera.clearFlag & gfx.ClearFlagBit.COLOR;
        Vec4.set(context.clearColor, 0, 0, 0, 1);

        let material = this.materialMap.get(camera);
        if (!material || material.parent !== this.material) {
            material = new renderer.MaterialInstance({
                parent: this.material
            })
            this.materialMap.set(camera, material);
        }

        context.material = material;

        material.setProperty('params1',
            this.params1.set(
                game.canvas.width, game.canvas.height,
                settings.outputRGBE ? 1 : 0,
                settings.tonemapped ? 0 : 1
            )
        );

        material.setProperty('params2',
            this.params2.set(
                HrefSetting.fxaa, 0, 0, 0
            )
        );

        const shadingScale = context.shadingScale;
        context
            .updatePassViewPort(1 / shadingScale, 1 / shadingScale)
            .addRenderPass('post-process', `Pass_${slot0}`)
            .setPassInput(input0, 'inputTexture')
            .addRasterView(slot0, Format.RGBA8, false)
            .blitScreen(0)
            .version()

        this.renderProfiler(camera);
    }
}
