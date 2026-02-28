import Phaser from 'phaser'
import { eventBridge } from './eventBridge'
import type { AgentEntry } from '../officeStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const WORLD_W = 2400
const WORLD_H = 900

// ─── Zone coords ──────────────────────────────────────────────────────────────

const ZONES = {
  teamZone:     { x: 40,   y: 40,  w: 540, h: 820 },
  archivistZone:{ x: 600,  y: 40,  w: 200, h: 820 },
  coffeeCorner: { x: 800,  y: 40,  w: 200, h: 210 },
  fridayOffice: { x: 1000, y: 40,  w: 400, h: 820 },
  lounge:       { x: 600,  y: 500, w: 700, h: 360 },
  smoking:      { x: 1300, y: 500, w: 300, h: 360 },
} as const

// ─── Wander spots per zone ───────────────────────────────────────────────────

const ZONE_SPOTS: Record<string, { x: number; y: number }[]> = {
  teamZone: [
    { x: 150, y: 200 }, { x: 280, y: 300 }, { x: 420, y: 200 },
    { x: 150, y: 450 }, { x: 310, y: 500 }, { x: 480, y: 400 },
  ],
  archivistZone: [
    { x: 660, y: 200 }, { x: 740, y: 400 }, { x: 700, y: 600 }, { x: 670, y: 750 },
  ],
  coffeeCorner: [
    { x: 860, y: 130 }, { x: 940, y: 130 }, { x: 900, y: 180 },
  ],
  fridayOffice: [
    { x: 1150, y: 200 }, { x: 1250, y: 350 }, { x: 1100, y: 500 }, { x: 1300, y: 600 },
  ],
  lounge: [
    { x: 700, y: 620 }, { x: 800, y: 660 }, { x: 950, y: 630 },
    { x: 1050, y: 700 }, { x: 1180, y: 650 }, { x: 1240, y: 750 },
  ],
  smoking: [
    { x: 1360, y: 620 }, { x: 1430, y: 680 }, { x: 1500, y: 630 },
    { x: 1550, y: 720 }, { x: 1380, y: 760 },
  ],
}

// ─── Role → Character mapping ─────────────────────────────────────────────────

const ROLE_TO_CHAR: Record<string, string> = {
  DIRECTOR:           'amelia',
  FINANCIER:          'amelia',
  BACKEND:            'adam',
  DEVOPS:             'bob',
  FRONTEND:           'alex',
  SECURITY:           'bob',
  ARCHIVIST:          'amelia',
  SOLUTION_ARCHITECT: 'adam',
  SQL_ARCHITECT:      'bob',
  TECH_WRITER:        'amelia',
  QA:                 'alex',
  PRODUCT:            'adam',
  TECH_LEAD:          'bob',
  BA:                 'amelia',
}

// ─── Speech phrases ───────────────────────────────────────────────────────────

const AGENT_PHRASES: Record<string, string[]> = {
  WORKING: ['Анализирую данные...', 'Пишу код...', 'Тестирую...', 'Смотрю логи...', 'Дебажу...', 'Строю схему...'],
  IDLE:    ['Готов к работе', 'Жду задачу...', 'Всё спокойно', 'Кофе бы...'],
  CHATTING:['Давай обсудим архитектуру?', 'Есть идея!', 'Нужна помощь?', 'Смотри что нашёл'],
  SMOKING: ['Перекур...', '...', 'Ух, устал', 'Минутка тишины'],
  RESTING: ['Zzz...', 'Отдыхаю', '😴', 'Тихо...'],
}

// ─── Behaviour state ──────────────────────────────────────────────────────────

type BehaviourState = 'AT_DESK' | 'WALKING' | 'WANDERING' | 'CHATTING' | 'WORKING'

// ─── Agent state ──────────────────────────────────────────────────────────────

interface AgentState {
  agentId: string
  role: string
  name: string
  presenceState: string
  sprite: Phaser.GameObjects.Sprite
  container: Phaser.GameObjects.Container
  bubble: Phaser.GameObjects.Container | null
  bubbleTimer: Phaser.Time.TimerEvent | null
  emoji: Phaser.GameObjects.Text | null
  emojiTimer: Phaser.Time.TimerEvent | null
  nameLabel: Phaser.GameObjects.Text
  behaviour: BehaviourState
  wanderTimer: Phaser.Time.TimerEvent | null
  currentX: number
  currentY: number
  deskX: number
  deskY: number
  charKey: string
  currentAnim: string
  workingComputer: Phaser.GameObjects.Image | null
  bubbleScheduleTimer: Phaser.Time.TimerEvent | null
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, AgentState>()
  private smokeParticles: { x: number; y: number; alpha: number; vy: number; obj: Phaser.GameObjects.Arc }[] = []
  private smokeTimer: Phaser.Time.TimerEvent | null = null
  private teamDeskSlots: { x: number; y: number; agentId: string | null }[] = []
  private deskComputerIcons = new Map<string, Phaser.GameObjects.Arc>()

  constructor() {
    super({ key: 'OfficeScene' })
  }

  // ── Preload ───────────────────────────────────────────────────────────────

  preload() {
    // Tilesets
    this.load.image('limezu-interiors', '/assets/limezu/Interiors_free_16x16.png')
    this.load.image('limezu-rooms', '/assets/limezu/Room_Builder_free_16x16.png')

    // Character spritesheets
    // Adam_16x16.png: 384x224, frameWidth=16, frameHeight=32 (24 cols × 7 rows)
    // Adam_idle_anim_16x16.png: 384x32, 24 frames single row
    // Adam_sit_16x16.png: 384x32, 24 frames
    // Adam_phone_16x16.png: 144x32, 9 frames
    for (const char of ['Adam', 'Amelia', 'Alex', 'Bob']) {
      this.load.spritesheet(
        `char-${char.toLowerCase()}-walk`,
        `/assets/limezu/${char}_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-run`,
        `/assets/limezu/${char}_run_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-sit`,
        `/assets/limezu/${char}_sit_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-sit2`,
        `/assets/limezu/${char}_sit2_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-sit3`,
        `/assets/limezu/${char}_sit3_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-idle`,
        `/assets/limezu/${char}_idle_anim_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
      this.load.spritesheet(
        `char-${char.toLowerCase()}-phone`,
        `/assets/limezu/${char}_phone_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },
      )
    }
  }

  // ── Create ────────────────────────────────────────────────────────────────

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBackgroundColor(0x0f0f1a)

    // Create animations for all characters
    this.createCharacterAnimations()

    // Init desk grid for team zone
    this.initTeamDeskGrid()

    // Draw world
    this.drawWorld()

    this.setupCamera()
    this.setupSmoke()
    this.setupBridge()
    this.setupMobileControls()
  }

  // ── Character Animations ──────────────────────────────────────────────────

  private createCharacterAnimations() {
    // Walk sheet: 384x224 → 24 cols × 7 rows (each frame 16×32)
    // Row 0 = walk down (frames 0-3), Row 1 = walk left (frames 24-27)
    // Row 2 = walk right (frames 48-51), Row 3 = walk up (frames 72-75)
    // (LimeZu standard layout)
    for (const char of ['adam', 'amelia', 'alex', 'bob']) {
      const walkKey = `char-${char}-walk`
      const runKey = `char-${char}-run`
      const sitKey = `char-${char}-sit`
      const sit2Key = `char-${char}-sit2`
      const sit3Key = `char-${char}-sit3`
      const idleKey = `char-${char}-idle`
      const phoneKey = `char-${char}-phone`

      // Walk animations (from walk sheet, 24 cols × 7 rows)
      if (this.textures.exists(walkKey)) {
        this.anims.create({
          key: `${char}-walk-down`,
          frames: this.anims.generateFrameNumbers(walkKey, { start: 0, end: 3 }),
          frameRate: 8, repeat: -1,
        })
        this.anims.create({
          key: `${char}-walk-left`,
          frames: this.anims.generateFrameNumbers(walkKey, { start: 24, end: 27 }),
          frameRate: 8, repeat: -1,
        })
        this.anims.create({
          key: `${char}-walk-right`,
          frames: this.anims.generateFrameNumbers(walkKey, { start: 48, end: 51 }),
          frameRate: 8, repeat: -1,
        })
        this.anims.create({
          key: `${char}-walk-up`,
          frames: this.anims.generateFrameNumbers(walkKey, { start: 72, end: 75 }),
          frameRate: 8, repeat: -1,
        })
      }

      // Run animations (384x32 = 24 frames single row)
      if (this.textures.exists(runKey)) {
        this.anims.create({
          key: `${char}-run`,
          frames: this.anims.generateFrameNumbers(runKey, { start: 0, end: 7 }),
          frameRate: 10, repeat: -1,
        })
      }

      // Sit (384x32 = 24 frames)
      if (this.textures.exists(sitKey)) {
        this.anims.create({
          key: `${char}-sit`,
          frames: this.anims.generateFrameNumbers(sitKey, { start: 0, end: 3 }),
          frameRate: 4, repeat: -1,
        })
      }

      // Sit2 (lounge rest)
      if (this.textures.exists(sit2Key)) {
        this.anims.create({
          key: `${char}-sit2`,
          frames: this.anims.generateFrameNumbers(sit2Key, { start: 0, end: 3 }),
          frameRate: 4, repeat: -1,
        })
      }

      // Sit3 (alternative rest)
      if (this.textures.exists(sit3Key)) {
        this.anims.create({
          key: `${char}-sit3`,
          frames: this.anims.generateFrameNumbers(sit3Key, { start: 0, end: 3 }),
          frameRate: 4, repeat: -1,
        })
      }

      // Idle animation (384x32 = 24 frames)
      if (this.textures.exists(idleKey)) {
        this.anims.create({
          key: `${char}-idle`,
          frames: this.anims.generateFrameNumbers(idleKey, { start: 0, end: 7 }),
          frameRate: 4, repeat: -1,
        })
      }

      // Phone animation (144x32 = 9 frames)
      if (this.textures.exists(phoneKey)) {
        this.anims.create({
          key: `${char}-phone`,
          frames: this.anims.generateFrameNumbers(phoneKey, { start: 0, end: 8 }),
          frameRate: 4, repeat: -1,
        })
      }
    }
  }

  // ── Tile placement helper ─────────────────────────────────────────────────

  private placeTile(
    texture: string,
    srcX: number, srcY: number, srcW: number, srcH: number,
    destX: number, destY: number,
    scale: number = 2,
    depth: number = 2,
  ): Phaser.GameObjects.Image {
    const img = this.add.image(destX - srcX * scale, destY - srcY * scale, texture)
    img.setOrigin(0, 0)
    img.setScale(scale)
    img.setDepth(depth)

    const maskShape = this.add.graphics()
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(destX, destY, srcW * scale, srcH * scale)
    const mask = maskShape.createGeometryMask()
    img.setMask(mask)

    return img
  }

  // ── World drawing ─────────────────────────────────────────────────────────

  private drawWorld() {
    // Background
    const bg = this.add.graphics()
    bg.fillStyle(0x0f0f1a, 1)
    bg.fillRect(0, 0, WORLD_W, WORLD_H)
    bg.setDepth(0)

    // Office floor (inner area)
    bg.fillStyle(0x1a1a2e, 1)
    bg.fillRect(30, 30, WORLD_W - 60, WORLD_H - 60)

    // Outer walls
    bg.lineStyle(6, 0x4a4a6e, 1)
    bg.strokeRect(30, 30, WORLD_W - 60, WORLD_H - 60)

    // Zone floors
    this.drawTeamZoneFloor()
    this.drawArchivistZoneFloor()
    this.drawCoffeeCornerFloor()
    this.drawFridayOfficeFloor()
    this.drawLoungeFloor()
    this.drawSmokingZoneFloor()

    // Zone decorations
    this.drawTeamZoneDecor()
    this.drawArchivistZoneDecor()
    this.drawCoffeeCornerDecor()
    this.drawFridayOffice()
    this.drawLoungeDecor()
    this.drawSmokingDecor()
    this.drawPerimeterDecor()

    // Zone dividers (subtle lines between open space areas)
    this.drawZoneDividers()

    // Zone labels
    this.drawZoneLabels()
  }

  private drawZoneFloor(
    x: number, y: number, w: number, h: number,
    color1: number, color2: number, borderColor: number,
    depth = 0,
  ) {
    const g = this.add.graphics()
    g.setDepth(depth)
    const tileSize = 32

    for (let ty = 0; ty < h; ty += tileSize) {
      for (let tx = 0; tx < w; tx += tileSize) {
        const col = Math.floor(tx / tileSize)
        const row = Math.floor(ty / tileSize)
        const isAlt = (col + row) % 2 === 1
        g.fillStyle(isAlt ? color2 : color1, 1)
        g.fillRect(x + tx, y + ty, Math.min(tileSize, w - tx), Math.min(tileSize, h - ty))
      }
    }

    g.lineStyle(1, 0x0a0a14, 0.4)
    for (let ty = 0; ty <= h; ty += tileSize) {
      g.moveTo(x, y + ty); g.lineTo(x + w, y + ty)
    }
    for (let tx = 0; tx <= w; tx += tileSize) {
      g.moveTo(x + tx, y); g.lineTo(x + tx, y + h)
    }
    g.strokePath()

    g.lineStyle(2, borderColor, 0.4)
    g.strokeRect(x, y, w, h)
  }

  private drawTeamZoneFloor() {
    const z = ZONES.teamZone
    this.drawZoneFloor(z.x, z.y, z.w, z.h, 0x2a2d3e, 0x252836, 0x89b4fa)
  }

  private drawArchivistZoneFloor() {
    const z = ZONES.archivistZone
    this.drawZoneFloor(z.x, z.y, z.w, z.h, 0x2a2535, 0x231e2d, 0xcba6f7)
  }

  private drawCoffeeCornerFloor() {
    const z = ZONES.coffeeCorner
    this.drawZoneFloor(z.x, z.y, z.w, z.h, 0x2d2318, 0x251e14, 0xfab387)
  }

  private drawFridayOfficeFloor() {
    const z = ZONES.fridayOffice
    // Wooden floor effect
    const g = this.add.graphics().setDepth(0)
    const plankH = 16
    for (let py = z.y; py < z.y + z.h; py += plankH) {
      const offset = ((py - z.y) / plankH) % 2 === 0 ? 0 : 40
      for (let px = z.x; px < z.x + z.w; px += 80) {
        g.fillStyle(0x3d2b1a, 1)
        g.fillRect(px + offset, py, 78, plankH - 1)
        g.fillStyle(0x4a3520, 0.5)
        g.fillRect(px + offset + 2, py + 2, 74, 2)
      }
    }
    g.lineStyle(2, 0xd4af37, 0.4)
    g.strokeRect(z.x, z.y, z.w, z.h)
  }

  private drawLoungeFloor() {
    const z = ZONES.lounge
    this.drawZoneFloor(z.x, z.y, z.w, z.h, 0x2a1e14, 0x231a10, 0xfab387)
  }

  private drawSmokingZoneFloor() {
    const z = ZONES.smoking
    this.drawZoneFloor(z.x, z.y, z.w, z.h, 0x1e1e1e, 0x191919, 0x6e6e6e)
  }

  private drawTeamZoneDecor() {
    // Zone label area highlight
    const g = this.add.graphics().setDepth(1)
    g.fillStyle(0x89b4fa, 0.05)
    g.fillRect(ZONES.teamZone.x, ZONES.teamZone.y, ZONES.teamZone.w, 40)

    // Vertical accent line on right edge of team zone
    g.lineStyle(3, 0x89b4fa, 0.2)
    g.moveTo(ZONES.teamZone.x + ZONES.teamZone.w, ZONES.teamZone.y)
    g.lineTo(ZONES.teamZone.x + ZONES.teamZone.w, ZONES.teamZone.y + ZONES.teamZone.h)
    g.strokePath()
  }

  private drawArchivistZoneDecor() {
    const z = ZONES.archivistZone
    const g = this.add.graphics().setDepth(1)

    // Shelves along left wall
    const shelfX = z.x + 4
    const shelfW = 60
    const shelfCount = 10
    const shelfSpacing = (z.h - 40) / shelfCount

    for (let i = 0; i < shelfCount; i++) {
      const sy = z.y + 40 + i * shelfSpacing
      // Shelf board
      g.fillStyle(0x4a3520, 1)
      g.fillRect(shelfX, sy, shelfW, 6)
      g.lineStyle(1, 0x6a5040, 0.8)
      g.strokeRect(shelfX, sy, shelfW, 6)

      // Books on shelf
      const bookColors = [0x89b4fa, 0xcba6f7, 0xa6e3a1, 0xf9e2af, 0xf38ba8, 0xfab387]
      let bx = shelfX + 2
      while (bx < shelfX + shelfW - 8) {
        const bw = Phaser.Math.Between(4, 10)
        const bh = Phaser.Math.Between(14, 22)
        const bc = bookColors[Math.floor(Math.random() * bookColors.length)]
        g.fillStyle(bc, 0.9)
        g.fillRect(bx, sy - bh, bw, bh)
        g.lineStyle(1, 0x0a0a14, 0.4)
        g.strokeRect(bx, sy - bh, bw, bh)
        bx += bw + 1
      }
    }

    // Right side shelves
    const shelfX2 = z.x + z.w - 4 - 60
    for (let i = 0; i < shelfCount; i++) {
      const sy = z.y + 40 + i * shelfSpacing
      g.fillStyle(0x4a3520, 1)
      g.fillRect(shelfX2, sy, 60, 6)
      g.lineStyle(1, 0x6a5040, 0.8)
      g.strokeRect(shelfX2, sy, 60, 6)

      let bx = shelfX2 + 2
      while (bx < shelfX2 + 56) {
        const bw = Phaser.Math.Between(4, 10)
        const bh = Phaser.Math.Between(14, 22)
        const bc = [0x89b4fa, 0xcba6f7, 0xa6e3a1, 0xf9e2af, 0xf38ba8][Math.floor(Math.random() * 5)]
        g.fillStyle(bc, 0.9)
        g.fillRect(bx, sy - bh, bw, bh)
        bx += bw + 1
      }
    }

    // Central big desk for archivist
    const deskX = z.x + 30
    const deskY = z.y + z.h / 2 - 40
    g.fillStyle(0x5a4030, 1)
    g.fillRoundedRect(deskX, deskY, 140, 70, 4)
    g.lineStyle(2, 0xcba6f7, 0.6)
    g.strokeRoundedRect(deskX, deskY, 140, 70, 4)
    g.fillStyle(0x4a3020, 1)
    g.fillRoundedRect(deskX + 4, deskY + 4, 132, 62, 3)

    // Flower on desk
    g.fillStyle(0x2d7a3a, 1)
    g.fillRect(deskX + 110, deskY + 20, 4, 25)
    g.fillStyle(0xf38ba8, 1)
    g.fillCircle(deskX + 112, deskY + 15, 10)
    g.fillStyle(0xf5e6d3, 1)
    g.fillCircle(deskX + 112, deskY + 15, 5)

    // Documents on desk
    g.fillStyle(0xe8e8e0, 0.9)
    g.fillRect(deskX + 10, deskY + 10, 40, 30)
    g.fillStyle(0xd0d0c8, 0.7)
    g.fillRect(deskX + 15, deskY + 8, 40, 30)
    g.lineStyle(1, 0x89b4fa, 0.6)
    for (let li = 0; li < 4; li++) {
      g.moveTo(deskX + 16, deskY + 14 + li * 6)
      g.lineTo(deskX + 48, deskY + 14 + li * 6)
    }
    g.strokePath()

    // Ambient glow
    const glow = this.add.graphics().setDepth(0)
    glow.fillStyle(0xcba6f7, 0.04)
    glow.fillRect(z.x, z.y, z.w, z.h)
  }

  private drawCoffeeCornerDecor() {
    const z = ZONES.coffeeCorner
    const g = this.add.graphics().setDepth(1)

    // Coffee machine on upper wall
    const mX = z.x + z.w / 2 - 20
    const mY = z.y + 50
    g.fillStyle(0x2a2a3a, 1)
    g.fillRoundedRect(mX, mY, 40, 60, 4)
    g.lineStyle(2, 0xfab387, 0.8)
    g.strokeRoundedRect(mX, mY, 40, 60, 4)
    // Screen
    g.fillStyle(0x111122, 1)
    g.fillRect(mX + 5, mY + 8, 30, 18)
    g.fillStyle(0xfab387, 0.5)
    g.fillRect(mX + 7, mY + 10, 26, 14)
    // Buttons
    g.fillStyle(0xf38ba8, 1)
    g.fillCircle(mX + 10, mY + 35, 4)
    g.fillStyle(0x89b4fa, 1)
    g.fillCircle(mX + 20, mY + 35, 4)
    g.fillStyle(0xa6e3a1, 1)
    g.fillCircle(mX + 30, mY + 35, 4)
    // Drip area
    g.fillStyle(0x1a1a2a, 1)
    g.fillRect(mX + 10, mY + 44, 20, 8)
    g.fillStyle(0x4a3520, 1)
    g.fillRect(mX + 14, mY + 52, 12, 5)

    // Small coffee table (2 chairs facing each other)
    const tX = z.x + 40
    const tY = z.y + 140
    g.fillStyle(0x3a2510, 1)
    g.fillRoundedRect(tX, tY, 120, 55, 6)
    g.lineStyle(2, 0xfab387, 0.5)
    g.strokeRoundedRect(tX, tY, 120, 55, 6)

    // Cups on table
    g.fillStyle(0xe8e8e0, 0.9)
    g.fillCircle(tX + 35, tY + 27, 9)
    g.fillStyle(0x3a1a0a, 0.8)
    g.fillCircle(tX + 35, tY + 27, 6)
    g.fillStyle(0xe8e8e0, 0.9)
    g.fillCircle(tX + 85, tY + 27, 9)
    g.fillStyle(0x3a1a0a, 0.8)
    g.fillCircle(tX + 85, tY + 27, 6)

    // Chair 1 (left)
    g.fillStyle(0x4a3a1a, 1)
    g.fillRoundedRect(tX - 30, tY + 5, 26, 40, 4)
    g.lineStyle(1, 0xfab387, 0.3)
    g.strokeRoundedRect(tX - 30, tY + 5, 26, 40, 4)

    // Chair 2 (right)
    g.fillStyle(0x4a3a1a, 1)
    g.fillRoundedRect(tX + 124, tY + 5, 26, 40, 4)
    g.strokeRoundedRect(tX + 124, tY + 5, 26, 40, 4)

    // Warm glow
    const glow = this.add.graphics().setDepth(0)
    glow.fillStyle(0xfab387, 0.05)
    glow.fillRect(z.x, z.y, z.w, z.h)
  }

  private drawFridayOffice() {
    const z = ZONES.fridayOffice
    const scale = 2
    const T = 16 * scale  // 32px per tile

    // Glass wall left side (divides from coffee/archivist areas)
    const glass = this.add.graphics().setDepth(3)
    glass.fillStyle(0x89dceb, 0.12)
    glass.fillRect(z.x, z.y, 8, z.h)
    glass.lineStyle(3, 0x89dceb, 0.5)
    glass.moveTo(z.x, z.y)
    glass.lineTo(z.x, z.y + z.h)
    glass.strokePath()

    // Glass wall right side
    glass.fillStyle(0x89dceb, 0.12)
    glass.fillRect(z.x + z.w - 8, z.y, 8, z.h)
    glass.lineStyle(3, 0x89dceb, 0.5)
    glass.moveTo(z.x + z.w, z.y)
    glass.lineTo(z.x + z.w, z.y + z.h)
    glass.strokePath()

    // Door opening (left wall, centered)
    const doorX = z.x
    const doorY = z.y + z.h / 2 - 40
    const doorW = 8
    const doorH = 80
    // Clear glass over door area
    glass.fillStyle(0x1a1a2e, 1)
    glass.fillRect(doorX, doorY, doorW, doorH)
    // Door frame
    glass.lineStyle(2, 0xd4af37, 0.8)
    glass.moveTo(doorX, doorY)
    glass.lineTo(doorX, doorY + doorH)
    glass.strokePath()

    // Nameplate on door
    glass.fillStyle(0xd4af37, 0.8)
    glass.fillRect(z.x + 10, doorY + 5, 60, 14)
    this.add.text(z.x + 40, doorY + 12, '🤖 ПЯТНИЦА', {
      fontSize: '6px', color: '#1a0a0a', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(6)

    // Floor tiles (already drawn by drawFridayOfficeFloor)
    // Executive desk — large, centered
    const ox = z.x + 60
    const oy = z.y + 80

    // Desk (tiled from interiors)
    this.placeTile('limezu-interiors', 48, 192, 32, 32, ox + T, oy, scale, 3)
    this.placeTile('limezu-interiors', 48, 192, 32, 32, ox + T * 3, oy, scale, 3)

    // Desk surface (graphics overlay)
    const desk = this.add.graphics().setDepth(3)
    desk.fillStyle(0x4a3020, 1)
    desk.fillRoundedRect(ox, oy, 260, 80, 6)
    desk.lineStyle(2, 0xd4af37, 0.7)
    desk.strokeRoundedRect(ox, oy, 260, 80, 6)
    desk.fillStyle(0x5a3a25, 1)
    desk.fillRoundedRect(ox + 4, oy + 4, 252, 72, 4)

    // Monitor on desk
    desk.fillStyle(0x111122, 1)
    desk.fillRoundedRect(ox + 80, oy - 45, 100, 65, 4)
    desk.lineStyle(2, 0x89b4fa, 0.8)
    desk.strokeRoundedRect(ox + 80, oy - 45, 100, 65, 4)
    desk.fillStyle(0x89b4fa, 0.3)
    desk.fillRect(ox + 84, oy - 41, 92, 57)
    // Code lines on monitor
    desk.lineStyle(1, 0xa6e3a1, 0.7)
    for (let li = 0; li < 5; li++) {
      desk.moveTo(ox + 88, oy - 36 + li * 10)
      desk.lineTo(ox + 88 + Phaser.Math.Between(30, 80), oy - 36 + li * 10)
    }
    desk.strokePath()
    // Monitor stand
    desk.fillStyle(0x2a2a3a, 1)
    desk.fillRect(ox + 125, oy + 20, 10, 25)
    desk.fillRect(ox + 115, oy + 44, 30, 6)

    // Leather chair (dark)
    const chairX = ox + 100
    const chairY = oy + 90
    desk.fillStyle(0x1a1a1a, 1)
    desk.fillRoundedRect(chairX, chairY, 60, 50, 8)
    desk.lineStyle(2, 0x3a3a3a, 0.8)
    desk.strokeRoundedRect(chairX, chairY, 60, 50, 8)
    desk.fillStyle(0x2a2a2a, 1)
    desk.fillRoundedRect(chairX + 5, chairY + 5, 50, 35, 6)
    // Chair back
    desk.fillStyle(0x1a1a1a, 1)
    desk.fillRoundedRect(chairX + 5, chairY - 40, 50, 45, 6)
    desk.lineStyle(2, 0x3a3a3a, 0.6)
    desk.strokeRoundedRect(chairX + 5, chairY - 40, 50, 45, 6)

    // Plant in corner
    const plantX = z.x + z.w - 50
    const plantY = z.y + 60
    desk.fillStyle(0x5a3010, 1)
    desk.fillRect(plantX - 12, plantY + 20, 24, 20)
    desk.fillStyle(0x2d7a3a, 1)
    desk.fillCircle(plantX, plantY, 18)
    desk.fillCircle(plantX - 14, plantY + 8, 12)
    desk.fillCircle(plantX + 14, plantY + 8, 12)
    desk.fillStyle(0x1a5a28, 1)
    desk.fillCircle(plantX, plantY + 6, 13)

    // Second plant in opposite corner
    desk.fillStyle(0x5a3010, 1)
    desk.fillRect(z.x + 10, z.y + z.h - 70, 18, 20)
    desk.fillStyle(0x1a6a30, 1)
    desk.fillCircle(z.x + 20, z.y + z.h - 80, 14)

    // Bookshelves on back wall
    const shelfY = z.y + 4
    desk.fillStyle(0x3a2510, 1)
    deck: for (let bsi = 0; bsi < 3; bsi++) {
      const bsX = z.x + 20 + bsi * 100
      desk.fillRect(bsX, shelfY, 80, 12)
      desk.lineStyle(1, 0x5a3520, 0.7)
      desk.strokeRect(bsX, shelfY, 80, 12)
      // Books
      let bkx = bsX + 4
      while (bkx < bsX + 76) {
        const bw = Phaser.Math.Between(6, 12)
        const bh = Phaser.Math.Between(20, 32)
        const bcs = [0xcba6f7, 0x89b4fa, 0xf9e2af, 0xa6e3a1, 0xfab387]
        desk.fillStyle(bcs[Math.floor(Math.random() * bcs.length)], 0.9)
        desk.fillRect(bkx, shelfY - bh, bw, bh)
        bkx += bw + 2
      }
    }

    // Room label
    this.add.text(z.x + z.w / 2, z.y + 15, '🤖 Кабинет Пятницы', {
      fontSize: '10px', color: '#d4af37', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(6)

    // Golden accent glow
    const glow = this.add.graphics().setDepth(0)
    glow.fillStyle(0xd4af37, 0.04)
    glow.fillRect(z.x, z.y, z.w, z.h)
  }

  private drawLoungeDecor() {
    const z = ZONES.lounge
    const g = this.add.graphics().setDepth(1)

    // Zone top border accent
    g.lineStyle(3, 0xfab387, 0.3)
    g.moveTo(z.x, z.y)
    g.lineTo(z.x + z.w, z.y)
    g.strokePath()

    // Large sofa (3-seater) on left side
    const sofaX = z.x + 30
    const sofaY = z.y + 80
    // Sofa back
    g.fillStyle(0x5a3a1a, 1)
    g.fillRoundedRect(sofaX, sofaY - 40, 220, 50, 6)
    g.lineStyle(2, 0xfab387, 0.5)
    g.strokeRoundedRect(sofaX, sofaY - 40, 220, 50, 6)
    // Sofa seat
    g.fillStyle(0x6a4a2a, 1)
    g.fillRoundedRect(sofaX, sofaY, 220, 60, 6)
    g.lineStyle(2, 0xfab387, 0.4)
    g.strokeRoundedRect(sofaX, sofaY, 220, 60, 6)
    // Sofa cushions
    for (let ci = 0; ci < 3; ci++) {
      g.fillStyle(0x7a5a3a, 1)
      g.fillRoundedRect(sofaX + 10 + ci * 72, sofaY + 5, 65, 48, 4)
      g.lineStyle(1, 0xfab387, 0.25)
      g.strokeRoundedRect(sofaX + 10 + ci * 72, sofaY + 5, 65, 48, 4)
    }
    // Sofa armrests
    g.fillStyle(0x5a3a1a, 1)
    g.fillRoundedRect(sofaX - 18, sofaY - 40, 18, 100, 4)
    g.fillRoundedRect(sofaX + 220, sofaY - 40, 18, 100, 4)

    // Coffee table in front of sofa
    g.fillStyle(0x3a2510, 1)
    g.fillRoundedRect(sofaX + 20, sofaY + 70, 180, 40, 4)
    g.lineStyle(2, 0xfab387, 0.4)
    g.strokeRoundedRect(sofaX + 20, sofaY + 70, 180, 40, 4)
    // Cups on coffee table
    g.fillStyle(0xe8e8e0, 0.9)
    g.fillCircle(sofaX + 60, sofaY + 90, 8)
    g.fillStyle(0x3a1a0a, 0.8)
    g.fillCircle(sofaX + 60, sofaY + 90, 5)
    g.fillStyle(0xe8e8e0, 0.9)
    g.fillCircle(sofaX + 160, sofaY + 90, 8)
    g.fillStyle(0x3a1a0a, 0.8)
    g.fillCircle(sofaX + 160, sofaY + 90, 5)

    // TV on right wall
    const tvX = z.x + z.w - 140
    const tvY = z.y + 30
    g.fillStyle(0x111122, 1)
    g.fillRoundedRect(tvX, tvY, 120, 75, 4)
    g.lineStyle(3, 0x3a3a5a, 1)
    g.strokeRoundedRect(tvX, tvY, 120, 75, 4)
    g.fillStyle(0x0a0a1a, 1)
    g.fillRect(tvX + 5, tvY + 5, 110, 65)
    // TV content (code/dashboard)
    g.fillStyle(0x89b4fa, 0.8)
    g.fillRect(tvX + 10, tvY + 15, 35, 45)
    g.fillStyle(0xa6e3a1, 0.8)
    g.fillRect(tvX + 50, tvY + 25, 30, 35)
    g.fillStyle(0xf9e2af, 0.8)
    g.fillRect(tvX + 85, tvY + 20, 25, 40)
    // TV stand
    g.fillStyle(0x2a2a3a, 1)
    g.fillRect(tvX + 55, tvY + 75, 10, 20)
    g.fillRect(tvX + 45, tvY + 95, 30, 6)

    // Floor lamp
    const lampX = z.x + z.w - 30
    const lampY = z.y + 50
    g.fillStyle(0x4a4a6a, 1)
    g.fillRect(lampX - 2, lampY, 4, 100)
    g.fillStyle(0xf9e2af, 0.6)
    g.fillTriangle(lampX - 14, lampY + 100, lampX + 14, lampY + 100, lampX, lampY + 120)
    g.fillStyle(0xffffff, 0.3)
    g.fillCircle(lampX, lampY + 104, 6)

    // Warm ambient glow
    const glow = this.add.graphics().setDepth(0)
    glow.fillStyle(0xfab387, 0.05)
    glow.fillRect(z.x, z.y, z.w, z.h)
  }

  private drawSmokingDecor() {
    const z = ZONES.smoking
    const g = this.add.graphics().setDepth(1)

    // Dark overlay
    const dark = this.add.graphics().setDepth(0)
    dark.fillStyle(0x0a0a0a, 0.4)
    dark.fillRect(z.x, z.y, z.w, z.h)

    // Bench/seating along wall
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(z.x + 10, z.y + 30, z.w - 20, 35, 4)
    g.lineStyle(1, 0x4a4a4a, 0.7)
    g.strokeRoundedRect(z.x + 10, z.y + 30, z.w - 20, 35, 4)
    // Bench seat
    g.fillStyle(0x3a3a3a, 1)
    g.fillRoundedRect(z.x + 10, z.y + 55, z.w - 20, 12, 2)

    // Ashtray stand
    const ashX = z.x + z.w / 2 - 15
    const ashY = z.y + 120
    g.fillStyle(0x3a3a3a, 1)
    g.fillRect(ashX + 10, ashY, 8, 70)
    g.fillStyle(0x5a5a5a, 1)
    g.fillEllipse(ashX + 14, ashY + 70, 50, 18)
    g.fillStyle(0x2a2a2a, 1)
    g.fillEllipse(ashX + 14, ashY + 70, 36, 12)
    // Cigarette butts in ashtray
    g.fillStyle(0xfab387, 0.7)
    g.fillRect(ashX + 4, ashY + 62, 8, 3)
    g.fillRect(ashX + 14, ashY + 64, 8, 3)
    g.fillRect(ashX + 20, ashY + 60, 8, 3)

    // Second bench on right wall
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(z.x + z.w - 45, z.y + 100, 35, 160, 4)
    g.lineStyle(1, 0x3a3a3a, 0.6)
    g.strokeRoundedRect(z.x + z.w - 45, z.y + 100, 35, 160, 4)

    // Warning sign
    const signX = z.x + 10
    const signY = z.y + 200
    g.fillStyle(0xf9e2af, 0.9)
    g.fillRoundedRect(signX, signY, 50, 30, 3)
    g.lineStyle(2, 0xe67e22, 0.9)
    g.strokeRoundedRect(signX, signY, 50, 30, 3)
    this.add.text(signX + 25, signY + 15, '🚬', {
      fontSize: '14px', fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(3)

    // No-entry exit only sign
    const sign2X = z.x + z.w - 60
    const sign2Y = z.y + 200
    g.fillStyle(0xf38ba8, 0.7)
    g.fillRoundedRect(sign2X, sign2Y, 50, 20, 2)
    this.add.text(sign2X + 25, sign2Y + 10, 'ZONE', {
      fontSize: '6px', color: '#1a0a0a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(3)
  }

  private drawPerimeterDecor() {
    const g = this.add.graphics().setDepth(1)

    // Corner plants
    const plantPositions = [
      { x: 50, y: 55 }, { x: 2350, y: 55 }, { x: 50, y: 840 }, { x: 2350, y: 840 },
      { x: 580, y: 55 }, { x: 1000, y: 55 }, { x: 1600, y: 55 },
    ]
    for (const pp of plantPositions) {
      this.drawPlant(g, pp.x, pp.y)
    }

    // Ceiling lamps
    const lampPositions = [200, 500, 750, 1050, 1200, 1500, 1800, 2100, 2300]
    for (const lx of lampPositions) {
      this.drawLamp(g, lx, 38)
    }

    // Code posters on top wall
    const posters = [
      { x: 120, color: 0x89b4fa, text: '//' },
      { x: 400, color: 0xa6e3a1, text: '><' },
      { x: 800, color: 0xcba6f7, text: '{ }' },
      { x: 1600, color: 0xf9e2af, text: '...' },
      { x: 1900, color: 0xf38ba8, text: '◆' },
      { x: 2200, color: 0xfab387, text: '★' },
    ]
    for (const p of posters) {
      this.drawPoster(g, p.x, 38, p.color, p.text)
    }
  }

  private drawZoneDividers() {
    const g = this.add.graphics().setDepth(1)

    // Subtle divider between archivist and team zone (already border)
    // Divider between coffee corner (upper) and lounge (lower)
    g.lineStyle(2, 0x3a3a5a, 0.5)
    g.moveTo(ZONES.coffeeCorner.x, ZONES.coffeeCorner.y + ZONES.coffeeCorner.h)
    g.lineTo(ZONES.coffeeCorner.x + ZONES.coffeeCorner.w, ZONES.coffeeCorner.y + ZONES.coffeeCorner.h)
    g.strokePath()

    // Divider line between lounge and smoking
    g.lineStyle(3, 0x4a4a4a, 0.6)
    g.moveTo(ZONES.smoking.x, ZONES.smoking.y)
    g.lineTo(ZONES.smoking.x, ZONES.smoking.y + ZONES.smoking.h)
    g.strokePath()
  }

  private drawZoneLabels() {
    const labels = [
      { text: '💼 Team Zone', x: ZONES.teamZone.x + 8, y: ZONES.teamZone.y + 8, color: '#89b4fa' },
      { text: '📚 Архивариус', x: ZONES.archivistZone.x + 8, y: ZONES.archivistZone.y + 8, color: '#cba6f7' },
      { text: '☕ Coffee', x: ZONES.coffeeCorner.x + 8, y: ZONES.coffeeCorner.y + 8, color: '#fab387' },
      { text: '🛋️ Lounge', x: ZONES.lounge.x + 8, y: ZONES.lounge.y + 8, color: '#fab387' },
      { text: '🚬 Курилка', x: ZONES.smoking.x + 8, y: ZONES.smoking.y + 8, color: '#9b9b9b' },
    ]
    for (const lbl of labels) {
      this.add.text(lbl.x, lbl.y, lbl.text, {
        fontSize: '10px', color: lbl.color,
        fontFamily: 'monospace', fontStyle: 'bold',
      }).setDepth(5).setAlpha(0.85)
    }
  }

  private drawPlant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x8b4513, 1)
    g.fillRect(x - 8, y + 10, 16, 12)
    g.fillStyle(0x6b3410, 1)
    g.fillRect(x - 9, y + 8, 18, 4)
    g.fillStyle(0x2d7a3a, 1)
    g.fillCircle(x, y, 10)
    g.fillCircle(x - 8, y + 4, 7)
    g.fillCircle(x + 8, y + 4, 7)
    g.fillStyle(0x1a5a28, 1)
    g.fillCircle(x, y + 2, 7)
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x4a4a6a, 1)
    g.fillRect(x - 2, y, 4, 16)
    g.fillRect(x - 8, y + 14, 16, 3)
    g.fillStyle(0xf9e2af, 0.7)
    g.fillTriangle(x - 10, y + 17, x + 10, y + 17, x, y + 30)
    g.fillStyle(0xffffff, 0.3)
    g.fillCircle(x, y + 20, 4)
  }

  private drawPoster(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, text: string) {
    g.fillStyle(0x1a1a2e, 1)
    g.fillRoundedRect(x - 18, y - 24, 36, 48, 3)
    g.lineStyle(2, color, 0.7)
    g.strokeRoundedRect(x - 18, y - 24, 36, 48, 3)
    g.fillStyle(color, 0.3)
    g.fillRect(x - 14, y - 20, 28, 36)
    this.add.text(x, y, text, {
      fontSize: '8px', color: '#' + color.toString(16).padStart(6, '0'),
      fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(2)
  }

  // ── Dynamic desk grid ─────────────────────────────────────────────────────

  private initTeamDeskGrid() {
    const cols = 3
    const startX = 80
    const startY = 80
    const deskW = 140
    const deskH = 100

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < cols; col++) {
        this.teamDeskSlots.push({
          x: startX + col * (deskW + 20),
          y: startY + row * (deskH + 10),
          agentId: null,
        })
      }
    }
  }

  private assignTeamDesk(agentId: string): { x: number; y: number } | null {
    const free = this.teamDeskSlots.find((s) => s.agentId === null)
    if (!free) return null
    free.agentId = agentId
    this.drawTeamDesk(free.x, free.y, agentId)
    return { x: free.x + 60, y: free.y + 40 }  // center of desk
  }

  private drawTeamDesk(x: number, y: number, _agentId: string) {
    const g = this.add.graphics().setDepth(2)

    // Desk surface
    g.fillStyle(0x3a3a5a, 1)
    g.fillRoundedRect(x, y, 140, 70, 4)
    g.lineStyle(1, 0x5a5a8a, 0.8)
    g.strokeRoundedRect(x, y, 140, 70, 4)
    g.fillStyle(0x2a2a4a, 1)
    g.fillRoundedRect(x + 3, y + 3, 134, 64, 3)

    // Monitor stand
    g.fillStyle(0x1a1a2e, 1)
    g.fillRect(x + 60, y - 2, 6, 4)

    // Monitor
    g.fillStyle(0x111122, 1)
    g.fillRoundedRect(x + 30, y - 38, 80, 44, 3)
    g.lineStyle(1, 0x89b4fa, 0.6)
    g.strokeRoundedRect(x + 30, y - 38, 80, 44, 3)
    g.fillStyle(0x89b4fa, 0.15)
    g.fillRect(x + 33, y - 35, 74, 38)

    // Keyboard
    g.fillStyle(0x2a2a4a, 1)
    g.fillRoundedRect(x + 15, y + 40, 80, 20, 2)
    g.lineStyle(1, 0x3a3a5a, 0.5)
    for (let ki = 0; ki < 5; ki++) {
      g.moveTo(x + 20 + ki * 14, y + 43)
      g.lineTo(x + 20 + ki * 14, y + 57)
    }
    g.strokePath()

    // Mouse
    g.fillStyle(0x3a3a5a, 1)
    g.fillEllipse(x + 112, y + 48, 14, 20)
    g.lineStyle(1, 0x5a5a8a, 0.5)
    g.strokeEllipse(x + 112, y + 48, 14, 20)
  }

  // Show/hide computer glow (working state indicator)
  private updateDeskComputer(agentId: string, visible: boolean) {
    const existing = this.deskComputerIcons.get(agentId)
    if (existing) {
      existing.setVisible(visible)
      return
    }

    if (!visible) return

    const state = this.agents.get(agentId)
    if (!state) return

    // Create glowing computer indicator at desk
    const glow = this.add.arc(state.deskX, state.deskY - 45, 8, 0, 360, false, 0x89b4fa, 0.6)
    glow.setDepth(4)
    this.deskComputerIcons.set(agentId, glow)

    this.tweens.add({
      targets: glow,
      alpha: 0.2, scaleX: 1.5, scaleY: 1.5,
      duration: 800, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1,
    })
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main
    cam.setZoom(1)

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: unknown,
      _deltaX: number,
      deltaY: number,
    ) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.4, 1.8)
      cam.setZoom(newZoom)
    })

    cam.centerOn(WORLD_W / 2, WORLD_H / 2)
  }

  // ── Smoke particles ───────────────────────────────────────────────────────

  private setupSmoke() {
    const smokeX = [1360, 1430, 1490]
    const smokeBaseY = 620

    this.smokeTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        for (const x of smokeX) {
          const smoke = this.add.arc(
            x + Phaser.Math.Between(-5, 5),
            smokeBaseY,
            Phaser.Math.Between(4, 8), 0, 360, false,
            0x9b9b9b, 0.5,
          )
          smoke.setDepth(5)
          this.smokeParticles.push({ x, y: smokeBaseY, alpha: 0.5, vy: -1, obj: smoke })

          this.tweens.add({
            targets: smoke,
            y: smokeBaseY - Phaser.Math.Between(40, 100),
            alpha: 0,
            scaleX: 2.5, scaleY: 2.5,
            duration: 3000,
            ease: 'Quad.easeOut',
            onComplete: () => smoke.destroy(),
          })
        }
      },
    })
  }

  // ── Event bridge ──────────────────────────────────────────────────────────

  private setupBridge() {
    eventBridge.on('agent:added', (agent: AgentEntry) => {
      if (this.scene.isActive()) this.spawnAgent(agent)
    })

    eventBridge.on('agent:moved', ({ agentId, presenceState }: { agentId: string; presenceState: string }) => {
      if (this.scene.isActive()) this.onAgentPresenceChanged(agentId, presenceState)
    })

    eventBridge.on('agent:update', (agents: AgentEntry[]) => {
      if (!this.scene.isActive()) return
      for (const a of agents) {
        if (!this.agents.has(a.agentId)) {
          this.spawnAgent(a)
        } else {
          this.updateAgent(a.agentId, a)
        }
      }
    })

    eventBridge.on('agent:say', ({ agentId, text }: { agentId: string; text: string }) => {
      if (this.scene.isActive()) this.showBubble(agentId, text)
    })

    eventBridge.on('scene:sync', ({ agents }: { agents: AgentEntry[] }) => {
      if (!this.scene.isActive()) return
      for (const a of agents) {
        if (!this.agents.has(a.agentId)) this.spawnAgent(a)
      }
    })

    this.time.delayedCall(100, () => {
      eventBridge.emit('scene:ready', undefined)
    })
  }

  // ── Spawn agent ───────────────────────────────────────────────────────────

  private spawnAgent(a: AgentEntry) {
    if (this.agents.has(a.agentId)) {
      this.updateAgent(a.agentId, a)
      return
    }

    const charKey = ROLE_TO_CHAR[a.role] ?? 'adam'

    // Determine position by role
    let spawnX: number
    let spawnY: number
    let deskX: number
    let deskY: number

    if (a.role === 'DIRECTOR') {
      // Friday always in her office
      spawnX = 1150
      spawnY = 420
      deskX = 1130
      deskY = 400
    } else if (a.role === 'ARCHIVIST') {
      // Archivist in their zone
      spawnX = 700
      spawnY = ZONES.archivistZone.y + ZONES.archivistZone.h / 2
      deskX = 700
      deskY = ZONES.archivistZone.y + ZONES.archivistZone.h / 2
    } else {
      // Team zone — assign dynamic desk
      const desk = this.assignTeamDesk(a.agentId)
      if (desk) {
        spawnX = desk.x
        spawnY = desk.y
        deskX = desk.x
        deskY = desk.y
      } else {
        // Fallback: random spot in team zone
        spawnX = Phaser.Math.Between(80, 540)
        spawnY = Phaser.Math.Between(80, 820)
        deskX = spawnX
        deskY = spawnY
      }
    }

    // Create sprite
    const idleKey = `char-${charKey}-idle`
    const textureKey = this.textures.exists(idleKey) ? idleKey : '__DEFAULT'
    const sprite = this.add.sprite(0, 0, textureKey)
    sprite.setScale(2)
    sprite.setDepth(10)

    // Name label
    const cleanName = a.name.replace(/^\p{Emoji}\s*/u, '')
    const nameLabel = this.add.text(0, 22, cleanName, {
      fontSize: '9px',
      color: '#cdd6f4',
      fontFamily: 'monospace',
      backgroundColor: '#0a0a14aa',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 0).setAlpha(0.92).setDepth(11)

    // Container
    const container = this.add.container(spawnX, spawnY, [sprite, nameLabel])
    container.setDepth(10)
    container.setSize(32, 48)
    container.setInteractive()

    // Click → emit agent:click event
    container.on('pointerdown', () => {
      const st = this.agents.get(a.agentId)
      eventBridge.emit('agent:click', {
        agentId: a.agentId,
        role: a.role,
        name: a.name,
        presenceState: st?.presenceState ?? a.presenceState,
      })
    })
    container.on('pointerover', () => {
      this.game.canvas.style.cursor = 'pointer'
    })
    container.on('pointerout', () => {
      this.game.canvas.style.cursor = 'default'
    })

    const state: AgentState = {
      agentId: a.agentId,
      role: a.role,
      name: a.name,
      presenceState: a.presenceState,
      sprite,
      container,
      bubble: null,
      bubbleTimer: null,
      emoji: null,
      emojiTimer: null,
      nameLabel,
      behaviour: 'AT_DESK',
      wanderTimer: null,
      currentX: spawnX,
      currentY: spawnY,
      deskX,
      deskY,
      charKey,
      currentAnim: `${charKey}-idle`,
      workingComputer: null,
      bubbleScheduleTimer: null,
    }

    this.agents.set(a.agentId, state)

    // Spawn animation
    container.setAlpha(0)
    container.setScale(0.5)
    this.tweens.add({
      targets: container,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        const st = this.agents.get(a.agentId)
        if (!st) return
        this.applyPresenceAnimation(st)
        this.scheduleBubble(a.agentId)
      },
    })

    // Start idle animation immediately
    if (this.textures.exists(idleKey)) {
      sprite.play(`${charKey}-idle`)
      state.currentAnim = `${charKey}-idle`
    }
  }

  // ── Update agent ──────────────────────────────────────────────────────────

  private updateAgent(agentId: string, a: AgentEntry) {
    const state = this.agents.get(agentId)
    if (!state) return
    if (state.presenceState !== a.presenceState) {
      this.onAgentPresenceChanged(agentId, a.presenceState)
    }
  }

  private onAgentPresenceChanged(agentId: string, presenceState: string) {
    const state = this.agents.get(agentId)
    if (!state) return
    if (state.presenceState === presenceState) return

    state.presenceState = presenceState

    // Clear timers
    if (state.wanderTimer) { state.wanderTimer.destroy(); state.wanderTimer = null }
    if (state.emojiTimer) { state.emojiTimer.destroy(); state.emojiTimer = null }
    if (state.bubbleTimer) { state.bubbleTimer.destroy(); state.bubbleTimer = null }
    if (state.bubble) { state.bubble.destroy(); state.bubble = null }

    this.tweens.killTweensOf(state.container)
    this.applyPresenceAnimation(state)
  }

  private applyPresenceAnimation(state: AgentState) {
    const char = state.charKey

    switch (state.presenceState) {
      case 'WORKING':
      case 'BUSY': {
        // Move to desk, then sit
        this.walkTo(state, state.deskX, state.deskY, () => {
          const s = this.agents.get(state.agentId)
          if (!s) return
          s.behaviour = 'WORKING'
          this.playAnim(s, `${char}-sit`)
          this.updateDeskComputer(state.agentId, true)
          this.showHeadEmoji(state.agentId, '💻')
          // Schedule periodic work emojis
          this.scheduleWorkEmoji(state.agentId)
        })
        break
      }

      case 'IDLE': {
        this.updateDeskComputer(state.agentId, false)
        this.walkTo(state, state.deskX, state.deskY, () => {
          const s = this.agents.get(state.agentId)
          if (!s) return
          s.behaviour = 'AT_DESK'
          this.playAnim(s, `${char}-idle`)
          this.scheduleWander(state.agentId)
        })
        break
      }

      case 'CHATTING': {
        this.updateDeskComputer(state.agentId, false)
        const chatSpot = Phaser.Utils.Array.GetRandom(ZONE_SPOTS.fridayOffice) ??
          { x: 1200, y: 400 }
        this.walkTo(state, chatSpot.x, chatSpot.y, () => {
          const s = this.agents.get(state.agentId)
          if (!s) return
          s.behaviour = 'CHATTING'
          // Phone animation for chatting
          const hasPhone = this.textures.exists(`char-${char}-phone`)
          this.playAnim(s, hasPhone ? `${char}-phone` : `${char}-idle`)
          const phrase = Phaser.Utils.Array.GetRandom(AGENT_PHRASES.CHATTING) ?? '...'
          this.showBubble(state.agentId, phrase)
        })
        break
      }

      case 'SMOKING': {
        this.updateDeskComputer(state.agentId, false)
        const smokeSpot = Phaser.Utils.Array.GetRandom(ZONE_SPOTS.smoking) ??
          { x: 1450, y: 680 }
        this.walkTo(state, smokeSpot.x, smokeSpot.y, () => {
          const s = this.agents.get(state.agentId)
          if (!s) return
          s.behaviour = 'WANDERING'
          this.playAnim(s, `${char}-idle`)
          this.showBubble(state.agentId, Phaser.Utils.Array.GetRandom(AGENT_PHRASES.SMOKING) ?? '...')
        })
        break
      }

      case 'RESTING': {
        this.updateDeskComputer(state.agentId, false)
        const loungeSpot = Phaser.Utils.Array.GetRandom(ZONE_SPOTS.lounge) ??
          { x: 850, y: 650 }
        this.walkTo(state, loungeSpot.x, loungeSpot.y, () => {
          const s = this.agents.get(state.agentId)
          if (!s) return
          s.behaviour = 'WANDERING'
          // Sit2 or sit3 for resting
          const hasSit2 = this.textures.exists(`char-${char}-sit2`)
          this.playAnim(s, hasSit2 ? `${char}-sit2` : `${char}-idle`)
          this.showHeadEmoji(state.agentId, Phaser.Utils.Array.GetRandom(['💤', '😴']) ?? '💤')
        })
        break
      }

      default: {
        this.playAnim(state, `${char}-idle`)
        break
      }
    }
  }

  // ── Wander logic ──────────────────────────────────────────────────────────

  private scheduleWander(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    const delay = Phaser.Math.Between(30000, 90000)
    state.wanderTimer = this.time.delayedCall(delay, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState === 'WORKING' || s.presenceState === 'BUSY') return
      this.doWander(agentId, () => this.scheduleWander(agentId))
    })
  }

  private doWander(agentId: string, onDone: () => void) {
    const state = this.agents.get(agentId)
    if (!state) return

    const zoneKeys = Object.keys(ZONE_SPOTS)
    const targetZone = Phaser.Utils.Array.GetRandom(zoneKeys) as string
    const spots = ZONE_SPOTS[targetZone]
    const spot = Phaser.Utils.Array.GetRandom(spots)

    this.walkTo(state, spot.x, spot.y, () => {
      const s = this.agents.get(agentId)
      if (!s) return

      s.behaviour = 'WANDERING'

      if (Math.random() < 0.4) {
        const presencePhrases = AGENT_PHRASES[s.presenceState] ?? AGENT_PHRASES.IDLE
        const phrase = Phaser.Utils.Array.GetRandom(presencePhrases) ?? '...'
        this.showBubble(agentId, phrase)
      }

      const standDelay = Phaser.Math.Between(15000, 45000)
      s.wanderTimer = this.time.delayedCall(standDelay, () => {
        const ss = this.agents.get(agentId)
        if (!ss || ss.presenceState === 'WORKING') { onDone(); return }

        if (Math.random() < 0.5) {
          this.walkTo(ss, ss.deskX, ss.deskY, () => {
            const sss = this.agents.get(agentId)
            if (!sss) return
            sss.behaviour = 'AT_DESK'
            this.playAnim(sss, `${sss.charKey}-idle`)
            onDone()
          })
        } else {
          this.doWander(agentId, onDone)
        }
      })
    })
  }

  // ── Walk to position ──────────────────────────────────────────────────────

  private walkTo(state: AgentState, tx: number, ty: number, onComplete?: () => void) {
    state.behaviour = 'WALKING'

    const dx = tx - state.currentX
    const char = state.charKey

    // Choose walk direction animation
    let animKey: string
    if (Math.abs(dx) > 10) {
      animKey = dx > 0 ? `${char}-walk-right` : `${char}-walk-left`
    } else {
      animKey = ty > state.currentY ? `${char}-walk-down` : `${char}-walk-up`
    }

    // Try run anim, fallback to walk, then idle
    const runKey = `${char}-run`
    const useKey = this.textures.exists(runKey) ? runKey : (this.anims.exists(animKey) ? animKey : `${char}-idle`)
    this.playAnim(state, useKey)

    const dist = Phaser.Math.Distance.Between(state.currentX, state.currentY, tx, ty)
    const duration = Math.max(400, dist * 2.5)

    this.tweens.killTweensOf(state.container)
    this.tweens.add({
      targets: state.container,
      x: tx, y: ty,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        state.currentX = state.container.x
        state.currentY = state.container.y
        // Flip sprite based on movement direction
        if (state.container.x < tx) {
          state.sprite.setFlipX(false)
        } else if (state.container.x > tx) {
          state.sprite.setFlipX(true)
        }
      },
      onComplete: () => {
        state.currentX = tx
        state.currentY = ty
        if (onComplete) onComplete()
      },
    })
  }

  // ── Play animation safely ─────────────────────────────────────────────────

  private playAnim(state: AgentState, animKey: string) {
    if (state.currentAnim === animKey) return
    if (!this.anims.exists(animKey)) {
      // Fallback: try idle
      const idleKey = `${state.charKey}-idle`
      if (this.anims.exists(idleKey) && state.currentAnim !== idleKey) {
        state.sprite.play(idleKey)
        state.currentAnim = idleKey
      }
      return
    }
    state.sprite.play(animKey)
    state.currentAnim = animKey
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────

  showBubble(agentId: string, text: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    // Destroy existing bubble
    if (state.bubble) {
      state.bubble.destroy()
      state.bubble = null
    }
    if (state.bubbleTimer) {
      state.bubbleTimer.destroy()
      state.bubbleTimer = null
    }

    // Truncate and wrap text
    const maxLen = 120
    let safeText = text.slice(0, maxLen)
    if (text.length > maxLen) safeText += '...'

    // Wrap at 30 chars
    const words = safeText.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 30) {
        if (line) lines.push(line.trim())
        line = word
      } else {
        line = (line + ' ' + word).trim()
      }
    }
    if (line) lines.push(line.trim())

    const wrappedText = lines.join('\n')
    const lineCount = lines.length

    const bubbleW = 130
    const bubbleH = 14 + lineCount * 13
    const bubbleX = -bubbleW / 2
    const bubbleY = -70 - bubbleH

    // Background
    const bg = this.add.graphics()
    bg.fillStyle(0xfff8dc, 0.96)
    bg.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 6)
    bg.lineStyle(1, 0x89b4fa, 0.8)
    bg.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 6)

    // Tail
    bg.fillStyle(0xfff8dc, 0.96)
    bg.fillTriangle(-6, bubbleY + bubbleH, 6, bubbleY + bubbleH, 0, bubbleY + bubbleH + 10)

    // Text
    const label = this.add.text(0, bubbleY + 7, wrappedText, {
      fontSize: '10px',
      color: '#1a1a2e',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5, 0)

    const bubble = this.add.container(0, 0, [bg, label])
    bubble.setDepth(20)
    state.container.add(bubble)
    state.bubble = bubble

    // Auto-dismiss after 4 seconds
    state.bubbleTimer = this.time.delayedCall(4000, () => {
      const s = this.agents.get(agentId)
      if (s?.bubble) {
        this.tweens.add({
          targets: s.bubble,
          alpha: 0, y: -20,
          duration: 400, ease: 'Quad.easeIn',
          onComplete: () => {
            s.bubble?.destroy()
            s.bubble = null
          },
        })
      }
    })
  }

  // Schedule random bubbles for agents
  private scheduleBubble(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    const delay = Phaser.Math.Between(30000, 90000)
    state.bubbleScheduleTimer = this.time.delayedCall(delay, () => {
      const s = this.agents.get(agentId)
      if (!s) return

      const phrases = AGENT_PHRASES[s.presenceState] ?? AGENT_PHRASES.IDLE
      const phrase = Phaser.Utils.Array.GetRandom(phrases)
      if (phrase) this.showBubble(agentId, phrase)

      this.scheduleBubble(agentId)
    })
  }

  // ── Head emoji ────────────────────────────────────────────────────────────

  private showHeadEmoji(agentId: string, emojiChar: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    if (state.emoji) {
      state.emoji.destroy()
      state.emoji = null
    }

    const em = this.add.text(0, -60, emojiChar, {
      fontSize: '18px',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(20)
    state.container.add(em)
    state.emoji = em

    this.tweens.add({
      targets: em,
      y: -80, alpha: 0,
      duration: 2500, ease: 'Quad.easeOut',
      onComplete: () => {
        em.destroy()
        const s = this.agents.get(agentId)
        if (s) s.emoji = null
      },
    })
  }

  // ── Schedule work emoji ───────────────────────────────────────────────────

  private scheduleWorkEmoji(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state || state.presenceState !== 'WORKING') return

    const delay = Phaser.Math.Between(10000, 25000)
    state.emojiTimer = this.time.delayedCall(delay, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState !== 'WORKING') return
      const em = Phaser.Utils.Array.GetRandom(['💻', '🔧', '📊', '🚀', '⚡', '🔍'])
      if (em) this.showHeadEmoji(agentId, em)
      this.scheduleWorkEmoji(agentId)
    })
  }

  // ── Mobile controls ───────────────────────────────────────────────────────

  private setupMobileControls(): void {
    const cam = this.cameras.main
    const MIN_ZOOM = 0.5
    const MAX_ZOOM = 2.5
    const INITIAL_ZOOM = cam.zoom

    let lastPinchDist = 0
    let isPinching = false
    let panStartX = 0
    let panStartY = 0
    let camStartScrollX = 0
    let camStartScrollY = 0

    const getDistance = (p1: Touch, p2: Touch): number => {
      const dx = p1.clientX - p2.clientX
      const dy = p1.clientY - p2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const canvas = this.game.canvas

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true
        lastPinchDist = getDistance(e.touches[0], e.touches[1])
      } else if (e.touches.length === 1) {
        isPinching = false
        panStartX = e.touches[0].clientX
        panStartY = e.touches[0].clientY
        camStartScrollX = cam.scrollX
        camStartScrollY = cam.scrollY
      }
    }, { passive: true })

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 2 && isPinching) {
        const dist = getDistance(e.touches[0], e.touches[1])
        const scale = dist / lastPinchDist
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * scale))
        cam.setZoom(newZoom)
        lastPinchDist = dist
      } else if (e.touches.length === 1 && !isPinching) {
        const dx = (e.touches[0].clientX - panStartX) / cam.zoom
        const dy = (e.touches[0].clientY - panStartY) / cam.zoom
        cam.setScroll(camStartScrollX - dx, camStartScrollY - dy)
      }
    }, { passive: false })

    canvas.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false
        if (e.touches.length === 1) {
          panStartX = e.touches[0].clientX
          panStartY = e.touches[0].clientY
          camStartScrollX = cam.scrollX
          camStartScrollY = cam.scrollY
        }
      }
    }, { passive: true })

    let lastTap = 0
    canvas.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length === 0) {
        const now = Date.now()
        if (now - lastTap < 300) {
          cam.setZoom(INITIAL_ZOOM)
          cam.setScroll(0, 0)
        }
        lastTap = now
      }
    }, { passive: true })
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────

  shutdown() {
    eventBridge.off('agent:added')
    eventBridge.off('agent:moved')
    eventBridge.off('agent:update')
    eventBridge.off('agent:say')
    eventBridge.off('scene:sync')

    if (this.smokeTimer) this.smokeTimer.destroy()

    this.agents.forEach((state) => {
      if (state.wanderTimer) state.wanderTimer.destroy()
      if (state.emojiTimer) state.emojiTimer.destroy()
      if (state.bubbleTimer) state.bubbleTimer.destroy()
      if (state.bubbleScheduleTimer) state.bubbleScheduleTimer.destroy()
    })

    this.deskComputerIcons.forEach((arc) => arc.destroy())
    this.deskComputerIcons.clear()
    this.agents.clear()
  }
}
