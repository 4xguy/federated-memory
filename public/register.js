let currentMode = 'register';
let currentToken = '';

function switchTab(mode) {
    currentMode = mode;
    
    // Update tabs
    document.getElementById('registerTab').classList.toggle('active', mode === 'register');
    document.getElementById('loginTab').classList.toggle('active', mode === 'login');
    
    // Update form
    document.getElementById('nameGroup').style.display = mode === 'register' ? 'block' : 'none';
    document.getElementById('submitBtn').textContent = mode === 'register' ? 'Create Account' : 'Sign In';
    
    // Update email field requirement
    const emailField = document.getElementById('email');
    if (mode === 'login') {
        emailField.setAttribute('required', 'required');
    }
    
    // Clear messages
    document.getElementById('message').innerHTML = '';
    document.getElementById('tokenDisplay').style.display = 'none';
}

async function handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = document.getElementById('submitBtn');
    const messageDiv = document.getElementById('message');
    
    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = currentMode === 'register' ? 'Creating account...' : 'Signing in...';
    
    // Get form data
    const formData = {
        email: form.email.value,
        password: form.password.value
    };
    
    if (currentMode === 'register') {
        formData.name = form.name.value;
    }
    
    try {
        // Use BigMemory-style endpoints
        const endpoint = currentMode === 'register' ? 'register-email' : 'login';
        const response = await fetch(`${window.location.origin}/api/auth/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Success
            currentToken = data.user?.token || data.data?.token || data.token;
            messageDiv.innerHTML = `<div class="message success">${data.message || 'Success!'}</div>`;
            
            // Show token and MCP URL
            document.getElementById('tokenValue').textContent = currentToken;
            const mcpUrl = `${window.location.origin}/${currentToken}/sse`;
            document.getElementById('mcpUrlValue').textContent = mcpUrl;
            document.getElementById('tokenDisplay').style.display = 'block';
            
            // Clear form
            form.reset();
        } else {
            // Error
            messageDiv.innerHTML = `<div class="message error">${data.error || 'An error occurred'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="message error">Network error: ${error.message}</div>`;
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === 'register' ? 'Create Account' : 'Sign In';
    }
}

function copyToken() {
    navigator.clipboard.writeText(currentToken).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

function copyMcpUrl() {
    const mcpUrl = document.getElementById('mcpUrlValue').textContent;
    navigator.clipboard.writeText(mcpUrl).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

function oauthLogin(provider) {
    window.location.href = `${window.location.origin}/api/auth/${provider}`;
}

async function quickRegister() {
    const btn = document.getElementById('quickRegisterBtn');
    const messageDiv = document.getElementById('message');
    
    // Disable button
    btn.disabled = true;
    btn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${window.location.origin}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Success
            currentToken = data.data.token;
            messageDiv.innerHTML = `<div class="message success">MCP URL generated successfully!</div>`;
            
            // Show token and MCP URL
            document.getElementById('tokenValue').textContent = currentToken;
            const mcpUrl = `${window.location.origin}/${currentToken}/sse`;
            document.getElementById('mcpUrlValue').textContent = mcpUrl;
            document.getElementById('tokenDisplay').style.display = 'block';
            
            // Hide the form
            document.getElementById('authForm').style.display = 'none';
        } else {
            // Error
            messageDiv.innerHTML = `<div class="message error">${data.error || 'Failed to generate MCP URL'}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<div class="message error">Network error: ${error.message}</div>`;
    } finally {
        // Re-enable button
        btn.disabled = false;
        btn.textContent = 'Generate MCP URL without Email';
    }
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    document.getElementById('registerTab').addEventListener('click', () => switchTab('register'));
    document.getElementById('loginTab').addEventListener('click', () => switchTab('login'));
    
    // Form submission
    document.getElementById('authForm').addEventListener('submit', handleSubmit);
    
    // OAuth buttons
    document.getElementById('googleOAuthBtn').addEventListener('click', () => oauthLogin('google'));
    document.getElementById('githubOAuthBtn').addEventListener('click', () => oauthLogin('github'));
    
    // Copy token button
    document.getElementById('copyTokenBtn').addEventListener('click', copyToken);
    
    // Copy MCP URL button
    document.getElementById('copyMcpUrlBtn').addEventListener('click', copyMcpUrl);
    
    // Quick register button
    document.getElementById('quickRegisterBtn').addEventListener('click', quickRegister);
});