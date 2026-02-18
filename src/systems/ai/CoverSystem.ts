/**
 * CoverSystem.ts - 掩体系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 掩体识别、选择、移动
 */

import * as THREE from 'three';
import { AICharacter } from './AICharacter';
import { PerceptionResult } from './Perception';

// ============== 掩体类型 ==============
export enum CoverType {
  LOW = 'low',        // 低掩体 (需蹲下)
  HIGH = 'high',      // 高掩体 (站立)
  DYNAMIC = 'dynamic', // 动态掩体 (可破坏)
  ENERGY = 'energy',  // 能量护盾
}

// ============== 掩体数据 ==============
export interface CoverSpot {
  id: string;
  position: THREE.Vector3;
  quality: number;      // 质量 0-1
  coverType: CoverType;
  directions: THREE.Vector3[]; // 覆盖的方向
  height: number;       // 掩体高度
  isDynamic: boolean;   // 是否可破坏
  health?: number;      // 生命值 (可破坏掩体)
}

// ============== 掩体状态 ==============
export interface CoverState {
  currentCover: CoverSpot | null;
  targetCover: CoverSpot | null;
  isMovingToCover: boolean;
  coverTimer: number;
  retreatHealthThreshold: number;
}

// ============== 掩体系统 ==============
export class CoverSystem {
  // 场景中的掩体点
  private coverSpots: Map<string, CoverSpot> = new Map();
  
  // 临时向量
  private tempVector: THREE.Vector3 = new THREE.Vector3();
  private tempDirection: THREE.Vector3 = new THREE.Vector3();
  
  // ============== 初始化 ==============
  public init(scene: THREE.Scene): void {
    // 扫描场景中的掩体
    this.scanForCovers(scene);
    console.log(`[CoverSystem] 扫描到 ${this.coverSpots.size} 个掩体`);
  }
  
  // ============== 扫描掩体 ==============
  private scanForCovers(scene: THREE.Scene): void {
    // 查找标记为 cover 的物体
    scene.traverse((object) => {
      if (object.userData.isCover) {
        this.addCoverSpot(object);
      }
    });
  }
  
  // ============== 添加掩体点 ==============
  public addCoverSpot(object: THREE.Object3D): void {
    const coverType = object.userData.coverType || 'high';
    const quality = object.userData.coverQuality || 0.8;
    
    const coverSpot: CoverSpot = {
      id: `cover_${object.uuid}`,
      position: object.position.clone(),
      quality,
      coverType: coverType as CoverType,
      directions: this.calculateCoverDirections(object),
      height: object.userData.coverHeight || 1.5,
      isDynamic: object.userData.isDynamic || false,
      health: object.userData.coverHealth,
    };
    
    this.coverSpots.set(coverSpot.id, coverSpot);
  }
  
  // ============== 计算掩体方向 ==============
  private calculateCoverDirections(object: THREE.Object3D): THREE.Vector3[] {
    const directions: THREE.Vector3[] = [];
    
    // 四个基本方向
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion);
    const back = forward.clone().negate();
    const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(object.quaternion);
    const right = left.clone().negate();
    
    directions.push(forward, back, left, right);
    
    return directions;
  }
  
  // ============== 查找最佳掩体 ==============
  public findBestCover(
    enemy: AICharacter,
    threatPosition: THREE.Vector3,
    currentCoverState?: CoverState
  ): CoverSpot | null {
    const availableCovers = this.getAvailableCovers(enemy);
    
    if (availableCovers.length === 0) return null;
    
    // 评分掩体
    const scoredCovers = availableCovers.map(cover => ({
      spot: cover,
      score: this.scoreCover(cover, enemy, threatPosition),
    }));
    
    // 排序
    scoredCovers.sort((a, b) => b.score - a.score);
    
    // 返回最佳掩体
    const bestCover = scoredCovers[0]?.spot;
    
    // 如果当前已有掩体，检查是否需要移动
    if (currentCoverState?.currentCover && bestCover) {
      const currentScore = this.scoreCover(currentCoverState.currentCover, enemy, threatPosition);
      // 如果当前掩体评分不比最佳差 20%，保持当前掩体
      if (bestCover.score - currentScore < 0.2) {
        return currentCoverState.currentCover;
      }
    }
    
    return bestCover;
  }
  
  // ============== 获取可用掩体 ==============
  private getAvailableCovers(enemy: AICharacter): CoverSpot[] {
    const maxDistance = 30; // 30米内的掩体
    const covers: CoverSpot[] = [];
    
    this.coverSpots.forEach(cover => {
      const distance = enemy.position.distanceTo(cover.position);
      if (distance < maxDistance && (cover.health === undefined || cover.health > 0)) {
        covers.push(cover);
      }
    });
    
    return covers;
  }
  
  // ============== 评分掩体 ==============
  private scoreCover(
    cover: CoverSpot,
    enemy: AICharacter,
    threatPosition: THREE.Vector3
  ): number {
    let score = 0;
    
    // 1. 距离评分 (越近越好)
    const distance = enemy.position.distanceTo(cover.position);
    score += Math.max(0, (30 - distance) / 30) * 0.3;
    
    // 2. 质量评分
    score += cover.quality * 0.3;
    
    // 3. 方向评分 (必须在敌人和威胁之间)
    this.tempDirection.subVectors(cover.position, enemy.position).normalize();
    const threatDirection = new THREE.Vector3().subVectors(threatPosition, enemy.position).normalize();
    const angleToThreat = this.tempDirection.angleTo(threatDirection);
    
    // 掩体在敌人和威胁之间
    if (angleToThreat < Math.PI / 2) {
      score += 0.4;
    }
    
    // 4. 高度评分
    if (cover.coverType === CoverType.HIGH) {
      score += 0.1;
    }
    
    return score;
  }
  
  // ============== 更新敌人掩体状态 ==============
  public update(
    enemy: AICharacter,
    playerPosition: THREE.Vector3,
    perception: PerceptionResult
  ): void {
    // 需要掩体的情况
    const needsCover = 
      perception.isTakingDamage ||
      perception.distanceToTarget < 15 ||
      (enemy.health < enemy.maxHealth * 0.5 && perception.hasLineOfSight);
    
    if (needsCover && !enemy.coverState?.currentCover) {
      // 寻找新掩体
      const bestCover = this.findBestCover(enemy, playerPosition, enemy.coverState);
      if (bestCover) {
        enemy.setTargetCover(bestCover);
      }
    }
    
    // 更新掩体状态
    if (enemy.coverState?.isMovingToCover) {
      this.moveToCover(enemy);
    }
    
    // 检查掩体状态
    this.checkCoverStatus(enemy, playerPosition);
  }
  
  // ============== 移动到掩体 ==============
  private moveToCover(enemy: AICharacter): void {
    if (!enemy.coverState?.targetCover) return;
    
    const targetPosition = enemy.coverState.targetCover.position;
    const distance = enemy.position.distanceTo(targetPosition);
    
    if (distance < 1) {
      // 到达掩体
      enemy.coverState.currentCover = enemy.coverState.targetCover;
      enemy.coverState.isMovingToCover = false;
      enemy.isInCover = true;
    } else {
      // 移动向掩体
      enemy.moveToward(targetPosition, 0.016);
    }
  }
  
  // ============== 检查掩体状态 ==============
  private checkCoverStatus(enemy: AICharacter, threatPosition: THREE.Vector3): void {
    if (!enemy.coverState?.currentCover) return;
    
    const cover = enemy.coverState.currentCover;
    
    // 检查掩体是否仍然有效
    const coverToThreat = new THREE.Vector3()
      .subVectors(threatPosition, cover.position)
      .normalize();
    const enemyToThreat = new THREE.Vector3()
      .subVectors(threatPosition, enemy.position)
      .normalize();
    
    // 如果威胁绕到掩体后面，考虑撤退
    const angle = coverToThreat.angleTo(enemyToThreat);
    if (angle > Math.PI * 0.7) {
      // 掩体失效，寻找新掩体
      const newCover = this.findBestCover(enemy, threatPosition, enemy.coverState);
      if (newCover && newCover.id !== cover.id) {
        enemy.setTargetCover(newCover);
      } else {
        // 无法找到有效掩体，撤退
        enemy.leaveCover();
      }
    }
    
    // 检查可破坏掩体生命值
    if (cover.isDynamic && cover.health !== undefined && cover.health <= 0) {
      enemy.leaveCover();
    }
  }
  
  // ============== 离开掩体 ==============
  public leaveCover(enemy: AICharacter): void {
    enemy.coverState = {
      currentCover: null,
      targetCover: null,
      isMovingToCover: false,
      coverTimer: 0,
      retreatHealthThreshold: 0.3,
    };
    enemy.isInCover = false;
  }
  
  // ============== 创建测试掩体 ==============
  public createTestCover(position: THREE.Vector3, type: CoverType = CoverType.HIGH): CoverSpot {
    const cover: CoverSpot = {
      id: `test_cover_${Date.now()}`,
      position: position.clone(),
      quality: 0.8,
      coverType: type,
      directions: [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
      ],
      height: type === CoverType.HIGH ? 1.8 : 1.0,
      isDynamic: false,
    };
    
    this.coverSpots.set(cover.id, cover);
    return cover;
  }
  
  // ============== 获取所有掩体 ==============
  public getAllCovers(): CoverSpot[] {
    return Array.from(this.coverSpots.values());
  }
  
  // ============== 调试可视化 ==============
  public getDebugCovers(): any[] {
    const covers: any[] = [];
    this.coverSpots.forEach(cover => {
      covers.push({
        id: cover.id,
        position: cover.position.toArray(),
        quality: cover.quality,
        type: cover.coverType,
      });
    });
    return covers;
  }
  
  // ============== 清理 ==============
  public clear(): void {
    this.coverSpots.clear();
  }
}

export default CoverSystem;
