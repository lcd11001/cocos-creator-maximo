import { Component, _decorator, Vec3, EventTouch, Touch, Quat, Vec2, Node, EventMouse, lerp, input, Input } from 'cc'
import { EDITOR } from 'cc/env';
const { ccclass, property, type } = _decorator;

let tempVec3 = new Vec3
let tempVec3_2 = new Vec3
let tempQuat = new Quat
const DeltaFactor = 1 / 200

let PositiveForward = new Vec3(0, 0, 1);

@ccclass('OrbitCamera')
export default class OrbitCamera extends Component {

    @property
    enableTouch = true;

    @property
    rotateSpeed = 1;
    @property
    xRotationRange = new Vec2(5, 70);

    @property
    get targetRotation (): Vec3 {
        if (!EDITOR) {
            this._startRotation.set(this._targetRotation);
        }
        return this._startRotation;
    }
    set targetRotation (v: Vec3) {
        this._targetRotation.set(v);
        this._startRotation.set(v);
    }

    @property
    private _startRotation = new Vec3;


    private _touched = false;
    private _targetRotation = new Vec3;
    private _rotation = new Quat

    start () {
        if (this.enableTouch) {
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this)
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this)
        }

        this._targetRotation.set(this.node.eulerAngles);
        this._rotation.set(this.node.rotation);

        this.limitRotation()
    }

    onTouchStart () {
        this._targetRotation.set(this.node.eulerAngles);
        this._rotation.set(this.node.rotation);
        this._touched = true;
    }
    onTouchMove (touch: EventTouch) {
        // if (!this._touched) return;
        let delta = touch.getDelta()

        Quat.fromEuler(tempQuat, this._targetRotation.x, this._targetRotation.y, this._targetRotation.z);

        Quat.rotateX(tempQuat, tempQuat, delta.y * DeltaFactor);
        Quat.rotateAround(tempQuat, tempQuat, Vec3.UP, -delta.x * DeltaFactor);

        Quat.toEuler(this._targetRotation, tempQuat);

        this.limitRotation()
    }
    onTouchEnd () {
        this._touched = false;
    }

    limitRotation () {
        let rotation = this._targetRotation;

        if (rotation.x < this.xRotationRange.x) {
            rotation.x = this.xRotationRange.x
        }
        else if (rotation.x > this.xRotationRange.y) {
            rotation.x = this.xRotationRange.y
        }

        rotation.z = 0;
    }


    update (dt: number) {
        let targetRotation = this._targetRotation;

        Quat.fromEuler(tempQuat, targetRotation.x, targetRotation.y, targetRotation.z);
        Quat.slerp(this._rotation, this._rotation, tempQuat, dt * 7 * this.rotateSpeed);
        this.node.rotation = this._rotation;
    }
}
