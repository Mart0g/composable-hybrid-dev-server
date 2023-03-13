const express = require('express');
const {createProxyMiddleware, responseInterceptor} = require('http-proxy-middleware');
const {matchPath} = require('react-router');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const env = dotenv.config()
dotenvExpand.expand(env)

const PORT = process.env.PORT || 8001
const PROXY_ORIGIN = process.env.PROXY_ORIGIN;
const SFCC_ORIGIN = process.env.SFCC_ORIGIN;
const PWA_ORIGIN = process.env.PWA_ORIGIN;
const PWA_ROUTES = require('./routes');

const options = {
    target: SFCC_ORIGIN,
    secure: false,
    changeOrigin: true,
    autoRewrite: true,
    hostRewrite: true,
    cookieDomainRewrite: true,
    router: (req) => {
        const match = PWA_ROUTES.some((route) => {
            return matchPath(req.path, route);
        });

        if (match || req.path.startsWith('/mobify')) {
            return PWA_ORIGIN;
        }

        return SFCC_ORIGIN;
    },
    selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
        return responseInterceptor(async (responseBuffer) => {
            if (!proxyRes.headers['content-type']?.includes('html')) {
                return responseBuffer;
            }
            const response = responseBuffer.toString('utf8');

            // some links are absolute URLs, replace them so they go through the proxy
            let newRes = response.replace(new RegExp(`${SFCC_ORIGIN}`, 'g'), PROXY_ORIGIN);

            // replace any redirects to the SFCC origin with the proxy origin (for example: URLUtils.https)
            if (proxyRes.headers.location?.includes(SFCC_ORIGIN)) {
                console.log(`Rewriting location header => ${proxyRes.headers.location}`);
                res.setHeader('location', proxyRes.headers.location.replace(SFCC_ORIGIN, PROXY_ORIGIN));
            }

            return newRes;
        })(proxyRes, req, res);
    },
};

const app = express();

app.use(createProxyMiddleware(options));

app.listen(PORT, () => {
    console.log(`Proxy server listening: ${PROXY_ORIGIN}`);
});