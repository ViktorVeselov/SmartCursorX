export function getNumericTaskId(conversationId: string): number {
    if (!conversationId) return 1;
    // Generate a stable 32-bit integer hash from the entire conversation ID string using DJB2
    let hash = 5381;
    for (let i = 0; i < conversationId.length; i++) {
        hash = (hash * 33) ^ conversationId.charCodeAt(i);
    }
    return Math.abs(hash) || 1;
}
