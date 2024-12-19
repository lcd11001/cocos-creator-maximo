import { director, game, sys } from 'cc';
import { BUILD, JSB, MINIGAME } from 'cc/env';
import * as detectGPU from '../lib/detect-gpu'

import { GpuMobiles } from './gpu-mobiles';

export enum RenderQulity {
    Low,
    Medium,
    High,
}

const getGpuType = (renderer: string) => {
    const types = sys.isMobile
        ? ([
            'adreno',
            'apple',
            'mali',
            'xclipse',
            'immortalis'
        ] as const)
        : (['intel', 'apple', 'amd', 'radeon', 'nvidia', 'geforce'] as const);
    for (const type of types) {
        if (renderer.includes(type)) {
            return type;
        }
    }
};
export function getGPUVersion (model: string) {
    // model = model.replace(/\([^)]+\)/, '');

    const matches =
        // First set of digits
        model.match(/[ga]?\d+/) ||
        // If the renderer did not contain any numbers, match letters
        model.match(/(\W|^)([A-Za-z]{1,3})(\W|$)/g);

    // Remove any non-word characters and also remove 'amd' which could be matched
    // in the clause above
    return matches?.join('').replace(/\W|amd/g, '') ?? '';
}

export async function getGpuInfo () {
    let gpuType = ''
    let gpuVersion = ''
    let gpuScore = 0

    if (director.root && director.root.device) {
        let renderer = director.root.device.renderer.toLowerCase();
        console.log('renderer: ' + renderer)

        gpuType = getGpuType(renderer)
        gpuVersion = getGPUVersion(renderer)

        console.log('gpuType : ' + gpuType)
        console.log('gpuVersion : ' + gpuVersion)

        if (sys.isMobile) {
            try {
                gpuScore = GpuMobiles[gpuType][gpuVersion] || 0
                console.log(`gpu : score(${gpuScore})`)
            }
            catch (err) {
                if (sys.isMobile) {
                    console.warn(`Get gpu score failed`)
                }
            }
        }
        else {
            if (director.root && game.canvas) {
                let renderer = director.root.device.renderer.toLowerCase();
                let tier = await detectGPU.getGPUTier({
                    desktopTiers: [0, 60, 150, 300],
                    override: {
                        renderer,
                        isMobile: sys.isMobile,
                        screenSize: {
                            width: game.canvas.width,
                            height: game.canvas.height
                        }
                    }
                })

                gpuScore = tier.fps;

                console.log(tier)
            }
        }
    }

    let gpuInfo = {
        gpuType,
        gpuVersion,
        gpuScore
    }

    globalThis.gpuInfo = gpuInfo

    return gpuInfo;
}
