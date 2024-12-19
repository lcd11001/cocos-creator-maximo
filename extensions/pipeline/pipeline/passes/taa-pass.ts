import { Material, Texture2D, builtinResMgr, postProcess, renderer, rendering } from "cc";
import { EDITOR } from "cc/env";
import { HrefSetting } from "../settings/href-setting";


export class CustomTaaPass extends postProcess.TAAPass {
    materialMap: Map<renderer.scene.Camera, Material> = new Map

    _originalMaterial: Material | undefined

    checkEnable (camera: renderer.scene.Camera): boolean {
        let enable = super.checkEnable(camera);
        return enable && !!HrefSetting.taa;
    }

    render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        if (!EDITOR) {
            if (!this._originalMaterial) {
                this._originalMaterial = globalThis.pipelineAssets.getMaterial('deferred-taa');
            }

            let material = this.materialMap.get(camera);
            if (!material || material.parent !== this._originalMaterial) {
                material = new renderer.MaterialInstance({
                    parent: this._originalMaterial
                })
                material.recompileShaders({
                    USE_TAA_MASK: !EDITOR,
                })
                this.materialMap.set(camera, material);
            }
            this._material = material;

            let taaMaskTexture: Texture2D = globalThis.taaMask && globalThis.taaMask.mask;
            if (!taaMaskTexture || !HrefSetting.taaMask) {
                taaMaskTexture = builtinResMgr.get('black-texture')
            }
            material.setProperty('motionMaskTex', taaMaskTexture)
        }

        super.render(camera, ppl);
    }
}
