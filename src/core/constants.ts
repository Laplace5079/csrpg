/**
 * constants.ts - 全局常量定义
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

// ============== 游戏配置 ==============
export const GAME_CONFIG = {
  // 渲染
  TARGET_FPS: 60,
  WEBGL_VERSION: 2,
  ANTIALIAS: true,
  SHADOW_MAP_SIZE: 2048,
  
  // 物理
  PHYSICS_STEP: 1 / 60,
  MAX_SUBSTEPS: 3,
  GRAVITY: -20,
  
  // AI
  AI_TIME_BUDGET_MS: 8,
  AI_BATCH_SIZE: 10,
  MAX_ACTIVE_ENEMIES: 50,
  
  // 感知
  DEFAULT_VIEW_DISTANCE: 30,
  DEFAULT_VIEW_ANGLE: Math.PI / 2, // 90度
  DEFAULT_HEARING_RANGE: 20,
  
  // 存档
  AUTO_SAVE_INTERVAL: 60000,
  MAX_SAVE_SLOTS: 3,
  
  // 玩家
  PLAYER_HEIGHT: 1.8,
  PLAYER_WIDTH: 0.5,
  MOVE_SPEED: 5.0,
  SPRINT_SPEED: 8.0,
  JUMP_FORCE: 7.0,
  CROUCH_SPEED: 2.5,
  
  // 武器
  DEFAULT_WEAPON: 'quantum_pistol',
  RELOAD_TIME: 2000,
  ADS_SPEED: 0.2,
  
  // 战斗
  HEADSHOT_MULTIPLIER: 2.0,
  CRITICAL_CHANCE: 0.1,
  CRITICAL_DAMAGE: 1.5,
  
  // UI
  DAMAGE_NUMBER_LIFETIME: 1500,
  HEALTH_BAR_WIDTH: 200,
  NOTIFICATION_DURATION: 3000,
  
  // 相机
  FOV: 75,
  NEAR_PLANE: 0.1,
  FAR_PLANE: 1000,
  
  // 调试
  DEBUG_MODE: false,
  SHOW_FPS: true,
} as const;

// ============== 敌人类型 ==============
export enum EnemyType {
  GRUNT = 'grunt',
  SOLDIER = 'soldier',
  ELITE = 'elite',
  BOSS = 'boss',
}

// ============== 难度等级 ==============
export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  NIGHTMARE = 'nightmare',
}

// ============== 难度系数 ==============
export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, {
  enemyHealth: number;
  enemyDamage: number;
  enemyCount: number;
  playerDamage: number;
}> = {
  [Difficulty.EASY]: {
    enemyHealth: 0.7,
    enemyDamage: 0.7,
    enemyCount: 0.7,
    playerDamage: 1.3,
  },
  [Difficulty.NORMAL]: {
    enemyHealth: 1.0,
    enemyDamage: 1.0,
    enemyCount: 1.0,
    playerDamage: 1.0,
  },
  [Difficulty.HARD]: {
    enemyHealth: 1.5,
    enemyDamage: 1.5,
    enemyCount: 1.3,
    playerDamage: 0.8,
  },
  [Difficulty.NIGHTMARE]: {
    enemyHealth: 2.5,
    enemyDamage: 2.0,
    enemyCount: 1.5,
    playerDamage: 0.5,
  },
};

// ============== 物品稀有度 ==============
export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]: '#9d9d9d',
  [ItemRarity.UNCOMMON]: '#1eff00',
  [ItemRarity.RARE]: '#0070dd',
  [ItemRarity.EPIC]: '#a335ee',
  [ItemRarity.LEGENDARY]: '#ff8000',
};

// ============== 武器类型 ==============
export enum WeaponType {
  RIFLE = 'rifle',
  PISTOL = 'pistol',
  SHOTGUN = 'shotgun',
  SNIPER = 'sniper',
  SMG = 'smg',
  LMG = 'lmg',
  GRENADE = 'grenade',
  MELEE = 'melee',
}

export enum FireMode {
  SEMI = 'semi',
  AUTO = 'auto',
  BURST = 'burst',
}

// ============== 敌人状态 ==============
export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  ALERT = 'alert',
  CHASE = 'chase',
  COMBAT = 'combat',
  COVER = 'cover',
  RETREAT = 'retreat',
  DEAD = 'dead',
}

// ============== BOSS 阶段 ==============
export enum BossPhase {
  PHASE_1 = 1,
  PHASE_2 = 2,
  PHASE_3 = 3,
  PHASE_4 = 4,
  PHASE_5 = 5,
}

// ============== 场景类型 ==============
export enum EnvironmentType {
  URBAN = 'urban',
  INDUSTRIAL = 'industrial',
  LABORATORY = 'laboratory',
  NATURE = 'nature',
  SPACE = 'space',
}

// ============== 动画常量 ==============
export const ANIMATIONS = {
  PLAYER_IDLE: 'idle',
  PLAYER_RUN: 'run',
  PLAYER_WALK: 'walk',
  PLAYER_JUMP: 'jump',
  PLAYER_CROUCH: 'crouch',
  PLAYER_SHOOT: 'shoot',
  PLAYER_RELOAD: 'reload',
  
  ENEMY_IDLE: 'idle',
  ENEMY_WALK: 'walk',
  ENEMY_RUN: 'run',
  ENEMY_ATTACK: 'attack',
  ENEMY_DEATH: 'death',
  ENEMY_HURT: 'hurt',
} as const;

// ============== 输入常量 ==============
export const INPUT_KEYS = {
  FORWARD: 'KeyW',
  BACKWARD: 'KeyS',
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  JUMP: 'Space',
  CROUCH: 'KeyC',
  SPRINT: 'ShiftLeft',
  FIRE: 'Mouse0',
  AIM: 'Mouse1',
  RELOAD: 'KeyR',
  WEAPON_1: 'Digit1',
  WEAPON_2: 'Digit2',
  WEAPON_3: 'Digit3',
  INVENTORY: 'Tab',
  MAP: 'M',
  PAUSE: 'Escape',
} as const;

// ============== 资源路径 ==============
export const ASSET_PATHS = {
  MODELS: '/assets/models/',
  TEXTURES: '/assets/textures/',
  AUDIO: '/assets/audio/',
  FONTS: '/assets/fonts/',
} as const;

// ============== 调试常量 ==============
export const DEBUG = {
  SHOW_HITBOXES: false,
  SHOW_PATHS: false,
  SHOW_SENSES: false,
  GOD_MODE: false,
  INFINITE_AMMO: false,
  NO_RELOAD: false,
} as const;

export default GAME_CONFIG;
