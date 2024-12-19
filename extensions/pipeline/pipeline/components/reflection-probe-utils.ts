import { Component, ReflectionProbe, _decorator } from "cc";

const { ccclass, property, executeInEditMode } = _decorator

export let ReflectionProbes = {
    probes: [] as ReflectionProbe[]
}

@ccclass('ReflectionProbeUtils')
@executeInEditMode
export class ReflectionProbeUtils extends Component {
    probe: ReflectionProbe | undefined
    onEnable () {
        this.probe = this.getComponent(ReflectionProbe)
        if (ReflectionProbes.probes.indexOf(this.probe) === -1) {
            ReflectionProbes.probes.push(this.probe);
        }
    }
    onDisable () {
        let index = ReflectionProbes.probes.indexOf(this.probe)
        if (index !== -1) {
            ReflectionProbes.probes.splice(index, 1);
        }
    }

    capturing = false;
    runtimeCapture (capturing = true) {
        this.capturing = capturing;

        if (capturing) {
            if (!this.probe) {
                return;
            }

            if (!this.probe.probe) {
                this.probe._createProbe()
            }
            this.probe.probe.captureCubemap()
        }
    }

    update () {
        if (this.capturing) {
            this.probe.probe._needRender = true;
        }
    }
}
