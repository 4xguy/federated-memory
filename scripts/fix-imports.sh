#!/bin/bash

# Fix imports in API files
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/api/mcp/authenticated-server.ts
sed -i "s|from '@/core/modules/registry.service'|from '../../core/modules/registry.service'|g" src/api/mcp/authenticated-server.ts

sed -i "s|from '@/core/modules/registry.service'|from '../../core/modules/registry.service'|g" src/api/rest/health.routes.ts
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/api/rest/health.routes.ts

sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/api/rest/memory.routes.ts

sed -i "s|from '@/core/modules/registry.service'|from '../../core/modules/registry.service'|g" src/api/rest/module.routes.ts

# Fix imports in module files
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/modules/work/WorkModule.ts
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/modules/creative/CreativeModule.ts
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/modules/personal/PersonalModule.ts
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/modules/communication/CommunicationModule.ts
sed -i "s|from '@/core/cmi/index.service'|from '../../core/cmi/index.service'|g" src/modules/learning/LearningModule.ts

echo "Fixed all imports to use relative paths"