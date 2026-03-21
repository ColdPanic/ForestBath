import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  width: 570,
  height: 900,
  backgroundColor: '#1a1a2e',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
