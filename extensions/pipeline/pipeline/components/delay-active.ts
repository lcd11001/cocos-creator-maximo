import { _decorator, Component, Node, ParticleSystem } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('DelayActive')
export class DelayActive extends Component {
    @property(Node)
    targets: Node[] = []

    @property
    delay = 0.5

    start () {

        const particles = this.node?.getComponentsInChildren(ParticleSystem);

        for (let i = 0; i < particles.length; i++) {
            particles[i].play();
        }

        setTimeout(() => {
            this.targets.forEach(t => {
                t.active = true
            })

            this.node.removeFromParent()
        }, this.delay * 1000)
    }

}


