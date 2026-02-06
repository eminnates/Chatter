/**
 * 🚀 Performance Utilities for Chatter
 * Debounce, throttle, and performance helpers
 */

/**
 * Debounce - delays execution until after wait milliseconds have elapsed since the last call
 * Use for: typing indicators, search inputs, resize handlers
 */
export function debounce(fn, wait = 300) {
    let timeoutId = null;

    const debouncedFn = (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, wait);
    };

    debouncedFn.cancel = () => {
        if (timeoutId) clearTimeout(timeoutId);
    };

    return debouncedFn;
}

/**
 * Throttle - limits execution to at most once per wait milliseconds
 * Use for: scroll handlers, resize handlers, mousemove handlers
 */
export function throttle(fn, wait = 100) {
    let lastTime = 0;
    let timeoutId = null;

    return (...args) => {
        const now = Date.now();
        const remaining = wait - (now - lastTime);

        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastTime = now;
            fn.apply(this, args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastTime = Date.now();
                timeoutId = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * RequestAnimationFrame wrapper for smooth animations
 */
export function rafThrottle(fn) {
    let rafId = null;

    return (...args) => {
        if (rafId) return;

        rafId = requestAnimationFrame(() => {
            fn.apply(this, args);
            rafId = null;
        });
    };
}

/**
 * Memoize expensive function calls
 */
export function memoize(fn) {
    const cache = new Map();

    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);

        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
