import { renderer } from "cc";

export let settings = {
    bakingReflection: false,
    outputRGBE: false,
    tonemapped: false,

    shadowPass: undefined,
    gbufferPass: undefined,

    renderProfiler: false,

    passPathName: '',

    passVersion: 0,

    renderCameras: [] as renderer.scene.Camera[]
}

globalThis.ppSettings = settings;
