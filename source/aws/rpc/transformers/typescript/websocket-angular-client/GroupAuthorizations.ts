import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { TokenHolder } from "./token-holder.service";
import { environment } from '../../environments/environment';

export class GuardBase implements CanActivate {
    constructor(public token: TokenHolder, public router: Router) {}
    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot){
        let canAccess = this.check();
        if(canAccess){
            console.log('Can Access!');
            return canAccess;
        }
        else {
            // in case of unauthenticated, go to OAuth2 url
            // try to get the access_token from the query string
            let fragment = route.fragment;
            console.log('fragment', fragment)
            let search = new URLSearchParams(fragment as string);
            if(search.has('access_token') && search.has('token_type') && search.has('expires_in')){
                search.forEach((value, key)=>{
                    console.log(`${key}:`, value);
                })
                console.log('id_token:', search.get('id_token'));
                // console.log('refresh_token:', search.get('refresh_token'));
                this.token.Access = search.get('access_token');
                this.token.Id = search.get('id_token');
                this.token.Type = search.get('token_type') as any;
                
                // this.token.Expires = Number(search.get('expires_in') as any) * 1000 + Date.now();
                this.token.JWTVerify();
                console.log('route.routeConfig?.path:', route.routeConfig?.path);

                let pathname = search.get('state');
                if(typeof pathname == 'string' && pathname.length > 0){
                    console.log('navigate by state:', pathname);
                    this.router.navigateByUrl(pathname);
                }
                else {
                    this.router.navigateByUrl(route.routeConfig?.path ? route.routeConfig.path : '');
                }
                return true;
            }
            else {
                console.log('host:', window.location.protocol, window.location.host, window.location.pathname);
                let loginUrl = `${environment.authUri}/oauth2/authorize?client_id=${environment.clientId}&response_type=token&redirect_uri=${window.location.protocol}//${window.location.host}&state=${encodeURIComponent(window.location.pathname)}`;
                console.log('loginUrl:', loginUrl);
                window.location.href = loginUrl;
                return false;
            }
        }
    }
    check = () => false;
}