import { postProcess, sys } from "cc";
import { Vec4, director, gfx, renderer, rendering } from "cc";
import { settings } from "./setting";

const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx

export class DeferredGBufferPass extends postProcess.BasePass {
    name = 'DeferredGBufferPass'
    outputNames = ['gBufferColor', 'gBufferNormal', 'gBufferEmissive', 'gBufferPosition', 'gBufferDS']

    // uniquePass = true;

    public render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        settings.tonemapped = false;
        settings.gbufferPass = this;

        // hack: use fog uniform to set deferred pipeline
        director.root.pipeline.pipelineSceneData.fog.fogStart = 1;

        let context = this.context;
        context.clearFlag = ClearFlagBit.COLOR | ClearFlagBit.DEPTH_STENCIL;
        Vec4.set(context.clearColor, 0, 0, 0, 1);
        Vec4.set(context.clearDepthColor, camera.clearDepth, camera.clearStencil, 0, 0);

        const colFormat = Format.RGBA16F;
        let posFormat = colFormat;
        if (!sys.isMobile) {
            posFormat = Format.RGBA32F
        }

        const slot0 = this.slotName(camera, 0);
        const slot1 = this.slotName(camera, 1);
        const slot2 = this.slotName(camera, 2);
        const slot3 = this.slotName(camera, 3);
        const slot4 = this.slotName(camera, 4);

        context.depthSlotName = slot4;

        context
            .updatePassViewPort()
            .addRenderPass('default', `${slot0}_Pass`)
            .addRasterView(slot0, colFormat, true)
            .addRasterView(slot1, colFormat, true)
            .addRasterView(slot2, colFormat, true)
            .addRasterView(slot3, posFormat, true)
            .addRasterView(slot4, Format.DEPTH_STENCIL, true)
            .version()

        context.pass
            .addQueue(QueueHint.RENDER_OPAQUE)
            .addSceneOfCamera(camera, new LightInfo(), SceneFlags.OPAQUE_OBJECT | SceneFlags.CUTOUT_OBJECT | SceneFlags.DRAW_INSTANCING);

    }
}
