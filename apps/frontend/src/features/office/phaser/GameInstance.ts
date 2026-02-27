import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'

let gameInstance: Phaser.Game | null = null

export function createGame(parent: HTMLElement): Phaser.Game {
  if (gameInstance) {
    gameInstance.destroy(true)
    gameInstance = null
  }

  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0f0f1a',
    scene: [OfficeScene],
    audio: { disableWebAudio: true },
    input: { activePointers: 2 },
    physics: {
      default: 'arcade',
      arcade: { debug: false, gravity: { x: 0, y: 0 } },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })

  return gameInstance
}

export function destroyGame() {
  if (gameInstance) {
    gameInstance.destroy(true)
    gameInstance = null
  }
}
