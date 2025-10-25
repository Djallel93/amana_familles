// ============================================
// OAUTH2 AUTHENTICATION
// ============================================
/**
 * Get OAuth2 service instance
 */
function getOAuthService() {
    return OAuth2.createService('GoogleForms')
        .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/v2/auth')
        .setTokenUrl('https://oauth2.googleapis.com/token')
        .setClientId(PropertiesService.getScriptProperties().getProperty("CLIENT_ID"))
        .setClientSecret(PropertiesService.getScriptProperties().getProperty("CLIENT_SECRET"))
        .setCallbackFunction('authCallback')
        .setPropertyStore(PropertiesService.getUserProperties())
        .setScope(CONFIG.OAUTH_CONFIG.SCOPES)
        .setParam('access_type', 'offline')
        .setParam('prompt', 'consent');
}
/**
 * Get valid access token
 */
function getOAuth2AccessToken() {
    const service = getOAuthService();
    if (!service.hasAccess()) {
        throw new Error('OAuth not authorized. Run getAuthorizationUrl() first.');
    }
    return service.getAccessToken();
}
/**
 * Get authorization URL (run once to authorize)
 */
function getAuthorizationUrl() {
    const service = getOAuthService();
    const authUrl = service.getAuthorizationUrl();
    console.log('Open this URL to authorize: ' + authUrl);
    return authUrl;
}
/**
 * OAuth callback handler
 */
function authCallback(request) {
    const service = getOAuthService();
    const authorized = service.handleCallback(request);
    if (authorized) {
        return HtmlService.createHtmlOutput('✅ Authorization successful! You can close this window.');
    } else {
        return HtmlService.createHtmlOutput('❌ Authorization denied.');
    }
}
/**
 * Refresh access token if needed
 */
function refreshAccessToken() {
    const service = getOAuthService();
    if (!service.hasAccess()) {
        throw new Error('OAuth not authorized.');
    }
    return service.getAccessToken(); // Automatically refreshes if expired
}
/**
 * Clear stored OAuth tokens
 */
function clearOAuthTokens() {
    const properties = PropertiesService.getScriptProperties();
    ['access_token', 'refresh_token', 'token_expiry', 'oauth_state'].forEach(key => {
        properties.deleteProperty(key);
    });
    console.log('OAuth tokens cleared');
}