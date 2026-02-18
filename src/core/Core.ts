/**
 * Core.ts - 全局数据总线与游戏状态管理
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

import { GameState, GamePhase } from './GameState';
import { SaveSystem } from './SaveSystem';
import { EventBus, GameEvent } from './EventBus';
import * as THREE from 'three';

// ============== 全局常量 ==============
export const GAME_CONFIG = {
  // 渲染
  TARGET_FPS: 60,
  WEBGL_VERSION: 2,
  
  // 物理
  PHYSICS_STEP: 1 / 60,
  MAX_SUBSTEPS: 3,
  
  // AI
  AI_TIME_BUDGET_MS: 8,
  AI_BATCH_SIZE: 10,
  MAX_ACTIVE_ENEMIES: 50,
  
  // 存档
  AUTO_SAVE_INTERVAL: 60000, // 60秒
  MAX_SAVE_SLOTS: 3,
  
  // 玩家
  PLAYER_HEIGHT: 1.8,
  PLAYER_WIDTH: 0.5,
  MOVE_SPEED: 5.0,
  SPRINT_SPEED: 8.0,
  JUMP_FORCE: 7.0,
  
  // 武器
  DEFAULT_WEAPON: 'quantum_pistol',
  RELOAD_TIME: 2000,
  
  // UI
  DAMAGE_NUMBER_LIFETIME: 1500,
  HEALTH_BAR_WIDTH: 200,
} as const;

// ============== 玩家数据 ==============
export interface PlayerData {
  // 基础
  id: string;
  name: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  
  // 战斗属性
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  
  // 经验
  level: number;
  experience: number;
  experienceToNextLevel: number;
  
  // 武器
  currentWeapon: string;
  weapons: string[];
  
  // 技能
  unlockedSkills: string[];
  
  // 物品
  inventory: InventoryItem[];
  currency: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'key';
  quantity: number;
  equipped?: boolean;
}

// ============== 游戏进度 ==============
export interface GameProgress {
  currentChapter: number;
  currentLevel: string;
  completedLevels: string[];
  checkPoints: CheckpointData[];
  questProgress: Record<string, QuestProgress>;
}

export interface CheckpointData {
  id: string;
  levelId: string;
  position: THREE.Vector3;
  playerData: PlayerData;
  timestamp: number;
}

export interface QuestProgress {
  questId: string;
  status: 'available' | 'active' | 'completed' | 'failed';
  progress: number;
  objectives: Record<string, boolean>;
}

// ============== Core 类 ==============
export class Core {
  // 单例
  private static instance: Core;
  public static getInstance(): Core {
    if (!Core.instance) {
      Core.instance = new Core();
    }
    return Core.instance;
  }
  
  // 核心系统
  public gameState: GameState;
  public saveSystem: SaveSystem;
  public eventBus: EventBus;
  
  // 玩家数据
  public player: PlayerData;
  
  // 游戏进度
  public progress: GameProgress;
  
  // 渲染器引用
  public renderer: THREE.WebGLRenderer | null = null;
  public scene: THREE.Scene | null = null;
  public camera: THREE.PerspectiveCamera | null = null;
  
  // 物理世界引用
  public physicsWorld: any = null;
  
  // 时间管理
  private lastTime: number = 0;
  private deltaTime: number = 0;
  private elapsedTime: number = 0;
  
  // 标志
  public isPaused: boolean = false;
  public isLoading: boolean = false;
  
  private constructor() {
    this.gameState = new GameState();
    this.saveSystem = new SaveSystem();
    this.eventBus = new EventBus();
    
    this.player = this.createDefaultPlayer();
    this.progress = this.createDefaultProgress();
    
    this.setupEventListeners();
  }
  
  // ============== 初始化 ==============
  public initialize(): void {
    console.log('[Core] 初始化墨境：孤军...');
    
    // 尝试自动加载存档
    const savedData = this.saveSystem.autoLoad();
    if (savedData) {
      this.loadGame(savedData);
      console.log('[Core] 自动加载存档成功');
    }
    
    this.gameState.setPhase(GamePhase.MAIN_MENU);
    this.eventBus.emit(GameEvent.CORE_INITIALIZED, this);
  }
  
  // ============== 游戏循环 ==============
  public update(currentTime: number): void {
    if (this.isPaused || this.isLoading) return;
    
    this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.elapsedTime += this.deltaTime;
    
    // 更新游戏状态
    this.gameState.update(this.deltaTime);
    
    // 发出帧更新事件
    this.eventBus.emit(GameEvent.FRAME_UPDATE, {
      deltaTime: this.deltaTime,
      elapsedTime: this.elapsedTime,
    });
  }
  
  // ============== 玩家操作 ==============
  public updatePlayerPosition(position: THREE.Vector3): void {
    this.player.position.copy(position);
    this.eventBus.emit(GameEvent.PLAYER_MOVED, position);
  }
  
  public updatePlayerRotation(rotation: THREE.Euler): void {
    this.player.rotation.copy(rotation);
  }
  
  public takeDamage(amount: number): void {
    // 护甲减免
    let damage = amount;
    if (this.player.armor > 0) {
      const armorDamage = Math.min(damage * 0.5, this.player.armor);
      this.player.armor -= armorDamage;
      damage -= armorDamage;
    }
    
    this.player.health = Math.max(0, this.player.health - damage);
    
    this.eventBus.emit(GameEvent.PLAYER_DAMAGED, {
      amount,
      currentHealth: this.player.health,
      maxHealth: this.player.maxHealth,
    });
    
    if (this.player.health <= 0) {
      this.onPlayerDeath();
    }
  }
  
  public heal(amount: number): void {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    this.eventBus.emit(GameEvent.PLAYER_HEALED, amount);
  }
  
  public addExperience(amount: number): void {
    this.player.experience += amount;
    
    // 检查升级
    while (this.player.experience >= this.player.experienceToNextLevel) {
      this.levelUp();
    }
    
    this.eventBus.emit(GameEvent.EXPERIENCE_GAINED, amount);
  }
  
  private levelUp(): void {
    this.player.level++;
    this.player.experience -= this.player.experienceToNextLevel;
    this.player.experienceToNextLevel = this.calculateExpForLevel(this.player.level + 1);
    
    // 属性提升
    this.player.maxHealth += 10;
    this.player.health = this.player.maxHealth;
    this.player.maxArmor += 5;
    
    this.eventBus.emit(GameEvent.LEVEL_UP, this.player.level);
  }
  
  private calculateExpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }
  
  // ============== 游戏流程 ==============
  public startNewGame(): void {
    console.log('[Core] 开始新游戏...');
    
    this.player = this.createDefaultPlayer();
    this.progress = this.createDefaultProgress();
    
    this.gameState.setPhase(GamePhase.PLAYING);
    this.eventBus.emit(GameEvent.GAME_STARTED, null);
  }
  
  public loadGame(data: any): void {
    this.player = data.player;
    this.progress = data.progress;
    this.gameState.setPhase(GamePhase.PLAYING);
  }
  
  public saveGame(slot: number = 0): void {
    const saveData = {
      player: this.player,
      progress: this.progress,
      timestamp: Date.now(),
    };
    this.saveSystem.save(slot, saveData);
    this.eventBus.emit(GameEvent.GAME_SAVED, slot);
  }
  
  public pauseGame(): void {
    this.isPaused = true;
    this.gameState.setPhase(GamePhase.PAUSED);
    this.eventBus.emit(GameEvent.GAME_PAUSED, null);
  }
  
  public resumeGame(): void {
    this.isPaused = false;
    this.gameState.setPhase(GamePhase.PLAYING);
    this.eventBus.emit(GameEvent.GAME_RESUMED, null);
  }
  
  public quitGame(): void {
    this.saveGame(0); // 自动存档
    this.gameState.setPhase(GamePhase.MAIN_MENU);
    this.eventBus.emit(GameEvent.GAME_QUIT, null);
  }
  
  // ============== 关卡管理 ==============
  public loadLevel(levelId: string): void {
    this.isLoading = true;
    this.gameState.setPhase(GamePhase.LOADING);
    
    this.progress.currentLevel = levelId;
    
    this.eventBus.emit(GameEvent.LEVEL_LOADING, levelId);
    
    // 模拟加载 (实际会从 JSON 加载)
    setTimeout(() => {
      this.isLoading = false;
      this.gameState.setPhase(GamePhase.PLAYING);
      this.eventBus.emit(GameEvent.LEVEL_LOADED, levelId);
    }, 500);
  }
  
  public completeLevel(levelId: string): void {
    if (!this.progress.completedLevels.includes(levelId)) {
      this.progress.completedLevels.push(levelId);
    }
    
    this.eventBus.emit(GameEvent.LEVEL_COMPLETED, levelId);
  }
  
  // ============== 私有方法 ==============
  private createDefaultPlayer(): PlayerData {
    return {
      id: 'player_1',
      name: '墨羽',
      position: new THREE.Vector3(0, 1.8, 0),
      rotation: new THREE.Euler(0, 0, 0),
      health: 100,
      maxHealth: 100,
      armor: 0,
      maxArmor: 50,
      level: 1,
      experience: 0,
      experienceToNextLevel: 100,
      currentWeapon: GAME_CONFIG.DEFAULT_WEAPON,
      weapons: [GAME_CONFIG.DEFAULT_WEAPON],
      unlockedSkills: [],
      inventory: [],
      currency: 0,
    };
  }
  
  private createDefaultProgress(): GameProgress {
    return {
      currentChapter: 0,
      currentLevel: 'level_0',
      completedLevels: [],
      checkPoints: [],
      questProgress: {},
    };
  }
  
  private onPlayerDeath(): void {
    this.gameState.setPhase(GamePhase.GAME_OVER);
    this.eventBus.emit(GameEvent.PLAYER_DEATH, null);
  }
  
  private setupEventListeners(): void {
    // 自动存档
    setInterval(() => {
      if (this.gameState.getPhase() === GamePhase.PLAYING) {
        this.saveGame(0);
      }
    }, GAME_CONFIG.AUTO_SAVE_INTERVAL);
  }
  
  // ============== 调试 ==============
  public getDebugInfo(): Record<string, any> {
    return {
      phase: this.gameState.getPhase(),
      fps: 1 / this.deltaTime,
      player: {
        position: this.player.position.toArray(),
        health: this.player.health,
        level: this.player.level,
      },
      elapsedTime: this.elapsedTime,
      isPaused: this.isPaused,
    };
  }
}

// ============== 导出 ==============
export default Core;
