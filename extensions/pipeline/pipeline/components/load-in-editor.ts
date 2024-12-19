import { _decorator, Component, Node, CCString, resources, instantiate, Prefab, CCObject } from 'cc';
import { EDITOR } from 'cc/env';
import { loadResource } from '../utils/npm';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('load_in_editor')
@executeInEditMode
export class load_in_editor extends Component {
    @property({ type: CCString })
    prefabPaths: string[] = []

    start () {
        if (!EDITOR) {
            return
        }

        this.prefabPaths.forEach(async p => {
            let prefab = await loadResource('db://assets/resources/' + p) as Prefab
            if (prefab) {
                let node = instantiate(prefab);
                node.hideFlags = CCObject.Flags.DontSave
                node.parent = this.node
            }
        })
    }
}


