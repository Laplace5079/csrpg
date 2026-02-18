/**
 * AIManager.ts - AI 调度器
 * 墨境：孤军 (Ink Realm: Lone Army)
 * Time-slicing 调度 + LOD 分级更新
 */

import * as THREE from 'three';
import { AICharacter, AIState } from './AICharacter';
import { PerceptionSystem } from './Perception';
import { CoverSystem } from './CoverSystem';
import { BehaviorTree } from './BehaviorTree';
import { GAME_CONFIG } from '../../core/constants';

// ============== AI 调度器 ==============
export class AIManager {
  // 单例
  private static instance: AIManager;
  public static getInstance(): AIManager {
    if (!AIManager.instance) {
      AIManager.instance = new AIManager();
    }
    return AIManager.instance;
  }
  
  // 敌人列表
  private enemies: Map<string, AICharacter> = new Map();
  
  // 感知系统
  private perception: PerceptionSystem;
  
  // 掩体系统
  private coverSystem: CoverSystem;
  
  // 玩家引用
  private player: any = null;
  private playerPosition: THREE.Vector3 = new THREE.Vector3();
  
  // 时间预算
  private timeBudget: number = GAME_CONFIG.AI_TIME_BUDGET_MS;
  private batchSize: number = GAME_CONFIG.AI_BATCH_SIZE;
  private currentBatchIndex: number = 0;
  
  // LOD 距离阈值
  private lodDistances = {
    HIGH: 20,   // 完整 AI (行为树)
    MEDIUM: 50, // 简化行为 (仅感知)
    LOW: 100,   // 基础更新 (仅位置)
  };
  
  // 性能统计
  private updateTime: number = 0;
  private activeCount: number = 0;
  
  constructor() {
    this.perception = new PerceptionSystem();
    this.coverSystem = new CoverSystem();
  }
  
  // ============== 初始化 ==============
  public init(player: any): void {
    this.player = player;
    console.log('[AIManager] 初始化完成');
  }
  
  // ============== 注册敌人 ==============
  public registerEnemy(enemy: AICharacter): void {
    this.enemies.set(enemy.id, enemy);
    console.log(`[AIManager] 注册敌人: ${enemy.id}`);
  }
  
  // ============== 移除敌人 ==============
  public removeEnemy(enemyId: string): void {
    this.enemies.delete(enemyId);
  }
  
  // ============== 更新玩家位置 ==============
  public updatePlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }
  
  // ============== 主更新循环 ==============
  public update(deltaTime: number): void {
    const startTime = performance.now();
    
    // 排序: 按距离/重要性
    const sortedEnemies = this.sortEnemiesByPriority();
    
    // 分帧处理
    let processed = 0;
    for (let i = this.currentBatchIndex; i < sortedEnemies.length; i++) {
      if (processed >= this.batchSize) break;
      if (performance.now() - startTime > this.timeBudget) break;
      
      const enemy = sortedEnemies[i];
      this.updateEnemy(enemy, deltaTime);
      processed++;
    }
    
    // 轮换批次
    this.currentBatchIndex = (this.currentBatchIndex + processed) % Math.max(1, sortedEnemies.length);
    
    // 群体协作更新 (每帧处理一部分)
    this.updateGroupAI();
    
    // 更新性能统计
    this.updateTime = performance.now() - startTime;
    this.activeCount = this.enemies.size;
  }
  
  // ============== LOD 分级更新 ==============
  private updateEnemy(enemy: AICharacter, deltaTime: number): void {
    const distance = enemy.position.distanceTo(this.playerPosition);
    
    if (distance < this.lodDistances.HIGH) {
      // 完整 AI 更新
      this.updateEnemyFull(enemy, deltaTime);
    } else if (distance < this.lodDistances.MEDIUM) {
      // 简化更新
      this.updateEnemySimplified(enemy, deltaTime);
    } else {
      // 基础更新
      this.updateEnemyBasic(enemy, deltaTime);
    }
  }
  
  // ============== 完整 AI 更新 ==============
  private updateEnemyFull(enemy: AICharacter, deltaTime: number): void {
    if (!enemy.isAlive) return;
    
    // 1. 感知更新
    const perceptionResult = this.perception.update(enemy, this.playerPosition);
    enemy.perception = perceptionResult;
    
    // 2. 掩体决策
    if (enemy.canUseCover) {
      this.coverSystem.update(enemy, this.playerPosition, perceptionResult);
    }
    
    // 3. 行为树更新
    if (enemy.behaviorTree) {
      enemy.behaviorTree.setContext({
        targetPosition: this.playerPosition,
        hasLineOfSight: perceptionResult.hasLineOfSight,
        distanceToTarget: perceptionResult.distanceToTarget,
        isInCover: enemy.isInCover,
        isUnderFire: perceptionResult.isTakingDamage,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
      });
      
      enemy.behaviorTree.update(deltaTime);
    }
    
    // 4. 物理更新
    enemy.update(deltaTime);
  }
  
  // ============== 简化 AI 更新 ==============
  private updateEnemySimplified(enemy: AICharacter, deltaTime: number): void {
    if (!enemy.isAlive) return;
    
    // 仅感知和基本状态更新
    const perceptionResult = this.perception.update(enemy, this.playerPosition);
    enemy.perception = perceptionResult;
    
    // 简化移动
    if (perceptionResult.hasLineOfSight) {
      enemy.moveToward(this.playerPosition, deltaTime);
    }
    
    enemy.update(deltaTime);
  }
  
  // ============== 基础更新 ==============
  private updateEnemyBasic(enemy: AICharacter, deltaTime: number): void {
    if (!enemy.isAlive) return;
    
    // 仅更新动画/状态
    enemy.updateBasic(deltaTime);
  }
  
  // ============== 群体协作 ==============
  private updateGroupAI(): void {
    // 检查是否有敌人发现玩家
    this.enemies.forEach(enemy => {
      if (enemy.isAlive && enemy.perception?.hasLineOfSight) {
        // 通知附近敌人
        this.alertNearbyEnemies(enemy);
      }
    });
  }
  
  // ============== 警报附近敌人 ==============
  private alertNearbyEnemies(sourceEnemy: AICharacter): void {
    const alertRadius = 30; // 30米内的敌人
    
    this.enemies.forEach(enemy => {
      if (enemy.id === sourceEnemy.id || !enemy.isAlive) return;
      
      const distance = enemy.position.distanceTo(sourceEnemy.position);
      if (distance < alertRadius) {
        // 转换为警戒状态
        enemy.transitionTo(AIState.ALERT);
        enemy.setAlertTarget(this.playerPosition);
        
        // 战术分配
        if (enemy.type === 'flanker') {
          enemy.executeFlankManuver(this.playerPosition);
        }
      }
    });
  }
  
  // ============== 按优先级排序 ==============
  private sortEnemiesByPriority(): AICharacter[] {
    return Array.from(this.enemies.values()).sort((a, b) => {
      // 优先级: 战斗状态 > 低血量 > 距离
      const aPriority = this.getPriority(a);
      const bPriority = this.getPriority(b);
      return bPriority - aPriority;
    });
  }
  
  private getPriority(enemy: AICharacter): number {
    let priority = 0;
    
    // 战斗状态 +3
    if (enemy.state === AIState.COMBAT || enemy.state === AIState.CHASE) {
      priority += 3;
    }
    
    // 警戒状态 +2
    if (enemy.state === AIState.ALERT) {
      priority += 2;
    }
    
    // 低血量 +1
    if (enemy.health < enemy.maxHealth * 0.3) {
      priority += 1;
    }
    
    // 距离越近优先级越高
    const distance = enemy.position.distanceTo(this.playerPosition);
    priority += Math.max(0, (100 - distance) / 100);
    
    return priority;
  }
  
  // ============== 获取统计 ==============
  public getStats(): {
    totalEnemies: number;
    activeCount: number;
    updateTime: number;
  } {
    return {
      totalEnemies: this.enemies.size,
      activeCount: this.activeCount,
      updateTime: this.updateTime,
    };
  }
  
  // ============== 清理 ==============
  public clear(): void {
    this.enemies.clear();
    this.currentBatchIndex = 0;
  }
  
  // ============== 调试 ==============
  public getDebugInfo(): any {
    const enemies: any[] = [];
    this.enemies.forEach(enemy => {
      enemies.push({
        id: enemy.id,
        type: enemy.type,
        state: enemy.state,
        health: enemy.health,
        position: enemy.position.toArray(),
        distanceToPlayer: enemy.position.distanceTo(this.playerPosition),
      });
    });
    
    return {
      enemies,
      stats: this.getStats(),
    };
  }
}

export default AIManager;
