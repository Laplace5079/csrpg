/**
 * InstancedRenderer.ts - GPU 实例化渲染
 * 墨境：孤军 (Ink Realm: Lone Army)
 * 高性能渲染大量重复物体
 */

import * as THREE from 'three';

// ============== 实例化渲染器基类 ==============
export class InstancedRenderer<T extends THREE.Object3D> {
  protected scene: THREE.Scene | null = null;
  protected mesh: THREE.InstancedMesh | null = null;
  
  protected instanceCount: number = 0;
  protected maxCount: number;
  
  // 数据数组
  protected positions: Float32Array;
  protected rotations: Float32Array;
  protected scales: Float32Array;
  protected colors: Float32Array;
  
  // 临时对象
  protected tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  protected tempPosition: THREE.Vector3 = new THREE.Vector3();
  protected tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  protected tempScale: THREE.Vector3 = new THREE.Vector3();
  protected tempColor: THREE.Color = new THREE.Color();
  
  constructor(
    maxCount: number,
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ) {
    this.maxCount = maxCount;
    
    // 创建实例化网格
    this.mesh = new THREE.InstancedMesh(geometry, material, maxCount);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    
    // 初始化数据数组
    const size = maxCount;
    this.positions = new Float32Array(size * 3);
    this.rotations = new Float32Array(size * 4);
    this.scales = new Float32Array(size * 3);
    this.colors = new Float32Array(size * 3);
  }
  
  // ============== 场景设置 ==============
  public setScene(scene: THREE.Scene): void {
    this.scene = scene;
    if (this.mesh) {
      scene.add(this.mesh);
    }
  }
  
  public removeFromScene(): void {
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
    }
  }
  
  // ============== 设置实例 ==============
  public setInstance(
    index: number,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3,
    color?: THREE.Color
  ): void {
    if (index >= this.maxCount) return;
    
    // 位置
    this.positions[index * 3] = position.x;
    this.positions[index * 3 + 1] = position.y;
    this.positions[index * 3 + 2] = position.z;
    
    // 旋转
    this.rotations[index * 4] = rotation.x;
    this.rotations[index * 4 + 1] = rotation.y;
    this.rotations[index * 4 + 2] = rotation.z;
    this.rotations[index * 4 + 3] = rotation.w;
    
    // 缩放
    this.scales[index * 3] = scale.x;
    this.scales[index * 3 + 1] = scale.y;
    this.scales[index * 3 + 2] = scale.z;
    
    // 颜色
    if (color) {
      this.colors[index * 3] = color.r;
      this.colors[index * 3 + 1] = color.g;
      this.colors[index * 3 + 2] = color.b;
    }
  }
  
  // ============== 更新渲染 ==============
  public update(): void {
    if (!this.mesh) return;
    
    for (let i = 0; i < this.instanceCount; i++) {
      this.tempPosition.set(
        this.positions[i * 3],
        this.positions[i * 3 + 1],
        this.positions[i * 3 + 2]
      );
      
      this.tempQuaternion.set(
        this.rotations[i * 4],
        this.rotations[i * 4 + 1],
        this.rotations[i * 4 + 2],
        this.rotations[i * 4 + 3]
      );
      
      this.tempScale.set(
        this.scales[i * 3],
        this.scales[i * 3 + 1],
        this.scales[i * 3 + 2]
      );
      
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.mesh.setMatrixAt(i, this.tempMatrix);
      
      // 颜色
      if (this.mesh.instanceColor) {
        this.tempColor.set(
          this.colors[i * 3],
          this.colors[i * 3 + 1],
          this.colors[i * 3 + 2]
        );
        this.mesh.setColorAt(i, this.tempColor);
      }
    }
    
    this.mesh.count = this.instanceCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
  
  // ============== 清空 ==============
  public clear(): void {
    this.instanceCount = 0;
    if (this.mesh) {
      this.mesh.count = 0;
    }
  }
  
  // ============== 获取/设置数量 ==============
  public getCount(): number {
    return this.instanceCount;
  }
  
  public setCount(count: number): void {
    this.instanceCount = Math.min(count, this.maxCount);
  }
  
  // ============== 获取网格 ==============
  public getMesh(): THREE.InstancedMesh | null {
    return this.mesh;
  }
  
  // ============== 清理 ==============
  public dispose(): void {
    this.clear();
    if (this.mesh) {
      this.mesh.geometry?.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        this.mesh.material?.dispose();
      }
    }
  }
}

// ============== 环境实例渲染器 ==============
export class EnvironmentInstancedRenderer extends InstancedRenderer<THREE.Mesh> {
  // 预创建几何体
  private static geometries: Map<string, THREE.BufferGeometry> = new Map();
  
  constructor(maxCount: number = 1000) {
    // 使用方块几何体
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.8,
      metalness: 0.2,
    });
    
    super(maxCount, geometry, material);
    
    if (this.mesh) {
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
    }
  }
  
  // ============== 批量添加环境物体 ==============
  public addBoxes(boxes: Array<{
    position: THREE.Vector3;
    scale: THREE.Vector3;
    rotation?: THREE.Euler;
    color?: number;
  }>): void {
    boxes.forEach((box, i) => {
      if (i >= this.maxCount) return;
      
      const rotation = box.rotation || new THREE.Euler(0, 0, 0);
      this.tempQuaternion.setFromEuler(rotation);
      
      const color = box.color ? new THREE.Color(box.color) : new THREE.Color(0x444444);
      
      this.setInstance(i, box.position, this.tempQuaternion, box.scale, color);
      this.instanceCount++;
    });
    
    this.update();
  }
  
  // ============== 添加单个物体 ==============
  public addBox(
    position: THREE.Vector3,
    scale: THREE.Vector3,
    rotation?: THREE.Euler,
    color?: number
  ): void {
    if (this.instanceCount >= this.maxCount) return;
    
    const rot = rotation || new THREE.Euler(0, 0, 0);
    this.tempQuaternion.setFromEuler(rot);
    
    const col = color ? new THREE.Color(color) : new THREE.Color(0x444444);
    
    this.setInstance(this.instanceCount, position, this.tempQuaternion, scale, col);
    this.instanceCount++;
    
    this.update();
  }
}

// ============== 敌人实例渲染器 ==============
export class EnemyInstancedRenderer extends InstancedRenderer<THREE.Mesh> {
  constructor(maxCount: number = 50) {
    // 使用胶囊几何体
    const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.6,
      metalness: 0.4,
      emissive: 0x330000,
      emissiveIntensity: 0.3,
    });
    
    super(maxCount, geometry, material);
    
    if (this.mesh) {
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
    }
  }
  
  // ============== 更新敌人 ==============
  public updateEnemies(enemies: Array<{
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    scale: THREE.Vector3;
    health?: number;
    isAlert?: boolean;
  }>): void {
    this.clear();
    
    enemies.forEach((enemy, i) => {
      if (i >= this.maxCount) return;
      
      let color: THREE.Color;
      if (enemy.isAlert) {
        color = new THREE.Color(0xff3300); // 警觉红色
      } else if (enemy.health !== undefined && enemy.health < 0.3) {
        color = new THREE.Color(0xff6600); // 低血量橙色
      } else {
        color = new THREE.Color(0xff0000); // 普通红色
      }
      
      this.setInstance(i, enemy.position, enemy.rotation, enemy.scale, color);
      this.instanceCount++;
    });
    
    this.update();
  }
  
  // ============== 设置单个敌人 ==============
  public setEnemy(
    index: number,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3,
    isAlert: boolean = false,
    healthRatio: number = 1
  ): void {
    let color: THREE.Color;
    if (isAlert) {
      color = new THREE.Color(0xff3300);
    } else if (healthRatio < 0.3) {
      color = new THREE.Color(0xff6600);
    } else {
      color = new THREE.Color(0xff0000);
    }
    
    this.setInstance(index, position, rotation, scale, color);
    this.instanceCount = Math.max(this.instanceCount, index + 1);
  }
}

// ============== 特效实例渲染器 ==============
export class EffectInstancedRenderer extends InstancedRenderer<THREE.Mesh> {
  constructor(maxCount: number = 200) {
    // 使用平面几何体（粒子效果）
    const geometry = new THREE.PlaneGeometry(0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    super(maxCount, geometry, material);
    
    if (this.mesh) {
      this.mesh.frustumCulled = false;
    }
  }
  
  // ============== 添加粒子效果 ==============
  public addParticles(particles: Array<{
    position: THREE.Vector3;
    scale: number;
    color: number;
    rotation?: number;
  }>): void {
    particles.forEach((particle, i) => {
      if (i >= this.maxCount) return;
      
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), particle.rotation || 0);
      this.tempScale.setScalar(particle.scale);
      this.setInstance(
        i,
        particle.position,
        this.tempQuaternion,
        this.tempScale,
        new THREE.Color(particle.color)
      );
      this.instanceCount++;
    });
    
    this.update();
  }
}

// ============== 子弹实例渲染器 ==============
export class BulletInstancedRenderer extends InstancedRenderer<THREE.Mesh> {
  constructor(maxCount: number = 500) {
    const geometry = new THREE.SphereGeometry(0.05, 4, 4);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    
    super(maxCount, geometry, material);
    
    if (this.mesh) {
      this.mesh.frustumCulled = false;
    }
  }
  
  // ============== 更新子弹 ==============
  public updateBullets(bullets: Array<{
    position: THREE.Vector3;
    color?: number;
  }>): void {
    this.clear();
    
    bullets.forEach((bullet, i) => {
      if (i >= this.maxCount) return;
      
      this.tempScale.setScalar(1);
      this.tempQuaternion.identity();
      
      const color = bullet.color ? new THREE.Color(bullet.color) : new THREE.Color(0x00ffff);
      
      this.setInstance(i, bullet.position, this.tempQuaternion, this.tempScale, color);
      this.instanceCount++;
    });
    
    this.update();
  }
}

export default InstancedRenderer;
