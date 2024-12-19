import { Component, MeshRenderer, renderer, _decorator } from "cc";

const { ccclass, property, executeInEditMode } = _decorator

@ccclass('StaticBatchComp')
export class StaticBatchComp extends Component {
    start () {
        let mr = this.getComponent(MeshRenderer);

        let material = new renderer.MaterialInstance({
            parent: mr.material,
        })
        material.recompileShaders({ USE_INSTANCING: false })
        mr.material = material
    }
}
