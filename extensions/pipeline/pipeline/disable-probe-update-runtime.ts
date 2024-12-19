import { Director, director, Game, game, profiler, ReflectionProbeManager } from "cc";
import { EDITOR } from "cc/env";


if (!EDITOR) {
    game.on(Game.EVENT_GAME_INITED, () => {
        let target, func;
        if (ReflectionProbeManager !== undefined) {
            target = ReflectionProbeManager.probeManager
            func = ReflectionProbeManager.probeManager.onUpdateProbes
        }
        else {
            let callbackInfos = (director as any)._callbackTable[Director.EVENT_BEFORE_UPDATE].callbackInfos;
            for (let i = 0; i < callbackInfos.length; i++) {
                target = callbackInfos[i].target
                if (target && target.onUpdateProbes) {
                    func = target.onUpdateProbes;
                    break;
                }
            }
        }

        if (target && func) {
            director.off(Director.EVENT_BEFORE_UPDATE, func, target);
        }
    })
}
