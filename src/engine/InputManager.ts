/**
 * InputManager.ts - 输入管理系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

import { INPUT_KEYS } from '../core/constants';

// ============== 输入状态 ==============
export interface InputState {
  // 移动
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  
  // 动作
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  
  // 射击
  fire: boolean;
  aim: boolean;
  reload: boolean;
  
  // 武器切换
  weapon1: boolean;
  weapon2: boolean;
  weapon3: boolean;
  
  // 系统
  inventory: boolean;
  map: boolean;
  pause: boolean;
  
  // 鼠标
  mouseX: number;
  mouseY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  mouseScroll: number;
  
  // 指针锁定
  isPointerLocked: boolean;
}

// ============== 输入管理器 ==============
export class InputManager {
  private state: InputState;
  private previousState: Partial<InputState>;
  
  // 鼠标灵敏度
  public sensitivity: number = 0.002;
  public aimSensitivity: number = 0.001;
  
  // 回调
  private keyDownCallbacks: Map<string, () => void> = new Map();
  private keyUpCallbacks: Map<string, () => void> = new Map();
  
  // 目标元素
  private targetElement: HTMLElement | null = null;
  
  constructor() {
    this.state = this.createDefaultState();
    this.previousState = {};
  }
  
  // ============== 初始化 ==============
  public init(element: HTMLElement): void {
    this.targetElement = element;
    
    // 键盘事件
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    
    // 鼠标事件
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('wheel', (e) => this.onMouseWheel(e));
    
    // 指针锁定
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('pointerlockerror', () => this.onPointerLockError());
    
    // 鼠标按下/抬起
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));
    
    console.log('[InputManager] 初始化完成');
  }
  
  // ============== 指针锁定 ==============
  public requestPointerLock(): void {
    if (this.targetElement) {
      this.targetElement.requestPointerLock();
    }
  }
  
  public exitPointerLock(): void {
    document.exitPointerLock();
  }
  
  private onPointerLockChange(): void {
    this.state.isPointerLocked = document.pointerLockElement === this.targetElement;
    console.log('[InputManager] 指针锁定:', this.state.isPointerLocked);
  }
  
  private onPointerLockError(): void {
    console.error('[InputManager] 指针锁定失败');
  }
  
  // ============== 键盘事件 ==============
  private onKeyDown(e: KeyboardEvent): void {
    const key = e.code;
    
    // 阻止默认行为
    if (['Space', 'Tab', 'KeyM', 'KeyR'].includes(key)) {
      e.preventDefault();
    }
    
    this.setKeyState(key, true);
    
    // 触发回调
    const callback = this.keyDownCallbacks.get(key);
    if (callback) callback();
  }
  
  private onKeyUp(e: KeyboardEvent): void {
    const key = e.code;
    this.setKeyState(key, false);
    
    // 触发回调
    const callback = this.keyUpCallbacks.get(key);
    if (callback) callback();
  }
  
  private setKeyState(key: string, value: boolean): void {
    switch (key) {
      case INPUT_KEYS.FORWARD: this.state.forward = value; break;
      case INPUT_KEYS.BACKWARD: this.state.backward = value; break;
      case INPUT_KEYS.LEFT: this.state.left = value; break;
      case INPUT_KEYS.RIGHT: this.state.right = value; break;
      case INPUT_KEYS.JUMP: this.state.jump = value; break;
      case INPUT_KEYS.CROUCH: this.state.crouch = value; break;
      case INPUT_KEYS.SPRINT: this.state.sprint = value; break;
      case INPUT_KEYS.RELOAD: this.state.reload = value; break;
      case INPUT_KEYS.WEAPON_1: this.state.weapon1 = value; break;
      case INPUT_KEYS.WEAPON_2: this.state.weapon2 = value; break;
      case INPUT_KEYS.WEAPON_3: this.state.weapon3 = value; break;
      case INPUT_KEYS.INVENTORY: this.state.inventory = value; break;
      case INPUT_KEYS.MAP: this.state.map = value; break;
      case INPUT_KEYS.PAUSE: this.state.pause = value; break;
    }
  }
  
  // ============== 鼠标事件 ==============
  private onMouseMove(e: MouseEvent): void {
    if (this.state.isPointerLocked) {
      this.state.mouseDeltaX += e.movementX;
      this.state.mouseDeltaY += e.movementY;
    }
  }
  
  private onMouseWheel(e: WheelEvent): void {
    this.state.mouseScroll += e.deltaY;
  }
  
  private onMouseDown(e: MouseEvent): void {
    switch (e.button) {
      case 0: // 左键
        this.state.fire = true;
        break;
      case 1: // 中键
        this.state.aim = true;
        break;
      case 2: // 右键
        this.state.aim = true;
        break;
    }
  }
  
  private onMouseUp(e: MouseEvent): void {
    switch (e.button) {
      case 0:
        this.state.fire = false;
        break;
      case 1:
      case 2:
        this.state.aim = false;
        break;
    }
  }
  
  // ============== 更新 ==============
  public update(): void {
    // 保存上一帧状态
    this.previousState = { ...this.state };
    
    // 重置增量
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    this.state.mouseScroll = 0;
  }
  
  // ============== 获取输入 ==============
  public getState(): InputState {
    return this.state;
  }
  
  public getMovement(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    
    if (this.state.forward) z -= 1;
    if (this.state.backward) z += 1;
    if (this.state.left) x -= 1;
    if (this.state.right) x += 1;
    
    // 归一化
    const length = Math.sqrt(x * x + z * z);
    if (length > 0) {
      x /= length;
      z /= length;
    }
    
    return { x, z };
  }
  
  public getMouseDelta(): { x: number; y: number } {
    const sens = this.state.aim ? this.aimSensitivity : this.sensitivity;
    return {
      x: this.state.mouseDeltaX * sens,
      y: this.state.mouseDeltaY * sens,
    };
  }
  
  public isMoving(): boolean {
    return this.state.forward || this.state.backward || this.state.left || this.state.right;
  }
  
  public isSprinting(): boolean {
    return this.state.sprint && this.isMoving();
  }
  
  public isFiring(): boolean {
    return this.state.fire && this.state.isPointerLocked;
  }
  
  public isAiming(): boolean {
    return this.state.aim && this.state.isPointerLocked;
  }
  
  // ============== 回调注册 ==============
  public onKeyDownRegister(key: string, callback: () => void): void {
    this.keyDownCallbacks.set(key, callback);
  }
  
  public onKeyUpRegister(key: string, callback: () => void): void {
    this.keyUpCallbacks.set(key, callback);
  }
  
  // ============== 工具 ==============
  private createDefaultState(): InputState {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      sprint: false,
      fire: false,
      aim: false,
      reload: false,
      weapon1: false,
      weapon2: false,
      weapon3: false,
      inventory: false,
      map: false,
      pause: false,
      mouseX: 0,
      mouseY: 0,
      mouseDeltaX: 0,
      mouseDeltaY: 0,
      mouseScroll: 0,
      isPointerLocked: false,
    };
  }
  
  public setSensitivity(value: number): void {
    this.sensitivity = value;
  }
  
  public setAimSensitivity(value: number): void {
    this.aimSensitivity = value;
  }
}

export default InputManager;
