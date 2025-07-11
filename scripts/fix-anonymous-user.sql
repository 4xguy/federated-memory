-- Create anonymous user if it doesn't exist
INSERT INTO users (id, email, token)
VALUES ('anonymous', 'anonymous@system.local', 'system-anonymous-user')
ON CONFLICT (id) DO NOTHING;

-- Also create a test user
INSERT INTO users (id, email, token)
VALUES ('test-user', 'test@example.com', 'test-token')
ON CONFLICT (id) DO NOTHING;
EOF < /dev/null
