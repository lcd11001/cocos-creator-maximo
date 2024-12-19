import { EventKeyboard, Game, game, Input, input, KeyCode } from 'cc';
import { EDITOR, JSB } from 'cc/env';
import { InPlayMode } from '../utils/npm';
import { HrefSetting } from './href-setting';

// if (true) {
if (!EDITOR && !JSB && HrefSetting.spector) {

    let SPECTORTOOLS: any;
    (function (SPECTORTOOLS) {
        let Loader: any = (function () {
            let useDist: any;
            let queue: any;
            let callback: any;

            // useDist = true

            let host = 'http://' + location.host.split(':')[0]
            if (EDITOR) {
                host = 'http://127.0.0.1'
            }

            function Loader () {
                queue = [];
                // useDist = (document.location.href.toLowerCase().indexOf('dist=true') > 0);
                callback = null;
            }

            Loader.prototype.dequeue = function () {
                if (queue.length == 0) {
                    if (callback) {
                        callback();
                    }
                    console.log('Scripts loaded');
                    return;
                }

                let url: any = queue.shift();

                let head: any = document.getElementsByTagName('head')[0];
                let script: any = document.createElement('script');
                script.type = 'text/javascript';
                script.src = url;

                let self: any = this;
                script.onload = function () {
                    self.dequeue();
                };
                head.appendChild(script);
            }

            Loader.prototype.loadScript = function (url: string) {
                queue.push(url);
            }

            Loader.prototype.loadSPECTORScripts = function () {
                if (useDist) {
                    this.loadScript(`${host}:1337/dist/spector.bundle.js`);
                }
                else {
                    this.loadScript(`${host}:1337/.temp/spector.bundle.js`);
                }
            }

            Loader.prototype.onReady = function (newCallback: Function) {
                callback = newCallback;
                return this;
            }

            Loader.prototype.load = function (scriptPaths: string[]) {
                let self: any = this;

                self.loadScript(`${host}:35729/livereload.js?snipver=1`);
                self.loadSPECTORScripts();

                if (scriptPaths) {
                    for (let i: any = 0; i < scriptPaths.length; i++) {
                        let scriptPath: any = scriptPaths[i];
                        self.loadScript(scriptPath);
                    }
                }

                self.dequeue();
            };

            return Loader;
        }());

        let loader: any = new Loader();
        SPECTORTOOLS.Loader = loader;

    })(SPECTORTOOLS || (SPECTORTOOLS = {}))

    SPECTORTOOLS.Loader.load();

    async function init () {
        await Promise.all([
            new Promise(resolve => {
                SPECTORTOOLS.Loader.onReady(function () {
                    resolve(null)
                })
            }),
            new Promise(resolve => {
                game.on(Game.EVENT_GAME_INITED, () => {
                    resolve(null)
                })
            })
        ])

        let fullCapture = HrefSetting.spector === 2

        let spector: any = new globalThis.SPECTOR.Spector();
        spector.fullCapture = fullCapture;
        spector.timeSpy.spyRequestAnimationFrame('requestAnimationFrame', window);
        spector.displayUI(undefined, undefined, false, false);
        spector.spyCanvas(game.canvas);
        globalThis.SPECTOR.Spector.getFirstAvailable3dContext(game.canvas)

        globalThis.spector = spector;
        globalThis.rAF = window.requestAnimationFrame;
        (game as any)._pacer._rAF = globalThis.rAF

        spector.capture = function () {
            let frameRate = game.frameRate
            game.frameRate = 60
            spector.captureCanvas(game.canvas, undefined, undefined, fullCapture);
            // game.frameRate = frameRate
        }

        input.on(Input.EventType.KEY_DOWN, (e) => {
            if (e.keyCode === KeyCode.KEY_H) {
                spector.capture()
            }
        })
    }

    init()
}
