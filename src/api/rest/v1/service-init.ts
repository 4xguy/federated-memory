import { ChurchService } from '@/services/church.service';
import { ProjectManagementService } from '@/services/project-management.service';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { getCMIService } from '@/core/cmi/index.service';
import { logger } from '@/utils/logger';

// Service instances
let churchService: ChurchService | null = null;
let projectService: ProjectManagementService | null = null;
let initialized = false;

/**
 * Initialize all services needed for REST API
 */
export async function initializeServices() {
  if (initialized) {
    return {
      churchService: churchService!,
      projectService: projectService!,
    };
  }

  try {
    // Get core services
    const embeddingService = getEmbeddingService();
    const cmiService = getCMIService();

    // Initialize domain services
    churchService = new ChurchService(embeddingService, cmiService);
    await churchService.initialize();

    projectService = new ProjectManagementService(embeddingService, cmiService);
    await projectService.initialize();

    initialized = true;
    logger.info('REST API services initialized successfully');

    return {
      churchService,
      projectService,
    };
  } catch (error) {
    logger.error('Failed to initialize REST API services', { error });
    throw error;
  }
}

/**
 * Get initialized church service
 */
export function getChurchService(): ChurchService {
  if (!churchService) {
    throw new Error('Church service not initialized. Call initializeServices() first.');
  }
  return churchService;
}

/**
 * Get initialized project service
 */
export function getProjectService(): ProjectManagementService {
  if (!projectService) {
    throw new Error('Project service not initialized. Call initializeServices() first.');
  }
  return projectService;
}