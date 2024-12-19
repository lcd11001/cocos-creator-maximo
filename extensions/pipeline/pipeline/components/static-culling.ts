import { Component, director, MeshRenderer, _decorator } from "cc";

const { ccclass, executeInEditMode } = _decorator;

@ccclass('StaticCulling')
// @executeInEditMode
export class StaticCulling extends Component {
    start () {
        setTimeout(() => {
            this.hack()
        }, 1500);
    }
    hack () {
        let mrs = this.node.getComponentsInChildren(MeshRenderer);
        mrs.forEach(mr => {
            mr.model.updateUBOs = () => { }
        })
    }
}
