/**
 * Centralized tools list for MCP server
 * This ensures both OAuth and token-based authentication get the same tools
 */

export function getToolsList() {
  return [
    // Core Memory Tools (1-7)
    {
      name: 'searchMemory',
      description: 'Search across federated memory modules',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for'
          },
          modules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific modules to search (optional)'
          },
          limit: {
            type: 'number',
            description: 'Maximum results (default: 10)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'storeMemory',
      description: 'Store information in federated memory',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The information to remember'
          },
          metadata: {
            type: 'object',
            description: 'Additional context or tags'
          }
        },
        required: ['content']
      }
    },
    {
      name: 'listModules',
      description: 'List available memory modules',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'getModuleStats',
      description: 'Get statistics for memory modules',
      inputSchema: {
        type: 'object',
        properties: {
          moduleId: {
            type: 'string',
            description: 'Module ID (optional, returns all if not specified)'
          }
        }
      }
    },
    {
      name: 'getMemory',
      description: 'Retrieve a specific memory by ID',
      inputSchema: {
        type: 'object',
        properties: {
          memoryId: {
            type: 'string',
            description: 'The ID of the memory to retrieve'
          }
        },
        required: ['memoryId']
      }
    },
    {
      name: 'updateMemory',
      description: 'Update an existing memory',
      inputSchema: {
        type: 'object',
        properties: {
          memoryId: {
            type: 'string',
            description: 'The ID of the memory to update'
          },
          content: {
            type: 'string',
            description: 'New content for the memory (optional)'
          },
          metadata: {
            type: 'object',
            description: 'New metadata for the memory (optional)'
          }
        },
        required: ['memoryId']
      }
    },
    {
      name: 'removeMemory',
      description: 'Remove a memory',
      inputSchema: {
        type: 'object',
        properties: {
          memoryId: {
            type: 'string',
            description: 'The ID of the memory to remove'
          }
        },
        required: ['memoryId']
      }
    },

    // Category Management Tools (8-9)
    {
      name: 'searchCategories',
      description: 'Search or list available memory categories',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (optional, returns all if empty)'
          }
        }
      }
    },
    {
      name: 'createCategory',
      description: 'Create a new memory category',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the category'
          },
          description: {
            type: 'string',
            description: 'Description of the category (optional)'
          },
          parentCategory: {
            type: 'string',
            description: 'Parent category name (optional)'
          },
          icon: {
            type: 'string',
            description: 'Emoji icon for the category (optional)'
          }
        },
        required: ['name']
      }
    },

    // Project Management Tools (10-18)
    {
      name: 'createProject',
      description: 'Create a new project',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name'
          },
          description: {
            type: 'string',
            description: 'Project description (optional)'
          },
          status: {
            type: 'string',
            enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
            description: 'Project status (default: planning)'
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description: 'Project due date (optional)'
          },
          owner: {
            type: 'string',
            description: 'Project owner (optional)'
          },
          team: {
            type: 'array',
            items: { type: 'string' },
            description: 'Team members (optional)'
          },
          ministry: {
            type: 'string',
            description: 'Ministry area (optional)'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'listProjects',
      description: 'List all projects with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by project status'
          },
          owner: {
            type: 'string',
            description: 'Filter by project owner'
          },
          ministry: {
            type: 'string',
            description: 'Filter by ministry area'
          },
          includeCompleted: {
            type: 'boolean',
            description: 'Include completed projects (default: false)'
          }
        }
      }
    },
    {
      name: 'getProjectTasks',
      description: 'Get all tasks for a specific project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'ID of the project'
          }
        },
        required: ['projectId']
      }
    },
    {
      name: 'createTask',
      description: 'Create a new task',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title'
          },
          description: {
            type: 'string',
            description: 'Task description (optional)'
          },
          projectId: {
            type: 'string',
            description: 'ID of the project this task belongs to (optional)'
          },
          assignee: {
            type: 'string',
            description: 'Person assigned to this task (optional)'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Task priority (default: medium)'
          },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'],
            description: 'Task status (default: todo)'
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description: 'Task due date (optional)'
          },
          ministry: {
            type: 'string',
            description: 'Ministry area (optional)'
          }
        },
        required: ['title']
      }
    },
    {
      name: 'updateTaskStatus',
      description: 'Update the status of an existing task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task to update'
          },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'],
            description: 'New task status'
          }
        },
        required: ['taskId', 'status']
      }
    },
    {
      name: 'linkTaskDependency',
      description: 'Create a dependency between two tasks',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the dependent task'
          },
          dependsOnTaskId: {
            type: 'string',
            description: 'ID of the task it depends on'
          },
          dependencyType: {
            type: 'string',
            enum: ['blocks', 'depends_on', 'related'],
            description: 'Type of dependency (default: depends_on)'
          }
        },
        required: ['taskId', 'dependsOnTaskId']
      }
    },
    {
      name: 'listTasks',
      description: 'List all tasks with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Filter by project ID'
          },
          assignee: {
            type: 'string',
            description: 'Filter by assignee'
          },
          status: {
            type: 'string',
            description: 'Filter by task status'
          },
          priority: {
            type: 'string',
            description: 'Filter by priority'
          },
          ministry: {
            type: 'string',
            description: 'Filter by ministry area'
          },
          includeCompleted: {
            type: 'boolean',
            description: 'Include completed tasks (default: false)'
          }
        }
      }
    },
    {
      name: 'getTaskDependencies',
      description: 'Get all dependencies for a specific task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID of the task'
          }
        },
        required: ['taskId']
      }
    },
    {
      name: 'createRecurringTask',
      description: 'Create a recurring task that generates instances based on a schedule',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title (will be used as template)'
          },
          description: {
            type: 'string',
            description: 'Task description template'
          },
          recurrence: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                enum: ['daily', 'weekly', 'monthly', 'custom'],
                description: 'Recurrence pattern'
              },
              interval: {
                type: 'number',
                description: 'Interval between occurrences'
              },
              daysOfWeek: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                },
                description: 'For weekly pattern, which days'
              },
              dayOfMonth: {
                type: 'number',
                description: 'For monthly pattern, which day (1-31)'
              },
              endDate: {
                type: 'string',
                format: 'date-time',
                description: 'When to stop creating tasks'
              }
            },
            required: ['pattern']
          },
          assignee: {
            type: 'string',
            description: 'Default assignee for generated tasks'
          },
          projectId: {
            type: 'string',
            description: 'ID of the project (optional)'
          },
          ministry: {
            type: 'string',
            description: 'Ministry area (optional)'
          }
        },
        required: ['title', 'recurrence']
      }
    },

    // Church Module Tools (19-36)
    // Person Management (1-6)
    {
      name: 'createPerson',
      description: 'Create a new person in the church database',
      inputSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          membershipStatus: {
            type: 'string',
            enum: ['visitor', 'regular', 'member'],
            description: 'Membership status'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for the person'
          },
          customFields: {
            type: 'object',
            description: 'Custom field values'
          }
        },
        required: ['firstName', 'lastName']
      }
    },
    {
      name: 'updatePerson',
      description: 'Update an existing person\'s information',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          updates: {
            type: 'object',
            description: 'Fields to update',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              membershipStatus: {
                type: 'string',
                enum: ['visitor', 'regular', 'member']
              },
              tags: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        },
        required: ['personId', 'updates']
      }
    },
    {
      name: 'getPerson',
      description: 'Retrieve a person by their ID',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' }
        },
        required: ['personId']
      }
    },
    {
      name: 'searchPeople',
      description: 'Search for people using natural language or filters',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          filters: {
            type: 'object',
            properties: {
              membershipStatus: {
                type: 'array',
                items: { type: 'string' }
              },
              hasEmail: { type: 'boolean' },
              hasPhone: { type: 'boolean' },
              tags: {
                type: 'array',
                items: { type: 'string' }
              },
              ministries: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          limit: { type: 'number', default: 20 }
        }
      }
    },
    {
      name: 'listPeople',
      description: 'List people with pagination and filters',
      inputSchema: {
        type: 'object',
        properties: {
          filters: {
            type: 'object',
            properties: {
              membershipStatus: {
                type: 'array',
                items: { type: 'string' }
              },
              tags: {
                type: 'array',
                items: { type: 'string' }
              },
              ministries: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          sortBy: {
            type: 'string',
            enum: ['name', 'created', 'updated'],
            default: 'name'
          },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      }
    },
    {
      name: 'mergePeople',
      description: 'Merge duplicate person records',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'ID of person to merge from' },
          targetId: { type: 'string', description: 'ID of person to merge into' }
        },
        required: ['sourceId', 'targetId']
      }
    },

    // Household Management (7-9)
    {
      name: 'createHousehold',
      description: 'Create a new household',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Household name' },
          address: {
            type: 'object',
            properties: {
              street1: { type: 'string' },
              street2: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' }
            }
          }
        },
        required: ['name']
      }
    },
    {
      name: 'updateHousehold',
      description: 'Update household information',
      inputSchema: {
        type: 'object',
        properties: {
          householdId: { type: 'string', description: 'Household ID' },
          updates: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: { type: 'object' },
              primaryContactId: { type: 'string' }
            }
          }
        },
        required: ['householdId', 'updates']
      }
    },
    {
      name: 'addPersonToHousehold',
      description: 'Add a person to a household',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          householdId: { type: 'string', description: 'Household ID' },
          role: {
            type: 'string',
            enum: ['head', 'spouse', 'child', 'other'],
            description: 'Role in household'
          }
        },
        required: ['personId', 'householdId']
      }
    },

    // Custom Fields & Tags (10-12)
    {
      name: 'defineCustomField',
      description: 'Create a new custom field definition',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Field name' },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'boolean', 'select', 'multiselect'],
            description: 'Field type'
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Options for select/multiselect fields'
          },
          category: { type: 'string', description: 'Field category' },
          required: { type: 'boolean', default: false }
        },
        required: ['name', 'type']
      }
    },
    {
      name: 'setPersonCustomField',
      description: 'Set a custom field value for a person',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          fieldKey: { type: 'string', description: 'Custom field key' },
          value: { description: 'Field value (type depends on field definition)' }
        },
        required: ['personId', 'fieldKey', 'value']
      }
    },
    {
      name: 'listCustomFields',
      description: 'List all custom fields for a specific module',
      inputSchema: {
        type: 'object',
        properties: {
          module: {
            type: 'string',
            enum: ['people', 'calendar', 'registrations', 'groups', 'giving', 'check-ins'],
            default: 'people',
            description: 'CRM module to list fields for'
          }
        }
      }
    },
    {
      name: 'tagPerson',
      description: 'Add, remove, or set tags for a person',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags to apply'
          },
          operation: {
            type: 'string',
            enum: ['add', 'remove', 'set'],
            default: 'set',
            description: 'How to apply tags'
          }
        },
        required: ['personId', 'tags']
      }
    },

    // Lists & Export (13-15)
    {
      name: 'createPeopleList',
      description: 'Create a saved list with filters',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'List name' },
          description: { type: 'string', description: 'List description' },
          filters: {
            type: 'object',
            description: 'Filters to apply to the list'
          }
        },
        required: ['name', 'filters']
      }
    },
    {
      name: 'exportPeopleData',
      description: 'Export people data in various formats',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['csv', 'json', 'xlsx'],
            description: 'Export format'
          },
          filters: {
            type: 'object',
            description: 'Filters to apply'
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to include in export'
          },
          includeCustomFields: { type: 'boolean', default: true }
        },
        required: ['format']
      }
    },
    {
      name: 'bulkUpdatePeople',
      description: 'Update multiple people at once',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['tag', 'untag', 'setField', 'setStatus'],
            description: 'Bulk operation type'
          },
          targetIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of people to update'
          },
          value: {
            description: 'Value to apply (depends on operation)'
          }
        },
        required: ['operation', 'targetIds']
      }
    },

    // Ministry & Attendance (16-18)
    {
      name: 'assignMinistryRole',
      description: 'Assign a person to a ministry with a specific role',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          ministryName: { type: 'string', description: 'Ministry name' },
          role: {
            type: 'string',
            enum: ['member', 'leader', 'volunteer'],
            description: 'Role in ministry'
          }
        },
        required: ['personId', 'ministryName']
      }
    },
    {
      name: 'listMinistryMembers',
      description: 'Get all people in a specific ministry',
      inputSchema: {
        type: 'object',
        properties: {
          ministryName: { type: 'string', description: 'Ministry name' }
        },
        required: ['ministryName']
      }
    },
    {
      name: 'trackAttendance',
      description: 'Record attendance for a person at an event',
      inputSchema: {
        type: 'object',
        properties: {
          personId: { type: 'string', description: 'Person ID' },
          eventType: {
            type: 'string',
            enum: ['service', 'smallGroup', 'event', 'meeting'],
            description: 'Type of event'
          },
          eventName: { type: 'string', description: 'Event name' },
          date: {
            type: 'string',
            format: 'date-time',
            description: 'Event date/time'
          },
          status: {
            type: 'string',
            enum: ['present', 'absent', 'late'],
            default: 'present'
          }
        },
        required: ['personId', 'eventType', 'date']
      }
    }
  ];
}