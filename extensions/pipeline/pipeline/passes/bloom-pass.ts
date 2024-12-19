
import { _decorator, renderer, gfx, builtinResMgr, Input, rendering, Vec4, Material, CCString, input, director, postProcess } from "cc";
import { BloomSetting } from "../components/bloom";
import { HrefSetting } from "../settings/href-setting";

const { type, property, ccclass } = _decorator;
const { RasterView, AttachmentType, AccessType, ResourceResidency, LightInfo, SceneFlags, QueueHint, ComputeView } = rendering;
const { Format, LoadOp, StoreOp, ClearFlagBit, Color, Viewport } = gfx

export const MAX_BLOOM_FILTER_PASS_NUM = 6;
export const BLOOM_PREFILTERPASS_INDEX = 0;
export const BLOOM_DOWNSAMPLEPASS_INDEX = 1;
export const BLOOM_UPSAMPLEPASS_INDEX = BLOOM_DOWNSAMPLEPASS_INDEX + MAX_BLOOM_FILTER_PASS_NUM;
export const BLOOM_COMBINEPASS_INDEX = BLOOM_UPSAMPLEPASS_INDEX + MAX_BLOOM_FILTER_PASS_NUM;


const tempVec4 = new Vec4();

let clampSampler = new gfx.Sampler(new gfx.SamplerInfo(
    gfx.Filter.LINEAR, gfx.Filter.LINEAR, undefined,
    gfx.Address.CLAMP, gfx.Address.CLAMP
), 0);

export class BloomPass extends postProcess.SettingPass {
    get setting () { return this.getSetting(BloomSetting); }

    name = 'BloomPass'
    outputNames = ['BloomPassCombineColor']

    checkEnable (camera: renderer.scene.Camera) {
        let enable = super.checkEnable(camera)
        return enable && !!HrefSetting.bloom;
    }

    public render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        const slot0 = this.slotName(camera, 0);
        const context = this.context;
        const passViewport = context.passViewport;

        context.clearBlack();

        let material = globalThis.pipelineAssets.getMaterial('bloom')
        context.material = material;

        let setting = this.setting;
        let format = Format.RGBA16F

        // Start bloom
        // ==== Bloom prefilter ===
        const bloomPassPrefilterRTName = `dsBloomPassPrefilterColor${slot0}`;

        let shadingScale = 1 / 2;

        material.setProperty('texSize', new Vec4(0, 0, setting.threshold, 0), BLOOM_PREFILTERPASS_INDEX);

        let input0 = this.lastPass.slotName(camera, 0)
        context
            .updatePassViewPort(shadingScale)
            .addRenderPass('bloom-prefilter', `CameraBloomPrefilterPass${slot0}`)
            .setPassInput(input0, 'outputResultMap')
            .addRasterView(bloomPassPrefilterRTName, format)
            .blitScreen(BLOOM_PREFILTERPASS_INDEX)
            .version()

        // === Bloom downSampler ===
        let inputName = bloomPassPrefilterRTName;
        let iterations = setting.iterations;
        let downIndex = 0;
        for (let i = 0; i < iterations; ++i) {
            shadingScale /= 2;

            for (let j = 0; j < 2; j++) {
                context.updatePassViewPort(shadingScale)

                let params = new Vec4
                const bloomPassDownSampleRTName = `dsBloomPassDownSampleColor${slot0}${downIndex}`;
                let width = passViewport.width;
                if (j) {
                    params.set(0, setting.blurRadius / width);
                }
                else {
                    params.set(setting.blurRadius / width, 0);
                }
                material.setProperty('texSize', params, BLOOM_DOWNSAMPLEPASS_INDEX + downIndex);

                let layoutName = `bloom-downsample${downIndex}`
                context
                    .addRenderPass(layoutName, `CameraBloomDownSamplePass${slot0}${downIndex}`)
                    .setPassInput(inputName, 'bloomTexture')
                    .addRasterView(bloomPassDownSampleRTName, format)
                    .blitScreen(BLOOM_DOWNSAMPLEPASS_INDEX + downIndex)
                    .version()

                // let setter = (context.pass as any);
                // setter.addConstant('BloomUBO', layoutName);
                // setter.setSampler('bloomTexture', clampSampler)

                inputName = bloomPassDownSampleRTName;
                downIndex++;
            }
        }


        // === Bloom upSampler ===
        for (let i = iterations - 2; i >= 0; --i) {
            material.setProperty('texSize', new Vec4(1, 1, 0, 0), BLOOM_UPSAMPLEPASS_INDEX + i);

            const bloomPassUpSampleRTName = `dsBloomPassUpSampleColor${slot0}${i}`;
            context
                .updatePassViewPort(shadingScale)
                .addRenderPass(`bloom-upsample${i}`, `CameraBloomUpSamplePass${slot0}${i}`)
                .setPassInput(inputName, 'outputResultMap')
                .setPassInput(`dsBloomPassDownSampleColor${slot0}${i * 2 + 1}`, 'bloomTexture')
                .addRasterView(bloomPassUpSampleRTName, format)
                .blitScreen(BLOOM_UPSAMPLEPASS_INDEX + i)
                .version()

            inputName = bloomPassUpSampleRTName;
        }

        // === Bloom Combine Pass ===
        material.setProperty('texSize', new Vec4(setting.intensity, 1, 0, 0), BLOOM_COMBINEPASS_INDEX);

        context
            .updatePassViewPort()
            .addRenderPass('bloom-combine', `CameraBloomCombinePass${slot0}`)
            .setPassInput(input0, 'outputResultMap')
            .setPassInput(inputName, 'bloomTexture')
            .addRasterView(slot0, format)
            .blitScreen(BLOOM_COMBINEPASS_INDEX)
            .version()

    }
}
