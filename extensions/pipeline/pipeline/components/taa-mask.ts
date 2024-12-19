import { Camera, Component, game, RenderTexture, _decorator } from "cc";
import { HrefSetting } from "../settings/href-setting";

const { ccclass, executeInEditMode } = _decorator

@ccclass('TAAMask')
@executeInEditMode
export class TAAMask extends Component {
    mask: RenderTexture
    start () {
        let cam = this.getComponent(Camera)
        if (!cam) {
            return
        }

        if (!HrefSetting.taaMask) {
            cam.enabled = false
            return;
        }

        let tex = new RenderTexture()
        tex.reset({
            width: game.canvas.width * HrefSetting.shadingScale,
            height: game.canvas.height * HrefSetting.shadingScale,
        })

        this.mask = tex
        cam.targetTexture = tex

        globalThis.taaMask = this
    }

    onDestroy () {
        if (globalThis.taaMask === this) {
            globalThis.taaMask = undefined
        }
    }
}

