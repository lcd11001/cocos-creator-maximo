
import { _decorator, Component, RenderTexture, game, gfx, Camera, ccenum, director } from 'cc';
import { InPlayMode } from './utils/npm';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('CameraSetting')
@executeInEditMode
export class CameraSetting extends Component {
    static main: CameraSetting | undefined;
    static get mainCamera (): Camera | null {
        if (!InPlayMode) {
            return globalThis.cce.Camera._camera;
        }
        if (this.main) {
            return this.main.camera;
        }
        return null;
    }

    camera: Camera | undefined;

    @property
    isMainCamera = true;

    @property
    pipeline = 'main'

    @property
    customOutPutName = ''

    @property
    forceOffScreen = false;

    __preload () {
        this.camera = this.getComponent(Camera)
        CameraSetting.main = this;
    }
}
