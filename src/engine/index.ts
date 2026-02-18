/**
 * engine/index.ts - 引擎模块导出
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

export { InputManager } from './InputManager';
export type { InputState } from './InputManager';

export { ObjectPool } from './ObjectPool';
export type { Poolable } from './ObjectPool';
export { BulletPoolManager, ParticlePoolManager, PooledBullet, PooledParticle } from './ObjectPool';

export { InstancedRenderer } from './InstancedRenderer';
export { EnvironmentInstancedRenderer, EnemyInstancedRenderer, EffectInstancedRenderer, BulletInstancedRenderer } from './InstancedRenderer';
