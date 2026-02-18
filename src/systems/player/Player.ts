/**
 * Player.ts - 玩家控制器
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 第一人称射击 + 物理胶囊体
 */

import * as THREE from 'three';
import { InputManager, InputState } from './InputManager';
import { GAME_CONFIG } from '../core/constants';
import { Core, GameEvent } from '../core';

// ============== 玩家状态 ==============
export enum PlayerState {
  IDLE = 'idle',
  WALKING = 'walking',
  RUNNING = 'running',
  JUMPING = 'jumping',
  CROUCHING = 'crouching',
  AIMING = 'aiming',
  FIRING = 'firing',
  RELOADING = 'reloading',
}

// ============== 玩家类 ==============
export class Player {
  // 核心组件
  private camera: THREE.PerspectiveCamera;
  private inputManager: InputManager;
  private core: Core;
  
  // 变换
  public position: THREE.Vector3 = new THREE.Vector3(0, GAME_CONFIG.PLAYER_HEIGHT, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotation: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  
  // 状态
  public state: PlayerState = PlayerState.IDLE;
  public isGrounded: boolean = true;
  public isSprinting: boolean = false;
  public isAiming: boolean = false;
  
  // 物理属性
  public moveSpeed: number = GAME_CONFIG.MOVE_SPEED;
  public sprintSpeed: number = GAME_CONFIG.SPRINT_SPEED;
  public crouchSpeed: number = GAME_CONFIG.CROUCH_SPEED;
  public jumpForce: number = GAME_CONFIG.JUMP_FORCE;
  
  // 摄像机震动
  private shakeIntensity: number = 0;
  private shakeDecay: number = 5;
  private currentShake: THREE.Vector3 = new THREE.Vector3();
  
  // 瞄准偏移
  private aimOffset: number = 0;
  private targetAimOffset: number = 0;
  
  // 体力
  private stamina: number = 100;
  private maxStamina: number = 100;
  private staminaRegen: number = 10;
  private sprintDrain: number = 20;
  
  constructor(
    camera: THREE.PerspectiveCamera,
    inputManager: InputManager,
    core: Core
  ) {
    this.camera = camera;
    this.inputManager = inputManager;
    this.core = core;
    
    this.init();
  }
  
  // ============== 初始化 ==============
  private init(): void {
    // 注册输入回调
    this.inputManager.onKeyDownRegister('KeyP', () => {
      this.inputManager.requestPointerLock();
    });
    
    this.inputManager.onKeyDownRegister('Escape', () => {
      if (this.inputManager.getState().isPointerLocked) {
        // 暂停逻辑
      }
    });
    
    console.log('[Player] 初始化完成');
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    const inputState = this.inputManager.getState();
    
    // 检查是否在游戏中
    if (!this.inputManager.getState().isPointerLocked) {
      return;
    }
    
    // 更新状态
    this.updateMovement(inputState, deltaTime);
    this.updateRotation(inputState);
    this.updateState(inputState);
    this.updateCameraShake(deltaTime);
    this.updateAimOffset(deltaTime);
    this.updateStamina(deltaTime);
    
    // 应用位置到相机
    this.applyToCamera();
    
    // 更新核心玩家数据
    this.core.updatePlayerPosition(this.position);
    this.core.updatePlayerRotation(this.rotation);
  }
  
  // ============== 移动 ==============
  private updateMovement(inputState: InputState, deltaTime: number): void {
    // 获取移动方向
    const movement = this.inputManager.getMovement();
    
    // 计算目标速度
    let targetSpeed = this.moveSpeed;
    
    // 冲刺
    if (inputState.sprint && this.stamina > 0 && this.isMoving()) {
      this.isSprinting = true;
      targetSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - this.sprintDrain * deltaTime);
    } else {
      this.isSprinting = false;
      // 体力恢复
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
    }
    
    // 蹲下
    if (inputState.crouch) {
      targetSpeed = this.crouchSpeed;
    }
    
    // 计算速度方向
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    forward.applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    right.applyEuler(new THREE.Euler(0, this.rotation.y, 0));
    
    // 计算目标速度
    const targetVelocity = new THREE.Vector3();
    targetVelocity.addScaledVector(forward, -movement.z * targetSpeed);
    targetVelocity.addScaledVector(right, movement.x * targetSpeed);
    
    // 水平移动
    this.velocity.x = targetVelocity.x;
    this.velocity.z = targetVelocity.z;
    
    // 跳跃
    if (inputState.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.state = PlayerState.JUMPING;
    }
    
    // 重力
    if (!this.isGrounded) {
      this.velocity.y -= 20 * deltaTime;
    }
    
    // 应用位置
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    
    // 地面检测
    if (this.position.y <= GAME_CONFIG.PLAYER_HEIGHT) {
      this.position.y = GAME_CONFIG.PLAYER_HEIGHT;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
  }
  
  // ============== 旋转 ==============
  private updateRotation(inputState: InputState): void {
    const mouseDelta = this.inputManager.getMouseDelta();
    
    // 左右旋转 (Yaw)
    this.rotation.y -= mouseDelta.x;
    
    // 上下旋转 (Pitch)
    this.rotation.x -= mouseDelta.y;
    
    // 限制上下旋转角度
    this.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotation.x));
  }
  
  // ============== 状态更新 ==============
  private updateState(inputState: InputState): void {
    if (!this.isGrounded) {
      this.state = PlayerState.JUMPING;
    } else if (inputState.crouch) {
      this.state = PlayerState.CROUCHING;
    } else if (this.isSprinting) {
      this.state = PlayerState.RUNNING;
    } else if (this.inputManager.isMoving()) {
      this.state = PlayerState.WALKING;
    } else if (inputState.aim) {
      this.state = PlayerState.AIMING;
    } else {
      this.state = PlayerState.IDLE;
    }
  }
  
  // ============== 摄像机震动 ==============
  public addShake(intensity: number): void {
    this.shakeIntensity = Math.min(1, this.shakeIntensity + intensity);
  }
  
  private updateCameraShake(deltaTime: number): void {
    if (this.shakeIntensity > 0) {
      // 生成随机震动
      this.currentShake.set(
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1,
        (Math.random() - 0.5) * this.shakeIntensity * 0.1
      );
      
      // 衰减
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * deltaTime);
    } else {
      this.currentShake.set(0, 0, 0);
    }
  }
  
  // ============== 瞄准偏移 ==============
  private updateAimOffset(deltaTime: number): void {
    this.isAiming = this.inputManager.isAiming();
    
    this.targetAimOffset = this.isAiming ? 1 : 0;
    this.aimOffset = THREE.MathUtils.lerp(this.aimOffset, this.targetAimOffset, deltaTime * 10);
  }
  
  // ============== 体力 ==============
  private updateStamina(deltaTime: number): void {
    // 体力恢复在移动逻辑中处理
  }
  
  public getStamina(): number {
    return this.stamina;
  }
  
  public getStaminaRatio(): number {
    return this.stamina / this.maxStamina;
  }
  
  // ============== 应用到相机 ==============
  private applyToCamera(): void {
    // 位置
    this.camera.position.copy(this.position);
    
    // 震动偏移
    const shakeOffset = this.currentShake.clone();
    
    // 瞄准时视角降低
    const aimYOffset = this.aimOffset * 0.1;
    
    this.camera.position.y -= aimYOffset;
    this.camera.position.add(shakeOffset);
    
    // 旋转
    this.camera.rotation.copy(this.rotation);
  }
  
  // ============== 工具方法 ==============
  public isMoving(): boolean {
    return this.inputManager.isMoving();
  }
  
  public getForwardVector(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(this.rotation);
    return forward;
  }
  
  public getRightVector(): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0);
    right.applyEuler(this.rotation);
    return right;
  }
  
  public getAimOffset(): number {
    return this.aimOffset;
  }
  
  public getState(): PlayerState {
    return this.state;
  }
  
  // ============== 伤害 ==============
  public takeDamage(amount: number): void {
    this.core.takeDamage(amount);
    this.addShake(0.5);
  }
  
  // ============== 传送 ==============
  public teleport(position: THREE.Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
  }
}

export default Player;
