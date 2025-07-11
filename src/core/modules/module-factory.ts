import { BaseModule } from './base.module';
import { TechnicalModule } from '@/modules/technical';
import { PersonalModule } from '@/modules/personal';
import { WorkModule } from '@/modules/work';
import { LearningModule } from '@/modules/learning';
import { CommunicationModule } from '@/modules/communication';
import { CreativeModule } from '@/modules/creative';
import { Logger } from '@/utils/logger';

export class ModuleFactory {
  private static logger = Logger.getInstance();

  static async createModule(moduleId: string): Promise<BaseModule | null> {
    try {
      switch (moduleId) {
        case 'technical':
          return new TechnicalModule();
        case 'personal':
          return new PersonalModule();
        case 'work':
          return new WorkModule();
        case 'learning':
          return new LearningModule();
        case 'communication':
          return new CommunicationModule();
        case 'creative':
          return new CreativeModule();
        default:
          this.logger.warn(`Unknown module ID: ${moduleId}`);
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to create module ${moduleId}`, { error });
      return null;
    }
  }

  static getAvailableModules(): string[] {
    return ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
  }
}