if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/mirror/sw.js', { scope: '/mirror/' })})}