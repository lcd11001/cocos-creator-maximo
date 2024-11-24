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

}


