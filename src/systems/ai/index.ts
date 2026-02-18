/**
 * systems/ai/index.ts - AI 系统导出
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

export { AIManager } from './AIManager';
export { PerceptionSystem } from './Perception';
export type { PerceptionResult, PerceptionConfig } from './Perception';

export { CoverSystem } from './CoverSystem';
export type { CoverSpot, CoverState, CoverType } from './CoverSystem';

export { BehaviorTree } from './BehaviorTree';
export { AICharacter } from './AICharacter';
export type { AIConfig } from './AICharacter';

// Re-export enemy types
export { EnemyType, AIState } from '../../core/constants';
