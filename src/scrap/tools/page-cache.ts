import fs from "fs";
import * as path from "path";

function btoa(s: string) {
    return Buffer.from(s).toString('base64');
}

class PageCache {
    cacheRoot: string;

    constructor(cacheRoot: string) {
        if (!fs.existsSync(cacheRoot)) {
            fs.mkdirSync(cacheRoot, {recursive: true});
        }
        this.cacheRoot = cacheRoot;
    }

    private static url2paths(u: string) {
        // "http://10.141.2.229:1001/index.html/"
        const [protocol, ...other] = u.split("://");
        // "http" "10.141.2.229:1001/index.html/"
        const [host, ...paths] = other.join("://").split("/");
        // "10.141.2.229:1001" "index.html" ""
        // "http://10.141.2.229:1001" "[index.html]" "<>"
        return [(protocol + "://" + host), ...(paths.map((p, pIndex) => {
            return pIndex === paths.length - 1 ? `<${p}>` : `[${p}]`;
        }))].map(s => btoa(s));
    }

    async getCachedPage(url: string): Promise<string | null> {
        const paths = PageCache.url2paths(url);
        const leadingPaths = paths.slice(0, paths.length - 1);
        const last = paths[paths.length - 1];
        const filePath = path.join(this.cacheRoot, ...leadingPaths, last);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        } else {
            return null;
        }
    }

    cachePage(url: string, content: string) {
        const paths = PageCache.url2paths(url);
        const leadingPaths = paths.slice(0, paths.length - 1);
        const last = paths[paths.length - 1];
        const dirPath = path.join(this.cacheRoot, ...leadingPaths);
        const filePath = path.join(dirPath, last);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, {recursive: true});
        }
        fs.writeFileSync(filePath, content, 'utf8');
        return content;
    }
}

export const pageCache = new PageCache("cache/page-cache");
