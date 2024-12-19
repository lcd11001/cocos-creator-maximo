import { Component, Director, Game, _decorator, director, game, postProcess, renderer, rendering } from "cc";
import { DeferredGBufferPass } from "./passes/gbuffer-pass";
import { DeferredPostPass } from "./passes/deferred-post-pass";
import { DeferredLightingPass } from "./passes/deferred-lighting-pass";
import { BloomPass } from "./passes/bloom-pass";
import { CustomTaaPass } from "./passes/taa-pass";
import { CustomFSRPass } from "./passes/fsr-pass";
import { ZoomScreenPass } from "./passes/zoom-screen-pass";
import { HrefSetting } from "./settings/href-setting";

const { ccclass } = _decorator

let builder = rendering.getCustomPipeline('Custom') as postProcess.PostProcessBuilder;
if (builder) {
    builder.getCameraPipelineName = function getCameraPipelineName (camera: renderer.scene.Camera) {
        let pipelineName = camera.pipeline;
        if (!pipelineName && camera.usePostProcess) {
            pipelineName = 'deferred';
        } else {
            pipelineName = 'default';
        }
        return pipelineName;
    }
    let passes: postProcess.BasePass[] = [
        // new postProcess.ShadowPass,
        new DeferredGBufferPass,
        new DeferredLightingPass,
        new BloomPass,
        new CustomTaaPass,
        new CustomFSRPass,
        new ZoomScreenPass,
        new DeferredPostPass,
    ]
    builder.pipelines.set('deferred', passes);
    const forward = builder.getPass(postProcess.ForwardPass, 'forward');
    forward.context.maxSpotLights = 0;
    forward.context.maxSphereLights = 0;
    forward.context.maxPointLights = 0;
    forward.context.maxRangedDirLights = 0;
}

game.on(Game.EVENT_RENDERER_INITED, () => {
    director.root.pipeline.setMacroInt('CC_PIPELINE_TYPE', 1);
    director.root.pipeline.setMacroInt('CC_USE_HDR', 1);
})


@ccclass('PipelineManager')
class PipelineManager extends Component {
    postProcess: postProcess.PostProcess

    onEnable (): void {
        this.postProcess = this.getComponent(postProcess.PostProcess)
    }

    update (dt: number): void {
        if (!this.postProcess) {
            return;
        }

        this.postProcess.shadingScale = HrefSetting.shadingScale;
    }
}
