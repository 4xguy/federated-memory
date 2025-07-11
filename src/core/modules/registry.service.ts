import { PrismaClient } from '@prisma/client';
import { Logger } from '@/utils/logger';
import { BaseModule } from './base.module';
import { ModuleType, ModuleConfig } from './interfaces';

export interface ModuleRegistration {
  moduleId: string;
  moduleName: string;
  description: string;
  moduleType: ModuleType;
  configuration: ModuleConfig;
  isActive: boolean;
  instance?: BaseModule;
}

export interface ModuleHealth {
  moduleId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: {
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    totalMemories: number;
  };
  issues?: string[];
}

export class ModuleRegistry {
  private static instance: ModuleRegistry;
  private prisma: PrismaClient;
  private logger: Logger;
  private modules: Map<string, ModuleRegistration> = new Map();
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private moduleInstances: Map<string, BaseModule> = new Map();

  private constructor() {
    this.prisma = new PrismaClient();
    this.logger = Logger.getInstance();
    this.initializeRegistry();
  }

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Initialize registry from database
   */
  private async initializeRegistry(): Promise<void> {
    try {
      const modules = await this.prisma.memoryModule.findMany({
        where: { isActive: true }
      });

      for (const module of modules) {
        this.modules.set(module.moduleId, {
          moduleId: module.moduleId,
          moduleName: module.moduleName,
          description: module.description || '',
          moduleType: module.moduleType as ModuleType,
          configuration: module.configuration as unknown as ModuleConfig,
          isActive: module.isActive
        });
      }

      this.logger.info('Module registry initialized', {
        moduleCount: this.modules.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize module registry', { error });
    }
  }

  /**
   * Register a new module
   */
  async registerModule(
    moduleId: string,
    instance: BaseModule,
    config?: Partial<ModuleConfig>
  ): Promise<void> {
    try {
      const moduleInfo = instance.getModuleInfo();
      
      // Store in database
      await this.prisma.memoryModule.upsert({
        where: { moduleId },
        create: {
          moduleId,
          moduleName: moduleInfo.name,
          description: moduleInfo.description,
          moduleType: moduleInfo.type,
          configuration: {
            ...this.getDefaultConfig(moduleInfo.type),
            ...config
          },
          isActive: true
        },
        update: {
          moduleName: moduleInfo.name,
          description: moduleInfo.description,
          configuration: {
            ...this.getDefaultConfig(moduleInfo.type),
            ...config
          },
          isActive: true
        }
      });

      // Store in memory
      this.modules.set(moduleId, {
        moduleId,
        moduleName: moduleInfo.name,
        description: moduleInfo.description,
        moduleType: moduleInfo.type,
        configuration: {
          ...this.getDefaultConfig(moduleInfo.type),
          ...config
        } as ModuleConfig,
        isActive: true,
        instance
      });

      this.moduleInstances.set(moduleId, instance);

      // Start health monitoring
      this.startHealthMonitoring(moduleId);

      this.logger.info('Module registered', {
        moduleId,
        moduleName: moduleInfo.name,
        moduleType: moduleInfo.type
      });
    } catch (error) {
      this.logger.error('Failed to register module', { error, moduleId });
      throw new Error(`Module registration failed: ${error}`);
    }
  }

  /**
   * Unregister a module
   */
  async unregisterModule(moduleId: string): Promise<void> {
    try {
      // Stop health monitoring
      this.stopHealthMonitoring(moduleId);

      // Mark as inactive in database
      await this.prisma.memoryModule.update({
        where: { moduleId },
        data: { isActive: false }
      });

      // Remove from memory
      this.modules.delete(moduleId);
      this.moduleInstances.delete(moduleId);

      this.logger.info('Module unregistered', { moduleId });
    } catch (error) {
      this.logger.error('Failed to unregister module', { error, moduleId });
      throw new Error(`Module unregistration failed: ${error}`);
    }
  }

  /**
   * Get module instance
   */
  getModule(moduleId: string): BaseModule | undefined {
    return this.moduleInstances.get(moduleId);
  }

  /**
   * Get all active modules
   */
  getActiveModules(): ModuleRegistration[] {
    return Array.from(this.modules.values()).filter(m => m.isActive);
  }

  /**
   * Get modules by type
   */
  getModulesByType(type: ModuleType): ModuleRegistration[] {
    return Array.from(this.modules.values()).filter(
      m => m.moduleType === type && m.isActive
    );
  }

  /**
   * Update module configuration
   */
  async updateModuleConfig(
    moduleId: string,
    config: Partial<ModuleConfig>
  ): Promise<void> {
    try {
      const module = this.modules.get(moduleId);
      if (!module) {
        throw new Error(`Module ${moduleId} not found`);
      }

      const updatedConfig = {
        ...module.configuration,
        ...config
      };

      // Update database
      await this.prisma.memoryModule.update({
        where: { moduleId },
        data: { configuration: updatedConfig }
      });

      // Update memory
      module.configuration = updatedConfig;

      // Notify module instance of config change
      const instance = this.moduleInstances.get(moduleId);
      if (instance && instance.onConfigUpdate) {
        await instance.onConfigUpdate(updatedConfig);
      }

      this.logger.info('Module configuration updated', { moduleId, config });
    } catch (error) {
      this.logger.error('Failed to update module config', { error, moduleId });
      throw new Error(`Module config update failed: ${error}`);
    }
  }

  /**
   * Get module health status
   */
  async getModuleHealth(moduleId: string): Promise<ModuleHealth> {
    const module = this.moduleInstances.get(moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    try {
      // Perform health check
      const startTime = Date.now();
      const isHealthy = await module.healthCheck();
      const responseTime = Date.now() - startTime;

      // Get module metrics
      const stats = await this.prisma.memoryIndex.aggregate({
        where: { moduleId },
        _count: { id: true },
        _avg: { accessCount: true }
      });

      // Calculate error rate (simplified - in production use proper metrics)
      const recentErrors = 0; // TODO: Implement error tracking
      const totalRequests = stats._avg.accessCount || 1;
      const errorRate = recentErrors / totalRequests;

      // Determine status
      let status: ModuleHealth['status'] = 'healthy';
      const issues: string[] = [];

      if (!isHealthy) {
        status = 'unhealthy';
        issues.push('Health check failed');
      } else if (responseTime > 1000) {
        status = 'degraded';
        issues.push('Slow response time');
      } else if (errorRate > 0.05) {
        status = 'degraded';
        issues.push('High error rate');
      }

      const health: ModuleHealth = {
        moduleId,
        status,
        lastCheck: new Date(),
        metrics: {
          averageResponseTime: responseTime,
          errorRate,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          totalMemories: stats._count.id || 0
        },
        issues: issues.length > 0 ? issues : undefined
      };

      return health;
    } catch (error) {
      this.logger.error('Module health check failed', { error, moduleId });
      return {
        moduleId,
        status: 'unhealthy',
        lastCheck: new Date(),
        metrics: {
          averageResponseTime: 0,
          errorRate: 1,
          memoryUsage: 0,
          totalMemories: 0
        },
        issues: [`Health check error: ${error}`]
      };
    }
  }

  /**
   * Get health status for all modules
   */
  async getAllModuleHealth(): Promise<ModuleHealth[]> {
    const healthStatuses: ModuleHealth[] = [];
    
    for (const moduleId of this.moduleInstances.keys()) {
      const health = await this.getModuleHealth(moduleId);
      healthStatuses.push(health);
    }

    return healthStatuses;
  }

  /**
   * Start health monitoring for a module
   */
  private startHealthMonitoring(moduleId: string): void {
    // Check health every 60 seconds
    const interval = setInterval(async () => {
      try {
        const health = await this.getModuleHealth(moduleId);
        
        if (health.status === 'unhealthy') {
          this.logger.error('Module health check failed', {
            moduleId,
            issues: health.issues
          });
          
          // TODO: Implement recovery strategies
          // - Restart module
          // - Send alerts
          // - Redirect traffic
        }
      } catch (error) {
        this.logger.error('Health monitoring error', { error, moduleId });
      }
    }, 60000);

    this.healthChecks.set(moduleId, interval);
  }

  /**
   * Stop health monitoring for a module
   */
  private stopHealthMonitoring(moduleId: string): void {
    const interval = this.healthChecks.get(moduleId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(moduleId);
    }
  }

  /**
   * Get default configuration for module type
   */
  private getDefaultConfig(type: ModuleType): Partial<ModuleConfig> {
    const defaults: Record<ModuleType, Partial<ModuleConfig>> = {
      standard: {
        maxMemorySize: 10000,
        retentionDays: 365,
        searchLimit: 50,
        enableVersioning: false,
        enableEncryption: false
      },
      specialized: {
        maxMemorySize: 5000,
        retentionDays: 180,
        searchLimit: 30,
        enableVersioning: true,
        enableEncryption: false
      },
      external: {
        maxMemorySize: 1000,
        retentionDays: 90,
        searchLimit: 20,
        enableVersioning: false,
        enableEncryption: true
      }
    };

    return defaults[type] || defaults.standard;
  }

  /**
   * Validate module dependencies
   */
  async validateDependencies(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) return false;

    // Check if required modules are available
    // This is a placeholder - implement based on actual dependencies
    return true;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all health checks
    for (const interval of this.healthChecks.values()) {
      clearInterval(interval);
    }
    this.healthChecks.clear();

    // Cleanup module instances
    for (const module of this.moduleInstances.values()) {
      if (module.cleanup) {
        await module.cleanup();
      }
    }

    await this.prisma.$disconnect();
  }
}

export default ModuleRegistry;