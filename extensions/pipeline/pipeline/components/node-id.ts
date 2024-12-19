import { Component, gfx, Material, MeshRenderer, Vec4, _decorator } from "cc";

const { ccclass, property, executeInEditMode } = _decorator

@ccclass('NodeID')
@executeInEditMode
export class NodeID extends Component {
    @property
    __id = 0

    @property
    get id () {
        return this.__id
    }
    set id (v) {
        this.__id = v
        this.register()
    }

    // __preload () {
    //     this.register()
    // }

    onEnable () {
        this.register()
    }

    register () {
        if (globalThis.nodeIDManager) {
            globalThis.nodeIDManager.register(this);
        }
    }
}