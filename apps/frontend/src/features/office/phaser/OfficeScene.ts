import Phaser from 'phaser'
import { eventBridge } from './eventBridge'
import type { AgentEntry } from '../officeStore'

// ─── Constants ────────────────────────────────────────────────────────────────

const WORLD_W = 1800
const WORLD_H = 900

// Zone definitions (world coords)
interface ZoneDef {
  key: string
  label: string
  x: number
  y: number
  w: number
  h: number
  floorColor: number
  floorAlt: number
  accentColor: number
}

const ZONES: ZoneDef[] = [
  {
    key: 'work',
    label: '💼 Рабочая зона',
    x: 60, y: 60, w: 820, h: 380,
    floorColor: 0x2a2d3e, floorAlt: 0x252836,
    accentColor: 0x89b4fa,
  },
  {
    key: 'meeting',
    label: '📋 Переговорная',
    x: 940, y: 60, w: 360, h: 380,
    floorColor: 0x2d2a3e, floorAlt: 0x28253a,
    accentColor: 0xcba6f7,
  },
  {
    key: 'chat',
    label: '💬 Болталка',
    x: 1360, y: 60, w: 380, h: 380,
    floorColor: 0x1e2d3b, floorAlt: 0x1a2635,
    accentColor: 0x89dceb,
  },
  {
    key: 'rest',
    label: '🎮 Комната отдыха',
    x: 60, y: 500, w: 520, h: 340,
    floorColor: 0x1e3a2a, floorAlt: 0x1a3325,
    accentColor: 0xa6e3a1,
  },
  {
    key: 'smoking',
    label: '🚬 Курилка',
    x: 640, y: 500, w: 300, h: 340,
    floorColor: 0x2a2a2a, floorAlt: 0x252525,
    accentColor: 0x9b9b9b,
  },
  {
    key: 'lounge',
    label: '☕ Лаундж',
    x: 1000, y: 500, w: 740, h: 340,
    floorColor: 0x3b2e1e, floorAlt: 0x352a1a,
    accentColor: 0xfab387,
  },
]

// Desk positions in work zone (world coords)
const DESKS: { x: number; y: number; agentKey: string }[] = [
  { x: 120, y: 130, agentKey: 'DIRECTOR' },
  { x: 270, y: 130, agentKey: 'FINANCIER' },
  { x: 420, y: 130, agentKey: 'MANAGER' },
  { x: 570, y: 130, agentKey: 'ARCHIVIST' },
  { x: 720, y: 130, agentKey: 'WORKER' },
  { x: 120, y: 280, agentKey: '' },
  { x: 270, y: 280, agentKey: '' },
  { x: 420, y: 280, agentKey: '' },
]

const ROLE_DESK: Record<string, { x: number; y: number }> = {
  DIRECTOR:  { x: 120, y: 145 },
  FINANCIER: { x: 270, y: 145 },
  MANAGER:   { x: 420, y: 145 },
  ARCHIVIST: { x: 570, y: 145 },
  WORKER:    { x: 720, y: 145 },
}

// Wander spots per zone
const ZONE_SPOTS: Record<string, { x: number; y: number }[]> = {
  smoking: [
    { x: 755, y: 620 }, { x: 790, y: 670 }, { x: 730, y: 700 }, { x: 810, y: 710 },
  ],
  rest: [
    { x: 150, y: 620 }, { x: 250, y: 640 }, { x: 160, y: 700 }, { x: 310, y: 690 }, { x: 400, y: 650 },
  ],
  chat: [
    { x: 1420, y: 150 }, { x: 1500, y: 180 }, { x: 1580, y: 140 }, { x: 1460, y: 230 }, { x: 1620, y: 250 },
  ],
  meeting: [
    { x: 1000, y: 200 }, { x: 1100, y: 220 }, { x: 1200, y: 200 }, { x: 1050, y: 320 }, { x: 1150, y: 320 },
  ],
  lounge: [
    { x: 1100, y: 620 }, { x: 1200, y: 660 }, { x: 1350, y: 630 }, { x: 1500, y: 650 }, { x: 1600, y: 700 },
  ],
}

// ─── Avatar definitions ───────────────────────────────────────────────────────

interface AvatarDef {
  key: string
  role: string
  skinColor: number
  hairColor: number
  bodyColor: number
  bodyAlt: number
  pantsColor: number
  shoeColor: number
  accessory: 'glasses' | 'cap' | 'beret' | 'earrings' | 'headphones' | 'none'
  accessoryColor: number
  extra: 'folder' | 'phone' | 'none'
}

const AVATAR_DEFS: AvatarDef[] = [
  {
    key: 'DIRECTOR',
    role: 'DIRECTOR',
    skinColor: 0xf4c2a1,
    hairColor: 0x1a1a1a,
    bodyColor: 0x1a1a2e,
    bodyAlt: 0x16213e,
    pantsColor: 0x1a1a2e,
    shoeColor: 0x111111,
    accessory: 'earrings',
    accessoryColor: 0xffd700,
    extra: 'none',
  },
  {
    key: 'FINANCIER',
    role: 'FINANCIER',
    skinColor: 0xfdd9b5,
    hairColor: 0x8b4513,
    bodyColor: 0x2d7a3a,
    bodyAlt: 0x256230,
    pantsColor: 0x2c3e50,
    shoeColor: 0x4a3728,
    accessory: 'glasses',
    accessoryColor: 0x444444,
    extra: 'folder',
  },
  {
    key: 'MANAGER',
    role: 'MANAGER',
    skinColor: 0xf5d5a8,
    hairColor: 0x2c1810,
    bodyColor: 0x4a6fa5,
    bodyAlt: 0x3a5f95,
    pantsColor: 0x2c3e50,
    shoeColor: 0x333333,
    accessory: 'headphones',
    accessoryColor: 0x333333,
    extra: 'none',
  },
  {
    key: 'ARCHIVIST',
    role: 'ARCHIVIST',
    skinColor: 0xead5b3,
    hairColor: 0x4a3728,
    bodyColor: 0x8b4513,
    bodyAlt: 0x6b3410,
    pantsColor: 0x2f4f2f,
    shoeColor: 0x3d2b1f,
    accessory: 'beret',
    accessoryColor: 0x4a3728,
    extra: 'none',
  },
  {
    key: 'WORKER',
    role: 'WORKER',
    skinColor: 0xf0c27f,
    hairColor: 0x1a1a1a,
    bodyColor: 0xe74c3c,
    bodyAlt: 0xc0392b,
    pantsColor: 0x1a1a2e,
    shoeColor: 0xffffff,
    accessory: 'cap',
    accessoryColor: 0x2c3e50,
    extra: 'phone',
  },
]

// ─── Agent state ──────────────────────────────────────────────────────────────

type BehaviourState = 'AT_DESK' | 'WALKING' | 'WANDERING' | 'CHATTING' | 'PULSING'

interface AgentState {
  agentId: string
  role: string
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
  walkFrame: number
  frameTimer: Phaser.Time.TimerEvent | null
  currentX: number
  currentY: number
  deskX: number
  deskY: number
  facingRight: boolean
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, AgentState>()
  private smokeParticles: { x: number; y: number; alpha: number; vy: number; obj: Phaser.GameObjects.Arc }[] = []
  private smokeTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super({ key: 'OfficeScene' })
  }

  preload() {
    // nothing — textures generated procedurally in create()
  }

  // ── Avatar texture generation ──────────────────────────────────────────────

  private generateAvatarTexture(def: AvatarDef) {
    // 2 frames: walk0 (standing) and walk1 (walking)
    for (let frame = 0; frame < 2; frame++) {
      const key = `avatar_${def.key}_${frame}`
      if (this.textures.exists(key)) continue

      const rt = this.add.renderTexture(0, 0, 32, 48)
      rt.setVisible(false)

      const g = this.add.graphics()
      g.clear()

      const W = 32
      const headCX = W / 2
      const headCY = 10
      const headR = 8

      // ── BODY (torso) ──
      g.fillStyle(def.bodyColor, 1)
      g.fillRect(10, 18, 12, 14)
      // collar / lapel
      g.fillStyle(def.bodyAlt, 1)
      g.fillRect(13, 18, 2, 6)
      g.fillRect(17, 18, 2, 6)

      // ── LEGS ──
      g.fillStyle(def.pantsColor, 1)
      if (frame === 0) {
        // Standing: legs together
        g.fillRect(10, 32, 5, 10)
        g.fillRect(17, 32, 5, 10)
      } else {
        // Walking: legs apart
        g.fillRect(9, 32, 5, 9)
        g.fillRect(18, 32, 5, 9)
        g.fillRect(8, 40, 5, 2)
        g.fillRect(19, 40, 5, 2)
      }

      // ── SHOES ──
      g.fillStyle(def.shoeColor, 1)
      if (frame === 0) {
        g.fillRect(9, 41, 6, 3)
        g.fillRect(17, 41, 6, 3)
      } else {
        g.fillRect(7, 41, 7, 3)
        g.fillRect(18, 41, 7, 3)
      }

      // ── ARMS ──
      g.fillStyle(def.bodyColor, 1)
      if (frame === 0) {
        g.fillRect(6, 19, 4, 10)   // left arm
        g.fillRect(22, 19, 4, 10)  // right arm
      } else {
        g.fillRect(5, 20, 4, 9)
        g.fillRect(23, 20, 4, 9)
      }

      // ── HANDS ──
      g.fillStyle(def.skinColor, 1)
      if (frame === 0) {
        g.fillRect(6, 29, 4, 3)
        g.fillRect(22, 29, 4, 3)
      } else {
        g.fillRect(5, 29, 4, 3)
        g.fillRect(23, 29, 4, 3)
      }

      // ── EXTRA (phone / folder) ──
      if (def.extra === 'phone') {
        g.fillStyle(0x1a1a1a, 1)
        g.fillRect(23, 22, 3, 5)
        g.fillStyle(0x89dceb, 0.8)
        g.fillRect(24, 23, 1, 3)
      } else if (def.extra === 'folder') {
        g.fillStyle(0xf39c12, 1)
        g.fillRect(4, 20, 5, 7)
        g.fillStyle(0xe67e22, 1)
        g.fillRect(4, 20, 5, 1)
      }

      // ── NECK ──
      g.fillStyle(def.skinColor, 1)
      g.fillRect(14, 14, 4, 5)

      // ── HEAD ──
      g.fillStyle(def.skinColor, 1)
      g.fillCircle(headCX, headCY, headR)

      // ── HAIR ──
      g.fillStyle(def.hairColor, 1)
      // Female styles: fuller hair
      if (def.key === 'DIRECTOR') {
        // Bob / kare
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 6)
        g.fillRect(headCX - headR - 2, headCY - 4, 4, 10)
        g.fillRect(headCX + headR - 2, headCY - 4, 4, 10)
      } else if (def.key === 'FINANCIER') {
        // Ponytail
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 5)
        g.fillRect(headCX + 4, headCY - 6, 3, 12) // tail
      } else if (def.key === 'MANAGER') {
        // Short hair
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 4)
      } else if (def.key === 'ARCHIVIST') {
        // Medium hair + beard
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 4)
        g.fillRect(headCX - 4, headCY + 4, 8, 4) // beard
      } else if (def.key === 'WORKER') {
        // Short under cap
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 3)
      }

      // ── FACE: eyes ──
      g.fillStyle(0x1a1a1a, 1)
      g.fillRect(headCX - 4, headCY, 2, 2)  // left eye
      g.fillRect(headCX + 2, headCY, 2, 2)  // right eye

      // ── FACE: smile ──
      g.fillStyle(0xcc8866, 1)
      g.fillRect(headCX - 2, headCY + 4, 4, 1)

      // ── ACCESSORIES ──
      if (def.accessory === 'glasses') {
        g.lineStyle(1, def.accessoryColor, 1)
        g.strokeRect(headCX - 5, headCY - 1, 4, 3)
        g.strokeRect(headCX + 1, headCY - 1, 4, 3)
        g.moveTo(headCX - 1, headCY + 1)
        g.lineTo(headCX + 1, headCY + 1)
        g.strokePath()
      } else if (def.accessory === 'cap') {
        g.fillStyle(def.accessoryColor, 1)
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 5)
        g.fillRect(headCX - headR - 2, headCY - headR + 4, headR * 2 + 4, 2) // brim
      } else if (def.accessory === 'beret') {
        g.fillStyle(def.accessoryColor, 1)
        g.fillCircle(headCX, headCY - headR + 3, headR)
        g.fillRect(headCX - headR, headCY - headR + 3, headR * 2, 4)
      } else if (def.accessory === 'earrings') {
        g.fillStyle(def.accessoryColor, 1)
        g.fillCircle(headCX - headR, headCY + 2, 2)
        g.fillCircle(headCX + headR, headCY + 2, 2)
      } else if (def.accessory === 'headphones') {
        g.fillStyle(def.accessoryColor, 1)
        g.fillRect(headCX - headR - 1, headCY - 3, 3, 6)
        g.fillRect(headCX + headR - 2, headCY - 3, 3, 6)
        g.lineStyle(2, def.accessoryColor, 1)
        g.beginPath()
        g.arc(headCX, headCY - 2, headR + 1, Math.PI, 0, false)
        g.strokePath()
        // headphones around neck
        g.fillStyle(def.accessoryColor, 1)
        g.fillRect(headCX - 4, 17, 8, 2)
      }

      rt.draw(g, 0, 0)
      rt.saveTexture(key)
      g.destroy()
      rt.destroy()
    }
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  create() {
    // Generate avatar textures first (must be in create, not preload)
    for (const def of AVATAR_DEFS) {
      this.generateAvatarTexture(def)
    }

    // World bounds
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBackgroundColor(0x0f0f1a)

    this.drawWorld()
    this.setupCamera()
    this.setupSmoke()
    this.setupBridge()
  }

  // ── World drawing ──────────────────────────────────────────────────────────

  private drawWorld() {
    // Background
    const bg = this.add.graphics()
    bg.fillStyle(0x0f0f1a, 1)
    bg.fillRect(0, 0, WORLD_W, WORLD_H)

    // Office outer walls (thick border)
    bg.lineStyle(6, 0x4a4a6e, 1)
    bg.strokeRect(30, 30, WORLD_W - 60, WORLD_H - 60)
    // Inner wall fill (wall color)
    bg.fillStyle(0x1a1a2e, 1)
    bg.fillRect(30, 30, WORLD_W - 60, WORLD_H - 60)

    // Floor zones
    for (const zone of ZONES) {
      this.drawZoneFloor(zone)
    }

    // Decor elements
    this.drawWorkZoneDecor()
    this.drawMeetingDecor()
    this.drawChatDecor()
    this.drawRestDecor()
    this.drawSmokingDecor()
    this.drawLoungeDecor()

    // Perimeter decor (plants, posters, lamps)
    this.drawPerimeterDecor()

    // Zone labels
    for (const zone of ZONES) {
      this.add.text(zone.x + 8, zone.y + 6, zone.label, {
        fontSize: '11px',
        color: '#' + zone.accentColor.toString(16).padStart(6, '0'),
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setDepth(2).setAlpha(0.9)
    }
  }

  private drawZoneFloor(zone: ZoneDef) {
    const g = this.add.graphics()
    g.setDepth(0)

    const tileSize = 32

    // Clip to zone
    // Draw checkerboard tiles
    for (let ty = 0; ty < zone.h; ty += tileSize) {
      for (let tx = 0; tx < zone.w; tx += tileSize) {
        const col = Math.floor(tx / tileSize)
        const row = Math.floor(ty / tileSize)
        const isAlt = (col + row) % 2 === 1
        g.fillStyle(isAlt ? zone.floorAlt : zone.floorColor, 1)
        g.fillRect(zone.x + tx, zone.y + ty,
          Math.min(tileSize, zone.w - tx),
          Math.min(tileSize, zone.h - ty))
      }
    }

    // Subtle tile grout lines
    g.lineStyle(1, 0x0a0a14, 0.5)
    for (let ty = 0; ty <= zone.h; ty += tileSize) {
      g.moveTo(zone.x, zone.y + ty)
      g.lineTo(zone.x + zone.w, zone.y + ty)
    }
    for (let tx = 0; tx <= zone.w; tx += tileSize) {
      g.moveTo(zone.x + tx, zone.y)
      g.lineTo(zone.x + tx, zone.y + zone.h)
    }
    g.strokePath()

    // Zone border accent
    g.lineStyle(2, zone.accentColor, 0.3)
    g.strokeRect(zone.x, zone.y, zone.w, zone.h)
  }

  private drawWorkZoneDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // 5 desks with monitors
    for (const desk of DESKS.slice(0, 5)) {
      // Desk surface
      g.fillStyle(0x3a3a5a, 1)
      g.fillRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
      g.lineStyle(1, 0x5a5a8a, 0.8)
      g.strokeRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)

      // Monitor stand
      g.fillStyle(0x1a1a2e, 1)
      g.fillRect(desk.x - 3, desk.y - 22, 6, 4)

      // Monitor screen
      g.fillStyle(0x111122, 1)
      g.fillRoundedRect(desk.x - 22, desk.y - 38, 44, 26, 3)
      g.lineStyle(2, 0x4a4a7a, 1)
      g.strokeRoundedRect(desk.x - 22, desk.y - 38, 44, 26, 3)

      // Screen glow (randomize per desk for variety)
      const glowColors = [0x89b4fa, 0xa6e3a1, 0xcba6f7, 0xf9e2af, 0x89dceb]
      const idx = DESKS.indexOf(desk)
      g.fillStyle(glowColors[idx % glowColors.length], 0.3)
      g.fillRect(desk.x - 20, desk.y - 36, 40, 22)

      // Keyboard
      g.fillStyle(0x2a2a4a, 1)
      g.fillRoundedRect(desk.x - 18, desk.y - 6, 36, 10, 2)

      // Mouse
      g.fillStyle(0x3a3a5a, 1)
      g.fillEllipse(desk.x + 22, desk.y - 3, 8, 12)
    }

    // Additional desks (bottom row) - empty
    for (const desk of DESKS.slice(5)) {
      g.fillStyle(0x3a3a5a, 0.7)
      g.fillRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
      g.lineStyle(1, 0x5a5a8a, 0.5)
      g.strokeRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
    }

    // Rug under work area
    g.fillStyle(0x1e2040, 0.4)
    g.fillRoundedRect(80, 95, 800, 340, 8)
  }

  private drawMeetingDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Oval conference table
    g.fillStyle(0x4a3a2a, 1)
    g.fillEllipse(1120, 250, 280, 140)
    g.lineStyle(3, 0xcba6f7, 0.6)
    g.strokeEllipse(1120, 250, 280, 140)

    // Table surface sheen
    g.fillStyle(0x5a4a3a, 0.5)
    g.fillEllipse(1110, 240, 240, 110)

    // Chairs around table
    const chairPositions = [
      { x: 990, y: 250 }, { x: 1250, y: 250 },
      { x: 1020, y: 185 }, { x: 1120, y: 170 }, { x: 1220, y: 185 },
      { x: 1020, y: 315 }, { x: 1120, y: 330 }, { x: 1220, y: 315 },
    ]
    for (const cp of chairPositions) {
      g.fillStyle(0x3a2a4a, 1)
      g.fillEllipse(cp.x, cp.y, 26, 22)
      g.lineStyle(1, 0xcba6f7, 0.4)
      g.strokeEllipse(cp.x, cp.y, 26, 22)
    }

    // Whiteboard on north wall
    g.fillStyle(0xe8e8f0, 1)
    g.fillRoundedRect(950, 68, 340, 65, 4)
    g.lineStyle(2, 0xcba6f7, 0.8)
    g.strokeRoundedRect(950, 68, 340, 65, 4)
    // Whiteboard content (lines)
    g.lineStyle(1, 0xcba6f7, 0.5)
    for (let i = 0; i < 3; i++) {
      g.moveTo(960, 82 + i * 14)
      g.lineTo(1050 + Math.random() * 100, 82 + i * 14)
    }
    g.strokePath()
    // Chart on whiteboard
    g.fillStyle(0x89b4fa, 0.7)
    g.fillRect(1150, 75, 20, 30)
    g.fillStyle(0xa6e3a1, 0.7)
    g.fillRect(1175, 82, 20, 23)
    g.fillStyle(0xcba6f7, 0.7)
    g.fillRect(1200, 78, 20, 27)
    g.fillStyle(0xf9e2af, 0.7)
    g.fillRect(1225, 85, 20, 20)
    g.fillStyle(0xf38ba8, 0.7)
    g.fillRect(1250, 79, 20, 26)

    // Projector screen
    g.fillStyle(0x1a1a1a, 0.9)
    g.fillRect(1275, 115, 20, 16)
    g.fillStyle(0xcba6f7, 0.3)
    g.fillRect(1277, 117, 16, 12)
  }

  private drawChatDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Water cooler
    g.fillStyle(0x4a6fa5, 1)
    g.fillRoundedRect(1660, 90, 30, 55, 4)
    g.fillStyle(0x89dceb, 0.8)
    g.fillRoundedRect(1663, 93, 24, 35, 3)
    g.fillStyle(0x3a5f95, 1)
    g.fillRect(1668, 128, 14, 8)
    // Water cooler spout
    g.fillStyle(0x2a4f85, 1)
    g.fillRect(1673, 130, 4, 5)

    // High stools / bar table
    g.fillStyle(0x3a3a5a, 1)
    g.fillRoundedRect(1380, 90, 200, 60, 6)
    g.lineStyle(1, 0x89dceb, 0.4)
    g.strokeRoundedRect(1380, 90, 200, 60, 6)
    // Stools
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x2a2a4a, 1)
      g.fillEllipse(1400 + i * 50, 160, 24, 18)
      g.fillStyle(0x4a4a6a, 1)
      g.fillRect(1397 + i * 50, 140, 6, 20)
    }

    // Sofas / bean bags
    g.fillStyle(0x2a4a5a, 1)
    g.fillRoundedRect(1380, 250, 100, 50, 8)
    g.fillRoundedRect(1500, 250, 100, 50, 8)
    g.lineStyle(1, 0x89dceb, 0.3)
    g.strokeRoundedRect(1380, 250, 100, 50, 8)
    g.strokeRoundedRect(1500, 250, 100, 50, 8)

    // Coffee table between sofas
    g.fillStyle(0x3a2a1a, 1)
    g.fillRoundedRect(1430, 280, 60, 25, 4)
    // Coffee cups
    g.fillStyle(0xfab387, 0.8)
    g.fillCircle(1445, 292, 5)
    g.fillCircle(1460, 288, 5)
    g.fillCircle(1475, 292, 5)
  }

  private drawRestDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Big sofa L-shape
    g.fillStyle(0x2a4a3a, 1)
    g.fillRoundedRect(80, 540, 200, 70, 8)  // main
    g.fillRoundedRect(80, 540, 60, 120, 8)  // side
    g.lineStyle(1, 0xa6e3a1, 0.4)
    g.strokeRoundedRect(80, 540, 200, 70, 8)
    g.strokeRoundedRect(80, 540, 60, 120, 8)

    // TV / console screen
    g.fillStyle(0x111122, 1)
    g.fillRoundedRect(320, 525, 220, 120, 6)
    g.lineStyle(2, 0xa6e3a1, 0.6)
    g.strokeRoundedRect(320, 525, 220, 120, 6)
    // Screen content (game)
    g.fillStyle(0x0a0a1a, 1)
    g.fillRect(325, 530, 210, 110)
    g.fillStyle(0xa6e3a1, 0.8)
    g.fillRect(390, 545, 10, 70)  // left paddle
    g.fillRect(540, 545, 10, 70)  // right paddle
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(460, 585, 12, 12)  // ball (pong)

    // TV stand
    g.fillStyle(0x2a2a4a, 1)
    g.fillRect(400, 645, 60, 12)
    g.fillRect(420, 657, 20, 8)

    // Gaming chair
    g.fillStyle(0x1a3a2a, 1)
    g.fillRoundedRect(200, 575, 80, 65, 6)
    g.lineStyle(1, 0xa6e3a1, 0.3)
    g.strokeRoundedRect(200, 575, 80, 65, 6)

    // Hookah / кальян
    g.fillStyle(0x4a3a2a, 1)
    g.fillRect(525, 640, 14, 80)   // tube
    g.fillStyle(0x8B4513, 1)
    g.fillEllipse(532, 700, 50, 30) // base
    g.fillStyle(0x2a1a0a, 1)
    g.fillEllipse(532, 640, 30, 20) // bowl
    g.fillStyle(0x89dceb, 0.5)
    g.fillEllipse(532, 650, 22, 14)
    // hose (simplified - no bezier, use line segments)
    g.lineStyle(3, 0x4a3a2a, 1)
    g.moveTo(525, 680)
    g.lineTo(500, 700)
    g.lineTo(480, 720)
    g.lineTo(490, 730)
    g.strokePath()

    // Rug
    g.fillStyle(0x1a3a2a, 0.4)
    g.fillEllipse(260, 640, 350, 200)
    g.lineStyle(2, 0xa6e3a1, 0.2)
    g.strokeEllipse(260, 640, 350, 200)
  }

  private drawSmokingDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Ashtray stand
    g.fillStyle(0x3a3a3a, 1)
    g.fillRect(776, 590, 8, 60)
    g.fillStyle(0x5a5a5a, 1)
    g.fillEllipse(780, 650, 50, 20)
    g.fillStyle(0x2a2a2a, 1)
    g.fillEllipse(780, 650, 36, 14)

    // Small outdoor bench (dark metal)
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(650, 640, 120, 30, 4)
    g.lineStyle(1, 0x4a4a4a, 0.8)
    g.strokeRoundedRect(650, 640, 120, 30, 4)
    // Bench legs
    g.lineStyle(3, 0x2a2a2a, 1)
    g.moveTo(660, 670); g.lineTo(655, 700)
    g.moveTo(760, 670); g.lineTo(755, 700)
    g.strokePath()

    // Second bench
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(820, 640, 100, 30, 4)

    // "No Smoking" sign (ironic)
    g.fillStyle(0x3a3a3a, 1)
    g.fillRoundedRect(875, 510, 60, 36, 4)
    g.fillStyle(0xf38ba8, 0.8)
    g.fillCircle(905, 528, 14)
    g.lineStyle(2, 0x1a1a1a, 1)
    g.moveTo(895, 518); g.lineTo(915, 538)
    g.strokePath()

    // Dark rug
    g.fillStyle(0x1a1a1a, 0.5)
    g.fillRect(650, 515, 280, 310)
    g.lineStyle(1, 0x3a3a3a, 0.5)
    g.strokeRect(650, 515, 280, 310)
  }

  private drawLoungeDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Long dining table
    g.fillStyle(0x4a3a1a, 1)
    g.fillRoundedRect(1020, 545, 520, 80, 6)
    g.lineStyle(2, 0xfab387, 0.5)
    g.strokeRoundedRect(1020, 545, 520, 80, 6)

    // Chairs around dining table
    const diningChairs = [
      { x: 1040, y: 540 }, { x: 1110, y: 540 }, { x: 1180, y: 540 },
      { x: 1250, y: 540 }, { x: 1320, y: 540 }, { x: 1390, y: 540 },
      { x: 1040, y: 635 }, { x: 1110, y: 635 }, { x: 1180, y: 635 },
      { x: 1250, y: 635 }, { x: 1320, y: 635 }, { x: 1390, y: 635 },
    ]
    for (const c of diningChairs) {
      g.fillStyle(0x3a2a0a, 1)
      g.fillRoundedRect(c.x - 15, c.y - 8, 30, 22, 3)
      g.lineStyle(1, 0xfab387, 0.3)
      g.strokeRoundedRect(c.x - 15, c.y - 8, 30, 22, 3)
    }

    // Dishes on table
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0xe8e8e0, 0.9)
      g.fillEllipse(1060 + i * 90, 585, 30, 22)
      g.fillStyle(0x1a1a1a, 0.3)
      g.fillEllipse(1060 + i * 90, 585, 20, 14)
    }

    // Kitchen counter / bar
    g.fillStyle(0x3a2a1a, 1)
    g.fillRoundedRect(1010, 700, 720, 50, 5)
    g.fillStyle(0x5a4a2a, 1)
    g.fillRoundedRect(1010, 700, 720, 10, 3)
    g.lineStyle(1, 0xfab387, 0.4)
    g.strokeRoundedRect(1010, 700, 720, 50, 5)

    // Appliances on counter
    // Coffee maker
    g.fillStyle(0x1a1a1a, 1)
    g.fillRoundedRect(1020, 680, 35, 25, 3)
    g.fillStyle(0xfab387, 0.5)
    g.fillRect(1025, 684, 8, 10)

    // Microwave
    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(1070, 680, 50, 25, 3)
    g.fillStyle(0x111111, 0.8)
    g.fillRect(1074, 684, 30, 17)

    // Fridge
    g.fillStyle(0x3a3a5a, 1)
    g.fillRoundedRect(1680, 510, 60, 110, 4)
    g.lineStyle(1, 0xfab387, 0.4)
    g.strokeRoundedRect(1680, 510, 60, 110, 4)
    g.fillStyle(0x2a2a4a, 1)
    g.fillRect(1684, 514, 52, 50)
    g.fillRect(1684, 568, 52, 48)
    // Fridge handle
    g.lineStyle(2, 0xfab387, 0.8)
    g.moveTo(1726, 535); g.lineTo(1726, 545)
    g.moveTo(1726, 575); g.lineTo(1726, 585)
    g.strokePath()
  }

  private drawPerimeterDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    // Plants (big leaf)
    const plantPositions = [
      { x: 35, y: 50 }, { x: 1760, y: 50 }, { x: 35, y: 850 }, { x: 1760, y: 850 },
      { x: 900, y: 38 }, { x: 900, y: 862 }, { x: 38, y: 450 }, { x: 1762, y: 450 },
    ]
    for (const pp of plantPositions) {
      this.drawPlant(g, pp.x, pp.y)
    }

    // Wall lamps (top edge)
    const lampPositions = [200, 500, 800, 1100, 1400, 1650]
    for (const lx of lampPositions) {
      this.drawLamp(g, lx, 38)
    }
    // Bottom lamps
    for (const lx of [300, 700, 1100, 1500]) {
      this.drawLamp(g, lx, 862)
    }

    // Posters / artwork on walls
    this.drawPoster(g, 120, 35, 0x89b4fa, '//') // top wall poster
    this.drawPoster(g, 450, 35, 0xa6e3a1, '><')
    this.drawPoster(g, 1200, 35, 0xcba6f7, '{  }')
    this.drawPoster(g, 1500, 35, 0xf9e2af, '...')
    // Left wall poster
    this.drawPoster(g, 35, 300, 0xf38ba8, '◆')
    this.drawPoster(g, 35, 600, 0x89dceb, '▲')
    // Right wall poster
    this.drawPoster(g, 1762, 300, 0xfab387, '★')
    this.drawPoster(g, 1762, 600, 0xa6e3a1, '♦')
  }

  private drawPlant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Pot
    g.fillStyle(0x8b4513, 1)
    g.fillRect(x - 8, y + 10, 16, 12)
    g.fillStyle(0x6b3410, 1)
    g.fillRect(x - 9, y + 8, 18, 4)
    // Leaves
    g.fillStyle(0x2d7a3a, 1)
    g.fillCircle(x, y, 10)
    g.fillCircle(x - 8, y + 4, 7)
    g.fillCircle(x + 8, y + 4, 7)
    g.fillStyle(0x1a5a28, 1)
    g.fillCircle(x, y + 2, 7)
  }

  private drawLamp(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Wall bracket
    g.fillStyle(0x4a4a6a, 1)
    g.fillRect(x - 2, y, 4, 16)
    g.fillRect(x - 8, y + 14, 16, 3)
    // Shade
    g.fillStyle(0xf9e2af, 0.8)
    g.fillTriangle(x - 10, y + 17, x + 10, y + 17, x, y + 30)
    // Glow dot
    g.fillStyle(0xffffff, 0.4)
    g.fillCircle(x, y + 20, 4)
  }

  private drawPoster(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, text: string) {
    g.fillStyle(0x1a1a2e, 1)
    g.fillRoundedRect(x - 18, y - 24, 36, 48, 3)
    g.lineStyle(2, color, 0.7)
    g.strokeRoundedRect(x - 18, y - 24, 36, 48, 3)
    g.fillStyle(color, 0.4)
    g.fillRect(x - 14, y - 20, 28, 36)

    // Add text label on poster
    this.add.text(x, y, text, {
      fontSize: '8px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(2)
  }

  // ── Camera pan ────────────────────────────────────────────────────────────

  private setupCamera() {
    const cam = this.cameras.main
    cam.setZoom(1)

    // Drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })

    // Scroll to zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.4, 1.8)
      cam.setZoom(newZoom)
    })

    // Start camera centered on work zone
    cam.centerOn(WORLD_W / 2, WORLD_H / 2)
  }

  // ── Smoke particles ───────────────────────────────────────────────────────

  private setupSmoke() {
    const smokeX = [760, 790, 820]
    const smokeBaseY = 580

    this.smokeTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        for (const x of smokeX) {
          const smoke = this.add.arc(
            x + Phaser.Math.Between(-5, 5),
            smokeBaseY,
            Phaser.Math.Between(4, 8), 0, 360, false,
            0x9b9b9b, 0.6,
          )
          smoke.setDepth(5)
          this.smokeParticles.push({ x, y: smokeBaseY, alpha: 0.6, vy: -1, obj: smoke })

          this.tweens.add({
            targets: smoke,
            y: smokeBaseY - Phaser.Math.Between(40, 80),
            alpha: 0,
            scaleX: 2.5, scaleY: 2.5,
            duration: 2500,
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
      if (this.scene.isActive()) this.addAgent(agent)
    })
    eventBridge.on('agent:moved', ({ agentId, presenceState }: { agentId: string; presenceState: string }) => {
      if (this.scene.isActive()) this.onAgentMoved(agentId, presenceState)
    })
    eventBridge.on('scene:sync', ({ agents }: { agents: AgentEntry[] }) => {
      if (this.scene.isActive()) {
        agents.forEach((a) => this.addAgent(a))
      }
    })

    // Signal to React layer that scene is ready for sync
    this.time.delayedCall(100, () => {
      eventBridge.emit('scene:ready' as never, undefined as never)
    })
  }

  // ── Add agent ─────────────────────────────────────────────────────────────

  private addAgent(agent: AgentEntry) {
    if (this.agents.has(agent.agentId)) {
      this.onAgentMoved(agent.agentId, agent.presenceState)
      return
    }

    const desk = ROLE_DESK[agent.role] ?? { x: 420, y: 145 }
    const avatarKey = `avatar_${agent.role}_0`
    const textureKey = this.textures.exists(avatarKey) ? avatarKey : `avatar_WORKER_0`

    const sprite = this.add.sprite(0, 0, textureKey)
    sprite.setScale(2)
    sprite.setDepth(10)

    // Name label
    const cleanName = agent.name.replace(/^\p{Emoji}\s*/u, '')
    const nameLabel = this.add.text(0, 36, cleanName, {
      fontSize: '9px',
      color: '#cdd6f4',
      fontFamily: 'monospace',
      backgroundColor: '#0a0a14',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 0).setAlpha(0.92).setDepth(11)

    const container = this.add.container(desk.x, desk.y, [sprite, nameLabel])
    container.setDepth(10)

    const state: AgentState = {
      agentId: agent.agentId,
      role: agent.role,
      presenceState: agent.presenceState,
      sprite,
      container,
      bubble: null,
      bubbleTimer: null,
      emoji: null,
      emojiTimer: null,
      nameLabel,
      behaviour: 'AT_DESK',
      wanderTimer: null,
      walkFrame: 0,
      frameTimer: null,
      currentX: desk.x,
      currentY: desk.y,
      deskX: desk.x,
      deskY: desk.y,
      facingRight: true,
    }

    this.agents.set(agent.agentId, state)

    // Entrance pop
    container.setAlpha(0)
    container.setScale(0.5)
    this.tweens.add({
      targets: container,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        if (agent.presenceState === 'WORKING') {
          this.startWorkingBehaviour(agent.agentId)
        } else {
          this.startIdleBehaviour(agent.agentId)
        }
      },
    })
  }

  // ── Behaviour: WORKING ────────────────────────────────────────────────────

  private startWorkingBehaviour(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    state.behaviour = 'PULSING'
    this.stopWalking(state)
    this.moveTo(state, state.deskX, state.deskY, 600)

    // Blue pulse ring
    const pulseRing = this.add.arc(0, 0, 24, 0, 360, false, 0x89b4fa, 0.15)
    pulseRing.setDepth(9)
    state.container.add(pulseRing)

    this.tweens.add({
      targets: pulseRing,
      scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 1200, ease: 'Sine.easeInOut',
      repeat: -1, yoyo: false,
      onRepeat: () => { pulseRing.setScale(1); pulseRing.setAlpha(0.15) },
    })

    // Random work emoji every 15-30s
    this.scheduleWorkEmoji(agentId)
  }

  private scheduleWorkEmoji(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state || state.presenceState !== 'WORKING') return

    const delay = Phaser.Math.Between(10000, 25000)
    state.emojiTimer = this.time.delayedCall(delay, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState !== 'WORKING') return
      this.showHeadEmoji(agentId, Phaser.Utils.Array.GetRandom(['💻', '🔧', '📊', '🚀', '⚡']))
      this.scheduleWorkEmoji(agentId)
    })
  }

  // ── Behaviour: IDLE wander ────────────────────────────────────────────────

  private startIdleBehaviour(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    // Sit at desk first
    state.behaviour = 'AT_DESK'
    this.moveTo(state, state.deskX, state.deskY, 600)

    const scheduleWander = () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState === 'WORKING') return

      const delay = Phaser.Math.Between(30000, 120000)
      s.wanderTimer = this.time.delayedCall(delay, () => {
        const ss = this.agents.get(agentId)
        if (!ss || ss.presenceState === 'WORKING') return
        this.doWander(agentId, scheduleWander)
      })
    }

    scheduleWander()
  }

  private doWander(agentId: string, onDone: () => void) {
    const state = this.agents.get(agentId)
    if (!state) return

    const zoneKeys = Object.keys(ZONE_SPOTS)
    const targetZone = Phaser.Utils.Array.GetRandom(zoneKeys) as string
    const spots = ZONE_SPOTS[targetZone]
    const spot = Phaser.Utils.Array.GetRandom(spots)

    state.behaviour = 'WALKING'
    this.startWalkAnimation(agentId)

    this.moveTo(state, spot.x, spot.y, 1800, () => {
      const s = this.agents.get(agentId)
      if (!s) return

      this.stopWalking(s)
      s.behaviour = 'WANDERING'

      // Maybe chat with someone nearby
      if (Math.random() < 0.4) {
        this.showSpeechBubble(agentId, '...')
      }

      // Stand there for a while
      const standDelay = Phaser.Math.Between(20000, 60000)
      s.wanderTimer = this.time.delayedCall(standDelay, () => {
        const ss = this.agents.get(agentId)
        if (!ss || ss.presenceState === 'WORKING') { onDone(); return }

        // Return to desk or wander again
        if (Math.random() < 0.6) {
          ss.behaviour = 'WALKING'
          this.startWalkAnimation(agentId)
          this.moveTo(ss, ss.deskX, ss.deskY, 1800, () => {
            const sss = this.agents.get(agentId)
            if (!sss) return
            this.stopWalking(sss)
            sss.behaviour = 'AT_DESK'
            onDone()
          })
        } else {
          this.doWander(agentId, onDone)
        }
      })
    })
  }

  // ── Walk animation ────────────────────────────────────────────────────────

  private startWalkAnimation(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state || state.frameTimer) return

    state.walkFrame = 0
    state.frameTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const s = this.agents.get(agentId)
        if (!s) return
        s.walkFrame = s.walkFrame === 0 ? 1 : 0
        const frameKey = `avatar_${s.role}_${s.walkFrame}`
        if (this.textures.exists(frameKey)) {
          s.sprite.setTexture(frameKey)
        }
        // Flip based on direction
        s.sprite.setFlipX(!s.facingRight)
      },
    })
  }

  private stopWalking(state: AgentState) {
    if (state.frameTimer) {
      state.frameTimer.destroy()
      state.frameTimer = null
    }
    state.walkFrame = 0
    const frameKey = `avatar_${state.role}_0`
    if (this.textures.exists(frameKey)) {
      state.sprite.setTexture(frameKey)
    }
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private moveTo(state: AgentState, tx: number, ty: number, duration: number, onComplete?: () => void) {
    // Update facing direction
    state.facingRight = tx >= state.currentX

    this.tweens.killTweensOf(state.container)
    this.tweens.add({
      targets: state.container,
      x: tx, y: ty,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        state.currentX = state.container.x
        state.currentY = state.container.y
      },
      onComplete: () => {
        state.currentX = tx
        state.currentY = ty
        if (onComplete) onComplete()
      },
    })
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────

  private showSpeechBubble(agentId: string, text: string) {
    const state = this.agents.get(agentId)
    if (!state || state.bubble) return

    const bg = this.add.graphics()
    bg.fillStyle(0xffffff, 0.95)
    bg.fillRoundedRect(-20, -40, 40, 22, 6)
    bg.fillStyle(0xffffff, 0.95)
    // Tail
    bg.fillTriangle(0, -20, -6, -10, 6, -10)

    const label = this.add.text(0, -30, text, {
      fontSize: '10px',
      color: '#1a1a2e',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5)

    const bubble = this.add.container(0, -50, [bg, label])
    bubble.setDepth(20)
    state.container.add(bubble)
    state.bubble = bubble

    const duration = Phaser.Math.Between(3000, 5000)
    state.bubbleTimer = this.time.delayedCall(duration, () => {
      const s = this.agents.get(agentId)
      if (s?.bubble) {
        s.bubble.destroy()
        s.bubble = null
      }
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

    const em = this.add.text(0, -55, emojiChar, {
      fontSize: '16px',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0.5).setDepth(20)
    state.container.add(em)
    state.emoji = em

    this.tweens.add({
      targets: em,
      y: -70, alpha: 0,
      duration: 2500, ease: 'Quad.easeOut',
      onComplete: () => {
        em.destroy()
        const s = this.agents.get(agentId)
        if (s) s.emoji = null
      },
    })
  }

  // ── Agent moved ───────────────────────────────────────────────────────────

  private onAgentMoved(agentId: string, presenceState: string) {
    const state = this.agents.get(agentId)
    if (!state) return
    if (state.presenceState === presenceState) return

    const prev = state.presenceState
    state.presenceState = presenceState

    // Clear old timers
    if (state.wanderTimer) { state.wanderTimer.destroy(); state.wanderTimer = null }
    if (state.emojiTimer) { state.emojiTimer.destroy(); state.emojiTimer = null }
    if (state.bubbleTimer) { state.bubbleTimer.destroy(); state.bubbleTimer = null }
    if (state.bubble) { state.bubble.destroy(); state.bubble = null }

    if (presenceState === 'WORKING') {
      this.startWorkingBehaviour(agentId)
    } else if (presenceState === 'SMOKING') {
      this.moveToZone(agentId, 'smoking')
    } else if (presenceState === 'RESTING') {
      this.moveToZone(agentId, 'rest')
    } else if (presenceState === 'CHATTING') {
      this.moveToZone(agentId, 'chat')
    } else if (presenceState === 'IDLE') {
      if (prev === 'WORKING') {
        // Was working, now idle — start autonomous behavior
        this.startIdleBehaviour(agentId)
      } else {
        this.startIdleBehaviour(agentId)
      }
    }
  }

  private moveToZone(agentId: string, zoneKey: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    const spots = ZONE_SPOTS[zoneKey]
    if (!spots) return

    const spot = Phaser.Utils.Array.GetRandom(spots)
    state.behaviour = 'WALKING'
    this.startWalkAnimation(agentId)

    this.moveTo(state, spot.x, spot.y, 1500, () => {
      const s = this.agents.get(agentId)
      if (!s) return
      this.stopWalking(s)
      s.behaviour = 'WANDERING'
    })
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────

  shutdown() {
    eventBridge.off('agent:added')
    eventBridge.off('agent:moved')
    if (this.smokeTimer) this.smokeTimer.destroy()
    this.agents.forEach((state) => {
      if (state.wanderTimer) state.wanderTimer.destroy()
      if (state.emojiTimer) state.emojiTimer.destroy()
      if (state.bubbleTimer) state.bubbleTimer.destroy()
      if (state.frameTimer) state.frameTimer.destroy()
    })
    this.agents.clear()
  }
}
