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
// NOTE: Director office occupies x=62..254, y=62..222 — other desks start at y=250+
const DESKS: { x: number; y: number; agentKey: string }[] = [
  { x: 120, y: 155, agentKey: 'DIRECTOR' },  // inside director office (visual only)
  { x: 310, y: 250, agentKey: 'FINANCIER' },
  { x: 450, y: 250, agentKey: 'BACKEND' },
  { x: 590, y: 250, agentKey: 'DEVOPS' },
  { x: 730, y: 250, agentKey: 'FRONTEND' },
  { x: 310, y: 330, agentKey: '' },
  { x: 450, y: 330, agentKey: '' },
  { x: 590, y: 330, agentKey: '' },
]

const ROLE_DESK: Record<string, { x: number; y: number }> = {
  DIRECTOR:  { x: 142, y: 120 },  // внутри кабинета: ox=62 + 2*32 + 16, oy=62 + 1*32 + 24
  FINANCIER: { x: 310, y: 265 },
  BACKEND:   { x: 450, y: 265 },
  DEVOPS:    { x: 590, y: 265 },
  FRONTEND:  { x: 730, y: 265 },
  // Архитектор — второй ряд
  ARCHITECT: { x: 450, y: 330 },
  // Security Auditor — второй ряд
  SECURITY:  { x: 560, y: 330 },
  // Ряд 3 (y=400)
  ARCHIVIST:          { x: 200, y: 400 },
  SOLUTION_ARCHITECT: { x: 310, y: 400 },
  SQL_ARCHITECT:      { x: 420, y: 400 },
  TECH_WRITER:        { x: 530, y: 400 },
  QA:                 { x: 640, y: 400 },
  // Ряд 4 (y=470)
  PRODUCT:            { x: 200, y: 470 },
  TECH_LEAD:          { x: 310, y: 470 },
  BA:                 { x: 420, y: 470 },
}

// Пул свободных столов в общей рабочей зоне — для агентов без выделенного места
const SHARED_DESK_POOL: { x: number; y: number }[] = [
  { x: 310, y: 330 },
  { x: 450, y: 330 },
  { x: 590, y: 330 },
  { x: 730, y: 330 },
  { x: 200, y: 400 },
  { x: 310, y: 400 },
  { x: 420, y: 400 },
  { x: 530, y: 400 },
  { x: 640, y: 400 },
]

const usedSharedDesks = new Set<string>()
const agentDeskAssignments = new Map<string, { x: number; y: number }>()

function getDeskPosition(agentId: string, role: string): { x: number; y: number } {
  const known = ROLE_DESK[role]
  if (known) return known

  const assigned = agentDeskAssignments.get(agentId)
  if (assigned) return assigned

  const next = SHARED_DESK_POOL.find((d) => !usedSharedDesks.has(`${d.x},${d.y}`))
  if (next) {
    usedSharedDesks.add(`${next.x},${next.y}`)
    agentDeskAssignments.set(agentId, next)
    return next
  }

  // Крайний случай — центр рабочей зоны
  return { x: 470, y: 250 }
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
  work: [
    { x: 200, y: 200 }, { x: 350, y: 250 }, { x: 500, y: 200 }, { x: 650, y: 250 }, { x: 750, y: 300 },
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
  extra: 'folder' | 'phone' | 'laptop' | 'none'
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
    key: 'BACKEND',
    role: 'BACKEND',
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
    key: 'DEVOPS',
    role: 'DEVOPS',
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
    key: 'FRONTEND',
    role: 'FRONTEND',
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
  {
    key: 'SECURITY',
    role: 'SECURITY',
    skinColor: 0xf5d5a8,
    hairColor: 0x2c2c2c,
    bodyColor: 0x2c3e50,
    bodyAlt: 0x1a252f,
    pantsColor: 0x1a252f,
    shoeColor: 0x222222,
    accessory: 'glasses',
    accessoryColor: 0x27ae60,
    extra: 'laptop',
  },
  {
    key: 'ARCHIVIST',
    role: 'ARCHIVIST',
    skinColor: 0xf5e6d3,
    hairColor: 0x8b6914,
    bodyColor: 0x6c3483,
    bodyAlt: 0x5b2c6f,
    pantsColor: 0x2c3e50,
    shoeColor: 0x1a1a1a,
    accessory: 'glasses',
    accessoryColor: 0x9b59b6,
    extra: 'laptop',
  },
  {
    key: 'SOLUTION_ARCHITECT',
    role: 'SOLUTION_ARCHITECT',
    skinColor: 0xf0d5a8,
    hairColor: 0x1a1a1a,
    bodyColor: 0x1a5276,
    bodyAlt: 0x154360,
    pantsColor: 0x1c2833,
    shoeColor: 0x222222,
    accessory: 'none',
    accessoryColor: 0x3498db,
    extra: 'laptop',
  },
  {
    key: 'SQL_ARCHITECT',
    role: 'SQL_ARCHITECT',
    skinColor: 0xfde8c8,
    hairColor: 0x5d4037,
    bodyColor: 0x1e8449,
    bodyAlt: 0x196f3d,
    pantsColor: 0x2c3e50,
    shoeColor: 0x333333,
    accessory: 'none',
    accessoryColor: 0x27ae60,
    extra: 'laptop',
  },
  {
    key: 'TECH_WRITER',
    role: 'TECH_WRITER',
    skinColor: 0xffe0bd,
    hairColor: 0xd4a017,
    bodyColor: 0xe67e22,
    bodyAlt: 0xca6f1e,
    pantsColor: 0x2c3e50,
    shoeColor: 0x4a3728,
    accessory: 'none',
    accessoryColor: 0xf39c12,
    extra: 'laptop',
  },
  {
    key: 'QA',
    role: 'QA',
    skinColor: 0xf5cba7,
    hairColor: 0x922b21,
    bodyColor: 0x78281f,
    bodyAlt: 0x641e16,
    pantsColor: 0x1a252f,
    shoeColor: 0x222222,
    accessory: 'none',
    accessoryColor: 0xe74c3c,
    extra: 'laptop',
  },
  {
    key: 'PRODUCT',
    role: 'PRODUCT',
    skinColor: 0xfad7a0,
    hairColor: 0x1a1a1a,
    bodyColor: 0x2e86c1,
    bodyAlt: 0x2874a6,
    pantsColor: 0x212f3d,
    shoeColor: 0x1a1a1a,
    accessory: 'none',
    accessoryColor: 0x3498db,
    extra: 'phone',
  },
  {
    key: 'TECH_LEAD',
    role: 'TECH_LEAD',
    skinColor: 0xf0c27f,
    hairColor: 0x2c2c2c,
    bodyColor: 0x1b2631,
    bodyAlt: 0x17202a,
    pantsColor: 0x1b2631,
    shoeColor: 0x111111,
    accessory: 'none',
    accessoryColor: 0xf1c40f,
    extra: 'laptop',
  },
  {
    key: 'BA',
    role: 'BA',
    skinColor: 0xfde9d9,
    hairColor: 0x784212,
    bodyColor: 0x884ea0,
    bodyAlt: 0x76448a,
    pantsColor: 0x2c3e50,
    shoeColor: 0x3d2b1f,
    accessory: 'glasses',
    accessoryColor: 0x8e44ad,
    extra: 'laptop',
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
  deskPosition: { x: number; y: number }
  facingRight: boolean
  workingPulseRing: Phaser.GameObjects.Arc | null
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
    // LimeZu tilesets
    this.load.image('limezu-interiors', '/assets/limezu/Interiors_free_16x16.png')
    this.load.image('limezu-rooms', '/assets/limezu/Room_Builder_free_16x16.png')
    this.load.image('limezu-interiors-32', '/assets/limezu/Interiors_free_32x32.png')

    // LimeZu characters (spritesheets — 4 frames walk cycle, 48×32 per direction)
    this.load.spritesheet('limezu-adam', '/assets/limezu/Adam_16x16.png', { frameWidth: 16, frameHeight: 32 })
    this.load.spritesheet('limezu-amelia', '/assets/limezu/Amelia_16x16.png', { frameWidth: 16, frameHeight: 32 })
    this.load.spritesheet('limezu-bob', '/assets/limezu/Bob_16x16.png', { frameWidth: 16, frameHeight: 32 })
    this.load.spritesheet('limezu-alex', '/assets/limezu/Alex_16x16.png', { frameWidth: 16, frameHeight: 32 })
  }

  // ── Tile placement from tileset atlas ────────────────────────────────────

  private placeTile(
    texture: string,
    srcX: number, srcY: number, srcW: number, srcH: number,
    destX: number, destY: number,
    scale: number = 2,
    depth: number = 2,
  ): Phaser.GameObjects.Image {
    // Position the full tileset image so the desired tile appears at destX/destY
    const img = this.add.image(destX - srcX * scale, destY - srcY * scale, texture)
    img.setOrigin(0, 0)
    img.setScale(scale)
    img.setDepth(depth)

    // Mask to clip only the tile region
    const maskShape = this.add.graphics()
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(destX, destY, srcW * scale, srcH * scale)
    const mask = maskShape.createGeometryMask()
    img.setMask(mask)

    return img
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
      } else if (def.extra === 'laptop') {
        g.fillStyle(0x2c3e50, 1)
        g.fillRect(3, 21, 8, 5)
        g.fillStyle(0x27ae60, 0.8)
        g.fillRect(4, 22, 6, 3)
      }

      // ── NECK ──
      g.fillStyle(def.skinColor, 1)
      g.fillRect(14, 14, 4, 5)

      // ── HEAD ──
      g.fillStyle(def.skinColor, 1)
      g.fillCircle(headCX, headCY, headR)

      // ── HAIR ──
      g.fillStyle(def.hairColor, 1)
      if (def.key === 'DIRECTOR') {
        // Bob / kare
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 6)
        g.fillRect(headCX - headR - 2, headCY - 4, 4, 10)
        g.fillRect(headCX + headR - 2, headCY - 4, 4, 10)
      } else if (def.key === 'FINANCIER') {
        // Ponytail
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 5)
        g.fillRect(headCX + 4, headCY - 6, 3, 12)
      } else if (def.key === 'BACKEND') {
        // Short hair
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 4)
      } else if (def.key === 'DEVOPS') {
        // Medium hair + beard
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 4)
        g.fillRect(headCX - 4, headCY + 4, 8, 4)
      } else if (def.key === 'FRONTEND') {
        // Short under cap
        g.fillRect(headCX - headR, headCY - headR, headR * 2, 3)
      }

      // ── FACE: eyes ──
      g.fillStyle(0x1a1a1a, 1)
      g.fillRect(headCX - 4, headCY, 2, 2)
      g.fillRect(headCX + 2, headCY, 2, 2)

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
        g.fillRect(headCX - headR - 2, headCY - headR + 4, headR * 2 + 4, 2)
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
    for (const def of AVATAR_DEFS) {
      this.generateAvatarTexture(def)
    }

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.cameras.main.setBackgroundColor(0x0f0f1a)

    this.drawWorld()
    this.setupCamera()
    this.setupSmoke()
    this.setupBridge()

    // ─── Mobile: Pinch-to-zoom + Pan ─────────────────────────────────────────
    this.setupMobileControls()
  }

  // ── World drawing ──────────────────────────────────────────────────────────

  private drawWorld() {
    const bg = this.add.graphics()
    bg.fillStyle(0x0f0f1a, 1)
    bg.fillRect(0, 0, WORLD_W, WORLD_H)

    bg.lineStyle(6, 0x4a4a6e, 1)
    bg.strokeRect(30, 30, WORLD_W - 60, WORLD_H - 60)
    bg.fillStyle(0x1a1a2e, 1)
    bg.fillRect(30, 30, WORLD_W - 60, WORLD_H - 60)

    for (const zone of ZONES) {
      this.drawZoneFloor(zone)
    }

    this.drawWorkZoneDecor()
    this.drawDirectorOffice()
    this.drawMeetingDecor()
    this.drawChatDecor()
    this.drawRestDecor()
    this.drawSmokingDecor()
    this.drawLoungeDecor()
    this.drawPerimeterDecor()

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

    g.lineStyle(2, zone.accentColor, 0.3)
    g.strokeRect(zone.x, zone.y, zone.w, zone.h)
  }

  private drawWorkZoneDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    for (const desk of DESKS.slice(0, 5)) {
      // DIRECTOR gets a dedicated office room — skip generic desk drawing
      if (desk.agentKey === 'DIRECTOR') continue

      g.fillStyle(0x3a3a5a, 1)
      g.fillRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
      g.lineStyle(1, 0x5a5a8a, 0.8)
      g.strokeRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)

      g.fillStyle(0x1a1a2e, 1)
      g.fillRect(desk.x - 3, desk.y - 22, 6, 4)

      g.fillStyle(0x111122, 1)
      g.fillRoundedRect(desk.x - 22, desk.y - 38, 44, 26, 3)
      g.lineStyle(2, 0x4a4a7a, 1)
      g.strokeRoundedRect(desk.x - 22, desk.y - 38, 44, 26, 3)

      const glowColors = [0x89b4fa, 0xa6e3a1, 0xcba6f7, 0xf9e2af, 0x89dceb]
      const idx = DESKS.indexOf(desk)
      g.fillStyle(glowColors[idx % glowColors.length], 0.3)
      g.fillRect(desk.x - 20, desk.y - 36, 40, 22)

      g.fillStyle(0x2a2a4a, 1)
      g.fillRoundedRect(desk.x - 18, desk.y - 6, 36, 10, 2)

      g.fillStyle(0x3a3a5a, 1)
      g.fillEllipse(desk.x + 22, desk.y - 3, 8, 12)
    }

    for (const desk of DESKS.slice(5)) {
      g.fillStyle(0x3a3a5a, 0.7)
      g.fillRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
      g.lineStyle(1, 0x5a5a8a, 0.5)
      g.strokeRoundedRect(desk.x - 40, desk.y - 20, 80, 40, 4)
    }

    // ARCHITECT desk — рядом с BACKEND (x=420, y=280)
    const architectDesk = ROLE_DESK['ARCHITECT']
    g.fillStyle(0x3a3a5a, 0.9)
    g.fillRoundedRect(architectDesk.x - 40, architectDesk.y - 20, 80, 40, 4)
    g.lineStyle(1, 0xcba6f7, 0.7)
    g.strokeRoundedRect(architectDesk.x - 40, architectDesk.y - 20, 80, 40, 4)
    g.fillStyle(0x111122, 1)
    g.fillRoundedRect(architectDesk.x - 22, architectDesk.y - 38, 44, 26, 3)
    g.lineStyle(2, 0xcba6f7, 0.8)
    g.strokeRoundedRect(architectDesk.x - 22, architectDesk.y - 38, 44, 26, 3)
    g.fillStyle(0xcba6f7, 0.25)
    g.fillRect(architectDesk.x - 20, architectDesk.y - 36, 40, 22)

    // SECURITY desk — рядом с DEVOPS (x=530, y=280)
    const securityDesk = ROLE_DESK['SECURITY']
    if (securityDesk) {
      const sd = this.add.graphics()
      sd.fillStyle(0x2c3e50, 1)
      sd.fillRect(securityDesk.x - 28, securityDesk.y - 16, 56, 32)
      sd.fillStyle(0x1a252f, 1)
      sd.fillRect(securityDesk.x - 24, securityDesk.y - 12, 48, 24)
    }

    // Row 3 desks
    const row3Roles = ['ARCHIVIST', 'SOLUTION_ARCHITECT', 'SQL_ARCHITECT', 'TECH_WRITER', 'QA']
    for (const role of row3Roles) {
      const deskPos = ROLE_DESK[role]
      if (deskPos) {
        const dg = this.add.graphics()
        dg.fillStyle(0x2d3561, 1)
        dg.fillRect(deskPos.x - 28, deskPos.y - 16, 56, 32)
        dg.fillStyle(0x1f2547, 1)
        dg.fillRect(deskPos.x - 24, deskPos.y - 12, 48, 24)
      }
    }

    // Row 4 desks
    const row4Roles = ['PRODUCT', 'TECH_LEAD', 'BA']
    for (const role of row4Roles) {
      const deskPos = ROLE_DESK[role]
      if (deskPos) {
        const dg = this.add.graphics()
        dg.fillStyle(0x1a3a4a, 1)
        dg.fillRect(deskPos.x - 28, deskPos.y - 16, 56, 32)
        dg.fillStyle(0x122533, 1)
        dg.fillRect(deskPos.x - 24, deskPos.y - 12, 48, 24)
      }
    }

    // Общие столы (shared pool) — лёгкая отметка цветом 0x334455
    for (const pos of SHARED_DESK_POOL) {
      g.fillStyle(0x334455, 1)
      g.fillRoundedRect(pos.x - 40, pos.y - 20, 80, 40, 4)
      g.lineStyle(1, 0x445566, 0.6)
      g.strokeRoundedRect(pos.x - 40, pos.y - 20, 80, 40, 4)
    }

    // General work zone highlight (below the director office)
    g.fillStyle(0x1e2040, 0.4)
    g.fillRoundedRect(80, 230, 800, 200, 8)
  }

  private drawDirectorOffice(): void {
    const ox = 62    // office origin x — aligned with work zone left edge
    const oy = 62    // office origin y — aligned with work zone top edge
    const scale = 2  // 16px tiles → 32px on screen
    const T = 16 * scale  // tile size on screen = 32px

    // Office is 6×5 tiles = 192×160px on screen

    // ── Floor tiles (деревянный пол) ──────────────────────────────────────
    // Room_Builder_free_16x16.png: деревянный пол x=48, y=80
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        this.placeTile('limezu-rooms', 48, 80, 16, 16, ox + col * T, oy + row * T, scale, 1)
      }
    }

    // ── Walls ──────────────────────────────────────────────────────────────
    // Top wall: x=16, y=80 (тёмно-коричневая стена)
    for (let col = 0; col < 6; col++) {
      this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + col * T, oy, scale, 2)
    }
    // Left wall
    for (let row = 1; row < 5; row++) {
      this.placeTile('limezu-rooms', 16, 80, 16, 16, ox, oy + row * T, scale, 2)
    }
    // Right wall
    for (let row = 1; row < 5; row++) {
      this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + 5 * T, oy + row * T, scale, 2)
    }

    // ── Door gap in bottom wall ────────────────────────────────────────────
    // Bottom row (row=4): tiles 0, 1, 4, 5 are walls; tiles 2, 3 are door gap
    this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + 0 * T, oy + 4 * T, scale, 2)
    this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + 1 * T, oy + 4 * T, scale, 2)
    // Tiles 2 and 3 are left open (door)
    this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + 4 * T, oy + 4 * T, scale, 2)
    this.placeTile('limezu-rooms', 16, 80, 16, 16, ox + 5 * T, oy + 4 * T, scale, 2)

    // Door frame posts (drawn on top with graphics)
    const door = this.add.graphics().setDepth(3)
    door.fillStyle(0x4a3010, 1)
    door.fillRect(ox + 2 * T - 2, oy + 4 * T - 4, 4, T + 4) // left post
    door.fillRect(ox + 4 * T - 2, oy + 4 * T - 4, 4, T + 4) // right post

    // ── Carpet (красно-бордовый) ───────────────────────────────────────────
    // Interiors_free_16x16.png: x=96, y=288, 48×32 — 3×2 tiles
    // Placed at col=1, row=1 (one tile inset from walls)
    this.placeTile('limezu-interiors', 96, 288, 48, 32, ox + 1 * T, oy + 1 * T, scale, 2)

    // ── Bookshelf on left wall ─────────────────────────────────────────────
    // Interiors_free_16x16.png: x=0, y=288, 32×32 — 2×2 tiles
    this.placeTile('limezu-interiors', 0, 288, 32, 32, ox + 0 * T, oy + 1 * T, scale, 3)

    // ── Executive desk (деревянный стол) ──────────────────────────────────
    // Interiors_free_16x16.png: x=48, y=192, 32×32 — 2×2 tiles
    this.placeTile('limezu-interiors', 48, 192, 32, 32, ox + 2 * T, oy + 1 * T, scale, 3)

    // ── Monitor on desk ───────────────────────────────────────────────────
    // Interiors_free_16x16.png: x=0, y=96, 16×16 — 1×1 tile
    this.placeTile('limezu-interiors', 0, 96, 16, 16, ox + 2 * T + 8, oy + 1 * T + 8, scale, 4)

    // ── Office chair (тёмное кресло) ──────────────────────────────────────
    // Interiors_free_16x16.png: x=128, y=448, 16×16
    this.placeTile('limezu-interiors', 128, 448, 16, 16, ox + 2 * T + 8, oy + 3 * T, scale, 3)

    // ── Plant in right corner ─────────────────────────────────────────────
    // Interiors_free_16x16.png: x=0, y=368, 16×16
    this.placeTile('limezu-interiors', 0, 368, 16, 16, ox + 5 * T - T, oy + 1 * T, scale, 3)

    // ── Nameplate on desk (graphics overlay) ──────────────────────────────
    const plate = this.add.graphics().setDepth(5)
    plate.fillStyle(0xd4af37, 1)
    plate.fillRect(ox + 2 * T + 4, oy + T - 8, 62, 7)
    plate.fillStyle(0xf0c040, 0.4)
    plate.fillRect(ox + 2 * T + 5, oy + T - 7, 30, 2)

    this.add.text(ox + 2 * T + 35, oy + T - 4, '🖤 DIRECTOR', {
      fontSize: '5px',
      color: '#1a0a0a',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(6)

    // ── Room label ────────────────────────────────────────────────────────
    this.add.text(ox + 3 * T, oy + 6, 'Кабинет директора', {
      fontSize: '6px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setDepth(6)

    // ── Accent glow overlay ────────────────────────────────────────────────
    const light = this.add.graphics().setDepth(1)
    light.fillStyle(0xd4af37, 0.06)
    light.fillRect(ox + T, oy + T, 4 * T, 3 * T)
  }

  private drawMeetingDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    g.fillStyle(0x4a3a2a, 1)
    g.fillEllipse(1120, 250, 280, 140)
    g.lineStyle(3, 0xcba6f7, 0.6)
    g.strokeEllipse(1120, 250, 280, 140)

    g.fillStyle(0x5a4a3a, 0.5)
    g.fillEllipse(1110, 240, 240, 110)

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

    g.fillStyle(0xe8e8f0, 1)
    g.fillRoundedRect(950, 68, 340, 65, 4)
    g.lineStyle(2, 0xcba6f7, 0.8)
    g.strokeRoundedRect(950, 68, 340, 65, 4)
    g.lineStyle(1, 0xcba6f7, 0.5)
    for (let i = 0; i < 3; i++) {
      g.moveTo(960, 82 + i * 14)
      g.lineTo(1050 + Math.random() * 100, 82 + i * 14)
    }
    g.strokePath()
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

    g.fillStyle(0x1a1a1a, 0.9)
    g.fillRect(1275, 115, 20, 16)
    g.fillStyle(0xcba6f7, 0.3)
    g.fillRect(1277, 117, 16, 12)
  }

  private drawChatDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    g.fillStyle(0x4a6fa5, 1)
    g.fillRoundedRect(1660, 90, 30, 55, 4)
    g.fillStyle(0x89dceb, 0.8)
    g.fillRoundedRect(1663, 93, 24, 35, 3)
    g.fillStyle(0x3a5f95, 1)
    g.fillRect(1668, 128, 14, 8)
    g.fillStyle(0x2a4f85, 1)
    g.fillRect(1673, 130, 4, 5)

    g.fillStyle(0x3a3a5a, 1)
    g.fillRoundedRect(1380, 90, 200, 60, 6)
    g.lineStyle(1, 0x89dceb, 0.4)
    g.strokeRoundedRect(1380, 90, 200, 60, 6)
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x2a2a4a, 1)
      g.fillEllipse(1400 + i * 50, 160, 24, 18)
      g.fillStyle(0x4a4a6a, 1)
      g.fillRect(1397 + i * 50, 140, 6, 20)
    }

    g.fillStyle(0x2a4a5a, 1)
    g.fillRoundedRect(1380, 250, 100, 50, 8)
    g.fillRoundedRect(1500, 250, 100, 50, 8)
    g.lineStyle(1, 0x89dceb, 0.3)
    g.strokeRoundedRect(1380, 250, 100, 50, 8)
    g.strokeRoundedRect(1500, 250, 100, 50, 8)

    g.fillStyle(0x3a2a1a, 1)
    g.fillRoundedRect(1430, 280, 60, 25, 4)
    g.fillStyle(0xfab387, 0.8)
    g.fillCircle(1445, 292, 5)
    g.fillCircle(1460, 288, 5)
    g.fillCircle(1475, 292, 5)
  }

  private drawRestDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    g.fillStyle(0x2a4a3a, 1)
    g.fillRoundedRect(80, 540, 200, 70, 8)
    g.fillRoundedRect(80, 540, 60, 120, 8)
    g.lineStyle(1, 0xa6e3a1, 0.4)
    g.strokeRoundedRect(80, 540, 200, 70, 8)
    g.strokeRoundedRect(80, 540, 60, 120, 8)

    g.fillStyle(0x111122, 1)
    g.fillRoundedRect(320, 525, 220, 120, 6)
    g.lineStyle(2, 0xa6e3a1, 0.6)
    g.strokeRoundedRect(320, 525, 220, 120, 6)
    g.fillStyle(0x0a0a1a, 1)
    g.fillRect(325, 530, 210, 110)
    g.fillStyle(0xa6e3a1, 0.8)
    g.fillRect(390, 545, 10, 70)
    g.fillRect(540, 545, 10, 70)
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(460, 585, 12, 12)

    g.fillStyle(0x2a2a4a, 1)
    g.fillRect(400, 645, 60, 12)
    g.fillRect(420, 657, 20, 8)

    g.fillStyle(0x1a3a2a, 1)
    g.fillRoundedRect(200, 575, 80, 65, 6)
    g.lineStyle(1, 0xa6e3a1, 0.3)
    g.strokeRoundedRect(200, 575, 80, 65, 6)

    g.fillStyle(0x4a3a2a, 1)
    g.fillRect(525, 640, 14, 80)
    g.fillStyle(0x8B4513, 1)
    g.fillEllipse(532, 700, 50, 30)
    g.fillStyle(0x2a1a0a, 1)
    g.fillEllipse(532, 640, 30, 20)
    g.fillStyle(0x89dceb, 0.5)
    g.fillEllipse(532, 650, 22, 14)
    g.lineStyle(3, 0x4a3a2a, 1)
    g.moveTo(525, 680)
    g.lineTo(500, 700)
    g.lineTo(480, 720)
    g.lineTo(490, 730)
    g.strokePath()

    g.fillStyle(0x1a3a2a, 0.4)
    g.fillEllipse(260, 640, 350, 200)
    g.lineStyle(2, 0xa6e3a1, 0.2)
    g.strokeEllipse(260, 640, 350, 200)
  }

  private drawSmokingDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    g.fillStyle(0x3a3a3a, 1)
    g.fillRect(776, 590, 8, 60)
    g.fillStyle(0x5a5a5a, 1)
    g.fillEllipse(780, 650, 50, 20)
    g.fillStyle(0x2a2a2a, 1)
    g.fillEllipse(780, 650, 36, 14)

    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(650, 640, 120, 30, 4)
    g.lineStyle(1, 0x4a4a4a, 0.8)
    g.strokeRoundedRect(650, 640, 120, 30, 4)
    g.lineStyle(3, 0x2a2a2a, 1)
    g.moveTo(660, 670); g.lineTo(655, 700)
    g.moveTo(760, 670); g.lineTo(755, 700)
    g.strokePath()

    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(820, 640, 100, 30, 4)

    g.fillStyle(0x3a3a3a, 1)
    g.fillRoundedRect(875, 510, 60, 36, 4)
    g.fillStyle(0xf38ba8, 0.8)
    g.fillCircle(905, 528, 14)
    g.lineStyle(2, 0x1a1a1a, 1)
    g.moveTo(895, 518); g.lineTo(915, 538)
    g.strokePath()

    g.fillStyle(0x1a1a1a, 0.5)
    g.fillRect(650, 515, 280, 310)
    g.lineStyle(1, 0x3a3a3a, 0.5)
    g.strokeRect(650, 515, 280, 310)
  }

  private drawLoungeDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    g.fillStyle(0x4a3a1a, 1)
    g.fillRoundedRect(1020, 545, 520, 80, 6)
    g.lineStyle(2, 0xfab387, 0.5)
    g.strokeRoundedRect(1020, 545, 520, 80, 6)

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

    for (let i = 0; i < 5; i++) {
      g.fillStyle(0xe8e8e0, 0.9)
      g.fillEllipse(1060 + i * 90, 585, 30, 22)
      g.fillStyle(0x1a1a1a, 0.3)
      g.fillEllipse(1060 + i * 90, 585, 20, 14)
    }

    g.fillStyle(0x3a2a1a, 1)
    g.fillRoundedRect(1010, 700, 720, 50, 5)
    g.fillStyle(0x5a4a2a, 1)
    g.fillRoundedRect(1010, 700, 720, 10, 3)
    g.lineStyle(1, 0xfab387, 0.4)
    g.strokeRoundedRect(1010, 700, 720, 50, 5)

    g.fillStyle(0x1a1a1a, 1)
    g.fillRoundedRect(1020, 680, 35, 25, 3)
    g.fillStyle(0xfab387, 0.5)
    g.fillRect(1025, 684, 8, 10)

    g.fillStyle(0x2a2a2a, 1)
    g.fillRoundedRect(1070, 680, 50, 25, 3)
    g.fillStyle(0x111111, 0.8)
    g.fillRect(1074, 684, 30, 17)

    g.fillStyle(0x3a3a5a, 1)
    g.fillRoundedRect(1680, 510, 60, 110, 4)
    g.lineStyle(1, 0xfab387, 0.4)
    g.strokeRoundedRect(1680, 510, 60, 110, 4)
    g.fillStyle(0x2a2a4a, 1)
    g.fillRect(1684, 514, 52, 50)
    g.fillRect(1684, 568, 52, 48)
    g.lineStyle(2, 0xfab387, 0.8)
    g.moveTo(1726, 535); g.lineTo(1726, 545)
    g.moveTo(1726, 575); g.lineTo(1726, 585)
    g.strokePath()
  }

  private drawPerimeterDecor() {
    const g = this.add.graphics()
    g.setDepth(1)

    const plantPositions = [
      { x: 35, y: 50 }, { x: 1760, y: 50 }, { x: 35, y: 850 }, { x: 1760, y: 850 },
      { x: 900, y: 38 }, { x: 900, y: 862 }, { x: 38, y: 450 }, { x: 1762, y: 450 },
    ]
    for (const pp of plantPositions) {
      this.drawPlant(g, pp.x, pp.y)
    }

    const lampPositions = [200, 500, 800, 1100, 1400, 1650]
    for (const lx of lampPositions) {
      this.drawLamp(g, lx, 38)
    }
    for (const lx of [300, 700, 1100, 1500]) {
      this.drawLamp(g, lx, 862)
    }

    this.drawPoster(g, 120, 35, 0x89b4fa, '//')
    this.drawPoster(g, 450, 35, 0xa6e3a1, '><')
    this.drawPoster(g, 1200, 35, 0xcba6f7, '{  }')
    this.drawPoster(g, 1500, 35, 0xf9e2af, '...')
    this.drawPoster(g, 35, 300, 0xf38ba8, '◆')
    this.drawPoster(g, 35, 600, 0x89dceb, '▲')
    this.drawPoster(g, 1762, 300, 0xfab387, '★')
    this.drawPoster(g, 1762, 600, 0xa6e3a1, '♦')
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
    g.fillStyle(0xf9e2af, 0.8)
    g.fillTriangle(x - 10, y + 17, x + 10, y + 17, x, y + 30)
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

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown, _deltaX: number, deltaY: number) => {
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.4, 1.8)
      cam.setZoom(newZoom)
    })

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

    const desk = getDeskPosition(agent.agentId, agent.role)
    const deskPosition = { x: desk.x, y: desk.y }

    const avatarKey = `avatar_${agent.role}_0`
    const textureKey = this.textures.exists(avatarKey) ? avatarKey : `avatar_FRONTEND_0`

    const sprite = this.add.sprite(0, 0, textureKey)
    sprite.setScale(2)
    sprite.setDepth(10)

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
      deskPosition,
      facingRight: true,
      workingPulseRing: null,
    }

    this.agents.set(agent.agentId, state)

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

  private goToDesk(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    // Stop wandering immediately
    if (state.wanderTimer) {
      state.wanderTimer.destroy()
      state.wanderTimer = null
    }

    state.behaviour = 'WALKING'
    this.startWalkAnimation(agentId)

    const { x, y } = state.deskPosition

    this.moveTo(state, x, y, 1200, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState !== 'WORKING') return
      this.stopWalking(s)
      this.startWorkingAnimation(agentId)
    })
  }

  private startWorkingAnimation(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    state.behaviour = 'PULSING'

    // Remove old pulse ring if exists
    if (state.workingPulseRing) {
      this.tweens.killTweensOf(state.workingPulseRing)
      state.workingPulseRing.destroy()
      state.workingPulseRing = null
    }

    // Blue pulse ring
    const pulseRing = this.add.arc(0, 0, 24, 0, 360, false, 0x89b4fa, 0.15)
    pulseRing.setDepth(9)
    state.container.add(pulseRing)
    state.workingPulseRing = pulseRing

    this.tweens.add({
      targets: pulseRing,
      scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 1200, ease: 'Sine.easeInOut',
      repeat: -1, yoyo: false,
      onRepeat: () => { pulseRing.setScale(1); pulseRing.setAlpha(0.15) },
    })

    // Show work emoji immediately
    this.showHeadEmoji(agentId, '💻')

    // Schedule periodic work emojis
    this.scheduleWorkEmoji(agentId)
  }

  private stopWorkingAnimation(state: AgentState) {
    if (state.workingPulseRing) {
      this.tweens.killTweensOf(state.workingPulseRing)
      state.workingPulseRing.destroy()
      state.workingPulseRing = null
    }
    if (state.emojiTimer) {
      state.emojiTimer.destroy()
      state.emojiTimer = null
    }
  }

  private startWorkingBehaviour(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    // Stop any current pulse animation (in case re-triggered)
    this.stopWorkingAnimation(state)

    // Go to desk, then start working animation on arrival
    this.goToDesk(agentId)
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

    // Stop working animation if active
    this.stopWorkingAnimation(state)

    // Wait 2-3 seconds, then start wandering
    const idleDelay = Phaser.Math.Between(2000, 3000)
    state.wanderTimer = this.time.delayedCall(idleDelay, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState === 'WORKING') return

      // First go back to desk
      s.behaviour = 'WALKING'
      this.startWalkAnimation(agentId)
      this.moveTo(s, s.deskPosition.x, s.deskPosition.y, 800, () => {
        const ss = this.agents.get(agentId)
        if (!ss) return
        this.stopWalking(ss)
        ss.behaviour = 'AT_DESK'
        this.scheduleWander(agentId)
      })
    })
  }

  private scheduleWander(agentId: string) {
    const state = this.agents.get(agentId)
    if (!state) return

    const delay = Phaser.Math.Between(30000, 120000)
    state.wanderTimer = this.time.delayedCall(delay, () => {
      const s = this.agents.get(agentId)
      if (!s || s.presenceState === 'WORKING') return
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

    state.behaviour = 'WALKING'
    this.startWalkAnimation(agentId)

    this.moveTo(state, spot.x, spot.y, 1800, () => {
      const s = this.agents.get(agentId)
      if (!s) return

      this.stopWalking(s)
      s.behaviour = 'WANDERING'

      if (Math.random() < 0.4) {
        this.showSpeechBubble(agentId, '...')
      }

      const standDelay = Phaser.Math.Between(20000, 60000)
      s.wanderTimer = this.time.delayedCall(standDelay, () => {
        const ss = this.agents.get(agentId)
        if (!ss || ss.presenceState === 'WORKING') { onDone(); return }

        if (Math.random() < 0.6) {
          ss.behaviour = 'WALKING'
          this.startWalkAnimation(agentId)
          this.moveTo(ss, ss.deskPosition.x, ss.deskPosition.y, 1800, () => {
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

    // Stop walk animation for clean state transition
    this.stopWalking(state)

    if (presenceState === 'WORKING') {
      // Stop working animation if somehow already pulsing, then go to desk
      this.stopWorkingAnimation(state)
      this.startWorkingBehaviour(agentId)
    } else if (presenceState === 'SMOKING') {
      this.stopWorkingAnimation(state)
      this.moveToZone(agentId, 'smoking')
    } else if (presenceState === 'RESTING') {
      this.stopWorkingAnimation(state)
      this.moveToZone(agentId, 'rest')
    } else if (presenceState === 'CHATTING') {
      this.stopWorkingAnimation(state)
      this.moveToZone(agentId, 'chat')
    } else if (presenceState === 'IDLE') {
      // Was working → now idle: stop working, wait 2-3s, start wandering
      if (prev === 'WORKING') {
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

    // Double-tap to reset zoom
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
    if (this.smokeTimer) this.smokeTimer.destroy()
    this.agents.forEach((state) => {
      if (state.wanderTimer) state.wanderTimer.destroy()
      if (state.emojiTimer) state.emojiTimer.destroy()
      if (state.bubbleTimer) state.bubbleTimer.destroy()
      if (state.frameTimer) state.frameTimer.destroy()
      if (state.workingPulseRing) state.workingPulseRing.destroy()
    })
    this.agents.clear()
  }
}
