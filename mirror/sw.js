if(!self.define){let e,i={};const n=(n,s)=>(n=new URL(n+".js",s).href,i[n]||new Promise((i=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=i,document.head.appendChild(e)}else e=n,importScripts(n),i()})).then((()=>{let e=i[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e})));self.define=(s,r)=>{const c=e||("document"in self?document.currentScript.src:"")||location.href;if(i[c])return;let o={};const t=e=>n(e,c),a={module:{uri:c},exports:o,require:t};i[c]=Promise.all(s.map((e=>a[e]||t(e)))).then((e=>(r(...e),o)))}}define(["./workbox-fa446783"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/index-7ca5b126.css",revision:null},{url:"assets/index-8202010d.js",revision:null},{url:"index.html",revision:"e5d3bc0b447ef80514dc5a6af9d05409"},{url:"registerSW.js",revision:"28f097fc9fb630c5035a5cadbca959de"},{url:"favicon.ico",revision:"acd3ad67a28ded14f48d5ed3aedab093"},{url:"apple-touch-icon.png",revision:"03c1a872bd3e0e461ac7e90792496686"},{url:"pwa-192x192.png",revision:"75c2348a8b447c722c81552ffce4a310"},{url:"pwa-512x512.png",revision:"c401fbeb22de2c836b27a460c6af87fc"},{url:"manifest.webmanifest",revision:"cd37af5a2a409e612fc6d1a2b68cba28"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));