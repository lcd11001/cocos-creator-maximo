import { _decorator, animation, CCString, Component, Node, SkeletalAnimation } from 'cc';
const { ccclass, property } = _decorator;


@ccclass('CharacterAnim')
export class CharacterAnim extends Component
{
    @property({ type: animation.AnimationController })
    private animController: animation.AnimationController = null;

    public Jump(): void
    {
        this.animController.setValue('Trigger Jump', true);
    }

    public Roll(): void
    {
        this.animController.setValue('Trigger Roll', true);
    }

    public JumpLeft(): void
    {
        this.animController.setValue('Trigger Jump', true);
        // enable layer turn left before jump
        this.animController.setLayerWeight(1, 0.5);
    }

    public JumpRight(): void
    {
        this.animController.setValue('Trigger Jump', true);
        // enable layer turn right before jump
        this.animController.setLayerWeight(2, 0.5);
    }
}


