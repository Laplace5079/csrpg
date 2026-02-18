/**
 * core/index.ts - 核心模块导出
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

export { Core, GAME_CONFIG } from './Core';
export type { PlayerData, InventoryItem, GameProgress, CheckpointData, QuestProgress } from './Core';

export { GameState, GamePhase } from './GameState';

export { SaveSystem } from './SaveSystem';
export type { SaveData, SaveSlot } from './SaveSystem';

export { EventBus, GameEvent } from './EventBus';

export { 
  GAME_CONFIG as CONFIG,
  EnemyType,
  Difficulty,
  ItemRarity,
  WeaponType,
  FireMode,
  AIState,
  BossPhase,
  EnvironmentType,
  ANIMATIONS,
  INPUT_KEYS,
  ASSET_PATHS,
  DEBUG,
  DIFFICULTY_MULTIPLIERS,
  RARITY_COLORS,
} from './constants';
