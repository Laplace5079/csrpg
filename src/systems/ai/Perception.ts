/**
 * Perception.ts - 感知系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 视觉锥 + 听觉半径 + 伤害检测
 */

import * as THREE from 'three';
import { AICharacter } from './AICharacter';

// ============== 感知结果 ==============
export interface PerceptionResult {
  // 视觉
  hasLineOfSight: boolean;
  visiblePosition: THREE.Vector3 | null;
  distanceToTarget: number;
  angleToTarget: number;
  
  // 听觉
  canHear: boolean;
  hearingSensitivity: number;
  
  // 状态
  isTakingDamage: boolean;
  lastDamagePosition: THREE.Vector3 | null;
  lastDamageTime: number;
  
  // 时间
  timeSinceLastSeen: number;
  timeSinceLastHeard: number;
}

// ============== 感知配置 ==============
export interface PerceptionConfig {
  // 视觉
  viewDistance: number;
  viewAngle: number;
  peripheralAngle: number;
  
  // 听觉
  hearingRange: number;
  alertHearingRange: number;
  
  // 感知冷却
  perceptionCooldown: number;
  
  // 记忆时间
  memoryDuration: number;
}

// ============== 默认感知配置 ==============
export const DEFAULT_PERCEPTION_CONFIG: PerceptionConfig = {
  viewDistance: 30,
  viewAngle: Math.PI / 2, // 90度
  peripheralAngle: Math.PI * 0.8, // 144度
  hearingRange: 20,
  alertHearingRange: 30,
  perceptionCooldown: 100, // 100ms
  memoryDuration: 3000, // 3秒记忆
};

// ============== 感知系统 ==============
export class PerceptionSystem {
  // 玩家最后已知位置
  private lastKnownPosition: THREE.Vector3 = new THREE.Vector3();
  
  // 记忆时间
  private lastSeenTime: number = 0;
  private lastHeardTime: number = 0;
  
  // 伤害追踪
  private lastDamagePosition: THREE.Vector3 | null = null;
  private lastDamageTime: number = 0;
  
  // 临时向量
  private tempVector: THREE.Vector3 = new THREE.Vector3();
  private tempDirection: THREE.Vector3 = new THREE.Vector3();
  private tempForward: THREE.Vector3 = new THREE.Vector3();
  
  // ============== 更新感知 ==============
  public update(enemy: AICharacter, targetPosition: THREE.Vector3): PerceptionResult {
    const config = enemy.perceptionConfig || DEFAULT_PERCEPTION_CONFIG;
    const now = performance.now();
    
    // 计算方向
    this.tempVector.subVectors(targetPosition, enemy.position);
    const distanceToTarget = this.tempVector.length();
    this.tempVector.normalize();
    
    // 获取敌人朝向
    enemy.getForwardDirection(this.tempForward);
    
    // 计算角度
    const angleToTarget = this.tempForward.angleTo(this.tempVector);
    
    // 视觉检测
    const hasLineOfSight = this.checkVision(
      enemy.position,
      this.tempForward,
      targetPosition,
      config
    );
    
    if (hasLineOfSight) {
      this.lastKnownPosition.copy(targetPosition);
      this.lastSeenTime = now;
    }
    
    // 听觉检测
    const canHear = this.checkHearing(
      enemy.position,
      targetPosition,
      distanceToTarget,
      config
    );
    
    if (canHear) {
      this.lastHeardTime = now;
    }
    
    // 伤害检测
    const isTakingDamage = this.checkDamage(enemy);
    
    return {
      hasLineOfSight,
      visiblePosition: hasLineOfSight ? targetPosition.clone() : null,
      distanceToTarget,
      angleToTarget,
      canHear,
      hearingSensitivity: this.getHearingSensitivity(enemy),
      isTakingDamage,
      lastDamagePosition: this.lastDamagePosition,
      lastDamageTime: this.lastDamageTime,
      timeSinceLastSeen: now - this.lastSeenTime,
      timeSinceLastHeard: now - this.lastHeardTime,
    };
  }
  
  // ============== 视觉检测 ==============
  private checkVision(
    enemyPosition: THREE.Vector3,
    enemyForward: THREE.Vector3,
    targetPosition: THREE.Vector3,
    config: PerceptionConfig
  ): boolean {
    // 计算到目标的方向
    this.tempDirection.subVectors(targetPosition, enemyPosition);
    const distance = this.tempDirection.length();
    this.tempDirection.normalize();
    
    // 距离检查
    if (distance > config.viewDistance) {
      return false;
    }
    
    // 角度检查 (主视野)
    const dot = enemyForward.dot(this.tempDirection);
    const viewHalfAngle = config.viewAngle / 2;
    
    if (dot >= Math.cos(viewHalfAngle)) {
      return true;
    }
    
    // 余光检查
    if (dot >= Math.cos(config.peripheralAngle / 2)) {
      // 余光感知距离减半
      return distance < config.viewDistance * 0.5;
    }
    
    return false;
  }
  
  // ============== 听觉检测 ==============
  private checkHearing(
    enemyPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    distance: number,
    config: PerceptionConfig
  ): boolean {
    // 检查目标是否在听觉范围内
    if (distance > config.alertHearingRange) {
      return false;
    }
    
    // TODO: 检测声音源 (脚步声、射击声)
    // 暂时返回距离检测
    return distance < config.hearingRange;
  }
  
  // ============== 伤害检测 ==============
  private checkDamage(enemy: AICharacter): boolean {
    const now = performance.now();
    
    // 检查是否在受伤冷却期内
    if (now - this.lastDamageTime < 1000) {
      return true;
    }
    
    return false;
  }
  
  // ============== 记录伤害 ==============
  public recordDamage(position: THREE.Vector3): void {
    this.lastDamagePosition = position.clone();
    this.lastDamageTime = performance.now();
  }
  
  // ============== 听觉灵敏度 ==============
  private getHearingSensitivity(enemy: AICharacter): number {
    // 根据敌人类型和环境条件计算
    let sensitivity = 1.0;
    
    // 精英敌人听力更好
    if (enemy.type === 'elite') {
      sensitivity = 1.5;
    } else if (enemy.type === 'soldier') {
      sensitivity = 1.2;
    }
    
    return sensitivity;
  }
  
  // ============== 获取最后已知位置 ==============
  public getLastKnownPosition(): THREE.Vector3 {
    return this.lastKnownPosition.clone();
  }
  
  // ============== 是否记得目标位置 ==============
  public remembersTarget(config: PerceptionConfig): boolean {
    const now = performance.now();
    return (now - this.lastSeenTime) < config.memoryDuration ||
           (now - this.lastHeardTime) < config.memoryDuration;
  }
  
  // ============== 射线检测 (可选) ==============
  public static raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    scene: THREE.Scene,
    maxDistance: number
  ): THREE.Intersection | null {
    const raycaster = new THREE.Raycaster(origin, direction, 0, maxDistance);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    return intersects.length > 0 ? intersects[0] : null;
  }
  
  // ============== 视野锥可视化 ==============
  public static createVisionConeMesh(
    viewDistance: number,
    viewAngle: number,
    color: number = 0xff0000
  ): THREE.Mesh {
    const geometry = new THREE.ConeGeometry(
      viewDistance * Math.tan(viewAngle / 2),
      viewDistance,
      32,
      1,
      true
    );
    
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    
    return mesh;
  }
  
  // ============== 听觉圈可视化 ==============
  public static createHearingCircleMesh(
    radius: number,
    color: number = 0x00ff00
  ): THREE.Mesh {
    const geometry = new THREE.RingGeometry(0.1, radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    return new THREE.Mesh(geometry, material);
  }
}

export default PerceptionSystem;
