import { Component, game, Mat4, Vec2, _decorator } from "cc";

const { ccclass, property, executeInEditMode } = _decorator


let halton8 = [
    new Vec2(0.5, 1.0 / 3),
    new Vec2(0.25, 2.0 / 3),
    new Vec2(0.75, 1.0 / 9),
    new Vec2(0.125, 4.0 / 9),
    new Vec2(0.625, 7.0 / 9),
    new Vec2(0.375, 2.0 / 9),
    new Vec2(0.875, 5.0 / 9),
    new Vec2(0.0625, 8.0 / 9),
]
halton8.forEach(v => {
    v.x -= 0.5;
    v.y -= 0.5;
})

let SampleOffsets = {
    // 2xMSAA
    // Pattern docs: http://msdn.microsoft.com/en-us/library/windows/desktop/ff476218(v=vs.85).aspx
    //   N.
    //   .S
    x2: [
        new Vec2(-4.0 / 16.0, -4.0 / 16.0),
        new Vec2(4.0 / 16.0, 4.0 / 16.0),
    ],

    // 3xMSAA
    //   A..
    //   ..B
    //   .C.
    // Rolling circle pattern (A,B,C).
    x3: [
        new Vec2(-2.0 / 3.0, -2.0 / 3.0),
        new Vec2(2 / 3, 0 / 3),
        new Vec2(0 / 3, 2 / 3),
    ],

    // 4xMSAA
    // Pattern docs: http://msdn.microsoft.com/en-us/library/windows/desktop/ff476218(v=vs.85).aspx
    //   .N..
    //   ...E
    //   W...
    //   ..S.
    // Rolling circle pattern (N,E,S,W).
    x4: [
        new Vec2(-2 / 16, -6 / 16),
        new Vec2(6 / 16, -2 / 16),
        new Vec2(2 / 16, 6 / 16),
        new Vec2(-6 / 16, 2 / 16),
    ],

    x5: [
        // Compressed 4 sample pattern on same vertical and horizontal line (less temporal flicker).
        // Compressed 1/2 works better than correct 2/3 (reduced temporal flicker).
        //   . N .
        //   W . E
        //   . S .
        // Rolling circle pattern (N,E,S,W).
        new Vec2(0, -1 / 2),
        new Vec2(1 / 2, 0),
        new Vec2(0, 1 / 2),
        new Vec2(-1 / 2, 0),
    ],

    halton8,
}


@ccclass('TAASetting')
@executeInEditMode
export class TAASetting extends Component {
    static instance: TAASetting | undefined

    @property
    enable = true

    @property
    sampleScale = 1;
    @property
    feedback = 0.95;

    @property
    shaowHistoryTexture = false;
    @property
    clampHistoryTexture = true;

    @property
    forceRender = false;
    @property
    dirty = false;

    sampleOffset = new Vec2;

    taaTextureIndex = -2;
    samples = SampleOffsets.halton8;
    sampleIndex = -1;

    onEnable () {
        globalThis.TAASetting.instance = this
    }
    onDisable () {
        if (globalThis.TAASetting.instance === this) {
            globalThis.TAASetting.instance = undefined;
        }
    }

    updateSample (width, height) {
        if (this.dirty || this.forceRender) {
            this.sampleIndex++;
            this.taaTextureIndex++;
            this.dirty = false;
        }

        let offset = this.samples[this.sampleIndex % this.samples.length];

        if (this.sampleIndex === -1) {
            offset = Vec2.ZERO;
        }

        this.sampleOffset.x = offset.x * this.sampleScale / width;
        this.sampleOffset.y = offset.y * this.sampleScale / height;
    }

    lateUpdate (dt) {
        this.updateSample(game.canvas.width, game.canvas.height);

    }
}
globalThis.TAASetting = TAASetting;
