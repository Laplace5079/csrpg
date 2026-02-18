/**
 * AICharacter.ts - AI 角色基类
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 敌人基础属性、状态机、行为树集成
 */

import * as THREE from 'three';
import { BehaviorTree } from './BehaviorTree';
import { PerceptionResult, PerceptionConfig, DEFAULT_PERCEPTION_CONFIG } from './Perception';
import { CoverState, CoverSpot } from './CoverSystem';
import { AIState, EnemyType } from '../../core/constants';

// ============== AI 配置 ==============
export interface AIConfig {
  type: EnemyType;
  health: number;
  armor: number;
  damage: number;
  movement: {
    walkSpeed: number;
    runSpeed: number;
    patrolSpeed: number;
    rotationSpeed: number;
    acceleration: number;
    deceleration: number;
    minDistance: number;
    maxDistance: number;
    retreatDistance: number;
  };
  perception: {
    hearingRange: number;
    viewAngle: number;
    viewDistance: number;
  };
}

// ============== 默认 AI 配置 ==============
export const DEFAULT_AI_CONFIG: AIConfig = {
  type: EnemyType.GRUNT,
  health: 50,
  armor: 0,
  damage: 10,
  movement: {
    walkSpeed: 2.0,
    runSpeed: 4.0,
    patrolSpeed: 1.5,
    rotationSpeed: 5.0,
    acceleration: 10.0,
    deceleration: 15.0,
    minDistance: 5.0,
    maxDistance: 20.0,
    retreatDistance: 0.3,
  },
  perception: {
    hearingRange: 20,
    viewAngle: Math.PI / 2,
    viewDistance: 30,
  },
};

// ============== AI 角色类 ==============
export class AICharacter {
  // 基础属性
  public id: string;
  public name: string;
  public type: string;
  
  // 变换
  public position: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  
  // 战斗属性
  public health: number = 100;
  public maxHealth: number = 100;
  public armor: number = 0;
  public damage: number = 10;
  
  // 状态
  public state: AIState = AIState.IDLE;
  public isAlive: boolean = true;
  public isMoving: boolean = false;
  public isAttacking: boolean = false;
  public isInCover: boolean = false;
  
  // 行为树
  public behaviorTree: BehaviorTree | null = null;
  
  // 感知
  public perception: PerceptionResult | null = null;
  public perceptionConfig: PerceptionConfig = DEFAULT_PERCEPTION_CONFIG;
  
  // 掩体
  public canUseCover: boolean = false;
  public coverState: CoverState = {
    currentCover: null,
    targetCover: null,
    isMovingToCover: false,
    coverTimer: 0,
    retreatHealthThreshold: 0.3,
  };
  
  // 目标
  public targetPosition: THREE.Vector3 = new THREE.Vector3();
  public alertTarget: THREE.Vector3 | null = null;
  
  // 巡逻点
  public patrolPoints: THREE.Vector3[] = [];
  public currentPatrolIndex: number = 0;
  
  // 寻路
  public navigationPath: THREE.Vector3[] = [];
  
  // 攻击
  public lastAttackTime: number = 0;
  public attackCooldown: number = 1000;
  public attackRange: number = 10;
  
  // 临时向量
  protected tempVector: THREE.Vector3 = new THREE.Vector3();
  protected tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  
  constructor(id: string, name: string, config: Partial<AIConfig> = {}) {
    this.id = id;
    this.name = name;
    
    const finalConfig = { ...DEFAULT_AI_CONFIG, ...config };
    this.type = finalConfig.type;
    this.health = finalConfig.health;
    this.maxHealth = finalConfig.health;
    this.armor = finalConfig.armor;
    this.damage = finalConfig.damage;
    
    // 设置感知配置
    this.perceptionConfig = {
      ...DEFAULT_PERCEPTION_CONFIG,
      hearingRange: finalConfig.perception.hearingRange,
      viewAngle: finalConfig.perception.viewAngle,
      viewDistance: finalConfig.perception.viewDistance,
    };
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    if (!this.isAlive) return;
    
    // 应用速度
    this.position.addScaledVector(this.velocity, deltaTime);
    
    // 旋转朝向
    this.rotateTowardTarget(deltaTime);
    
    // 状态更新
    this.updateState();
  }
  
  // ============== 基础更新 ==============
  public updateBasic(deltaTime: number): void {
    // 仅更新基本动画/状态
  }
  
  // ============== 完整更新 ==============
  public updateFull(deltaTime: number): void {
    this.update(deltaTime);
  }
  
  // ============== 简化更新 ==============
  public updateSimplified(deltaTime: number): void {
    this.update(deltaTime);
  }
  
  // ============== 状态更新 ==============
  private updateState(): void {
    const speed = this.velocity.length();
    this.isMoving = speed > 0.1;
    
    // 根据速度判断状态
    if (this.isInCover) {
      this.state = AIState.COVER;
    } else if (this.perception?.hasLineOfSight) {
      this.state = AIState.COMBAT;
    } else if (this.isMoving) {
      if (speed > 3) {
        this.state = AIState.CHASE;
      } else {
        this.state = AIState.PATROL;
      }
    } else {
      this.state = AIState.IDLE;
    }
  }
  
  // ============== 转换状态 ==============
  public transitionTo(newState: AIState): void {
    if (this.state === newState) return;
    
    this.state = newState;
    
    // 状态进入逻辑
    switch (newState) {
      case AIState.PATROL:
        this.startPatrol();
        break;
      case AIState.CHASE:
        // 开始追击
        break;
      case AIState.COMBAT:
        this.isAttacking = true;
        break;
      case AIState.RETREAT:
        this.startRetreat();
        break;
    }
  }
  
  // ============== 移动 ==============
  public moveToward(target: THREE.Vector3, deltaTime: number, speed?: number): void {
    this.tempVector.subVectors(target, this.position);
    const distance = this.tempVector.length();
    
    if (distance < 0.5) {
      this.velocity.set(0, 0, 0);
      return;
    }
    
    this.tempVector.normalize();
    const moveSpeed = speed || 2.0;
    this.velocity.copy(this.tempVector.multiplyScalar(moveSpeed));
  }
  
  // ============== 停止移动 ==============
  public stopMoving(): void {
    this.velocity.set(0, 0, 0);
    this.isMoving = false;
  }
  
  // ============== 旋转 ==============
  public rotateTowardTarget(deltaTime: number): void {
    if (this.targetPosition.lengthSq() === 0) return;
    
    this.tempVector.subVectors(this.targetPosition, this.position);
    this.tempVector.y = 0; // 仅水平旋转
    
    if (this.tempVector.lengthSq() < 0.01) return;
    
    this.tempQuaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      this.tempVector.normalize()
    );
    
    // 插值旋转
    this.rotation.y = THREE.MathUtils.lerp(
      this.rotation.y,
      Math.atan2(this.tempVector.x, this.tempVector.z),
      deltaTime * 5
    );
  }
  
  // ============== 攻击 ==============
  public attack(): void {
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldown) return;
    
    this.lastAttackTime = now;
    this.isAttacking = true;
    
    // 实际攻击逻辑由子类实现
    this.performAttack();
  }
  
  protected performAttack(): void {
    // 由子类重写
  }
  
  // ============== 巡逻 ==============
  public startPatrol(): void {
    if (this.patrolPoints.length === 0) return;
    this.currentPatrolIndex = 0;
  }
  
  public patrol(): void {
    if (this.patrolPoints.length === 0) return;
    
    const target = this.patrolPoints[this.currentPatrolIndex];
    const distance = this.position.distanceTo(target);
    
    if (distance < 1) {
      // 前往下一个点
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    } else {
      this.moveToward(target, 0.016, 1.5);
    }
  }
  
  // ============== 掩体 ==============
  public setTargetCover(cover: CoverSpot): void {
    this.coverState.targetCover = cover;
    this.coverState.isMovingToCover = true;
    this.isInCover = false;
  }
  
  public leaveCover(): void {
    this.coverState.currentCover = null;
    this.coverState.targetCover = null;
    this.coverState.isMovingToCover = false;
    this.isInCover = false;
  }
  
  // ============== 警戒 ==============
  public setAlertTarget(position: THREE.Vector3): void {
    this.alertTarget = position.clone();
    this.targetPosition.copy(position);
  }
  
  // ============== 侧翼包抄 ==============
  public executeFlankManuver(target: THREE.Vector3): void {
    // 计算侧翼位置
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      0,
      (Math.random() - 0.5) * 20
    );
    
    this.targetPosition.copy(target).add(offset);
    this.moveToward(this.targetPosition, 0.016, 4.0);
  }
  
  // ============== 撤退 ==============
  private startRetreat(): void {
    // 向远离玩家的方向移动
    this.tempVector.subVectors(this.position, this.targetPosition).normalize();
    this.targetPosition.copy(this.position).addScaledVector(this.tempVector, 20);
  }
  
  // ============== 获取朝向方向 ==============
  public getForwardDirection(out: THREE.Vector3): void {
    out.set(0, 0, 1);
    out.applyEuler(this.rotation);
  }
  
  // ============== 伤害 ==============
  public takeDamage(amount: number): void {
    if (!this.isAlive) return;
    
    // 护甲减免
    let damage = amount;
    if (this.armor > 0) {
      const armorDamage = Math.min(damage * 0.5, this.armor);
      this.armor -= armorDamage;
      damage -= armorDamage;
    }
    
    this.health = Math.max(0, this.health - damage);
    
    if (this.health <= 0) {
      this.die();
    }
  }
  
  // ============== 死亡 ==============
  public die(): void {
    this.isAlive = false;
    this.state = AIState.DEAD;
    this.velocity.set(0, 0, 0);
    this.isAttacking = false;
  }
  
  // ============== 复活 ==============
  public respawn(position: THREE.Vector3): void {
    this.position.copy(position);
    this.health = this.maxHealth;
    this.armor = 0;
    this.isAlive = true;
    this.state = AIState.IDLE;
  }
  
  // ============== 设置行为树 ==============
  public setBehaviorTree(tree: BehaviorTree): void {
    this.behaviorTree = tree;
  }
}

export default AICharacter;
