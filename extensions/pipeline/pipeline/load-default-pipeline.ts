import { assetManager, CCObject, director, Game, game, instantiate, Prefab } from "cc";
import { BUILD } from "cc/env";

console.log('load default pipeline')

let isBuild = !game.canvas || globalThis.Build// || BUILD
if (!isBuild) {
    if (!(director as any).__runSceneImmediate) {
        (director as any).__runSceneImmediate = director.runSceneImmediate
    }
    director.runSceneImmediate = function (scene, onBeforeLoadScene, onLaunched) {
        globalThis.__pipeline__.parent = null;

        (director as any).__runSceneImmediate.call(this, scene, onBeforeLoadScene, onLaunched)

        if (!globalThis.pipelineAssets && globalThis.__pipeline__) {
            globalThis.__pipeline__.parent = director.getScene()
        }
    }

    game.on(Game.EVENT_GAME_INITED, () => {
        if (!globalThis.__pipeline__) {
            // load default pipeline.prefab
            assetManager.loadAny('223548d6-e1d4-462a-99e1-f4046b1d0647', (err, pipPrefab: Prefab) => {
                if (err) {
                    return console.error(err);
                }
                let p = instantiate(pipPrefab)
                p.name = 'pipeline-default-persist';
                p.hideFlags |= CCObject.Flags.DontSave;// | CCObject.Flags.HideInHierarchy;
                globalThis.__pipeline__ = p;
            })
        }
    })
}
