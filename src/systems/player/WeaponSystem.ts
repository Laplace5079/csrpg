/**
 * WeaponSystem.ts - 武器系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 射击、后坐力、子弹追踪
 */

import * as THREE from 'three';
import { Core, GameEvent } from '../../core';
import { Player } from './Player';
import { FireMode, WeaponType } from '../../core/constants';

// ============== 武器数据 ==============
export interface WeaponData {
  id: string;
  name: string;
  type: WeaponType;
  
  // 伤害
  damage: number;
  headshotMultiplier: number;
  
  // 射程
  effectiveRange: number;
  maxRange: number;
  
  // 射速
  fireRate: number; // RPM
  fireMode: FireMode;
  burstCount: number;
  burstDelay: number;
  
  // 弹药
  magSize: number;
  totalAmmo: number;
  reloadTime: number;
  
  // 后坐力
  verticalRecoil: number[];
  horizontalRecoil: number[];
  recoilRecovery: number;
  recoilKick: number;
  
  // 散布
  hipSpread: SpreadConfig;
  adsSpread: SpreadConfig;
  
  // 瞄准
  aimTime: number;
  aimFOV: number;
  
  // 音效
  shootSound: string;
  reloadSound: string;
  
  // 特效
  muzzleFlash: boolean;
  tracerColor: string;
  tracerFrequency: number;
}

export interface SpreadConfig {
  min: number;
  max: number;
  increaseRate: number;
  decreaseRate: number;
}

// ============== 武器实例 ==============
export class Weapon {
  public data: WeaponData;
  
  // 状态
  public currentAmmo: number;
  public totalAmmo: number;
  public isReloading: boolean = false;
  public isAiming: boolean = false;
  public lastShotTime: number = 0;
  public burstCount: number = 0;
  
  // 散布
  public currentSpread: number = 0;
  
  // 容器
  public mesh: THREE.Object3D | null = null;
  
  constructor(data: WeaponData) {
    this.data = data;
    this.currentAmmo = data.magSize;
    this.totalAmmo = data.totalAmmo;
  }
  
  // ============== 射击 ==============
  public canFire(): boolean {
    const now = Date.now();
    const fireInterval = 60000 / this.data.fireRate; // RPM 转毫秒
    
    return (
      !this.isReloading &&
      this.currentAmmo > 0 &&
      now - this.lastShotTime >= fireInterval
    );
  }
  
  public fire(origin: THREE.Vector3, direction: THREE.Vector3): BulletResult | null {
    if (!this.canFire()) return null;
    
    this.lastShotTime = Date.now();
    this.currentAmmo--;
    
    // 应用散布
    const spreadDirection = this.applySpread(direction);
    
    // 减少后坐力
    this.currentSpread = Math.min(this.data.hipSpread.max, 
      this.currentSpread + this.data.hipSpread.increaseRate);
    
    return {
      origin: origin.clone(),
      direction: spreadDirection,
      damage: this.data.damage,
      range: this.data.effectiveRange,
    };
  }
  
  // ============== 散布 ==============
  private applySpread(direction: THREE.Vector3): THREE.Vector3 {
    const spread = this.currentSpread;
    
    const pitch = (Math.random() - 0.5) * spread;
    const yaw = (Math.random() - 0.5) * spread;
    
    const result = direction.clone();
    result.x += pitch;
    result.y += yaw;
    result.normalize();
    
    return result;
  }
  
  public updateSpread(deltaTime: number): void {
    // 散布恢复
    this.currentSpread = Math.max(
      this.data.hipSpread.min,
      this.currentSpread - this.data.hipSpread.decreaseRate * deltaTime
    );
  }
  
  // ============== 后坐力 ==============
  public getRecoil(): { pitch: number; yaw: number } {
    const now = Date.now();
    const timeSinceLastShot = now - this.lastShotTime;
    
    // 基础后坐力
    const recoilIndex = Math.floor(timeSinceLastShot / 50) % this.data.verticalRecoil.length;
    
    const pitch = this.data.verticalRecoil[recoilIndex] * this.data.recoilKick;
    const yaw = this.data.horizontalRecoil[recoilIndex] * this.data.recoilKick * (Math.random() - 0.5);
    
    return { pitch, yaw };
  }
  
  // ============== 换弹 ==============
  public reload(): boolean {
    if (this.isReloading || this.currentAmmo === this.data.magSize || this.totalAmmo <= 0) {
      return false;
    }
    
    this.isReloading = true;
    
    // 模拟换弹时间
    setTimeout(() => {
      const needed = this.data.magSize - this.currentAmmo;
      const available = Math.min(needed, this.totalAmmo);
      
      this.totalAmmo -= available;
      this.currentAmmo += available;
      this.isReloading = false;
    }, this.data.reloadTime);
    
    return true;
  }
  
  // ============== 获取信息 ==============
  public getAmmoString(): string {
    return `${this.currentAmmo} / ${this.totalAmmo}`;
  }
  
  public needsReload(): boolean {
    return this.currentAmmo === 0 && this.totalAmmo > 0;
  }
}

// ============== 子弹结果 ==============
export interface BulletResult {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  range: number;
}

// ============== 武器系统 ==============
export class WeaponSystem {
  private core: Core;
  private player: Player;
  
  // 武器列表
  private weapons: Map<string, Weapon> = new Map();
  private currentWeapon: Weapon | null = null;
  
  // 子弹追踪
  private bullets: Bullet[] = [];
  
  // 场景引用
  private scene: THREE.Scene | null = null;
  
  // 射线检测
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  
  constructor(core: Core, player: Player) {
    this.core = core;
    this.player = player;
    
    this.init();
  }
  
  // ============== 初始化 ==============
  private init(): void {
    // 注册默认武器
    this.registerDefaultWeapons();
    
    // 监听事件
    this.core.eventBus.on(GameEvent.FRAME_UPDATE, () => this.update(0.016));
    
    console.log('[WeaponSystem] 初始化完成');
  }
  
  // ============== 注册武器 ==============
  private registerDefaultWeapons(): void {
    // 量子手枪
    const pistol: WeaponData = {
      id: 'quantum_pistol',
      name: '量子手枪',
      type: WeaponType.PISTOL,
      damage: 25,
      headshotMultiplier: 2.0,
      effectiveRange: 50,
      maxRange: 100,
      fireRate: 300,
      fireMode: FireMode.SEMI,
      burstCount: 1,
      burstDelay: 0,
      magSize: 12,
      totalAmmo: 48,
      reloadTime: 1500,
      verticalRecoil: [0.5, 0.4, 0.3, 0.2],
      horizontalRecoil: [0.1, 0.15, 0.1, 0.05],
      recoilRecovery: 5,
      recoilKick: 1.0,
      hipSpread: { min: 0.01, max: 0.05, increaseRate: 0.01, decreaseRate: 0.05 },
      adsSpread: { min: 0.001, max: 0.01, increaseRate: 0.005, decreaseRate: 0.1 },
      aimTime: 0.15,
      aimFOV: 60,
      shootSound: 'pistol_shoot',
      reloadSound: 'pistol_reload',
      muzzleFlash: true,
      tracerColor: '#00ffff',
      tracerFrequency: 0,
    };
    
    // 突击步枪
    const rifle: WeaponData = {
      id: 'quantum_rifle',
      name: '量子步枪',
      type: WeaponType.RIFLE,
      damage: 30,
      headshotMultiplier: 2.0,
      effectiveRange: 100,
      maxRange: 200,
      fireRate: 600,
      fireMode: FireMode.AUTO,
      burstCount: 3,
      burstDelay: 100,
      magSize: 30,
      totalAmmo: 120,
      reloadTime: 2000,
      verticalRecoil: [0.3, 0.35, 0.3, 0.25, 0.2],
      horizontalRecoil: [0.1, 0.15, 0.12, 0.1, 0.08],
      recoilRecovery: 8,
      recoilKick: 0.8,
      hipSpread: { min: 0.02, max: 0.1, increaseRate: 0.02, decreaseRate: 0.03 },
      adsSpread: { min: 0.005, max: 0.03, increaseRate: 0.01, decreaseRate: 0.08 },
      aimTime: 0.2,
      aimFOV: 65,
      shootSound: 'rifle_shoot',
      reloadSound: 'rifle_reload',
      muzzleFlash: true,
      tracerColor: '#ff00ff',
      tracerFrequency: 3,
    };
    
    // 狙击枪
    const sniper: WeaponData = {
      id: 'quantum_sniper',
      name: '量子狙击',
      type: WeaponType.SNIPER,
      damage: 120,
      headshotMultiplier: 3.0,
      effectiveRange: 300,
      maxRange: 500,
      fireRate: 40,
      fireMode: FireMode.SEMI,
      burstCount: 1,
      burstDelay: 0,
      magSize: 5,
      totalAmmo: 20,
      reloadTime: 3000,
      verticalRecoil: [2.0, 1.5, 1.0],
      horizontalRecoil: [0.3, 0.2, 0.1],
      recoilRecovery: 3,
      recoilKick: 2.0,
      hipSpread: { min: 0.1, max: 0.5, increaseRate: 0.1, decreaseRate: 0.01 },
      adsSpread: { min: 0.0001, max: 0.001, increaseRate: 0.0001, decreaseRate: 0.001 },
      aimTime: 0.4,
      aimFOV: 40,
      shootSound: 'sniper_shoot',
      reloadSound: 'sniper_reload',
      muzzleFlash: true,
      tracerColor: '#ffff00',
      tracerFrequency: 1,
    };
    
    // 注册武器
    this.weapons.set(pistol.id, new Weapon(pistol));
    this.weapons.set(rifle.id, new Weapon(rifle));
    this.weapons.set(sniper.id, new Weapon(sniper));
    
    // 设置当前武器
    this.currentWeapon = this.weapons.get('quantum_pistol') || null;
  }
  
  // ============== 场景设置 ==============
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }
  
  // ============== 更新 ==============
  public update(deltaTime: number): void {
    if (!this.currentWeapon) return;
    
    // 更新散布
    this.currentWeapon.updateSpread(deltaTime);
    
    // 更新子弹
    this.updateBullets(deltaTime);
    
    // 处理射击输入
    if (this.player['inputManager']?.isFiring()) {
      this.attemptFire();
    }
  }
  
  // ============== 尝试射击 ==============
  private attemptFire(): void {
    if (!this.currentWeapon || !this.player) return;
    
    const result = this.currentWeapon.fire(
      this.player.position,
      this.player.getForwardVector()
    );
    
    if (result) {
      // 创建子弹
      this.createBullet(result);
      
      // 应用后坐力
      const recoil = this.currentWeapon.getRecoil();
      this.player['addShake'](recoil.pitch * 0.5);
      
      // 发出事件
      this.core.eventBus.emit(GameEvent.WEAPON_FIRED, {
        weaponId: this.currentWeapon.data.id,
        ammo: this.currentWeapon.currentAmmo,
      });
    }
  }
  
  // ============== 子弹 ==============
  private createBullet(result: BulletResult): void {
    const bullet: Bullet = {
      origin: result.origin,
      direction: result.direction,
      damage: result.damage,
      range: result.range,
      speed: 100, // m/s
      distanceTraveled: 0,
      mesh: this.createBulletMesh(),
    };
    
    this.bullets.push(bullet);
    
    if (this.scene && bullet.mesh) {
      bullet.mesh.position.copy(bullet.origin);
      this.scene.add(bullet.mesh);
    }
  }
  
  private createBulletMesh(): THREE.Mesh | null {
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }
  
  private updateBullets(deltaTime: number): void {
    const bulletsToRemove: number[] = [];
    
    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      
      // 移动
      const movement = bullet.direction.clone().multiplyScalar(bullet.speed * deltaTime);
      bullet.origin.add(movement);
      bullet.distanceTraveled += movement.length();
      
      // 更新mesh
      if (bullet.mesh) {
        bullet.mesh.position.copy(bullet.origin);
      }
      
      // 射程检测
      if (bullet.distanceTraveled >= bullet.range) {
        bulletsToRemove.push(i);
        this.removeBullet(i);
        continue;
      }
      
      // 碰撞检测
      if (this.scene) {
        this.raycaster.set(bullet.origin, bullet.direction);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0 && intersects[0].distance < movement.length()) {
          // 击中物体
          this.handleHit(intersects[0], bullet);
          bulletsToRemove.push(i);
          this.removeBullet(i);
        }
      }
    }
  }
  
  private handleHit(intersect: THREE.Intersection, bullet: Bullet): void {
    // 发出伤害事件
    this.core.eventBus.emit(GameEvent.ENEMY_DAMAGED, {
      damage: bullet.damage,
      position: intersect.point,
    });
  }
  
  private removeBullet(index: number): void {
    const bullet = this.bullets[index];
    if (bullet.mesh && this.scene) {
      this.scene.remove(bullet.mesh);
    }
    this.bullets.splice(index, 1);
  }
  
  // ============== 武器切换 ==============
  public switchWeapon(weaponId: string): boolean {
    const weapon = this.weapons.get(weaponId);
    if (!weapon) return false;
    
    this.currentWeapon = weapon;
    this.core.eventBus.emit(GameEvent.WEAPON_SWITCHED, weaponId);
    return true;
  }
  
  public getCurrentWeapon(): Weapon | null {
    return this.currentWeapon;
  }
  
  // ============== 换弹 ==============
  public reload(): void {
    if (this.currentWeapon) {
      this.currentWeapon.reload();
    }
  }
}

// ============== 子弹类型 ==============
interface Bullet {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  range: number;
  speed: number;
  distanceTraveled: number;
  mesh: THREE.Mesh | null;
}

export default WeaponSystem;
