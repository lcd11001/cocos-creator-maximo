import { CCClass, Component, _decorator } from "cc";
import { HrefSetting } from "../settings/href-setting";

const { ccclass } = _decorator

@ccclass('SceneParticles')
export class SceneParticles extends Component {
    start () {
        if (!HrefSetting.sceneParticles) {
            this.node.removeFromParent()
        }
    }
}
