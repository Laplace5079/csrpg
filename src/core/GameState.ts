/**
 * GameState.ts - 游戏状态机
 * 墨境：孤军 (Ink Realm: Lone Army)
 */

// ============== 游戏阶段 ==============
export enum GamePhase {
  // 初始状态
  INITIAL = 'initial',
  
  // 菜单
  MAIN_MENU = 'main_menu',
  LOADING = 'loading',
  
  // 游戏中
  PLAYING = 'playing',
  PAUSED = 'paused',
  
  // 对话/事件
  DIALOG = 'dialog',
  CINEMATIC = 'cinematic',
  
  // 战斗
  COMBAT = 'combat',
  BOSS_FIGHT = 'boss_fight',
  
  // 结局
  VICTORY = 'victory',
  GAME_OVER = 'game_over',
}

// ============== 游戏状态类 ==============
export class GameState {
  private currentPhase: GamePhase = GamePhase.INITIAL;
  private previousPhase: GamePhase = GamePhase.INITIAL;
  
  // 战斗状态
  private isInCombat: boolean = false;
  private isBossFight: boolean = false;
  
  // 时间
  private playTime: number = 0; // 毫秒
  private combatTime: number = 0;
  
  // 统计
  private enemiesKilled: number = 0;
  private damageDealt: number = 0;
  private damageTaken: number = 0;
  
  // 标志
  private flags: Map<string, boolean> = new Map();
  
  // ============== 阶段管理 ==============
  public setPhase(phase: GamePhase): void {
    if (this.currentPhase === phase) return;
    
    this.previousPhase = this.currentPhase;
    this.currentPhase = phase;
    
    console.log(`[GameState] 阶段切换: ${this.previousPhase} → ${this.currentPhase}`);
    
    // 阶段特定逻辑
    switch (phase) {
      case GamePhase.PLAYING:
        this.isInCombat = false;
        break;
      case GamePhase.COMBAT:
      case GamePhase.BOSS_FIGHT:
        this.isInCombat = true;
        this.isBossFight = phase === GamePhase.BOSS_FIGHT;
        this.combatTime = 0;
        break;
      case GamePhase.PAUSED:
        break;
      case GamePhase.GAME_OVER:
      case GamePhase.VICTORY:
        this.isInCombat = false;
        break;
    }
  }
  
  public getPhase(): GamePhase {
    return this.currentPhase;
  }
  
  public getPreviousPhase(): GamePhase {
    return this.previousPhase;
  }
  
  public isPlaying(): boolean {
    return this.currentPhase === GamePhase.PLAYING || 
           this.currentPhase === GamePhase.COMBAT ||
           this.currentPhase === GamePhase.BOSS_FIGHT;
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    if (this.isPlaying()) {
      this.playTime += deltaTime * 1000;
      
      if (this.isInCombat) {
        this.combatTime += deltaTime * 1000;
      }
    }
  }
  
  // ============== 战斗状态 ==============
  public enterCombat(): void {
    if (!this.isInCombat) {
      this.setPhase(GamePhase.COMBAT);
    }
  }
  
  public enterBossFight(): void {
    this.setPhase(GamePhase.BOSS_FIGHT);
  }
  
  public exitCombat(): void {
    if (this.isInCombat) {
      this.setPhase(GamePhase.PLAYING);
    }
  }
  
  public getIsInCombat(): boolean {
    return this.isInCombat;
  }
  
  public getIsBossFight(): boolean {
    return this.isBossFight;
  }
  
  // ============== 统计 ==============
  public recordEnemyKill(): void {
    this.enemiesKilled++;
  }
  
  public recordDamageDealt(amount: number): void {
    this.damageDealt += amount;
  }
  
  public recordDamageTaken(amount: number): void {
    this.damageTaken += amount;
  }
  
  public getStats(): {
    playTime: number;
    combatTime: number;
    enemiesKilled: number;
    damageDealt: number;
    damageTaken: number;
  } {
    return {
      playTime: this.playTime,
      combatTime: this.combatTime,
      enemiesKilled: this.enemiesKilled,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
    };
  }
  
  // ============== 标志管理 ==============
  public setFlag(key: string, value: boolean): void {
    this.flags.set(key, value);
  }
  
  public getFlag(key: string): boolean {
    return this.flags.get(key) ?? false;
  }
  
  public toggleFlag(key: string): boolean {
    const current = this.getFlag(key);
    this.setFlag(key, !current);
    return !current;
  }
  
  // ============== 重置 ==============
  public reset(): void {
    this.currentPhase = GamePhase.INITIAL;
    this.previousPhase = GamePhase.INITIAL;
    this.isInCombat = false;
    this.isBossFight = false;
    this.playTime = 0;
    this.combatTime = 0;
    this.enemiesKilled = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.flags.clear();
  }
}

export default GameState;
