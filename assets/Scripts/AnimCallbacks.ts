import { _decorator, animation, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AnimCallbacks')
export class AnimCallbacks extends Component
{
    @property({ type: animation.AnimationController })
    private animController: animation.AnimationController = null;

    public JumpStart(): void
    {
        console.log('JumpStart');
    }

    public JumpEnd(): void
    {
        console.log('JumpEnd');
        this.animController.setValue('isJump', false);
    }

    public JumpHighest(): void
    {
        console.log('JumpHighest');
    }
}


