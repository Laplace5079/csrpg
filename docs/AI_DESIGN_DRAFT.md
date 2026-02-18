# 《墨境：孤军》CS-RPG PVE 增强版
## 敌人 AI 行为树架构及 PVE 关卡设计草案

---

## 一、架构设计总览

### 1.1 核心目标
- **时长**: 5小时单人战役
- **帧率**: WebGL 2.0 60fps (50+ 敌人同屏)
- **风格**: 80s 赛博朋克 (霓虹/暗色/故障艺术)

### 1.2 技术架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                    WebGL 2.0 渲染管线                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 帧率稳定器   │  │ 时间分片调度 │  │ LOD系统     │             │
│  │ (FPS Stable)│  │(Time-sliced)│  │ (Level of D)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                    AI 执行层                                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ AIManager   │  │ Perception  │  │ Group AI    │             │
│  │ (调度器)    │  │ (视/听觉)   │  │ (群体协作)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                  行为树层 (Behavior Tree)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Sequence    │  │ Selector    │  │ Decorator   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、敌人 AI 行为树架构

### 2.1 节点类型定义

```typescript
// 节点类型
enum BTNodeType {
  SEQUENCE = 'sequence',      // 序列: 全部成功
  SELECTOR = 'selector',       // 选择: 优先尝试
  PARALLEL = 'parallel',       // 并行: 同时执行
  CONDITION = 'condition',      // 条件: 状态判断
  ACTION = 'action',          // 动作: 行为执行
  DECORATOR = 'decorator',     // 装饰: 结果修饰
}

// 节点状态
enum BTNodeStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILURE = 'failure',
}
```

### 2.2 敌人感知系统

```typescript
// 感知配置
interface PerceptionConfig {
  // 视觉
  viewDistance: number;      // 视觉距离 (章节1: 15m, 章节2: 25m, 章节3: 35m)
  viewAngle: number;         // 视角 (弧度, 默认 90°)
  peripheralAngle: number;   // 余光角度 (150°)
  
  // 听觉
  hearingRange: number;      // 听觉半径 (章节1: 10m, 章节2: 20m, 章节3: 30m)
  alertHearingRange: number;  // 警觉听觉半径
  
  // 感知冷却
  perceptionCooldown: number; // 感知刷新间隔 (ms)
}

// 视觉锥计算
class VisionCone {
  static checkVisibility(
    observer: THREE.Vector3,
    target: THREE.Vector3,
    forward: THREE.Vector3,
    config: PerceptionConfig
  ): { visible: boolean; distance: number; angle: number } {
    const direction = new THREE.Vector3().subVectors(target, observer);
    const distance = direction.length();
    
    // 距离检查
    if (distance > config.viewDistance) {
      return { visible: false, distance, angle: 0 };
    }
    
    // 角度检查
    direction.normalize();
    const dot = forward.dot(direction);
    const angle = Math.acos(dot);
    
    const isVisible = angle <= config.viewAngle / 2;
    
    return { visible: isVisible, distance, angle };
  }
}
```

### 2.3 基础行为树结构

```typescript
// 通用敌人行为树
const createEnemyBehaviorTree = (enemyType: EnemyType): BehaviorTree => {
  const root = new BTSelector('root', [
    // 优先级1: 死亡
    new BTSequence('dead', [
      new BTCondition('isDead', ctx => !ctx.isAlive),
      new BTAction('die', ctx => {
        ctx.self.onDeath();
        return NodeStatus.SUCCESS;
      }),
    ]),
    
    // 优先级2: 低血量撤退
    new BTSequence('retreat', [
      new BTCondition('isHealthLow', ctx => ctx.health < ctx.maxHealth * 0.3),
      new BTAction('retreatToCover', ctx => {
        ctx.self.findNearestCover();
        ctx.self.moveToCover();
        return NodeStatus.RUNNING;
      }),
    ]),
    
    // 优先级3: 掩体躲避
    new BTSequence('cover', [
      new BTCondition('isUnderFire', ctx => ctx.custom.isTakingDamage),
      new BTCondition('hasCoverSpots', ctx => ctx.coverSpots.length > 0),
      new BTAction('seekCover', ctx => {
        ctx.self.findAndMoveToCover();
        return NodeStatus.RUNNING;
      }),
    ]),
    
    // 优先级4: 发现目标
    new BTSequence('engage', [
      new BTCondition('hasLineOfSight', ctx => ctx.hasLineOfSight),
      new BTAction('notifyGroup', ctx => {
        // 群体协作: 通知附近敌人
        ctx.self.alertNearbyEnemies();
        return NodeStatus.SUCCESS;
      }),
      new BTSelector('attack_mode', [
        new BTSequence('close_range', [
          new BTCondition('isCloseRange', ctx => ctx.distanceToTarget < 10),
          new BTAction('rushAttack', ctx => ctx.self.rushAttack(ctx.target)),
        ]),
        new BTSequence('mid_range', [
          new BTCondition('isMidRange', ctx => ctx.distanceToTarget < 25),
          new BTAction('suppressFire', ctx => ctx.self.suppressFire(ctx.target)),
        ]),
        new BTSequence('long_range', [
          new BTCondition('isLongRange', ctx => ctx.distanceToTarget >= 25),
          new BTAction('precisionShot', ctx => ctx.self.precisionShot(ctx.target)),
        ]),
      ]),
    ]),
    
    // 优先级5: 巡逻
    new BTSequence('patrol', [
      new BTCondition('hasPatrolPoints', ctx => ctx.patrolPoints.length > 0),
      new BTAction('patrol', ctx => ctx.self.patrol()),
    ]),
    
    // 优先级6: 待机
    new BTAction('idle', ctx => ctx.self.idle()),
  ]);

  return new BehaviorTree(root);
};
```

### 2.4 章节特化 AI 配置

| 章节 | 敌人类型 | AI 复杂度 | 特殊能力 | 感知范围 |
|------|----------|-----------|---------|---------|
| **Ch.1** | 巡逻机器人 | ★☆☆☆☆ | 直线追击, 简单包围 | 15m 视觉, 10m 听觉 |
| **Ch.2** | 战术小队 | ★★★☆☆ | 掩体射击, 侧翼包抄, 扔手雷 | 25m 视觉, 20m 听觉 |
| **Ch.3** | 超凡者 | ★★★★★ | 瞬移, 能量护盾, 召唤小怪, 多阶段 | 35m 视觉, 30m 听觉 |

---

## 三、AI 调度器设计 (Time-Slicing)

### 3.1 AIManager 架构

```typescript
// AIManager.ts - AI 调度器
export class AIManager {
  private enemies: AICharacter[] = [];
  private activeEnemies: Set<string> = new Set();
  private timeBudget: number = 8; // 每帧 8ms 时间预算
  
  // 分帧处理
  private updateBatchSize: number = 10; // 每批处理数量
  private currentBatchIndex: number = 0;
  
  // LOD 距离阈值
  private lodDistances = {
    HIGH: 20,   // 完整 AI
    MEDIUM: 50, // 简化行为
    LOW: 100,   // 仅基础更新
  };

  // 主更新循环
  update(deltaTime: number): void {
    const startTime = performance.now();
    
    // 1. 排序: 按距离/重要性排序
    this.sortEnemiesByPriority();
    
    // 2. 分帧处理
    let processed = 0;
    for (let i = this.currentBatchIndex; i < this.enemies.length; i++) {
      if (processed >= this.updateBatchSize) break;
      if (performance.now() - startTime > this.timeBudget) break;
      
      const enemy = this.enemies[i];
      this.updateEnemy(enemy, deltaTime);
      processed++;
    }
    
    // 3. 轮换批次
    this.currentBatchIndex = (this.currentBatchIndex + this.updateBatchSize) % this.enemies.length;
    
    // 4. 群体协作更新 (每帧只处理一部分)
    this.updateGroupAI();
  }
  
  // LOD 更新
  private updateEnemy(enemy: AICharacter, delta: number): void {
    const distance = enemy.position.distanceTo(player.position);
    
    if (distance < this.lodDistances.HIGH) {
      enemy.updateFull(delta);  // 完整更新
    } else if (distance < this.lodDistances.MEDIUM) {
      enemy.updateSimplified(delta);  // 简化更新
    } else {
      enemy.updateBasic(delta);  // 基础更新 (仅位置)
    }
  }
}
```

---

## 四、掩体系统 (Cover System)

### 4.1 掩体数据

```typescript
interface CoverSpot {
  position: THREE.Vector3;
  quality: number;        // 质量 0-1
  coverType: CoverType;
  directions: THREE.Vector3[]; // 覆盖的方向
  height: number;          // 掩体高度
}

enum CoverType {
  LOW = 'low',           // 低掩体 (需蹲下)
  HIGH = 'high',         // 高掩体 (站立)
  DYNAMIC = 'dynamic',   // 动态掩体 (可破坏)
  ENERGY = 'energy',     // 能量护盾
}

// 掩体选择逻辑
class CoverSystem {
  findBestCover(
    enemy: AICharacter,
    threatPosition: THREE.Vector3,
    coverSpots: CoverSpot[]
  ): CoverSpot | null {
    return coverSpots
      .filter(cover => {
        // 过滤: 必须在敌人和威胁之间
        const toCover = new THREE.Vector3().subVectors(cover.position, enemy.position);
        const toThreat = new THREE.Vector3().subVectors(threatPosition, enemy.position);
        return toCover.angleTo(toThreat) < Math.PI / 2;
      })
      .sort((a, b) => {
        // 优先级: 质量 > 距离
        return b.quality - a.quality || 
               a.position.distanceTo(enemy.position) - b.position.distanceTo(enemy.position);
      })[0] || null;
  }
}
```

---

## 五、群体协作 AI (Group AI)

### 5.1 协作机制

```typescript
interface GroupAI {
  // 发现玩家时通知队友
  alertNearbyEnemies(radius: number = 30): void;
  
  // 包围战术
  executeFlankManuver(target: THREE.Vector3): void;
  
  // 压制火力
  provideSuppressingFire(target: THREE.Vector3): void;
  
  // 治疗受伤队友
  healNearbyAlly(ally: AICharacter): void;
}

// 群体行为示例
class SquadBehavior implements GroupAI {
  alertNearbyEnemies(radius: number): void {
    const nearbyEnemies = this.getEnemiesInRadius(this.position, radius);
    
    for (const enemy of nearbyEnemies) {
      if (enemy.state === AIState.PATROL || enemy.state === AIState.IDLE) {
        enemy.transitionTo(AIState.ALERT);
        enemy.setTarget(this.target);
        
        // 战术分配
        if (enemy.type === EnemyType.FLANKER) {
          enemy.executeFlankManuver(this.target.position);
        } else {
          enemy.approachAndEngage(this.target);
        }
      }
    }
  }
}
```

---

## 六、BOSS 行为设计

### 6.1 BOSS 架构

```typescript
interface BossPhase {
  name: string;
  healthThreshold: number;  // 血量百分比触发
  mechanics: BossMechanic[];
  behaviorTree: BehaviorTree;
}

interface BossConfig {
  id: string;
  name: string;
  phases: BossPhase[];
  enrageTime?: number;      // 狂暴时间 (秒)
  enrageMultiplier: number;  // 狂暴倍率
}

// BOSS 示例: 虚空吞噬者 (Chapter 3)
const VOID_EATER_CONFIG: BossConfig = {
  id: 'boss_void_eater',
  name: '虚空吞噬者',
  phases: [
    {
      name: '形态一: 虚影',
      healthThreshold: 1.0,
      mechanics: [
        { type: 'teleport', cooldown: 5000 },
        { type: 'void_orb', projectileCount: 5 },
      ],
    },
    {
      name: '形态二: 实体',
      healthThreshold: 0.6,
      mechanics: [
        { type: 'dash_attack', damage: 50 },
        { type: 'area_slow', radius: 15 },
        { type: 'summon_minions', count: 3 },
      ],
    },
    {
      name: '形态三: 狂暴',
      healthThreshold: 0.3,
      mechanics: [
        { type: 'beam_attack', warningTime: 2000 },
        { type: 'chaos_teleport', frequency: 1000 },
        { type: 'enrage', multiplier: 1.5 },
      ],
    },
  ],
  enrageTime: 180,
  enrageMultiplier: 2.0,
};
```

### 6.2 BOSS 技能预警系统

```typescript
// 全屏攻击预警
class BossWarningSystem {
  showWarning(type: WarningType, duration: number): void {
    // 显示警告区域
    // 播放警告音效
    // 屏幕震动
    
    switch (type) {
      case WarningType.BEAM:
        this.showLaserWarning();
        break;
      case WarningType.AREA:
        this.showAreaWarning();
        break;
      case WarningType.CHARGE:
        this.showChargeWarning();
        break;
    }
  }
}
```

---

## 七、关卡设计

### 7.1 章节结构

| 章节 | 名称 | 时长 | 敌人类型 | BOSS | 特色机制 |
|------|------|------|-----------|------|---------|
| Ch.1 | **机械觉醒** | 50min | 巡逻机器人 | 巨型机械臂 | 潜行教学 |
| Ch.2 | **灰色地带** | 60min | 战术小队 | 幽灵刺客 | 掩体战斗 |
| Ch.3 | **超凡领域** | 70min | 超凡者 | 虚空吞噬者 | 多阶段BOSS |
| Ch.4 | **核心入侵** | 60min | 混合部队 | 量子核心 | 黑客解谜 |
| Ch.5 | **终末之战** | 60min | 精英敌人 | 最终形态 | 连续BOSS战 |

### 7.2 关卡数据结构

```typescript
interface Level {
  id: string;
  name: string;
  chapter: number;
  duration: number;        // 分钟
  
  // AI 配置
  aiConfig: {
    enemyTypes: string[];
    difficulty: Difficulty;
    perceptionMultiplier: number;
    spawnRate: number;
  };
  
  // 场景
  environment: EnvironmentConfig;
  
  // 敌人波次
  waves: Wave[];
  
  // BOSS
  boss?: BossSpawn;
  
  // 目标
  objectives: Objective[];
  
  // 检查点
  checkpoints: Checkpoint[];
}
```

---

## 八、视觉风格: 80s 赛博朋克

### 8.1 配色方案
- **主色**: 霓虹粉 (#FF00FF), 电光蓝 (#00FFFF)
- **辅色**: 暗紫 (#1A0033), 深蓝 (#000033)
- **强调**: 荧光绿 (#39FF14), 警告红 (#FF073A)

### 8.2 视觉元素
- 扫描线效果 (CRT Style)
- 故障艺术 (Glitch Effects)
- 霓虹边缘光 (Neon Edge Lighting)
- 暗角效果 (Vignette)

---

## 九、验证清单

- [ ] 行为树节点类型完整 (Sequence/Selector/Condition/Action/Decorator)
- [ ] 视觉锥计算正确 (含余光机制)
- [ ] 听觉半径实现
- [ ] AIManager Time-slicing 调度
- [ ] LOD 距离分级
- [ ] 掩体识别与切换
- [ ] 群体协作 (警戒/包围/压制)
- [ ] BOSS 多阶段转换
- [ ] 攻击预警系统
- [ ] 章节特化 AI 配置
- [ ] JSON 关卡解析

---

**确认后启动第一阶段: 高性能 WebGL 框架与 AI 基座**
