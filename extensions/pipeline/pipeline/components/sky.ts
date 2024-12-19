import { Component, director, MeshRenderer, _decorator } from "cc";

const { ccclass, executeInEditMode } = _decorator

@ccclass('custom.Sky')
@executeInEditMode
export class Sky extends Component {
    start () {
        let mr = this.getComponent(MeshRenderer);

        let skybox = director.getScene().globals.skybox;
        mr.material.setProperty('envMap', skybox.reflectionMap || skybox.envmap)
    }
}
