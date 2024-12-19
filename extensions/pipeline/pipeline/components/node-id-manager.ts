import { Component, gfx, Material, MeshRenderer, Node, Vec4, _decorator } from "cc";
import { NodeID } from "./node-id";

const { ccclass, property, executeInEditMode } = _decorator

@ccclass('NodeIDManager')
@executeInEditMode
export class NodeIDManager extends Component {
    @property
    get generateChildrenID () {
        return false
    }
    set generateChildrenID (v) {
        this.doGenerateChildrenID()
    }

    nodeMap: Map<number, Node> = new Map
    mrMap: Map<number, MeshRenderer> = new Map

    // __preload () {
    //     this.registerDefault();
    // }

    onEnable () {
        this.registerDefault();
    }

    registerDefault () {
        this.registerRoot(this.node);
    }

    registerRoot (root: Node) {
        let renderers = root.getComponentsInChildren(NodeID);
        renderers.map((id) => {
            this.register(id);
        });
    }

    register (nodeID: NodeID) {
        this.nodeMap.set(nodeID.id, nodeID.node);
        this.mrMap.set(nodeID.id, nodeID.getComponent(MeshRenderer))
    }

    doGenerateChildrenID () {
        this.nodeMap.clear();
        this.mrMap.clear();

        let renderers = this.node.getComponentsInChildren(MeshRenderer);
        renderers.map((r, ri) => {
            let nodeID = r.getComponent(NodeID)
            if (!nodeID) {
                nodeID = r.addComponent(NodeID)
            }
            nodeID.id = ri + 1;

            this.register(nodeID);
        });
    }
}