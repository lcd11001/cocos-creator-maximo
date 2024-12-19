import { Component, gfx, Material, MeshRenderer, renderer, Vec4, _decorator } from "cc";
import { NodeID } from "../../node-id";

const { ccclass, property, executeInEditMode } = _decorator

@ccclass('RenderIDMaterial')
@executeInEditMode
export class RenderIDMaterial extends Component {
    @property(Material)
    material: Material | undefined

    @property
    cullMode = gfx.CullMode.BACK

    start () {
        this.setOCCMaterial()
    }

    setOCCMaterial () {
        let ni = this.getComponent(NodeID);
        let id = ni && ni.id;

        let mr = this.getComponent(MeshRenderer)
        if (!mr || !this.material) return

        let count = mr.sharedMaterials.length
        for (let i = 0; i < count; i++) {
            let mi = new renderer.MaterialInstance({
                parent: this.material
            })

            mi.overridePipelineStates({
                rasterizerState: {
                    cullMode: this.cullMode
                }
            })
            mi.setProperty('params', new Vec4(id, 0, 0, 0))

            mr.setMaterialInstance(mi, i)
        }
    }
}