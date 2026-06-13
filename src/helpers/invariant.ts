/**
 * NASA Power of 10 Rule #5: Use a minimum of two assertions per function
 *
 * This module provides runtime assertion utilities to enforce invariants,
 * preconditions, and postconditions throughout the codebase.
 *
 * NASA Power of 10 Rules (JPL Institutional Coding Standard):
 * Rule #5: The assertion density of the code should average a minimum of two
 * assertions per function. Assertions are used to check for anomalous conditions
 * that should never happen in real-life executions. Assertions must be side-effect-free.
 *
 * See: https://en.wikipedia.org/wiki/The_Power_of_10
 */

export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        if (process.env.NODE_ENV === 'production') {
            console.error(`Assertion failed: ${message}`);
            return;
        }
        throw new Error(`Assertion failed: ${message}`);
    }
}

export function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
    assert(value != null, `${name} must not be null or undefined`);
}

export function assertNonNull<T>(value: T | null, name: string): T {
    if (value === null) {
        if (process.env.NODE_ENV === 'production') {
            console.error(`Invariant violation: ${name} is null`);
            return undefined as unknown as T;
        }
        throw new Error(`${name} must not be null`);
    }
    return value;
}

export function checkReturn<T>(value: T | null | undefined, fallback: T, name: string): T {
    if (value == null) {
        console.warn(`[CheckReturn] ${name} returned null/undefined, using fallback`);
        return fallback;
    }
    return value;
}

export function checkArgs(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Invalid arguments: ${message}`);
    }
}
