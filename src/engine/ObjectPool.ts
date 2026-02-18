/**
 * ObjectPool.ts - 对象池系统
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 内存优化：子弹、粒子、特效
 */

import * as THREE from 'three';

// ============== 可池化对象接口 ==============
export interface Poolable {
  active: boolean;
  reset(): void;
  dispose(): void;
}

// ============== 对象池 ==============
export class ObjectPool<T extends Poolable> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private initialSize: number;
  private maxSize: number;
  
  constructor(
    factory: () => T,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.factory = factory;
    this.initialSize = initialSize;
    this.maxSize = maxSize;
    
    // 预分配
    this.expand(initialSize);
  }
  
  // ============== 获取对象 ==============
  public acquire(): T {
    let obj: T;
    
    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else if (this.inUse.size < this.maxSize) {
      obj = this.factory();
    } else {
      // 池已满，强制复用最旧的对象
      console.warn('[ObjectPool] 池已满，强制复用');
      obj = this.inUse.values().next().value;
      if (obj) {
        this.inUse.delete(obj);
      } else {
        obj = this.factory();
      }
    }
    
    obj.active = true;
    this.inUse.add(obj);
    
    return obj;
  }
  
  // ============== 归还对象 ==============
  public release(obj: T): void {
    if (!this.inUse.has(obj)) return;
    
    obj.reset();
    obj.active = false;
    this.inUse.delete(obj);
    this.available.push(obj);
  }
  
  // ============== 批量释放 ==============
  public releaseAll(): void {
    this.inUse.forEach(obj => {
      obj.reset();
      obj.active = false;
      this.available.push(obj);
    });
    this.inUse.clear();
  }
  
  // ============== 扩展池 ==============
  private expand(count: number): void {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      obj.active = false;
      this.available.push(obj);
    }
  }
  
  // ============== 统计 ==============
  public getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
  
  // ============== 清理 ==============
  public dispose(): void {
    this.releaseAll();
    this.available.forEach(obj => obj.dispose());
    this.available = [];
  }
}

// ============== 子弹对象 ==============
export class PooledBullet implements Poolable {
  public active: boolean = false;
  
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public damage: number = 0;
  public range: number = 0;
  public distanceTraveled: number = 0;
  
  public mesh: THREE.Mesh | null = null;
  
  // 预创建几何体和材质
  private static geometry: THREE.SphereGeometry | null = null;
  private static material: THREE.MeshBasicMaterial | null = null;
  
  constructor() {
    // 延迟初始化静态资源
    if (!PooledBullet.geometry) {
      PooledBullet.geometry = new THREE.SphereGeometry(0.03, 4, 4);
    }
    if (!PooledBullet.material) {
      PooledBullet.material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
      });
    }
    
    this.mesh = new THREE.Mesh(PooledBullet.geometry, PooledBullet.material);
    this.mesh.visible = false;
  }
  
  public reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.damage = 0;
    this.range = 0;
    this.distanceTraveled = 0;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }
  
  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry?.dispose();
      // 不dispose共享材质
    }
  }
  
  public activate(position: THREE.Vector3, velocity: THREE.Vector3, damage: number, range: number): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.damage = damage;
    this.range = range;
    this.distanceTraveled = 0;
    if (this.mesh) {
      this.mesh.position.copy(position);
      this.mesh.visible = true;
    }
  }
  
  public update(deltaTime: number): boolean {
    // 移动
    const movement = this.velocity.clone().multiplyScalar(deltaTime);
    this.position.add(movement);
    this.distanceTraveled += movement.length();
    
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
    
    // 检查是否超出射程
    return this.distanceTraveled >= this.range;
  }
}

// ============== 粒子对象 ==============
export class PooledParticle implements Poolable {
  public active: boolean = false;
  
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public life: number = 0;
  public maxLife: number = 1;
  public size: number = 1;
  public color: THREE.Color = new THREE.Color();
  
  public mesh: THREE.Mesh | null = null;
  
  // 共享资源
  private static geometry: THREE.PlaneGeometry | null = null;
  private static baseMaterial: THREE.MeshBasicMaterial | null = null;
  
  constructor() {
    if (!PooledParticle.geometry) {
      PooledParticle.geometry = new THREE.PlaneGeometry(0.1, 0.1);
    }
    if (!PooledParticle.baseMaterial) {
      PooledParticle.baseMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    }
    
    this.mesh = new THREE.Mesh(
      PooledParticle.geometry,
      PooledParticle.baseMaterial.clone()
    );
    this.mesh.visible = false;
    this.mesh.renderOrder = 999;
  }
  
  public reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.life = 0;
    this.maxLife = 1;
    this.size = 1;
    this.color.set(0xffffff);
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }
  
  public dispose(): void {
    if (this.mesh) {
      this.mesh.material?.dispose();
    }
  }
  
  public activate(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    life: number,
    size: number,
    color: number
  ): void {
    this.position.copy(position);
    this.velocity.copy(velocity);
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color.setHex(color);
    
    if (this.mesh) {
      this.mesh.position.copy(position);
      this.mesh.scale.setScalar(size);
      (this.mesh.material as THREE.MeshBasicMaterial).color.copy(this.color);
      this.mesh.visible = true;
    }
  }
  
  public update(deltaTime: number): boolean {
    // 物理
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.velocity.y -= 5 * deltaTime; // 重力
    
    // 生命周期
    this.life -= deltaTime;
    
    // 淡出
    const lifeRatio = this.life / this.maxLife;
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.scale.setScalar(this.size * lifeRatio);
      (this.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio;
    }
    
    return this.life <= 0;
  }
}

// ============== 子弹池管理器 ==============
export class BulletPoolManager {
  private bulletPool: ObjectPool<PooledBullet>;
  private scene: THREE.Scene | null = null;
  
  constructor(initialSize: number = 50) {
    this.bulletPool = new ObjectPool(
      () => new PooledBullet(),
      initialSize,
      200
    );
  }
  
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }
  
  public spawnBullet(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    range: number
  ): PooledBullet {
    const bullet = this.bulletPool.acquire();
    const velocity = direction.clone().multiplyScalar(speed);
    bullet.activate(position, velocity, damage, range);
    
    if (this.scene && bullet.mesh) {
      this.scene.add(bullet.mesh);
    }
    
    return bullet;
  }
  
  public update(deltaTime: number): void {
    this.bulletPool.inUse.forEach((bullet, obj) => {
      const expired = bullet.update(deltaTime);
      if (expired) {
        this.bulletPool.release(bullet);
        if (this.scene && bullet.mesh) {
          this.scene.remove(bullet.mesh);
        }
      }
    });
  }
  
  public getActiveCount(): number {
    return this.bulletPool.inUse.size;
  }
  
  public getStats() {
    return this.bulletPool.getStats();
  }
}

// ============== 粒子池管理器 ==============
export class ParticlePoolManager {
  private particlePool: ObjectPool<PooledParticle>;
  private scene: THREE.Scene | null = null;
  
  constructor(initialSize: number = 100) {
    this.particlePool = new ObjectPool(
      () => new PooledParticle(),
      initialSize,
      500
    );
  }
  
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }
  
  public spawnParticle(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    life: number,
    size: number,
    color: number
  ): PooledParticle {
    const particle = this.particlePool.acquire();
    particle.activate(position, velocity, life, size, color);
    
    if (this.scene && particle.mesh) {
      this.scene.add(particle.mesh);
    }
    
    return particle;
  }
  
  public spawnExplosion(position: THREE.Vector3, color: number = 0xff6600, count: number = 20): void {
    for (let i = 0; i < count; i++) {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 5,
        (Math.random() - 0.5) * 10
      );
      
      this.spawnParticle(
        position.clone(),
        velocity,
        0.5 + Math.random() * 0.5,
        0.5 + Math.random() * 0.5,
        color
      );
    }
  }
  
  public update(deltaTime: number): void {
    const toRelease: PooledParticle[] = [];
    
    this.particlePool.inUse.forEach(particle => {
      const expired = particle.update(deltaTime);
      if (expired) {
        toRelease.push(particle);
      }
    });
    
    toRelease.forEach(particle => {
      this.particlePool.release(particle);
      if (this.scene && particle.mesh) {
        this.scene.remove(particle.mesh);
      }
    });
  }
  
  public getActiveCount(): number {
    return this.particlePool.inUse.size;
  }
}

export default ObjectPool;
