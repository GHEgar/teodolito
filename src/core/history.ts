export interface Command {
    undo(): void;
    redo(): void;
}

export interface History {
    push(command: Command): void;
    undo(): boolean;
    redo(): boolean;
    clear(): void;
    canUndo(): boolean;
    canRedo(): boolean;
}

export function createHistory(limit = 100): History {
    const past: Command[] = [];
    let future: Command[] = [];
    return {
        push(command) {
            past.push(command);
            if (past.length > limit) past.shift();
            future = [];
        },
        undo() {
            const command = past.pop();
            if (!command) return false;
            command.undo();
            future.push(command);
            return true;
        },
        redo() {
            const command = future.pop();
            if (!command) return false;
            command.redo();
            past.push(command);
            return true;
        },
        clear() {
            past.length = 0;
            future = [];
        },
        canUndo: () => past.length > 0,
        canRedo: () => future.length > 0,
    };
}
