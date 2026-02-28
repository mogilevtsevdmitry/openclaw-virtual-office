# 🎨 Задача для Макса: Замена программных декораций на тайлы Limezu

**Приоритет:** HIGH  
**Исполнитель:** Макс (FRONTEND)  
**Файл:** `apps/frontend/src/features/office/phaser/OfficeScene.ts`

---

## Контекст

Уже реализовано:
- Тайлсеты загружены в `preload()`
- Метод `placeTile()` работает
- `drawDirectorOffice()` полностью на тайлах — **не трогать**

Нужно заменить остальные 7 функций декора + `drawZoneFloor()`.

---

## Тайлсеты и координаты

**`limezu-rooms`** = `Room_Builder_free_16x16.png` (272×368px, 17×23 тайлов, 16px каждый)  
**`limezu-interiors`** = `Interiors_free_16x16.png` (256×1424px, 16×89 тайлов, 16px каждый)

**Метод placeTile:**
```typescript
this.placeTile(
  textureKey,     // 'limezu-rooms' | 'limezu-interiors'
  col * 16,       // srcX в пикселях исходника
  row * 16,       // srcY в пикселях исходника
  tileW * 16,     // srcW (ширина в исходных пикселях, кратно 16)
  tileH * 16,     // srcH (высота в исходных пикселях, кратно 16)
  worldX,         // мировые координаты X
  worldY,         // мировые координаты Y
  2,              // scale (2 → 16px*2 = 32px на экране)
  depth           // 0=пол, 1=мебель нижняя, 2=объекты, 3=топ
)
```

Один тайл 16×16 → scale=2 → 32×32 на экране.

---

## Справочник тайлов (col, row)

### Room_Builder_free_16x16 — Полы
| Тип | col | row | Зона |
|---|---|---|---|
| Тёмный паркет (вертикальные доски) | 0 | 10 | Рабочая зона |
| Средний паркет | 2 | 10 | Лаундж, кабинет |
| Светлый паркет / бежевый | 4 | 10 | Переговорная |
| Голубой узорный ковёр | 8 | 8 | Болталка |
| Серый камень | 8 | 10 | Курилка |
| Тёмно-коричневый (горизонт.) | 0 | 12 | Комната отдыха |
| Оранжево-полосатый | 0 | 4 | Лаундж — альтернатива |

### Room_Builder_free_16x16 — Стены и углы (rows 0–2)
| Элемент | col | row |
|---|---|---|
| Угол верх-лево | 5 | 0 |
| Стена верх (горизонт.) | 6 | 0 |
| Стена верх | 7 | 0 |
| Стена верх | 8 | 0 |
| Угол верх-право | 9 | 0 |
| Стена лево (вертикал.) | 5 | 1 |
| Стена право (вертикал.) | 9 | 1 |
| Угол низ-лево | 5 | 2 |
| Стена низ | 6–8 | 2 |
| Угол низ-право | 9 | 2 |

### Interiors_free_16x16 — Мебель
| Объект | col | row | Размер (тайлы WxH) | Примечание |
|---|---|---|---|---|
| Компьютерный стол (коричн.) | 0 | 10 | 2×1 | Вид сверху, рабочее место |
| Компьютерный стол (бежевый) | 3 | 10 | 2×1 | Альт. цвет |
| Монитор + стол (вид спереди) | 0 | 2 | 2×2 | Стол с монитором |
| Стул зелёный (вид спереди) | 0 | 15 | 1×1 | Офисный стул |
| Стул оранжевый (мягкий) | 3 | 15 | 1×1 | Кресло |
| Стул (вид сверху) | 3 | 13 | 1×1 | Вокруг конференц-стола |
| Диван коричневый 2-мест. | 0 | 13 | 2×1 | Зона отдыха |
| Диван большой 3-мест. | 0 | 34 | 3×1 | Лаундж |
| Диван серый современный | 0 | 50 | 3×1 | Болталка |
| Конференц-столешница | 0 | 32 | 6×1 | Длинная барная/конференц |
| Книжная полка широкая | 0 | 19 | 3×2 | Библиотека/стеллаж |
| ТВ настенный | 4 | 25 | 2×1 | Комната отдыха |
| Большой ТВ на подставке | 0 | 28 | 2×2 | Кинозона |
| Растение малое | 0 | 52 | 1×1 | Горшок |
| Растение среднее | 1 | 52 | 1×1 | |
| Пальма / высокое растение | 9 | 44 | 1×2 | Вертикальное |
| Тропическое растение | 11 | 44 | 1×2 | |
| Кофемашина/чайник | 8 | 12 | 1×1 | На столешнице |
| Посуда/чашки | 7 | 12 | 1×1 | |
| Холодильник | 0 | 0 | 1×2 | Серый, вертикальный |
| Вендинг-автомат серый | 2 | 0 | 1×2 | Автомат с едой |
| Вендинг-автомат бирюзовый | 10 | 0 | 1×2 | Цветной |
| Настольная лампа | 0 | 17 | 1×1 | Рабочие столы |
| Столешница-прилавок (дерево) | 0 | 20 | 8×1 | Барная стойка |
| Деревянный стул (барный) | 0 | 22 | 1×1 | Барные стулья |
| Маркерная доска | 5 | 23 | 2×1 | Whiteboard |
| Игровой стол | 0 | 40 | 3×2 | Настольный теннис/бильярд |
| Картина/постер (пейзаж) | 0 | 12 | 2×1 | Настенный декор |

---

## Задачи по зонам

### 1. `drawZoneFloor()` — Полы ⭐ ПЕРВЫЙ ПРИОРИТЕТ

Заменить чередующиеся `fillRect` на повторяющиеся тайлы пола.

```typescript
private drawZoneFloor(zone: ZoneDef) {
  const ZONE_FLOOR: Record<string, { col: number; row: number }> = {
    work:    { col: 0, row: 10 }, // тёмный паркет
    meeting: { col: 4, row: 10 }, // светлый паркет
    chat:    { col: 8, row: 8  }, // голубой ковёр
    rest:    { col: 0, row: 12 }, // тёмно-коричневый
    smoking: { col: 8, row: 10 }, // серый камень
    lounge:  { col: 2, row: 10 }, // средний паркет
  }

  const tile = ZONE_FLOOR[zone.key] ?? { col: 0, row: 10 }
  const TILE_PX = 32 // 16 * scale=2

  for (let ty = 0; ty < zone.h; ty += TILE_PX) {
    for (let tx = 0; tx < zone.w; tx += TILE_PX) {
      this.placeTile(
        'limezu-rooms',
        tile.col * 16, tile.row * 16, 16, 16,
        zone.x + tx, zone.y + ty,
        2, 0
      )
    }
  }

  // Рамка зоны — оставить
  const g = this.add.graphics().setDepth(1)
  g.lineStyle(2, zone.accentColor, 0.4)
  g.strokeRect(zone.x, zone.y, zone.w, zone.h)
}
```

---

### 2. `drawWorkZoneDecor()` — Рабочие столы

Заменить `fillRoundedRect` + `fillRect` (мониторы) на тайловые столы.

```typescript
private drawWorkZoneDecor() {
  // Рабочие столы для именованных агентов
  for (const desk of DESKS) {
    if (desk.agentKey === 'DIRECTOR') continue

    // Стол (2×1 тайла = 64×32px на экране)
    this.placeTile('limezu-interiors', 0, 10*16, 32, 16, desk.x - 32, desk.y - 16, 2, 1)

    // Монитор (2×2 = 64×64px), позиционируем выше стола
    this.placeTile('limezu-interiors', 0, 2*16, 32, 32, desk.x - 32, desk.y - 72, 2, 2)

    // Лампа (1×1 = 32px) справа от стола
    this.placeTile('limezu-interiors', 0, 17*16, 16, 16, desk.x + 28, desk.y - 16, 2, 2)
  }

  // Row 3 столы (ARCHIVIST, SOLUTION_ARCHITECT, SQL_ARCHITECT, TECH_WRITER, QA)
  const row3Roles = ['ARCHIVIST', 'SOLUTION_ARCHITECT', 'SQL_ARCHITECT', 'TECH_WRITER', 'QA']
  for (const role of row3Roles) {
    const pos = ROLE_DESK[role]
    if (!pos) continue
    this.placeTile('limezu-interiors', 3*16, 10*16, 32, 16, pos.x - 32, pos.y - 16, 2, 1)
    this.placeTile('limezu-interiors', 0, 2*16, 32, 32, pos.x - 32, pos.y - 72, 2, 2)
  }

  // Row 4 столы (PRODUCT, TECH_LEAD, BA)
  const row4Roles = ['PRODUCT', 'TECH_LEAD', 'BA']
  for (const role of row4Roles) {
    const pos = ROLE_DESK[role]
    if (!pos) continue
    this.placeTile('limezu-interiors', 3*16, 10*16, 32, 16, pos.x - 32, pos.y - 16, 2, 1)
    this.placeTile('limezu-interiors', 0, 2*16, 32, 32, pos.x - 32, pos.y - 72, 2, 2)
  }

  // ARCHITECT и SECURITY столы
  for (const role of ['ARCHITECT', 'SECURITY']) {
    const pos = ROLE_DESK[role]
    if (!pos) continue
    this.placeTile('limezu-interiors', 0, 10*16, 32, 16, pos.x - 32, pos.y - 16, 2, 1)
    this.placeTile('limezu-interiors', 0, 2*16, 32, 32, pos.x - 32, pos.y - 72, 2, 2)
  }

  // Shared pool столы
  for (const pos of SHARED_DESK_POOL) {
    this.placeTile('limezu-interiors', 3*16, 10*16, 32, 16, pos.x - 32, pos.y - 16, 2, 1)
  }

  // Книжная полка у левой стены рабочей зоны
  this.placeTile('limezu-interiors', 0, 19*16, 48, 32, 65, 230, 2, 1)
}
```

---

### 3. `drawMeetingDecor()` — Переговорная

```typescript
private drawMeetingDecor() {
  // Конференц-стол (6 тайлов в ряд = 192×32px)
  for (let i = 0; i < 6; i++) {
    this.placeTile('limezu-interiors', 0, 32*16, 16, 16, 1000 + i*32, 240, 2, 1)
  }
  // Второй ряд столешницы (сделать стол глубже — 2 ряда)
  for (let i = 0; i < 6; i++) {
    this.placeTile('limezu-interiors', 0, 32*16, 16, 16, 1000 + i*32, 272, 2, 1)
  }

  // Стулья вокруг стола (стул вид сверху, col=3, row=13)
  const chairTop    = [1010, 1050, 1090, 1130, 1170, 1210]
  const chairBottom = [1010, 1050, 1090, 1130, 1170, 1210]
  chairTop.forEach(x =>
    this.placeTile('limezu-interiors', 3*16, 13*16, 16, 16, x, 200, 2, 2)
  )
  chairBottom.forEach(x =>
    this.placeTile('limezu-interiors', 3*16, 13*16, 16, 16, x, 310, 2, 2)
  )
  // Торцевые стулья
  this.placeTile('limezu-interiors', 3*16, 13*16, 16, 16, 965, 250, 2, 2)
  this.placeTile('limezu-interiors', 3*16, 13*16, 16, 16, 1255, 250, 2, 2)

  // Маркерная доска (whiteboard) — col=5, row=23, 2×1
  this.placeTile('limezu-interiors', 5*16, 23*16, 32, 16, 950, 72, 2, 2)

  // Стикеры/заметки на доске — оставить как graphics overlay
  const g = this.add.graphics().setDepth(3)
  const stickerColors = [0x89b4fa, 0xa6e3a1, 0xcba6f7, 0xf9e2af, 0xf38ba8]
  stickerColors.forEach((c, i) =>
    g.fillStyle(c, 0.85) && g.fillRect(1150 + i*25, 75, 18, 28)
  )

  // Декоративный экран/проектор — оставить
  const screen = this.add.graphics().setDepth(2)
  screen.fillStyle(0x1a1a1a, 0.9)
  screen.fillRect(1275, 115, 20, 16)
  screen.fillStyle(0xcba6f7, 0.3)
  screen.fillRect(1277, 117, 16, 12)
}
```

---

### 4. `drawChatDecor()` — Болталка

```typescript
private drawChatDecor() {
  // Вендинг-автомат (бирюзовый, col=10, row=0, 1×2)
  this.placeTile('limezu-interiors', 10*16, 0, 16, 32, 1660, 90, 2, 2)

  // Диван серый у окна (3×1)
  this.placeTile('limezu-interiors', 0, 50*16, 48, 16, 1380, 90, 2, 1)

  // Диваны у стен (2×1)
  this.placeTile('limezu-interiors', 0, 13*16, 32, 16, 1380, 250, 2, 1)
  this.placeTile('limezu-interiors', 0, 13*16, 32, 16, 1500, 250, 2, 1)

  // Стулья у столиков (1×1)
  ;[1400, 1450, 1500, 1550].forEach(x =>
    this.placeTile('limezu-interiors', 3*16, 15*16, 16, 16, x, 155, 2, 1)
  )

  // Столики (1×1 — небольшой стол)
  ;[1400, 1500].forEach(x =>
    this.placeTile('limezu-interiors', 3*16, 10*16, 32, 16, x, 190, 2, 1)
  )

  // Кофейный столик (посуда/чашки)
  this.placeTile('limezu-interiors', 7*16, 12*16, 16, 16, 1430, 280, 2, 2)
}
```

---

### 5. `drawRestDecor()` — Комната отдыха

```typescript
private drawRestDecor() {
  // Большой ТВ на подставке (col=0, row=28, 2×2)
  this.placeTile('limezu-interiors', 0, 28*16, 32, 32, 315, 520, 2, 2)

  // L-образный диван: горизонтальная часть (3×1)
  this.placeTile('limezu-interiors', 0, 34*16, 48, 16, 80, 545, 2, 1)
  // Вертикальная часть (2×1)
  this.placeTile('limezu-interiors', 0, 13*16, 32, 16, 80, 580, 2, 1)

  // Игровой стол (настольный теннис/бильярд, col=0, row=40, 3×2)
  this.placeTile('limezu-interiors', 0, 40*16, 48, 32, 200, 575, 2, 1)

  // Кресло у ТВ (1×1)
  this.placeTile('limezu-interiors', 4*16, 13*16, 16, 16, 400, 600, 2, 1)

  // Пальма в углу (1×2 тайла = 32×64px)
  this.placeTile('limezu-interiors', 11*16, 44*16, 16, 32, 510, 635, 2, 2)

  // Декоративный оверлей зоны (мягкое свечение) — оставить
  const g = this.add.graphics().setDepth(0)
  g.fillStyle(0x1a3a2a, 0.2)
  g.fillEllipse(260, 640, 350, 200)
}
```

---

### 6. `drawSmokingDecor()` — Курилка

```typescript
private drawSmokingDecor() {
  // Вендинг-автомат серый (col=2, row=0, 1×2)
  this.placeTile('limezu-interiors', 2*16, 0, 16, 32, 875, 510, 2, 2)

  // Лавочка/стулья (1×1)
  this.placeTile('limezu-interiors', 0, 15*16, 16, 16, 650, 645, 2, 1)
  this.placeTile('limezu-interiors', 0, 15*16, 16, 16, 690, 645, 2, 1)
  this.placeTile('limezu-interiors', 0, 15*16, 16, 16, 760, 645, 2, 1)

  // Знак "No Smoking" и тёмный оверлей — оставить как graphics
  const g = this.add.graphics().setDepth(1)
  g.fillStyle(0x1a1a1a, 0.4)
  g.fillRect(650, 515, 280, 310)
  g.lineStyle(1, 0x3a3a3a, 0.5)
  g.strokeRect(650, 515, 280, 310)

  // Пепельница (графически) — оставить, тайла нет
  g.fillStyle(0x3a3a3a, 1)
  g.fillRect(776, 590, 8, 60)
  g.fillStyle(0x5a5a5a, 1)
  g.fillEllipse(780, 650, 50, 20)
  g.fillStyle(0x2a2a2a, 1)
  g.fillEllipse(780, 650, 36, 14)

  // No-smoking знак — оставить
  g.fillStyle(0x3a3a3a, 1)
  g.fillRoundedRect(875, 510, 60, 36, 4)
  g.fillStyle(0xf38ba8, 0.8)
  g.fillCircle(905, 528, 14)
  g.lineStyle(2, 0x1a1a1a, 1)
  g.moveTo(895, 518); g.lineTo(915, 538)
  g.strokePath()
}
```

---

### 7. `drawLoungeDecor()` — Лаундж ⭐ САМОЕ ЗАМЕТНОЕ

```typescript
private drawLoungeDecor() {
  // ── Барная стойка (8 тайлов = 256px) ─────────────────────────────
  for (let i = 0; i < 8; i++) {
    this.placeTile('limezu-interiors', 0, 20*16, 16, 16, 1020 + i*32, 545, 2, 1)
  }

  // ── Барные стулья верхний ряд (перед стойкой) ─────────────────────
  ;[1040, 1110, 1180, 1250, 1320, 1390].forEach(x =>
    this.placeTile('limezu-interiors', 0, 22*16, 16, 16, x, 510, 2, 2)
  )

  // ── Барные стулья нижний ряд ──────────────────────────────────────
  ;[1040, 1110, 1180, 1250, 1320, 1390].forEach(x =>
    this.placeTile('limezu-interiors', 0, 22*16, 16, 16, x, 635, 2, 2)
  )

  // ── Тарелки/блюда на столе ────────────────────────────────────────
  ;[1060, 1150, 1240, 1330, 1420].forEach(x =>
    this.placeTile('limezu-interiors', 7*16, 12*16, 16, 16, x, 570, 2, 2)
  )

  // ── Кухонная стойка (нижняя) — столешница ─────────────────────────
  for (let i = 0; i < 8; i++) {
    this.placeTile('limezu-interiors', 0, 20*16, 16, 16, 1010 + i*32, 700, 2, 1)
  }

  // ── Кофемашина (col=8, row=12) ────────────────────────────────────
  this.placeTile('limezu-interiors', 8*16, 12*16, 16, 16, 1020, 680, 2, 2)

  // ── Холодильник (col=0, row=0, 1×2) ──────────────────────────────
  this.placeTile('limezu-interiors', 0, 0, 16, 32, 1680, 510, 2, 2)

  // ── Полка с напитками / витрина (col=5, row=38, 3×2) ──────────────
  this.placeTile('limezu-interiors', 5*16, 38*16, 48, 32, 1680, 570, 2, 2)

  // ── Диван большой (3×1) ───────────────────────────────────────────
  this.placeTile('limezu-interiors', 0, 34*16, 48, 16, 1030, 660, 2, 1)
}
```

---

### 8. `drawPerimeterDecor()` — Периметр

```typescript
private drawPerimeterDecor() {
  // Заменить drawPlant() на тайловые растения
  const plantPositions = [
    { x: 35, y: 35 }, { x: 1744, y: 35 },
    { x: 35, y: 820 }, { x: 1744, y: 820 },
    { x: 884, y: 25 }, { x: 884, y: 846 },
    { x: 25, y: 434 }, { x: 1746, y: 434 },
  ]

  for (const pp of plantPositions) {
    // Пальма (1×2 тайла = 32×64px на экране)
    this.placeTile('limezu-interiors', 11*16, 44*16, 16, 32, pp.x - 16, pp.y - 32, 2, 1)
  }

  // Лампы и постеры — оставить как graphics (они декоративные и уже хорошо выглядят)
  const g = this.add.graphics().setDepth(1)
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
// Метод drawPlant() можно удалить после этого
```

---

## Порядок реализации

1. `drawZoneFloor()` — самый заметный результат
2. `drawWorkZoneDecor()` — столы и мониторы
3. `drawLoungeDecor()` — барная стойка + кухня
4. `drawMeetingDecor()` — конференц-стол
5. `drawChatDecor()` — диваны и вендинг
6. `drawRestDecor()` — ТВ и диваны
7. `drawSmokingDecor()` — минимум изменений
8. `drawPerimeterDecor()` — растения

## Чек-лист

- [ ] Не трогать `drawDirectorOffice()` — уже готов
- [ ] Не трогать спрайты персонажей и их анимации
- [ ] Не трогать `setupCamera()`, `setupMobileControls()`
- [ ] После каждой зоны — проверить в браузере
- [ ] Итоговая сборка: `npm run build` в `apps/frontend/`
- [ ] Убедиться что `placeTile` не создаёт memory leak (маски Phaser)

## Ожидаемый визуал

- Рабочая зона: тёмный паркет + тайловые столы с мониторами
- Переговорная: светлый паркет + длинный конференц-стол + стулья вокруг
- Болталка: голубой ковёр + диваны + вендинг-автомат
- Комната отдыха: тёмный пол + ТВ + диваны + игровой стол
- Курилка: серая плитка + вендинг + лавочки
- Лаундж: паркет + барная стойка + стулья + кофемашина + холодильник
