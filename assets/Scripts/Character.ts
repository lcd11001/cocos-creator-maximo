import { _decorator, Component, Node, macro, Vec3, EventKeyboard, input, Input, KeyCode, CCFloat } from 'cc';
import { CharacterAnim } from './CharacterAnim';
const { ccclass, property } = _decorator;

@ccclass('Character')
export class Character extends Component
{
    @property({ type: CharacterAnim })
    private characterAnim: CharacterAnim = null;

    @property({ type: Vec3 })
    private velocity: Vec3 = new Vec3(0, 0, 0);

    @property({ type: CCFloat })
    private speed: number = 1;

    start()
    {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    onDestroy()
    {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    update(deltaTime: number)
    {
        const position = this.node.position.clone();
        const velocity = this.velocity.clone().multiplyScalar(this.speed * deltaTime);
        this.node.setPosition(position.add(velocity));
    }

    onKeyDown(event: EventKeyboard)
    {
        switch (event.keyCode)
        {
            case KeyCode.KEY_W:
                this.velocity.z = -1;
                break;
            case KeyCode.KEY_S:
                this.velocity.z = 1;
                break;
            case KeyCode.KEY_A:
                this.velocity.x = -1;
                break;
            case KeyCode.KEY_D:
                this.velocity.x = 1;
                break;
            case KeyCode.SPACE:
                console.log('Jump');
                this.characterAnim.Jump();
                break;


            case KeyCode.KEY_R:
                console.log('Roll');
                this.characterAnim.Roll();
                break;

            case KeyCode.KEY_Q:
                console.log('Jump Left');
                this.characterAnim.JumpLeft();
                break

            case KeyCode.KEY_E:
                console.log('Jump Right');
                this.characterAnim.JumpRight();
                break;
        }
    }

    onKeyUp(event: EventKeyboard)
    {
        switch (event.keyCode)
        {
            case KeyCode.KEY_W:
            case KeyCode.KEY_S:
                this.velocity.z = 0;
                break;
            case KeyCode.KEY_A:
            case KeyCode.KEY_D:
                this.velocity.x = 0;
                break;
        }
    }
}