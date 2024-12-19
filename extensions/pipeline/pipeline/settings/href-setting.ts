import { Game, game, profiler, sys } from 'cc';
import { BUILD, EDITOR, JSB } from 'cc/env';
import { getGpuInfo } from './gpu';

export const HrefSetting = {
    settings: 0,
    graph: 0,
    pauseGraphAfterLoad: 1,
    spector: 0,

    // rendering setting
    shadingScale: 1,
    zoomScreen: 0,
    bloom: 1,
    showFps: 1,
    fps: 60,
    transparent: 1,
    clusterLighting: 1,
    forceUpdateLighting: 0,
    ibl: 1,
    shadow: 0,
    fsr: 1,
    fog: 1,

    taa: 1,
    taaMask: 1,
    fxaa: 1,
    fullScene: 1,

    debugAlbedo: 0,
    debugNormal: 0,

    maxEnemies: 4,
    sceneParticles: 1
}
globalThis.HrefSetting = HrefSetting


export let changedMap: Map<string, boolean> = new Map

if (!EDITOR) {
    let href = window && window.location && window.location.href;
    let settings = href.split('?')[1]
    if (settings) {
        let results = settings.match(/([a-zA-Z]+=[0-9\.]+)/g)
        if (results) {
            results.forEach(res => {
                let test = res.split('=')
                let value = Number.parseFloat(test[1])
                if (typeof value === 'number') {
                    HrefSetting[test[0]] = value

                    changedMap.set(test[0], true)
                }
            })
        }
    }

}

if (EDITOR) {
    HrefSetting.graph = 2;
}

if (game.canvas) {
    getGpuInfo().then(info => {
        const { gpuScore, gpuVersion, gpuType } = info;

        let mobileSettings = [
            {
                score: 1000000,
                fps: 30,
            },
            {
                score: 2000,
                shadingScale: Math.min(1240 / game.canvas.width, 1),
                bloom: 0,
                fxaa: 0
            },
            {
                score: 1200,
                shadingScale: Math.min(1024 / game.canvas.width, 1),
            },
            {
                score: 500,
                gpu: [['apple', 'a10']],
                fsr: 0,
                taa: 0,
                maxEnemies: 2,
                sceneParticles: 0,
                fullScene: 0
            }
        ]

        let pcSettings = [
            {
                score: 1000000,
                fps: 60,
            },
            {
                score: 400,
                shadingScale: 0.7,
            },
            {
                score: 200,
                shadingScale: Math.min(1024 / game.canvas.width, 1),
                bloom: 0,
            },
            {
                score: 60,
                fsr: 0,
                fxaa: 0,
                maxEnemies: 2,
                sceneParticles: 0,
            }
        ]

        let gpuSettings = []
        if (sys.isMobile) {
            gpuSettings = mobileSettings
        }
        else if (!EDITOR) {
            gpuSettings = pcSettings
        }

        for (let i = 0; i < gpuSettings.length; i++) {
            let s = gpuSettings[i]

            let use = false
            if (gpuScore < s.score) {
                use = true
            }
            if (s.gpu) {
                for (let j = 0; j < s.gpu.length; j++) {
                    let g = s.gpu[j]
                    if (g[0] === gpuType && g[1] === gpuVersion) {
                        use = true
                        console.log('Force use gpu setting : ' + g)
                        break;
                    }
                }
            }

            if (use) {
                for (let name in s) {
                    if (name in HrefSetting) {
                        HrefSetting[name] = s[name]
                    }
                }
            }
        }

        if (sys.platform === sys.Platform.IOS || sys.platform === sys.Platform.MACOS) {
            HrefSetting.sceneParticles = 0
            HrefSetting.taaMask = 0
        }

        // if (sys.isNative) {
        //     HrefSetting.taaMask = 0
        // }

        console.log(`canvas size ${game.canvas.width}, ${game.canvas.height}`)
        console.log(`rendering size ${game.canvas.width * HrefSetting.shadingScale}, ${game.canvas.height * HrefSetting.shadingScale}`)

        game.frameRate = HrefSetting.fps

        if (sys.isMobile && !JSB) {
            // todo: mobile particle rendering issue
            HrefSetting.transparent = 0
        }
        console.log(HrefSetting)


    })
}
