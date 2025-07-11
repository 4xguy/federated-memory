import { Logger } from '@/utils/logger';
import { BaseModule } from './base.module';
import { ModuleRegistry } from './registry.service';
import { ModuleConfig } from './interfaces';
import { ModuleFactory } from './module-factory';
import path from 'path';
import fs from 'fs/promises';

export interface ModuleLoadResult {
  moduleId: string;
  success: boolean;
  error?: string;
  instance?: BaseModule;
}

export interface ModuleDependency {
  moduleId: string;
  requiredModules: string[];
  optionalModules?: string[];
}

export class ModuleLoader {
  private static instance: ModuleLoader;
  private logger: Logger;
  private registry: ModuleRegistry;
  private loadedModules: Set<string> = new Set();
  private moduleDirectory: string;
  private dependencies: Map<string, ModuleDependency> = new Map();

  private constructor() {
    this.logger = Logger.getInstance();
    this.registry = ModuleRegistry.getInstance();
    this.moduleDirectory = path.join(__dirname, '..', '..', 'modules');
    this.initializeDependencies();
  }

  static getInstance(): ModuleLoader {
    if (!ModuleLoader.instance) {
      ModuleLoader.instance = new ModuleLoader();
    }
    return ModuleLoader.instance;
  }

  /**
   * Initialize module dependencies
   */
  private initializeDependencies(): void {
    // Define module dependencies (simplified to avoid circular dependencies)
    this.dependencies.set('technical', {
      moduleId: 'technical',
      requiredModules: [],
      optionalModules: [],
    });

    this.dependencies.set('personal', {
      moduleId: 'personal',
      requiredModules: [],
      optionalModules: [],
    });

    this.dependencies.set('work', {
      moduleId: 'work',
      requiredModules: [],
      optionalModules: [],
    });

    this.dependencies.set('learning', {
      moduleId: 'learning',
      requiredModules: [],
      optionalModules: [],
    });

    this.dependencies.set('communication', {
      moduleId: 'communication',
      requiredModules: [],
      optionalModules: [],
    });

    this.dependencies.set('creative', {
      moduleId: 'creative',
      requiredModules: [],
      optionalModules: [],
    });
  }

  /**
   * Load all available modules
   */
  async loadAllModules(): Promise<ModuleLoadResult[]> {
    this.logger.info('Loading all modules...');
    const results: ModuleLoadResult[] = [];

    try {
      // Get module directories
      const moduleDirs = await this.getModuleDirectories();

      // Sort by dependencies
      const sortedModules = this.sortByDependencies(moduleDirs);

      // Load modules in order
      for (const moduleId of sortedModules) {
        const result = await this.loadModule(moduleId);
        results.push(result);
      }

      this.logger.info('Module loading completed', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to load modules', { error });
      throw new Error(`Module loading failed: ${error}`);
    }
  }

  /**
   * Load a specific module
   */
  async loadModule(moduleId: string, config?: Partial<ModuleConfig>): Promise<ModuleLoadResult> {
    if (this.loadedModules.has(moduleId)) {
      return {
        moduleId,
        success: true,
        instance: await this.registry.getModule(moduleId),
      };
    }

    try {
      this.logger.info(`Loading module: ${moduleId}`);

      // Check dependencies
      const deps = this.dependencies.get(moduleId);
      if (deps) {
        // Load required dependencies first
        for (const depId of deps.requiredModules) {
          if (!this.loadedModules.has(depId)) {
            const depResult = await this.loadModule(depId);
            if (!depResult.success) {
              throw new Error(`Required dependency ${depId} failed to load`);
            }
          }
        }

        // Try to load optional dependencies
        if (deps.optionalModules) {
          for (const depId of deps.optionalModules) {
            if (!this.loadedModules.has(depId)) {
              await this.loadModule(depId).catch(err => {
                this.logger.warn(`Optional dependency ${depId} failed to load`, { err });
              });
            }
          }
        }
      }

      // Create module instance using factory
      const instance = await ModuleFactory.createModule(moduleId);

      if (!instance) {
        throw new Error(`Failed to create module instance for ${moduleId}`);
      }

      // Validate module
      if (!this.isValidModule(instance)) {
        throw new Error('Module does not implement required BaseModule interface');
      }

      // Initialize module
      await instance.initialize();

      // Register with registry
      await this.registry.registerModule(moduleId, instance, config);

      // Mark as loaded
      this.loadedModules.add(moduleId);

      this.logger.info(`Module loaded successfully: ${moduleId}`);

      return {
        moduleId,
        success: true,
        instance,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load module: ${moduleId}`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        moduleId,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Unload a module
   */
  async unloadModule(moduleId: string): Promise<void> {
    if (!this.loadedModules.has(moduleId)) {
      return;
    }

    try {
      // Check if other modules depend on this one
      const dependents = this.getModuleDependents(moduleId);
      if (dependents.length > 0) {
        throw new Error(`Cannot unload module ${moduleId}. Required by: ${dependents.join(', ')}`);
      }

      // Get module instance
      const instance = await this.registry.getModule(moduleId);
      if (instance && instance.cleanup) {
        await instance.cleanup();
      }

      // Unregister from registry
      await this.registry.unregisterModule(moduleId);

      // Remove from loaded set
      this.loadedModules.delete(moduleId);

      this.logger.info(`Module unloaded: ${moduleId}`);
    } catch (error) {
      this.logger.error(`Failed to unload module: ${moduleId}`, { error });
      throw new Error(`Module unloading failed: ${error}`);
    }
  }

  /**
   * Reload a module
   */
  async reloadModule(moduleId: string, config?: Partial<ModuleConfig>): Promise<ModuleLoadResult> {
    this.logger.info(`Reloading module: ${moduleId}`);

    // Unload if loaded
    if (this.loadedModules.has(moduleId)) {
      await this.unloadModule(moduleId);
    }

    // Clear module from require cache
    const modulePath = path.join(this.moduleDirectory, moduleId, 'index.ts');
    delete require.cache[require.resolve(modulePath)];

    // Load module again
    return this.loadModule(moduleId, config);
  }

  /**
   * Sort modules by dependencies
   */
  private sortByDependencies(moduleIds: string[]): string[] {
    const sorted: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return;
      if (visiting.has(moduleId)) {
        this.logger.warn(`Circular dependency detected for module: ${moduleId}`);
        return;
      }

      visiting.add(moduleId);

      const deps = this.dependencies.get(moduleId);
      if (deps) {
        for (const depId of deps.requiredModules) {
          if (moduleIds.includes(depId)) {
            visit(depId);
          }
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      sorted.push(moduleId);
    };

    for (const moduleId of moduleIds) {
      visit(moduleId);
    }

    return sorted;
  }

  /**
   * Get modules that depend on a given module
   */
  private getModuleDependents(moduleId: string): string[] {
    const dependents: string[] = [];

    for (const [depModuleId, deps] of this.dependencies) {
      if (deps.requiredModules.includes(moduleId)) {
        if (this.loadedModules.has(depModuleId)) {
          dependents.push(depModuleId);
        }
      }
    }

    return dependents;
  }

  /**
   * Validate module instance
   */
  private isValidModule(instance: any): instance is BaseModule {
    return (
      instance &&
      typeof instance.initialize === 'function' &&
      typeof instance.store === 'function' &&
      typeof instance.search === 'function' &&
      typeof instance.get === 'function' &&
      typeof instance.update === 'function' &&
      typeof instance.delete === 'function' &&
      typeof instance.getModuleInfo === 'function' &&
      typeof instance.healthCheck === 'function'
    );
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available module directories
   */
  private async getModuleDirectories(): Promise<string[]> {
    return ModuleFactory.getAvailableModules();
  }

  /**
   * Get loaded modules
   */
  getLoadedModules(): string[] {
    return Array.from(this.loadedModules);
  }

  /**
   * Check if module is loaded
   */
  isModuleLoaded(moduleId: string): boolean {
    return this.loadedModules.has(moduleId);
  }

  /**
   * Get module dependencies
   */
  getModuleDependencies(moduleId: string): ModuleDependency | undefined {
    return this.dependencies.get(moduleId);
  }

  /**
   * Enable inter-module communication
   */
  async enableCommunication(sourceModule: string, targetModule: string): Promise<void> {
    const source = await this.registry.getModule(sourceModule);
    const target = await this.registry.getModule(targetModule);

    if (!source || !target) {
      throw new Error('Both modules must be loaded to enable communication');
    }

    // Set up bidirectional communication
    if (source.onModuleConnect) {
      await source.onModuleConnect(targetModule, target);
    }

    if (target.onModuleConnect) {
      await target.onModuleConnect(sourceModule, source);
    }

    this.logger.info('Inter-module communication enabled', {
      source: sourceModule,
      target: targetModule,
    });
  }

  /**
   * Broadcast event to all modules
   */
  async broadcastEvent(event: string, data: any): Promise<void> {
    const modules = this.registry.getActiveModules();

    for (const module of modules) {
      if (module.instance && module.instance.onEvent) {
        try {
          await module.instance.onEvent(event, data);
        } catch (error) {
          this.logger.error('Module event handler failed', {
            moduleId: module.moduleId,
            event,
            error,
          });
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Unload all modules
    const moduleIds = Array.from(this.loadedModules);
    for (const moduleId of moduleIds) {
      await this.unloadModule(moduleId).catch(err => {
        this.logger.error(`Failed to unload module during cleanup: ${moduleId}`, { err });
      });
    }

    this.loadedModules.clear();
  }
}
