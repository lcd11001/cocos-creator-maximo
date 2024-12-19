import { EventMouse, EventTouch, Input, Vec2, Vec4, game, gfx, input, postProcess, renderer, rendering } from "cc";
import { EDITOR } from "cc/env";
import { HrefSetting } from "../settings/href-setting";

let pointSampler = new gfx.Sampler(new gfx.SamplerInfo(
    gfx.Filter.POINT, gfx.Filter.POINT
), 0);
(pointSampler as any).custom = true;

export class ZoomScreenPass extends postProcess.BasePass {
    name = 'ZoomScreenPass'
    outputNames = ['ZoomScreenColor']

    constructor () {
        super();

        if (!EDITOR) {
            input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this)
            input.on(Input.EventType.TOUCH_START, this.onTouchDown, this)
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
            input.on(Input.EventType.TOUCH_END, this.onTouchUp, this)
        }

    }


    destroy () {
        if (!EDITOR) {
            input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this)
            input.off(Input.EventType.TOUCH_START, this.onTouchDown, this)
            input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this)
            input.off(Input.EventType.TOUCH_END, this.onTouchUp, this)
        }
    }

    reset () {
        this.updateMousePosition();
        this.updateScale();
    }

    checkEnable (camera: renderer.scene.Camera) {
        return super.checkEnable(camera) && !!HrefSetting.zoomScreen;
    }

    _scale = 1;
    _offset = new Vec2
    screenParams = new Vec4

    touchPos = new Vec2

    lastTouchDist = 0;
    pressed = false;
    onTouchDown (event: EventTouch) {
        event.propagationStopped = true;

        // let touches = event.getAllTouches();
        // if (touches.length >= 2) {
        //     let p0 = touches[0].getLocation();
        //     let p1 = touches[1].getLocation();
        //     this.lastTouchDist = Vec2.distance(p0, p1)
        // }

        this.lastTouchDist = 0;
        this.pressed = true;
        this.updateMousePosition(event);
    }
    onTouchMove (event: EventTouch) {

        // let touches = event.getAllTouches();
        // if (touches.length >= 2) {
        //     let p0 = touches[0].getLocation();
        //     let p1 = touches[1].getLocation();
        //     let dist = Vec2.distance(p0, p1)
        //     vec2_temp.set(p0)
        //     vec2_temp.subtract(p1).multiplyScalar(0.5).add(p1);

        //     let dif = dist - this.lastTouchDist
        //     this.lastTouchDist = dist;

        //     this.updateScale(vec2_temp, dif / 100.);
        // }

        event.propagationStopped = true;

        if (this.pressed) {
            this.updateMousePosition(event);

            this._offset.x -= event.getDeltaX() / game.canvas.width * this._scale;
            this._offset.y -= event.getDeltaY() / game.canvas.width * this._scale;
        }
    }
    onTouchUp (event: EventTouch) {
        event.propagationStopped = true;

        this.pressed = false;
    }
    updateMousePosition (event?: EventTouch) {
        let x = 0, y = 0;

        if (event) {
            x = event.getLocationX() / game.canvas!.width;
            y = event.getLocationY() / game.canvas!.height;
        }

        this.touchPos.set(x, y)
    }

    onMouseWheel (event: EventMouse) {
        event.propagationStopped = true;

        if (event) {
            let scrollY = event.getScrollY();

            let scaleOffset = 0.1 * -Math.sign(scrollY) * this._scale;
            this.updateScale(event.getLocation(), scaleOffset);
        }
        else {
            this._scale = 1;
            this._offset.set(0, 0);
        }
    }

    updateScale (center?: Vec2, scaleOffset = 0) {
        if (center) {
            this._scale += scaleOffset;
            this._scale = Math.max(0, this._scale);

            center.x /= game.canvas!.width;
            center.y /= game.canvas!.height;

            this._offset.x -= center.x * scaleOffset;
            this._offset.y -= center.y * scaleOffset;
        }
        else {
            this._scale = 1;
            this._offset.set(0, 0);
        }
    }

    public render (camera: renderer.scene.Camera, ppl: rendering.Pipeline): void {
        const context = this.context;
        context.clearBlack();

        let material = globalThis.pipelineAssets.getMaterial('zoom-screen')
        context.material = material;

        material.setProperty('screenParams', this.screenParams.set(this._scale, this._scale, this._offset.x, this._offset.y))

        let pass = material.passes[0];
        pass.bindSampler(pass.getBinding('outputResultMap'), pointSampler);


        const input0 = this.lastPass.slotName(camera, 0);
        const slot0 = this.slotName(camera, 0);
        const shadingScale = context.shadingScale;
        context
            .updatePassViewPort(1 / shadingScale, 1 / shadingScale)
            .addRenderPass('post-process', `Pass_${slot0}`);

        // let setter = (context.pass as any);
        // setter.setSampler('outputResultMap', director.root.pipeline.globalDSManager.pointSampler);

        context
            .setPassInput(input0, 'outputResultMap')
            .addRasterView(slot0, gfx.Format.RGBA16F)
            .blitScreen(0)
            .version()

    }
}
