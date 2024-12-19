import { Component, Node, Quat, Vec3, _decorator } from 'cc';
import { EDITOR } from 'cc/env';

const { property, ccclass, executeInEditMode } = _decorator

@ccclass('EditorCameraPlacer')
@executeInEditMode
export class EditorCameraPlacer extends Component {
    @property
    _place = false;

    @property
    get place () {
        return this._place;
    }
    set place (v) {
        this._place = v;

        if (EDITOR) {
            let cameraNode: Node = (globalThis as any).cce.Camera._camera.node
            if (v) {
                this._oldPosition.set(cameraNode.worldPosition);
                this._oldRotation.set(cameraNode.worldRotation);
            }
            else {
                cameraNode.worldPosition = this._oldPosition;
                cameraNode.worldRotation = this._oldRotation;
            }
        }
    }

    _oldPosition = new Vec3;
    _oldRotation = new Quat;

    update () {
        if (EDITOR && this.place) {
            let cameraNode: Node = (globalThis as any).cce.Camera._camera.node
            cameraNode.worldPosition = this.node.worldPosition;
            cameraNode.worldRotation = this.node.worldRotation;

            (globalThis as any).cce.Engine.repaintInEditMode()
        }
    }
}