import {IOptions} from "./IOptions";
import {Methods} from "./enums";
import {Tree} from "./tree";
import {Util} from "./util";
import {Params} from "./leaf";
import {Cache} from "rocket-lru";
import _= require( "lodash");


export class Router {


    private _forest: { [index: string]: Tree } = {};

    private _staticRoutes: { [index: string]: { [index: string]: any } } = {};
    private _cachedRoutes: { [index: string]: Cache<string, { params: Params, handler: any }> } = {};
    private _options: IOptions;
    private _useCache: boolean;

    public constructor(options?: IOptions) {

        this._options = _.extend({
            useCache: true,
            decodeUrlParams: false,
            maxCacheSize: 1000
        }, options || {});

        this._useCache = this._options.useCache;

        this.reset();
    }

    public reset() {
        Object.keys(Methods)
            .forEach(method => this._forest[method] = new Tree(this._options));

        Object.keys(Methods)
            .forEach(method => this._staticRoutes[method] = {});

        Object.keys(Methods)
            .forEach(method => this._cachedRoutes[method] = new Cache<string, { params: Params, handler: any }>({maxSize: this._options.maxCacheSize}));

    }

    public get(path: string, handler: any): this {
        return this.add(Methods.GET, path, handler);
    }

    public post(path: string, handler: any): this {
        return this.add(Methods.POST, path, handler);
    }

    public put(path: string, handler: any): this {
        return this.add(Methods.PUT, path, handler);
    }

    public patch(path: string, handler: any): this {
        return this.add(Methods.PATCH, path, handler);
    }

    public delete(path: string, handler: any): this {
        return this.add(Methods.DELETE, path, handler);
    }

    public head(path: string, handler: any): this {
        return this.add(Methods.HEAD, path, handler);
    }

    public add(method: keyof typeof Methods | (keyof typeof Methods)[], path: string, handler: any): this {

        path = Util.removeHeadSlash(path);

        this._add(method, path, handler);

        return this;
    }

    private _add(method: keyof typeof Methods | (keyof typeof Methods)[], path: string, handler: any): this {
        path = Util.removeTailSlash(path);

        let parts = path.split("/");

        let methods = _.isArray(method) ? method : [method];

        _.forEach(methods, method => {
            let tree = this._forest[method];

            let leaf = tree.add(parts);

            leaf.handler = handler;

            if (Util.isStaticRoute(path)) {
                this._staticRoutes[method][`/${path}`] = handler;
                this._staticRoutes[method][`/${path}/`] = handler;
            }
        });

        return this
    }

    public remove(method: keyof typeof Methods | (keyof typeof Methods)[], path: string) {
        path = Util.removeTailSlash(path);
        path = Util.removeHeadSlash(path);

        let methods = _.isArray(method) ? method : [method];

        let parts = path.split("/");

        _.forEach(methods, method => {

            let tree = this._forest[method];

            tree.remove(parts,0);

            if (Util.isStaticRoute(path)) {
                delete this._staticRoutes[method][`/${path}`];
                delete this._staticRoutes[method][`/${path}/`];
            }

            this._cachedRoutes[method].del(`/${path}`);
            this._cachedRoutes[method].del(`/${path}/`);
        });
    }

    public find(method: keyof typeof Methods, path: string): { params: Params, handler: any } {

        let staticRote = this._staticRoutes[method][path];

        if (staticRote) {
            return {handler: staticRote, params: {}}
        }

        if (this._useCache) {
            let cached = this._cachedRoutes[method].get(path);

            if (cached) {
                return {handler: cached.handler, params: cached.params}
            }
        }

        let parts = path.split("/");

        //remove "/"
        if (parts[parts.length - 1] == "") {
            parts.pop();
        }

        let tree = this._forest[method];

        let params = {};

        let found = tree.check(parts, 0, params);

        if (!found) {
            return null;
        }

        let dto = {params, handler: found.handler};

        this._cachedRoutes[method].set(path, dto);

        return dto;
    }

}