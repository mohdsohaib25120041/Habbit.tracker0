/* Android app only (Capacitor): shows an AdMob banner to FREE users.
   On the website this file does nothing. Needs the plugin @capacitor-community/admob and
   GOALFORCE_CONFIG.admobBanner (your banner ad unit id) in config.js. */
(function () {
    const C = window.Capacitor, cfg = window.GOALFORCE_CONFIG || {};
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;
    const A = C.Plugins && C.Plugins.AdMob;
    if (!A || !cfg.admobBanner) return;
    let ready = false, shown = false, busy = false;
    // `cloud` and `isPremium` live in the main script (shared page scope, not on window)
    const want = () => !(typeof cloud !== 'undefined' && cloud.settings && cloud.settings.ads_enabled === false) && !(typeof isPremium === 'function' && isPremium());
    async function refresh() {
        if (busy) return; busy = true;
        try {
            if (!ready) { await A.initialize({ initializeForTesting: !!cfg.admobTesting }); ready = true; }
            if (want() && !shown) { await A.showBanner({ adId: cfg.admobBanner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 64, isTesting: !!cfg.admobTesting }); shown = true; }
            else if (!want() && shown) { await A.removeBanner(); shown = false; }
        } catch (e) { /* ads are optional: never break the app */ }
        busy = false;
    }
    window.nativeAdsRefresh = refresh;
    window.addEventListener('load', () => setTimeout(refresh, 1500));
})();
