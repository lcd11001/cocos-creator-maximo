import { _decorator, animation, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AnimationCallbacks')
export class AnimationCallbacks extends Component
{
    @property({ type: animation.AnimationController })
    private animController: animation.AnimationController = null;

    public onJumpEnd(): void
    {
        console.log('onJumpEnd');
        // disable layer turn left / turn right after jump
        this.animController.setLayerWeight(1, 0);
        this.animController.setLayerWeight(2, 0);
    }
}


