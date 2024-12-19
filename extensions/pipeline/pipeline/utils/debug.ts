import { director, GeometryRenderer } from "cc";
import { EDITOR } from "cc/env";
import { CameraSetting } from "../camera-setting";


export function getGeometryRenderer () {
    let camera;
    if (EDITOR) {
        director.root.scenes.forEach(s => {
            s.cameras.forEach(c => {
                if (c.name === 'Editor UIGizmoCamera') {
                    camera = c;
                }
            })
        })
    }
    else {
        camera = CameraSetting.mainCamera && CameraSetting.mainCamera.camera;
    }

    if (camera) {
        camera.initGeometryRenderer();
    }
    let geometryRenderer: GeometryRenderer = camera && camera.geometryRenderer || director.root.pipeline.geometryRenderer;
    return geometryRenderer;
}

globalThis.getGeometryRenderer = getGeometryRenderer;
