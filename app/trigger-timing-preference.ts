import { normalizeTriggerTiming } from '../engine/trigger-timing.mjs';
const key = 'underworld:trigger-timing:v1';
export function readTriggerTimingPreference() { try {
    return normalizeTriggerTiming(localStorage.getItem(key));
}
catch {
    return 'event';
} }
export function saveTriggerTimingPreference(value: string) { try {
    localStorage.setItem(key, normalizeTriggerTiming(value));
}
catch { } }
