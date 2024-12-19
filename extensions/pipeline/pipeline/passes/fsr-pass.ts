import { Material, Vec4, _decorator, gfx, postProcess, renderer, rendering } from "cc";
import { HrefSetting } from "../settings/href-setting";
import { settings } from "./setting";

export class CustomFSRPass extends postProcess.FSRPass {
    checkEnable (camera: renderer.scene.Camera): boolean {
        let enable = super.checkEnable(camera);
        return enable && !!HrefSetting.fsr;
    }
    render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        this._material = globalThis.pipelineAssets.getMaterial('fsr')
        super.render(camera, ppl);
        settings.tonemapped = true;
    }
}
