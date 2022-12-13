Oidc.Log.logger = console;
Oidc.Log.level = Oidc.Log.DEBUG;

new Oidc.UserManager({response_mode:'query'}).signinCallback().catch(function(err){
    Oidc.Log.logger.error("error: " + err && err.message);
});
