// Placeholder for ES6 modules
export const version = '1.0.0';

export const Logger = {
    log: (message) => {
        console.log(`[PixiDevice] ${message}`);
    },
    error: (message) => {
        console.error(`[PixiDevice] ERROR: ${message}`);
    }
};
